import React from 'react';

const FinishPage = ({ averageScore }) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        background: "linear-gradient(135deg, #e6f2ff 0%, #f0f8ff 50%, #ffffff 100%)",
        padding: "20px",
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          padding: "30px",
          borderRadius: "10px",
          boxShadow: "0 4px 10px rgba(0, 0, 0, 0.1)",
          textAlign: "center",
          width: "100%",
          maxWidth: "600px",
        }}
      >
        <h1 style={{ fontSize: "2rem", color: "#1f2937", marginBottom: "20px" }}>
          🎉 Congratulations!
        </h1>
        <p style={{ fontSize: "1.2rem", color: "#4b5563", marginBottom: "20px" }}>
          Thank you for participating in the experiment!
        </p>
        <p style={{ fontSize: "1.1rem", color: "#4b5563" }}>
          You can close the window now.
        </p>
      </div>
    </div>
  );
};

export default FinishPage;