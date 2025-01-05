import { useEffect } from "react";

const useCancelAnimation = (animationRef) => {
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        console.log("Animation frame canceled");
      }
    };
  }, [animationRef]);
};

export default useCancelAnimation;
