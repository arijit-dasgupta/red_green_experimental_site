import { useEffect } from "react";

const useUpdateKeyStates = (keyStates, setKeyStates) => {
  useEffect(() => {
    const handleKey = (isDown) => (e) => {
      // Support F for red and J for green (with caps lock support)
      const key = e.key.toLowerCase();
      const isF = key === "f" || e.keyCode === 70;
      const isJ = key === "j" || e.keyCode === 74;
      
      if (isF) {
        console.log(`Red key (F) ${isDown ? 'pressed' : 'released'}`);
        setKeyStates((prev) => ({ ...prev, f: isDown })); // Keep internal state as 'f' for compatibility
      } else if (isJ) {
        console.log(`Green key (J) ${isDown ? 'pressed' : 'released'}`);
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
