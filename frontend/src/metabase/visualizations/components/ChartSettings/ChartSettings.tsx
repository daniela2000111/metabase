import { assocIn } from "icepick";
import { useCallback, useEffect, useMemo, useState } from "react";
import { t } from "ttag";
import _ from "underscore";

import Radio from "metabase/core/components/Radio";
import CS from "metabase/css/core/index.css";
import {
  extractRemappings,
  getVisualizationTransformed,
} from "metabase/visualizations";
import { ChartSettingsFooter } from "metabase/visualizations/components/ChartSettings/ChartSettingsFooter";
import Visualization from "metabase/visualizations/components/Visualization";
import { updateSeriesColor } from "metabase/visualizations/lib/series";
import {
  getClickBehaviorSettings,
  getComputedSettings,
  getSettingsWidgets,
  updateSettings,
} from "metabase/visualizations/lib/settings";
import { getSettingDefinitionsForColumn } from "metabase/visualizations/lib/settings/column";
import { keyForSingleSeries } from "metabase/visualizations/lib/settings/series";
import { getSettingsWidgetsForSeries } from "metabase/visualizations/lib/settings/visualization";
import type Question from "metabase-lib/v1/Question";
import { getColumnKey } from "metabase-lib/v1/queries/utils/column-key";
import type { DatasetColumn, VisualizationSettings } from "metabase-types/api";

import ChartSettingsWidgetList from "../ChartSettingsWidgetList";
import ChartSettingsWidgetPopover from "../ChartSettingsWidgetPopover";

import {
  ChartSettingsListContainer,
  ChartSettingsMenu,
  ChartSettingsPreview,
  ChartSettingsRoot,
  ChartSettingsVisualizationContainer,
  SectionContainer,
  SectionWarnings,
} from "./ChartSettings.styled";
import type {
  type ChartSettingsProps,
  ChartSettingsWithStateProps,
  type SectionRadioProps,
  type UseChartSectionsProps,
  type UseChartSettingsStateProps,
  Widget,
  type WidgetListProps,
} from "./types";

// section names are localized
const DEFAULT_TAB_PRIORITY = [t`Data`];

const SectionRadio = ({
  currentSection,
  options,
  setCurrentWidget,
  setCurrentSection,
}: SectionRadioProps) => {
  const handleShowSection = useCallback(
    (section: string) => {
      setCurrentSection(section);
      // close any open widget.
      setCurrentWidget(null);
    },
    [setCurrentSection, setCurrentWidget],
  );

  return (
    <SectionContainer isDashboard={false}>
      <Radio
        value={currentSection ?? undefined}
        onChange={handleShowSection}
        options={options}
        optionNameFn={_.identity<string>}
        optionValueFn={_.identity<string>}
        optionKeyFn={_.identity<string>}
        variant="underlined"
      />
    </SectionContainer>
  );
};

const WidgetList = ({
  chartSettings,
  series,
  onChange,
  widgets,
  visibleWidgets,
  question,
  currentSectionHasColumnSettings,
  computedSettings: propComputedSettings,
  setCurrentWidget,
  transformedSeries,
  currentWidget,
}: WidgetListProps) => {
  const [popoverRef, setPopoverRef] = useState<HTMLElement | null>();

  const computedSettings = useMemo(
    () => propComputedSettings || {},
    [propComputedSettings],
  );

  // allows a widget to temporarily replace itself with a different widget
  const handleShowWidget = useCallback(
    (widget: Widget, ref: HTMLElement | null) => {
      setPopoverRef(ref);
      setCurrentWidget(widget);
    },
    [setCurrentWidget],
  );

  // go back to previously selected section
  const handleEndShowWidget = useCallback(() => {
    setPopoverRef(null);
    setCurrentWidget(null);
  }, [setCurrentWidget]);

  const styleWidget = useMemo(() => {
    const seriesSettingsWidget =
      currentWidget && widgets.find(widget => widget.id === "series_settings");

    const display = transformedSeries?.[0]?.card?.display;
    // In the pie the chart, clicking on the "measure" settings menu will only
    // open a formatting widget, and we don't want the style widget (used only
    // for dimension) to override that
    if (display === "pie" && currentWidget?.id === "column_settings") {
      return null;
    }

    //We don't want to show series settings widget for waterfall charts
    if (display === "waterfall" || !seriesSettingsWidget) {
      return null;
    }

    if (currentWidget.props?.seriesKey !== undefined) {
      return {
        ...seriesSettingsWidget,
        props: {
          ...seriesSettingsWidget.props,
          initialKey: currentWidget.props.seriesKey,
        },
      };
    } else if (currentWidget.props?.initialKey) {
      const hasBreakouts =
        computedSettings["graph.dimensions"] &&
        computedSettings["graph.dimensions"].length > 1;

      if (hasBreakouts) {
        return null;
      }

      const singleSeriesForColumn = transformedSeries.find(single => {
        const metricColumn = single.data.cols[1];
        if (metricColumn) {
          return (
            getColumnKey(metricColumn) === currentWidget?.props?.initialKey
          );
        }
      });

      if (singleSeriesForColumn) {
        return {
          ...seriesSettingsWidget,
          props: {
            ...seriesSettingsWidget.props,
            initialKey: keyForSingleSeries(singleSeriesForColumn),
          },
        };
      }
    }

    return null;
  }, [computedSettings, currentWidget, transformedSeries, widgets]);

  const formattingWidget = useMemo(() => {
    const widget =
      currentWidget && widgets.find(widget => widget.id === currentWidget.id);

    if (widget) {
      return { ...widget, props: { ...widget.props, ...currentWidget.props } };
    }

    return null;
  }, [currentWidget, widgets]);

  const columnHasSettings = useCallback(
    (col: DatasetColumn) => {
      const settings = chartSettings || {};
      const settingsDefs = getSettingDefinitionsForColumn(series, col);
      const getComputedSettingsResult = getComputedSettings(
        settingsDefs,
        col,
        settings,
      );

      return getSettingsWidgets(
        settingsDefs,
        settings,
        getComputedSettingsResult,
        col,
        _.noop,
        {
          series,
        },
      ).some(widget => !widget.hidden);
    },
    [chartSettings, series],
  );

  const handleChangeSeriesColor = useCallback(
    (seriesKey: string, color: string) => {
      onChange?.(updateSeriesColor(chartSettings, seriesKey, color));
    },
    [chartSettings, onChange],
  );

  return (
    <>
      <ChartSettingsListContainer className={CS.scrollShow}>
        <ChartSettingsWidgetList
          widgets={visibleWidgets}
          extraWidgetProps={{
            // NOTE: special props to support adding additional fields
            question,
            onShowWidget: handleShowWidget,
            onEndShowWidget: handleEndShowWidget,
            currentSectionHasColumnSettings,
            columnHasSettings,
            onChangeSeriesColor: handleChangeSeriesColor,
          }}
        />
        <ChartSettingsWidgetPopover
          anchor={popoverRef as HTMLElement}
          widgets={[styleWidget, formattingWidget].filter(
            (widget): widget is Widget => !!widget,
          )}
          handleEndShowWidget={handleEndShowWidget}
        />
      </ChartSettingsListContainer>
    </>
  );
};

const useChartSettingsState = ({
  settings,
  series,
  onChange,
  widgets: propWidgets,
  isDashboard,
  dashboard,
}: UseChartSettingsStateProps) => {
  const chartSettings = useMemo(
    () => settings || series[0].card.visualization_settings,
    [series, settings],
  );

  const chartSettingsRawSeries = useMemo(
    () => assocIn(series, [0, "card", "visualization_settings"], chartSettings),
    [chartSettings, series],
  );

  const transformedSeries = useMemo(() => {
    const { series: transformedSeries } = getVisualizationTransformed(
      extractRemappings(chartSettingsRawSeries),
    );
    return transformedSeries;
  }, [chartSettingsRawSeries]);

  const handleChangeSettings = useCallback(
    (changedSettings: VisualizationSettings, question?: Question) => {
      onChange?.(updateSettings(chartSettings, changedSettings), question);
    },
    [chartSettings, onChange],
  );

  const widgets = useMemo(
    () =>
      propWidgets ||
      getSettingsWidgetsForSeries(
        transformedSeries,
        handleChangeSettings,
        isDashboard,
        { dashboardId: dashboard?.id },
      ),
    [
      propWidgets,
      transformedSeries,
      handleChangeSettings,
      isDashboard,
      dashboard?.id,
    ],
  );

  return {
    chartSettings,
    chartSettingsRawSeries,
    transformedSeries,
    handleChangeSettings,
    widgets,
  };
};

const useChartSections = ({ initial, widgets }: UseChartSectionsProps) => {
  const [currentSection, setCurrentSection] = useState<string | null>(
    initial?.section ?? null,
  );

  const sections: Record<string, Widget[]> = useMemo(() => {
    const sectionObj: Record<string, Widget[]> = {};
    for (const widget of widgets) {
      if (widget.widget && !widget.hidden) {
        sectionObj[widget.section] = sectionObj[widget.section] || [];
        sectionObj[widget.section].push(widget);
      }
    }

    // Move settings from the "undefined" section in the first tab
    if (sectionObj["undefined"] && Object.values(sectionObj).length > 1) {
      const extra = sectionObj["undefined"];
      delete sectionObj["undefined"];
      Object.values(sectionObj)[0].unshift(...extra);
    }
    return sectionObj;
  }, [widgets]);

  const sectionNames = Object.keys(sections);

  // This sorts the section radio buttons.
  const sectionSortOrder = [
    "data",
    "display",
    "axes",
    // include all section names so any forgotten sections are sorted to the end
    ...sectionNames.map(x => x.toLowerCase()),
  ];
  sectionNames.sort((a, b) => {
    const [aIdx, bIdx] = [a, b].map(x =>
      sectionSortOrder.indexOf(x.toLowerCase()),
    );
    return aIdx - bIdx;
  });

  const chartSettingCurrentSection = useMemo(
    () =>
      currentSection && sections[currentSection]
        ? currentSection
        : _.find(DEFAULT_TAB_PRIORITY, name => name in sections) ||
          sectionNames[0],
    [currentSection, sectionNames, sections],
  );

  const visibleWidgets = sections[chartSettingCurrentSection] || [];

  const currentSectionHasColumnSettings = (
    sections[chartSettingCurrentSection] || []
  ).some((widget: Widget) => widget.id === "column_settings");

  const showSectionPicker =
    sectionNames.length > 1 &&
    !(
      visibleWidgets.length === 1 &&
      visibleWidgets[0].id === "column_settings" &&
      !currentSectionHasColumnSettings
    );

  return {
    sectionNames,
    chartSettingCurrentSection,
    visibleWidgets,
    currentSectionHasColumnSettings,
    showSectionPicker,
    currentSection,
    setCurrentSection,
    widgets,
  };
};

export const ChartSettings = ({
  initial,
  settings,
  series,
  computedSettings: propComputedSettings,
  onChange,
  isDashboard = false,
  dashboard,
  question,
  widgets: propWidgets,
}: ChartSettingsProps) => {
  const [currentWidget, setCurrentWidget] = useState<Widget | null>(
    initial?.widget ?? null,
  );

  const {
    chartSettings,
    transformedSeries,
    widgets: finalWidgetList,
  } = useChartSettingsState({
    settings,
    series,
    onChange,
    isDashboard,
    dashboard,
    widgets: propWidgets,
  });

  const {
    chartSettingCurrentSection,
    currentSectionHasColumnSettings,
    sectionNames,
    setCurrentSection,
    showSectionPicker,
    visibleWidgets,
  } = useChartSections({
    initial,
    widgets: finalWidgetList,
  });

  return (
    <ChartSettingsMenu data-testid="chartsettings-sidebar">
      {showSectionPicker && (
        <SectionRadio
          options={sectionNames}
          setCurrentWidget={setCurrentWidget}
          currentSection={chartSettingCurrentSection}
          setCurrentSection={setCurrentSection}
        />
      )}
      <WidgetList
        chartSettings={chartSettings}
        onChange={onChange}
        widgets={finalWidgetList}
        visibleWidgets={visibleWidgets}
        question={question}
        currentSectionHasColumnSettings={currentSectionHasColumnSettings}
        series={series}
        computedSettings={propComputedSettings}
        setCurrentWidget={setCurrentWidget}
        currentWidget={currentWidget}
        transformedSeries={transformedSeries}
      />
    </ChartSettingsMenu>
  );
};

export const ChartSettingsWithState = ({
  settings,
  onChange,
  series,
  isDashboard,
  dashboard,
  dashcard,
}: ChartSettingsWithStateProps) => {
  const [tempSettings, setTempSettings] = useState(settings);
  const [warnings, setWarnings] = useState();

  useEffect(() => {
    if (settings) {
      setTempSettings(settings);
    }
  }, [settings]);

  const { chartSettings, chartSettingsRawSeries, handleChangeSettings } =
    useChartSettingsState({
      settings: tempSettings,
      series,
      onChange: setTempSettings,
    });

  const onDone = useCallback(
    (settings: VisualizationSettings) => onChange?.(settings ?? tempSettings),
    [onChange, tempSettings],
  );

  const handleDone = useCallback(() => {
    onDone?.(chartSettings);
  }, [chartSettings, onDone]);

  const handleCancel = useCallback(() => {}, []);

  const handleResetSettings = useCallback(() => {
    const originalCardSettings = dashcard?.card.visualization_settings;
    const clickBehaviorSettings = getClickBehaviorSettings(chartSettings);

    setTempSettings({
      ...originalCardSettings,
      ...clickBehaviorSettings,
    });
  }, [chartSettings, dashcard?.card.visualization_settings]);

  const onResetToDefault =
    // resetting virtual cards wipes the text and broke the UI (metabase#14644)
    !_.isEqual(chartSettings, {}) && (chartSettings || {}).virtual_card == null
      ? handleResetSettings
      : null;

  return (
    <ChartSettingsRoot className={CS.spread}>
      <ChartSettings
        series={series}
        isDashboard={isDashboard ?? false}
        dashboard={dashboard}
        onChange={handleChangeSettings}
        settings={chartSettings}
      />
      <ChartSettingsPreview>
        <SectionWarnings warnings={warnings} size={20} />
        <ChartSettingsVisualizationContainer>
          <Visualization
            className={CS.spread}
            rawSeries={chartSettingsRawSeries}
            showTitle
            isEditing
            isDashboard
            dashboard={dashboard}
            dashcard={dashcard}
            isSettings
            showWarnings
            onUpdateVisualizationSettings={handleChangeSettings}
            onUpdateWarnings={setWarnings}
          />
        </ChartSettingsVisualizationContainer>
        <ChartSettingsFooter
          onDone={handleDone}
          onCancel={handleCancel}
          onReset={onResetToDefault}
        />
      </ChartSettingsPreview>
    </ChartSettingsRoot>
  );
};
