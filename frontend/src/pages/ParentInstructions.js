import React from 'react';
import { useNavigation } from '../contexts/NavigationContext';

const ParentInstructions = () => {
    const { navigate } = useNavigation();

    const handleNext = () => {
        navigate("child-assent-intro");
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
                fontSize: "2.5rem",
                color: "#333",
                marginBottom: "20px",
                fontWeight: "bold",
            }}>
                Instructions for Parents
            </h1>

            <div style={{
                fontSize: "1.2rem",
                color: "#555",
                maxWidth: "700px",
                lineHeight: "1.8",
                textAlign: "left",
                backgroundColor: "#ffffff",
                padding: "30px",
                borderRadius: "10px",
                boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                marginBottom: "30px",
            }}>
                <p style={{ marginBottom: "20px" }}>
                    Please follow these instructions to help ensure your child has the best experience:
                </p>

                <ol style={{ paddingLeft: "20px", marginBottom: "20px" }}>
                    <li style={{ marginBottom: "15px" }}>
                        <strong>Position your child:</strong> Position your child in front of the computer and have them face the camera.
                    </li>
                    <li style={{ marginBottom: "15px" }}>
                        <strong>Quiet environment:</strong> Place the computer in a quiet room and remove distracting objects, such as toys and food.
                    </li>
                    <li style={{ marginBottom: "15px" }}>
                        <strong>Help your child:</strong> Help your children to go through the experiment. At least for the first session, parents can leave their children to do their own experiment after a child has become comfortable with the task.
                    </li>
                </ol>
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

export default ParentInstructions;

