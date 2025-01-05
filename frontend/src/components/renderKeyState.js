import React from 'react';

const renderKeyState = (key, color, keyStates, canvasSize) => {
  if ((keyStates.f && keyStates.j) || (!keyStates.f && !keyStates.j)) {
    // Placeholder when both or neither keys are pressed
    return}
  // Active state for a single key
  return keyStates[key] && (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: `${canvasSize.width * 0.01}px`,
      }}
    >
      <div
        style={{
          width: `${canvasSize.width * 0.12}px`,
          height: `${canvasSize.width * 0.12}px`,
          backgroundColor: color,
          animation: "pulse-vibrate 0.75s infinite",
          boxShadow: `0 0 ${canvasSize.width * 0.08}px ${color}B3`,
          marginTop: `${canvasSize.width * 0.03}px`,
        }}
      />
      <span style={{ color, fontWeight: "bold" }}>
        {color.charAt(0).toUpperCase() + color.slice(1)}
      </span>
    </div>
  );
};


const renderEmptyKeyState = (keyStates, canvasSize) => {
  if ((keyStates.f && keyStates.j) || (!keyStates.f && !keyStates.j)) {
    // Placeholder when both or neither keys are pressed
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: `${canvasSize.width * 0.01}px`,
        }}
      >
        <div
          style={{
            width: `${canvasSize.width * 0.12}px`,
            height: `${canvasSize.width * 0.12}px`,
            animation: "pulse-vibrate 0.75s infinite",
            boxShadow: `0 0 ${canvasSize.width * 0.08}px ${"red"}B3`,
            marginTop: `${canvasSize.width * 0.03}px`,
          }}
        />
        <span style={{ fontWeight: "bold" }}>
         &nbsp;
        </span>
      </div>
    );
  };
};
export {renderKeyState, renderEmptyKeyState};