import { useEffect } from "react";

const useSyncKeyStatesRef = (keyStates, keyStatesRef) => {
  useEffect(() => {
    keyStatesRef.current = keyStates;
  }, [keyStates, keyStatesRef]);
};

export default useSyncKeyStatesRef;