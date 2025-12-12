import { useEffect } from "react";

const useUpdateKeyStates = (keyStates, setKeyStates) => {
  useEffect(() => {
    const handleKey = (isDown) => (e) => {
      // Updated for USB numpad gamepad: 2 = red (was F), 8 = green (was J)
      // Support both number keys (2, 8) and letter keys (F, J) with caps lock support
      const key = e.key.toLowerCase();
      const isF = key === "f" || e.keyCode === 70 || e.key === "2" || e.keyCode === 50;
      const isJ = key === "j" || e.keyCode === 74 || e.key === "8" || e.keyCode === 56;
      
      if (isF) {
        console.log(`Red key (2/F) ${isDown ? 'pressed' : 'released'}`);
        setKeyStates((prev) => ({ ...prev, f: isDown })); // Keep internal state as 'f' for compatibility
      } else if (isJ) {
        console.log(`Green key (8/J) ${isDown ? 'pressed' : 'released'}`);
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
