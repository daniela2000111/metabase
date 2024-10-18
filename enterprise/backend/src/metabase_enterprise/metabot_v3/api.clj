(ns metabase-enterprise.metabot-v3.api
  "`/api/ee/metabot-v3/` routes"
  (:require
   [compojure.core :refer [POST]]
   [metabase-enterprise.metabot-v3.client :as metabot-v3.client]
   [metabase-enterprise.metabot-v3.context :as metabot-v3.context]
   [metabase-enterprise.metabot-v3.handle-response :as metabot-v3.handle-response]
   [metabase-enterprise.metabot-v3.reactions :as metabot-v3.reactions]
   [metabase.api.common :as api]
   [metabase.util.malli :as mu]
   [metabase.util.malli.registry :as mr]
   [metabase.util.malli.schema :as ms]))

(mr/def ::response
  "Shape of the response for the backend agent endpoint."
  [:map
   [:history    [:maybe #_::metabot-v3.client/history :any]]
   [:sequential ::metabot-v3.reactions/reaction]])

;; todo: define the ::metabot-v3.client/history schema
(mu/defn- request :- ::response
  [message :- :string
   context :- ::metabot-v3.context/context
   history :- [:maybe #_::metabot-v3.client/history :any]]
  (let [response (metabot-v3.client/*request* message context history)
        message  (:message response)]
    {:reactions (metabot-v3.handle-response/handle-response-message message)
     :history   (conj (vec history) message)}))

(api/defendpoint POST "/agent"
  "Send a chat message to the LLM via the AI Proxy."
  [:as {{:keys [message context history] :as _body} :body}]
  {message ms/NonBlankString
   context [:map-of :keyword :any]
   history [:maybe [:sequential :map]]}
  (request message context history))

(api/define-routes)
