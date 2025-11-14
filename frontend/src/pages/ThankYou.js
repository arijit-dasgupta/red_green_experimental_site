import React from 'react';

const ThankYouPage = () => {
    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            height: "100vh",
            backgroundColor: "#f9f9f9",
            padding: "20px",
            textAlign: "center",
        }}>
            <h1 style={{
                fontSize: "3rem",
                color: "#333",
                marginBottom: "20px",
                fontWeight: "bold",
            }}>
                Thank you for your time! 🙏
            </h1>
            <p style={{
                fontSize: "1.5rem",
                color: "#555",
                maxWidth: "600px",
                lineHeight: "1.6",
            }}>
                We appreciate you taking the time to consider participating in our experiment.
            </p>
        </div>
    );
};

export default ThankYouPage;

