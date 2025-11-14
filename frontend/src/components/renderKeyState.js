import React from 'react';

// Calculate scaling factor to keep keystate components at reasonable size
// Base size is 400px - scale down if canvas is larger
const getScaleFactor = (canvasSize) => {
  const baseSize = 400;
  const maxCanvasDim = Math.max(canvasSize.width, canvasSize.height);
  return Math.min(1, baseSize / maxCanvasDim);
};

const renderKeyState = (key, textureRef, keyStates, canvasSize) => {
  if ((keyStates.f && keyStates.j) || (!keyStates.f && !keyStates.j)) {
    // Placeholder when both or neither keys are pressed
    return null;
  }
  // Active state for a single key
  const scaleFactor = getScaleFactor(canvasSize);
  const size = `${Math.max(canvasSize.width * 0.12 * scaleFactor, 60)}px`;
  
  return keyStates[key] && (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: `${canvasSize.width * 0.01 * scaleFactor}px`,
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "8px",
          overflow: "hidden",
          animation: "subtle-pulse 1.5s ease-in-out infinite",
          boxShadow: `0 0 ${Math.max(canvasSize.width * 0.02 * scaleFactor, 4)}px rgba(0, 0, 0, 0.2)`,
          marginTop: `${canvasSize.width * 0.03 * scaleFactor}px`,
          border: "2px solid rgba(255, 255, 255, 0.8)",
          backgroundColor: "#f0f0f0",
          position: "relative",
        }}
      >
        {textureRef && textureRef.current && textureRef.current.complete ? (
          <img
            src={textureRef.current.src}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : (
          <div style={{
            width: "100%",
            height: "100%",
            backgroundColor: "#ccc",
          }} />
        )}
      </div>
    </div>
  );
};


const renderEmptyKeyState = (keyStates, canvasSize) => {
  if ((keyStates.f && keyStates.j) || (!keyStates.f && !keyStates.j)) {
    // Placeholder when both or neither keys are pressed
    const scaleFactor = getScaleFactor(canvasSize);
    const size = `${Math.max(canvasSize.width * 0.12 * scaleFactor, 60)}px`;
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: `${canvasSize.width * 0.01 * scaleFactor}px`,
        }}
      >
        <div
          style={{
            width: size,
            height: size,
            borderRadius: "8px",
            boxShadow: `0 0 ${Math.max(canvasSize.width * 0.02 * scaleFactor, 4)}px rgba(0, 0, 0, 0.1)`,
            marginTop: `${canvasSize.width * 0.03 * scaleFactor}px`,
            backgroundColor: "#e0e0e0",
            border: "2px dashed #999",
          }}
        />
      </div>
    );
  }
  return null;
};
export {renderKeyState, renderEmptyKeyState};