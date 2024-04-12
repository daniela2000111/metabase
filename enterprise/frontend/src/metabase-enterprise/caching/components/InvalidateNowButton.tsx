import {
  IconInButton,
  LoaderInDarkButton,
} from "metabase/admin/performance/components/StrategyForm.styled";
import { isErrorWithMessage } from "metabase/admin/performance/strategies";
import { Form, FormProvider } from "metabase/forms";
import { color } from "metabase/lib/colors";
import { useDispatch } from "metabase/lib/redux";
import { addUndo } from "metabase/redux/undo";
import { CacheConfigApi } from "metabase/services";
import { Group, Text, Tooltip } from "metabase/ui";

import { StyledInvalidateNowButton } from "./InvalidateNowButton.styled";

const delay = (milliseconds: number) =>
  new Promise(resolve => setTimeout(resolve, milliseconds));

export const InvalidateNowButton = ({ targetId }: { targetId: number }) => {
  const dispatch = useDispatch();
  const invalidateTargetDatabase = async () => {
    try {
      const invalidate = CacheConfigApi.invalidate(
        { include: "overrides", database: targetId },
        { hasBody: false },
      );
      // To prevent UI jumpiness, ensure a minimum delay before showing the success/failure message
      await Promise.all([delay(300), invalidate]);
    } catch (e) {
      if (isErrorWithMessage(e)) {
        dispatch(
          addUndo({
            icon: "warning",
            message: e.data.message,
            toastColor: "error",
            dismissIconColor: "white",
          }),
        );
      }
      throw e;
    }
  };

  return (
    <FormProvider initialValues={{}} onSubmit={invalidateTargetDatabase}>
      <Form>
        <Tooltip
          events={{ hover: true, focus: true, touch: true }}
          label="Invalidate cache right now"
          position="bottom"
        >
          <StyledInvalidateNowButton
            label={
              <Group spacing="sm">
                <IconInButton color={color("danger")} name="trash" />
                <Text>Invalidate cache now</Text>
              </Group>
            }
            activeLabel={<LoaderInDarkButton size="1rem" />}
            successLabel={<IconInButton name="check" color="white" />}
            failedLabel={
              <Text fw="bold" lh="1" color="white">
                Error
              </Text>
            }
          />
        </Tooltip>
      </Form>
    </FormProvider>
  );
};
