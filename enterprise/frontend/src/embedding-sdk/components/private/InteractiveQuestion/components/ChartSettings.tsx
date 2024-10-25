import { useMemo } from "react";

import {
  type InteractiveQuestionContextType,
  useInteractiveQuestionContext,
} from "embedding-sdk/components/private/InteractiveQuestion/context";
import { withPublicComponentWrapper } from "embedding-sdk/components/private/PublicComponentWrapper";
import { ChartSettings as CoreChartSettings } from "metabase/visualizations/components/ChartSettings";
import type Question from "metabase-lib/v1/Question";

export const ChartSettingsInner = ({
  question,
  queryResults,
  updateQuestion,
}: {
  question: Question;
  queryResults?: any[];
  updateQuestion: InteractiveQuestionContextType["updateQuestion"];
}) => {
  const card = question.card();
  const result = useMemo(() => queryResults?.[0] ?? {}, [queryResults]);

  const series = useMemo(() => {
    return [
      {
        ...result,
        card,
      },
    ];
  }, [card, result]);

  return (
    <CoreChartSettings
      question={question}
      series={series}
      onChange={async settings => {
        await updateQuestion(question.updateSettings(settings).lockDisplay());
      }}
    />
  );
};

export const ChartSettings = withPublicComponentWrapper(() => {
  const { question, queryResults, updateQuestion } =
    useInteractiveQuestionContext();

  if (!question) {
    return null;
  }

  return (
    <ChartSettingsInner
      question={question}
      queryResults={queryResults}
      updateQuestion={updateQuestion}
    />
  );
});
