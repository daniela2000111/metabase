(ns metabase-enterprise.metabot-v3.repl
  "Basic user message => AI Proxy => response chat flow. This namespace implements a text-based REPL you can use from
  Clojure or the CLI with

    clj -X:ee:metabot-v3/repl"
  (:require
   [clojure.string :as str]
   [metabase-enterprise.metabot-v3.client :as metabot-v3.client]
   [metabase-enterprise.metabot-v3.handle-response :as metabot-v3.handle-response]
   [metabase-enterprise.metabot-v3.reactions :as metabot-v3.reactions]
   [metabase.db :as mdb]
   [metabase.util :as u]
   [metabase.util.malli :as mu]))

(set! *warn-on-reflection* true)

(defmulti ^:private handle-reaction
  {:arglists '([reaction])}
  :type)

(defmethod handle-reaction :metabot.reaction/message
  [{:keys [message], repl-emoji :repl/emoji, repl-message-color :repl/message-color, :as _reaction}]
  (let [message (cond->> message
                  repl-emoji         (str repl-emoji " ")
                  repl-message-color (u/colorize repl-message-color))]
    #_{:clj-kondo/ignore [:discouraged-var]}
    (println message)))

(defmethod handle-reaction :default
  [reaction]
  #_{:clj-kondo/ignore [:discouraged-var]}
  (println (u/format-color :magenta "<REACTION>\n%s" (u/pprint-to-str reaction))))

(mu/defn- handle-reactions
  [reactions :- [:sequential ::metabot-v3.reactions/reaction]]
  (doseq [reaction reactions]
    (handle-reaction reaction)))

(defn user-repl
  "REPL for interacting with MetaBot."
  ([]
   (user-repl []))

  ([history]
   (when-let [input (try
                      #_{:clj-kondo/ignore [:discouraged-var]}
                      (print "\n> ")
                      (flush)
                      (read-line)
                      (catch Throwable _))]
     #_{:clj-kondo/ignore [:discouraged-var]}
     (println "🗨 " (u/colorize :blue input))
     (when (and (not (#{"quit" "exit" "bye" "goodbye" "\\q"} input))
                (not (str/blank? input)))
       (let [context  {}
             response (metabot-v3.client/*request* input context history)]
         (-> response
             :message
             metabot-v3.handle-response/handle-response-message
             handle-reactions)
         (recur (concat history (:new-history response))))))))

(defn user-repl-cli
  "CLI entrypoint for using the MetaBot REPL.

    clj -X:ee:metabot-v3/repl"
  [_options]
  (mdb/setup-db! :create-sample-content? false)
  #_{:clj-kondo/ignore [:discouraged-var]}
  (println "Starting MetaBot REPL... 🤖")
  (user-repl)
  (System/exit 0))
