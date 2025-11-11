import React from 'react';

// Calculate scaling factor to keep keystate components at reasonable size
// Base size is 400px - scale down if canvas is larger
const getScaleFactor = (canvasSize) => {
  const baseSize = 400;
  const maxCanvasDim = Math.max(canvasSize.width, canvasSize.height);
  return Math.min(1, baseSize / maxCanvasDim);
};

const renderKeyState = (key, color, keyStates, canvasSize) => {
  if ((keyStates.f && keyStates.j) || (!keyStates.f && !keyStates.j)) {
    // Placeholder when both or neither keys are pressed
    return null;
  }
  // Active state for a single key
  const scaleFactor = getScaleFactor(canvasSize);
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
          width: `${canvasSize.width * 0.12 * scaleFactor}px`,
          height: `${canvasSize.width * 0.12 * scaleFactor}px`,
          backgroundColor: color,
          animation: "pulse-vibrate 0.75s infinite",
          boxShadow: `0 0 ${canvasSize.width * 0.08 * scaleFactor}px ${color}B3`,
          marginTop: `${canvasSize.width * 0.03 * scaleFactor}px`,
        }}
      />
      <span style={{ color, fontWeight: "bold", fontSize: `${Math.max(14 * scaleFactor, 16)}px` }}>
        {color.charAt(0).toUpperCase() + color.slice(1)}
      </span>
    </div>
  );
};


const renderEmptyKeyState = (keyStates, canvasSize) => {
  if ((keyStates.f && keyStates.j) || (!keyStates.f && !keyStates.j)) {
    // Placeholder when both or neither keys are pressed
    const scaleFactor = getScaleFactor(canvasSize);
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
            width: `${canvasSize.width * 0.12 * scaleFactor}px`,
            height: `${canvasSize.width * 0.12 * scaleFactor}px`,
            animation: "pulse-vibrate 0.75s infinite",
            boxShadow: `0 0 ${canvasSize.width * 0.08 * scaleFactor}px ${"red"}B3`,
            marginTop: `${canvasSize.width * 0.03 * scaleFactor}px`,
          }}
        />
        <span style={{ fontWeight: "bold" }}>
         &nbsp;
        </span>
      </div>
    );
  }
  return null;
};
export {renderKeyState, renderEmptyKeyState};