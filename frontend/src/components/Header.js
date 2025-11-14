import React from 'react';

const Header = ({ sessionId }) => {
  return (
    <div
      style={{
        position: "absolute",
        top: "10px",
        left: "10px",
        backgroundColor: "rgba(255, 255, 255, 0.15)", // Very translucent
        padding: "5px 10px",
        borderRadius: "5px",
        fontSize: "12px",
        fontWeight: "normal",
        color: "rgba(0, 0, 0, 0.4)", // Very light text color
        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
        zIndex: 1000,
      }}
    >
      Session ID: {sessionId || sessionStorage.getItem("sessionId") || "Not set"}
    </div>
  );
};

export default Header;