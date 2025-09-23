import { useEffect } from "react";

const useUpdateKeyStates = (keyStates, setKeyStates) => {
  useEffect(() => {
    const handleKey = (isDown) => (e) => {
      if (e.key === "f" || e.key === "F" || e.key === "j" || e.key === "J") {
        setKeyStates((prev) => ({ ...prev, [e.key.toLowerCase()]: isDown }));
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
