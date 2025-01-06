import React from 'react';

// TODO: URL FOR PROLIFIC

const FinishPage = ({ averageScore }) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      height: "100vh",
      backgroundColor: "#f1f5f9",
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
        Thank you for participating in the experiment. Your average score is:
      </p>
      <div
        style={{
          fontSize: "2rem",
          color: "#007bff",
          fontWeight: "bold",
          marginBottom: "30px",
        }}
      >
        {averageScore !== null ? averageScore.toFixed(2) : "Calculating..."}
      </div>

      {/* Score Progress Bar */}
      <div style={{ width: "100%", margin: "20px 0" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "10px",
            fontSize: "0.9rem",
            color: "#6b7280",
          }}
        >
          <span>-80</span>
          <span>120</span>
        </div>
        <div
          style={{
            height: "30px",
            backgroundColor: "#e5e7eb",
            borderRadius: "15px",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              width: `${((averageScore + 80) / 200) * 100}%`,
              height: "100%",
              backgroundColor: (() => {
                const normalizedScore = (averageScore + 80) / 200;
                if (normalizedScore <= 1 / 3) {
                  return "#f87171"; // Red
                } else if (normalizedScore <= 2 / 3) {
                  return "#facc15"; // Yellow
                } else {
                  return "#34d399"; // Green
                }
              })(),
              transition: "width 0.5s ease-in-out, background-color 0.5s ease-in-out",
            }}
          />
        </div>
      </div>

      <p style={{ fontSize: "1rem", color: "#4b5563", marginBottom: "20px" }}>
        Click the link below to complete your participation on Prolific.
      </p>
      <a
        href="https://app.prolific.com/submissions/complete?cc=CJ6KMWB1"
        style={{
          display: "inline-block",
          textDecoration: "none",
          padding: "10px 20px",
          fontSize: "1rem",
          color: "white",
          backgroundColor: "#007bff",
          borderRadius: "5px",
          boxShadow: "0 2px 5px rgba(0, 0, 0, 0.2)",
          transition: "background-color 0.3s ease",
        }}
        onMouseOver={(e) => (e.target.style.backgroundColor = "#0056b3")}
        onMouseOut={(e) => (e.target.style.backgroundColor = "#007bff")}
      >
        Complete the Study
      </a>
    </div>
  </div>
);

export default FinishPage;