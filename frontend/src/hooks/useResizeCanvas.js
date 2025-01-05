import { useEffect, useCallback } from 'react';

const useResizeCanvas = (sceneData, setCanvasSize, renderFrame, currentFrameRef, CANVAS_PROPORTION, isPlaying) => {
  const handleResize = useCallback(() => {
    if (sceneData) {
      const worldWidth = sceneData.worldWidth || 20;
      const worldHeight = sceneData.worldHeight || 20;

      const newCanvasSize = {
        width: Math.floor((window.innerHeight * CANVAS_PROPORTION) / worldWidth) * worldWidth,
        height: Math.floor((window.innerHeight * CANVAS_PROPORTION) / worldHeight) * worldHeight,
      };

      setCanvasSize((prevSize) => {
        if (
          prevSize.width !== newCanvasSize.width ||
          prevSize.height !== newCanvasSize.height
        ) {
          return newCanvasSize;
        }
        return prevSize;
      });

      if (isPlaying) {
        renderFrame(currentFrameRef.current);
      }
    }
  }, [sceneData, setCanvasSize, renderFrame, currentFrameRef, CANVAS_PROPORTION, isPlaying]);

  useEffect(() => {
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [handleResize]); // Only listens to the `resize` event
};

export default useResizeCanvas;