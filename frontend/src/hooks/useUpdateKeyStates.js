import { useEffect } from "react";

const useUpdateKeyStates = (keyStates, setKeyStates) => {
  useEffect(() => {
    const handleKey = (isDown) => (e) => {
      // Handle both lowercase and uppercase, and also check keyCode for compatibility
      if (e.key === "f" || e.key === "F" || e.keyCode === 70) {
        console.log(`F key ${isDown ? 'pressed' : 'released'}`);
        setKeyStates((prev) => ({ ...prev, f: isDown }));
      } else if (e.key === "j" || e.key === "J" || e.keyCode === 74) {
        console.log(`J key ${isDown ? 'pressed' : 'released'}`);
        setKeyStates((prev) => ({ ...prev, j: isDown }));
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
