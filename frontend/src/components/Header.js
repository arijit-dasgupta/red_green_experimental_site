import React from 'react';

const Header = ({ sessionId }) => {
  return (
    <div
      style={{
        position: "absolute",
        top: "10px",
        left: "10px",
        backgroundColor: "rgba(255, 255, 255, 0.8)",
        padding: "5px 10px",
        borderRadius: "5px",
        fontSize: "14px",
        fontWeight: "bold",
        boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
        zIndex: 1000,
      }}
    >
      Session ID: {sessionId || sessionStorage.getItem("sessionId") || "Not set"}
    </div>
  );
};

export default Header;