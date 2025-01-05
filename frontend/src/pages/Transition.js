import React from 'react';

const TransitionPage = ({ trialInfo, fetchNextScene, setdisableCountdownTrigger }) => {
    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                height: "100vh",
                backgroundColor: "#ffffff",
                padding: "20px",
                boxSizing: "border-box",
                textAlign: "center",
            }}
        >
            <div
                style={{
                    backgroundColor: "#f9f9f9",
                    borderRadius: "10px",
                    padding: "30px",
                    maxWidth: "600px",
                    boxShadow: "0 4px 10px rgba(0, 0, 0, 0.1)",
                }}
            >
                <h1
                    style={{
                        fontSize: "2.5rem",
                        color: "#333",
                        marginBottom: "20px",
                        fontWeight: "bold",
                    }}
                >
                    Familiarization Complete
                </h1>
                <p
                    style={{
                        fontSize: "1.2rem",
                        color: "#666",
                        marginBottom: "20px",
                        lineHeight: "1.6",
                    }}
                >
                    Congratulations! You have completed all{" "}
                    <strong style={{ color: "#007bff" }}>{trialInfo.num_ftrials}</strong>{" "}
                    familiarization trials.
                </p>
                <p
                    style={{
                        fontSize: "1.2rem",
                        color: "#666",
                        marginBottom: "30px",
                        lineHeight: "1.6",
                    }}
                >
                    Press <strong style={{ color: "#007bff" }}>Next</strong> to begin the main experiment, 
                    which consists of <strong style={{ color: "#28a745" }}>{trialInfo.num_trials}</strong> trials. All the best!
                </p>
                <button
                    onClick={() => fetchNextScene(setdisableCountdownTrigger)}
                    style={{
                        padding: "15px 30px",
                        fontSize: "1.2rem",
                        color: "white",
                        backgroundColor: "#007bff",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                        boxShadow: "0 2px 5px rgba(0, 0, 0, 0.2)",
                        transition: "background-color 0.3s ease, transform 0.2s ease",
                    }}
                    onMouseOver={(e) => (e.target.style.backgroundColor = "#0056b3")}
                    onMouseOut={(e) => (e.target.style.backgroundColor = "#007bff")}
                    onMouseDown={(e) => (e.target.style.transform = "scale(0.95)")}
                    onMouseUp={(e) => (e.target.style.transform = "scale(1)")}
                >
                    Next
                </button>
            </div>
        </div>
    );
};

export default TransitionPage;
