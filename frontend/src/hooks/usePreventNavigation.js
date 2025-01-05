import { useEffect } from "react";

const usePreventNavigation = (shouldPrevent) => {
  useEffect(() => {
    if (!shouldPrevent) return;

    const preventNavigation = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };

    const preventBackButton = () => {
      window.history.pushState(null, null, window.location.href);
    };

    window.history.pushState(null, null, window.location.href);
    window.addEventListener('popstate', preventBackButton);
    window.addEventListener('beforeunload', preventNavigation);

    return () => {
      window.removeEventListener('popstate', preventBackButton);
      window.removeEventListener('beforeunload', preventNavigation);
    };
  }, [shouldPrevent]);
};

export default usePreventNavigation;