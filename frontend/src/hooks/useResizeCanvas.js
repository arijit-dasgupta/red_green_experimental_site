import { useEffect, useCallback } from 'react';

const useResizeCanvas = (sceneData, setCanvasSize, renderFrame, currentFrameRef, CANVAS_PROPORTION, isPlaying, MAX_CANVAS_SIZE) => {
  const handleResize = useCallback(() => {
    if (sceneData) {
      const worldWidth = sceneData.worldWidth || 20;
      const worldHeight = sceneData.worldHeight || 20;

      // Calculate canvas size based on world dimensions with max size constraint
      // Multipliers: 20, 10, or 5 (multiples of 5)
      const maxWorldDim = Math.max(worldWidth, worldHeight);
      
      let multiplier = 20;
      if (maxWorldDim > 20) {
        multiplier = 10;
      }
      if (maxWorldDim * multiplier > MAX_CANVAS_SIZE) {
        multiplier = 5;
      }
      
      const canvasWidth = worldWidth * multiplier;
      const canvasHeight = worldHeight * multiplier;
      
      const newCanvasSize = {
        width: Math.min(canvasWidth, MAX_CANVAS_SIZE),
        height: Math.min(canvasHeight, MAX_CANVAS_SIZE),
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
  }, [sceneData, setCanvasSize, renderFrame, currentFrameRef, CANVAS_PROPORTION, isPlaying, MAX_CANVAS_SIZE]);

  useEffect(() => {
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [handleResize]); // Only listens to the `resize` event
};

export default useResizeCanvas;