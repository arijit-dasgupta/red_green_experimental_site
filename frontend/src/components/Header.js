import React from 'react';

const Header = () => {
  const prolificPid = sessionStorage.getItem("prolific_pid") || 
    new URLSearchParams(window.location.search).get("PROLIFIC_PID") || 
    "default_pid";

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
      Prolific PID: {prolificPid}
    </div>
  );
};

export default Header;