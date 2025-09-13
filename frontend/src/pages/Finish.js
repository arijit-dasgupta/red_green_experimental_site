import React from 'react';
import { useNavigation } from '../contexts/NavigationContext';

// TODO: URL FOR PROLIFIC

const FinishPage = ({ averageScore }) => {
  const { navigate } = useNavigation();

  const handleCompleteStudy = () => {
    navigate('welcome');
  };

  return (
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
        Thank you for participating in the experiment!
      </p>
      <button
        onClick={handleCompleteStudy}
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
          border: "none",
          cursor: "pointer",
        }}
        onMouseOver={(e) => (e.target.style.backgroundColor = "#0056b3")}
        onMouseOut={(e) => (e.target.style.backgroundColor = "#007bff")}
      >
        Return to Welcome Page
      </button>
    </div>
  </div>
  );
};

export default FinishPage;