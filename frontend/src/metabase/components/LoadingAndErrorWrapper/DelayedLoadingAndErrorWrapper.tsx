import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import type { LoadingAndErrorWrapperProps } from "metabase/components/LoadingAndErrorWrapper/types";
import { Transition } from "metabase/ui";

import LoadingAndErrorWrapper from "./LoadingAndErrorWrapper";

/**
 * A loading/error display component that waits a bit before appearing
 * @see https://metaboat.slack.com/archives/C02H619CJ8K/p1709558533499399
 */
export const DelayedLoadingAndErrorWrapper = ({
  error,
  loading,
  delay = 300,
  blankComponent = null,
  children,
  ...props
}: {
  delay?: number;
  /** This is shown during the delay if `loading` is true */
  blankComponent?: ReactNode;
} & LoadingAndErrorWrapperProps) => {
  const [showWrapper, setShowWrapper] = useState(false);

  props.loadingMessages ??= [];

  useEffect(() => {
    const timeout = setTimeout(() => {
      setShowWrapper(true);
    }, delay);
    return () => clearTimeout(timeout);
  }, [delay]);

  if (!loading && !error) {
    return <>{children}</>;
  }
  if (!showWrapper) {
    return <>{blankComponent}</>;
  }
  return (
    <Transition
      mounted={!!(error || loading)}
      transition="fade"
      duration={200}
      timingFunction="ease"
    >
      {styles => (
        <div style={styles}>
          <LoadingAndErrorWrapper error={error} loading={loading} {...props}>
            {children}
          </LoadingAndErrorWrapper>
        </div>
      )}
    </Transition>
  );
};
