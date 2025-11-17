import React from 'react';
import { useNavigation } from '../contexts/NavigationContext';

const ChildAssentIntro = () => {
    const { navigate } = useNavigation();

    const handleNext = () => {
        navigate("child-assent");
    };

    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "100vh",
            background: "linear-gradient(135deg, #e6f2ff 0%, #f0f8ff 50%, #ffffff 100%)",
            padding: "20px",
            textAlign: "center",
        }}>
            <h1 style={{
                fontSize: "3rem",
                color: "#2C6EB5",
                marginBottom: "30px",
                fontWeight: "bold",
            }}>
                Child Assent
            </h1>

            <div style={{
                fontSize: "1.3rem",
                color: "#555",
                maxWidth: "700px",
                lineHeight: "1.8",
                textAlign: "center",
                backgroundColor: "#ffffff",
                padding: "40px",
                borderRadius: "10px",
                boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                marginBottom: "30px",
            }}>
                <p>
                    Now it's time to bring your child here. On the next page, your child will hear a paragraph describing what they will be doing in the study and asks for their assent.
                </p>
            </div>

            <button
                onClick={handleNext}
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
    );
};

export default ChildAssentIntro;

