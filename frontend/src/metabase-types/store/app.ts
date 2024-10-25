import type { CollectionId } from "metabase-types/api/collection";

export interface AppErrorDescriptor {
  status: number;
  data?: {
    error_code: string;
    message?: string;
  };
  context?: string;
}

export interface AppBreadCrumbs {
  collectionId: CollectionId;
  show: boolean;
}

/**
 * Storage for non-critical, ephemeral user preferences.
 * Think of it as a sessionStorage alternative implemented in Redux.
 * Only specific key/value pairs can be stored here,
 * and then later used with the `use-temp-storage` hook.
 */
// eslint-disable-next-line @typescript-eslint/ban-types
export type TempStorage = {};

export type TempStorageKey = keyof TempStorage;
export type TempStorageValue<Key extends TempStorageKey = TempStorageKey> =
  TempStorage[Key];

export interface AppState {
  errorPage: AppErrorDescriptor | null;
  isNavbarOpen: boolean;
  isDndAvailable: boolean;
  isErrorDiagnosticsOpen: boolean;
  tempStorage: TempStorage;
}
