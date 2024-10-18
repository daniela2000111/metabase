(ns metabase-enterprise.metabot-v3.api
  "`/api/ee/metabot-v3/` routes"
  (:require
   [compojure.core :refer [POST]]
   [malli.core :as mc]
   [malli.transform :as mtx]
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
   [:history    [:maybe ::metabot-v3.client/history]]
   [:sequential ::metabot-v3.reactions/reaction]])

(defn- encode-reactions [reactions]
  (mc/encode [:sequential ::metabot-v3.reactions/reaction]
             reactions
             (mtx/transformer {:name :api-response})))

(mu/defn- request :- ::response
  [message :- :string
   context :- ::metabot-v3.context/context
   history :- [:maybe ::metabot-v3.client/history]]
  (let [response (metabot-v3.client/*request* message context history)
        message  (:message response)]
    {:reactions (encode-reactions (metabot-v3.handle-response/handle-response-message message))
     :history   (conj (vec history) message)}))

(api/defendpoint POST "/agent"
  "Send a chat message to the LLM via the AI Proxy."
  [:as {{:keys [message context history] :as _body} :body}]
  {message ms/NonBlankString
   context [:map-of :keyword :any]
   history [:maybe [:sequential :map]]}
  (request message context history))

(api/define-routes)
