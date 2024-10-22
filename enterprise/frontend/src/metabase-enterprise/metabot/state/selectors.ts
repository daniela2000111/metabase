import { createSelector } from "@reduxjs/toolkit";
import _ from "underscore";

import type { MetabotStoreState } from "./types";

export const getMetabot = (state: MetabotStoreState) =>
  state.plugins.metabotPlugin;

export const getMetabotVisisble = createSelector(
  getMetabot,
  metabot => metabot.visible,
);
