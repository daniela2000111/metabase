(ns metabase.pulse.send
  "Code related to sending Pulses (Alerts or Dashboard Subscriptions)."
  (:require
   [metabase.models.dashboard :as dashboard :refer [Dashboard]]
   [metabase.models.database :refer [Database]]
   [metabase.models.interface :as mi]
   [metabase.models.pulse :as models.pulse :refer [Pulse]]
   [metabase.query-processor.timezone :as qp.timezone]
   [metabase.util.log :as log]
   [metabase.util.malli :as mu]
   [metabase.util.malli.schema :as ms]
   [toucan2.core :as t2]))

(set! *warn-on-reflection* true)

(defn- database-id [card]
  (or (:database_id card)
      (get-in card [:dataset_query :database])))

(mu/defn defaulted-timezone :- :string
  "Returns the timezone ID for the given `card`. Either the report timezone (if applicable) or the JVM timezone."
  [card :- (ms/InstanceOf :model/Card)]
  (or (some->> card database-id (t2/select-one Database :id) qp.timezone/results-timezone-id)
      (qp.timezone/system-timezone-id)))

;;; +----------------------------------------------------------------------------------------------------------------+
;;; |                                         Creating Notifications To Send                                         |
;;; +----------------------------------------------------------------------------------------------------------------+

(defn- alert-or-pulse [pulse]
  (if (:dashboard_id pulse)
    :pulse
    :alert))

(defn- channel-recipients
  [pulse-channel]
  (case (keyword (:channel_type pulse-channel))
    :slack
    [(get-in pulse-channel [:details :channel])]
    :email
    (for [recipient (:recipients pulse-channel)]
      (if-not (:id recipient)
        {:kind :external-email
         :email (:email recipient)}
        {:kind :user
         :user recipient}))
    :http
    []
    (do
      (log/warnf "Unknown channel type %s" (:channel_type pulse-channel))
      [])))

(defn- pc->channel
  "Given a pulse channel, return the channel object.

  Only supports HTTP channels for now, returns a map with type key for slack and email"
  [{channel-type :channel_type :as pulse-channel}]
  (if (= :http (keyword channel-type))
    (t2/select-one :model/Channel :id (:channel_id pulse-channel))
    {:type (keyword "channel" (name channel-type))}))

(defn- get-template
  [channel-type payload-type]
  (case [channel-type payload-type]
    [:channel/email :notification/dashboard-subscription]
    {:channel_type :channel/email
     :details      {:type    :email/mustache-resource
                    :subject "{{payload.dashboard.name}}"
                    :path    "metabase/email/dashboard_subscription_new"}}

    [:channel/email :notification/alert]
    {:channel_type :channel/email
     :details      {:type    :email/mustache-resource
                    :subject "{{computed.subject}}"
                    :path    "metabase/email/alert"}}
    nil))

(defn- get-notification-handler
  [pulse-channel payload-type]
  (let [channel-type (-> pulse-channel pc->channel :type)]
    {:channel_type channel-type
     :template     (get-template channel-type payload-type)
     :recipients   (channel-recipients pulse-channel)}))

(defn- notification-info
  [pulse dashboard pulse-channel]
  (if (= :pulse (alert-or-pulse pulse))
    {:payload_type           :notification/dashboard-subscription
     :creator_id             (:creator_id pulse)
     :dashboard_subscription {:dashboard_id  (:id dashboard)
                              :parameters    (:parameters pulse)
                              :skip_if_empty (:skip_if_empty pulse)}
     :handlers               [(get-notification-handler pulse-channel :notification/dashboard-subscription)]}
    {:payload_type :notification/alert
     :card_id      (some :id (:cards pulse))
     :alert        (assoc (select-keys pulse [:id :alert_condition :alert_above_goal])
                          :schedule (select-keys pulse-channel [:schedule_type :schedule_hour :schedule_day :schedule_frame]))
     :handlers     [(get-notification-handler pulse-channel :notification/alert)]
     :creator_id   (:creator_id pulse)}))

(defn- send-pulse!*
  [{:keys [channels channel-ids] :as pulse} dashboard]
  (let [;; `channel-ids` is the set of channels to send to now, so only send to those. Note the whole set of channels
        channels   (if (seq channel-ids)
                     (filter #((set channel-ids) (:id %)) channels)
                     channels)]
    (doseq [pulse-channel channels]
      (try
        ((requiring-resolve 'metabase.notification.core/*send-notification!*) (notification-info pulse dashboard pulse-channel))
        (catch Exception e
          (log/errorf e "[Pulse %d] Error sending to %s channel" (:id pulse) (:channel_type pulse-channel)))))
    nil))

(defn send-pulse!
  "Execute and Send a `Pulse`, optionally specifying the specific `PulseChannels`.  This includes running each
   `PulseCard`, formatting the content, and sending the content to any specified destination.

  `channel-ids` is the set of channel IDs to send to *now* -- this may be a subset of the full set of channels for
  the Pulse.

   Example:

    (send-pulse! pulse)                    ; Send to all Channels
    (send-pulse! pulse :channel-ids [312]) ; Send only to Channel with :id = 312"
  [{:keys [dashboard_id], :as pulse} & {:keys [channel-ids]}]
  {:pre [(map? pulse) (integer? (:creator_id pulse))]}
  (let [dashboard (t2/select-one Dashboard :id dashboard_id)
        pulse     (-> (mi/instance Pulse pulse)
                      ;; This is usually already done by this step, in the `send-pulses` task which uses `retrieve-pulse`
                      ;; to fetch the Pulse.
                      models.pulse/hydrate-notification
                      (merge (when channel-ids {:channel-ids channel-ids})))]
    (when (not (:archived dashboard))
      (send-pulse!* pulse dashboard))))

#_(ngoc/with-tc
    (mapv send-pulse! (t2/select :model/Pulse 8)))

#_(t2/select-one :model/Pulse :dashboard_id 12 :archived false)
