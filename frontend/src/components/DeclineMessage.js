import React from 'react';

const DeclineMessage = () => {
    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            height: "100vh",
            background: "linear-gradient(135deg, #e6f2ff 0%, #f0f8ff 50%, #ffffff 100%)",
            padding: "20px",
            textAlign: "center",
        }}>
            <div style={{
                fontSize: "1.5rem",
                color: "#333",
                maxWidth: "700px",
                lineHeight: "1.6",
                backgroundColor: "#ffffff",
                padding: "40px",
                borderRadius: "10px",
                boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)"
            }}>
                <p style={{
                    fontSize: "1.8rem",
                    fontWeight: "bold",
                    color: "#dc3545",
                    marginBottom: "20px"
                }}>
                    You chose not to participate in the study.
                </p>
                <p style={{
                    fontSize: "1.2rem",
                    color: "#555",
                }}>
                    You can close the window now.
                </p>
            </div>
        </div>
    );
};

export default DeclineMessage;

