import { useEffect } from "react";

const useUpdateKeyStates = (keyStates, setKeyStates) => {
  useEffect(() => {
    const handleKey = (isDown) => (e) => {
      // Updated for USB numpad gamepad: 2 = red (was F), 8 = green (was J)
      if (e.key === "2" || e.keyCode === 50 || e.key === "f" || e.key === "F" || e.keyCode === 70) {
        console.log(`Red key (2) ${isDown ? 'pressed' : 'released'}`);
        setKeyStates((prev) => ({ ...prev, f: isDown })); // Keep internal state as 'f' for compatibility
      } else if (e.key === "8" || e.keyCode === 56 || e.key === "j" || e.key === "J" || e.keyCode === 74) {
        console.log(`Green key (8) ${isDown ? 'pressed' : 'released'}`);
        setKeyStates((prev) => ({ ...prev, j: isDown })); // Keep internal state as 'j' for compatibility
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
