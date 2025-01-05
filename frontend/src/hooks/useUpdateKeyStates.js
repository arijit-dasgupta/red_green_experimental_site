import { useEffect } from "react";

const useUpdateKeyStates = (keyStates, setKeyStates) => {
  useEffect(() => {
    const handleKey = (isDown) => (e) => {
      if (e.key === "f" || e.key === "j") {
        setKeyStates((prev) => ({ ...prev, [e.key]: isDown }));
      }
    };

    window.addEventListener("keydown", handleKey(true));
    window.addEventListener("keyup", handleKey(false));

    return () => {
      window.removeEventListener("keydown", handleKey(true));
      window.removeEventListener("keyup", handleKey(false));
    };
  }, [setKeyStates]);
};

export default useUpdateKeyStates;
