import { assocIn, dissocIn, updateIn } from "icepick";
import { t } from "ttag";

import { CardApi } from "metabase/services";
import Collections from "metabase/entities/collections";

import type { Dispatch, GetState, State } from "metabase-types/store";
import type { CollectionId } from "metabase-types/api";
import type { FileUploadState } from "metabase-types/store/upload";

import {
  createAction,
  createThunkAction,
  handleActions,
} from "metabase/lib/redux";

export const UPLOAD_FILE_TO_COLLECTION = "metabase/collection/UPLOAD_FILE";
const UPLOAD_FILE_TO_COLLECTION_START = "metabase/collection/UPLOAD_FILE_START";
const UPLOAD_FILE_TO_COLLECTION_END = "metabase/collection/UPLOAD_FILE_END";
const UPLOAD_FILE_TO_COLLECTION_ERROR = "metabase/collection/UPLOAD_FILE_ERROR";
const UPLOAD_FILE_TO_COLLECTION_CLEAR = "metabase/collection/UPLOAD_FILE_CLEAR";

const MAX_UPLOAD_SIZE = 200 * 1024 * 1024; // 200MB
const MAX_UPLOAD_STRING = "200MB";

const CLEAR_AFTER_MS = 5000;

const uploadStart = createAction(UPLOAD_FILE_TO_COLLECTION_START);
const uploadEnd = createAction(UPLOAD_FILE_TO_COLLECTION_END);
const uploadError = createAction(UPLOAD_FILE_TO_COLLECTION_ERROR);
const clearUpload = createAction(UPLOAD_FILE_TO_COLLECTION_CLEAR);

export const getAllUploads = (state: State) =>
  Object.keys(state.upload).map(key => state.upload[key]);

export const uploadFile = createThunkAction(
  UPLOAD_FILE_TO_COLLECTION,
  (file: File, collectionId: CollectionId) =>
    async (dispatch: Dispatch, getState: GetState) => {
      const id = Date.now();

      const clear = () =>
        setTimeout(() => {
          dispatch(clearUpload({ id }));
        }, CLEAR_AFTER_MS);

      dispatch(
        uploadStart({
          id,
          name: file.name,
          collectionId,
        }),
      );

      if (file.size > MAX_UPLOAD_SIZE) {
        dispatch(
          uploadError({
            id,
            message: t`You cannot upload files larger than ${MAX_UPLOAD_STRING}`,
          }),
        );
        clear();
        return;
      }

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("collection_id", String(collectionId));
        const response = await CardApi.uploadCSV(formData);

        dispatch(
          uploadEnd({
            id,
            modelId: response.model_id,
          }),
        );

        dispatch(Collections.actions.invalidateLists());
      } catch (err: any) {
        dispatch(
          uploadError({
            id,
            message:
              err?.data?.message ?? t`There was an error uploading the file`,
          }),
        );
      } finally {
        clear();
      }
    },
);

interface UploadStartPayload {
  id: number;
  name: string;
  collectionId: string;
}

interface UploadEndPayload {
  id: number;
}

const upload = handleActions<
  FileUploadState,
  UploadStartPayload | UploadEndPayload
>(
  {
    [UPLOAD_FILE_TO_COLLECTION_START]: {
      next: (state, { payload }) =>
        assocIn(state, [payload.id], {
          ...payload,
          status: "in-progress",
        }),
    },
    [UPLOAD_FILE_TO_COLLECTION_END]: {
      next: (state, { payload }) =>
        updateIn(state, [payload.id], val => ({
          ...val,
          ...payload,
          status: "complete",
        })),
    },
    [UPLOAD_FILE_TO_COLLECTION_ERROR]: {
      next: (state, { payload }) =>
        updateIn(state, [payload.id], val => ({
          ...val,
          ...payload,
          status: "error",
        })),
    },
    [UPLOAD_FILE_TO_COLLECTION_CLEAR]: {
      next: (state, { payload: { id } }) => dissocIn(state, [id]),
    },
  },
  {},
);

export default upload;
