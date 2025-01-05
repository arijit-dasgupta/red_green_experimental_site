import React, { useState } from 'react';
import { useNavigation } from '../contexts/NavigationContext';
import renderKeyState from '../components/renderKeyState';


const InstructionsPage = ({ trialInfo, keyStates, canvasSize }) => {

    const { navigate } = useNavigation(); // Use the navigation context
    const [currentInstructionPage, setcurrentInstructionPage] = useState(1);

    const handleNext = () => {
        if (currentInstructionPage === 1) setcurrentInstructionPage(2);
        else navigate("experiment");
    };

    const handleBack = () => {
        if (currentInstructionPage === 2) setcurrentInstructionPage(1);
    };

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                minHeight: "100vh",
                backgroundColor: "#f9f9f9",
                padding: "5px",
                boxSizing: "border-box",
                overflowY: "auto",
            }}
        >
            {currentInstructionPage === 1 && (
                <div
                    style={{
                        width: "100%",
                        maxWidth: "1400px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        height: "100vh", // Full viewport height
                        padding: "5px",
                        boxSizing: "border-box",
                    }}
                >
                    {/* Title and Description */}
                    <h1 style={{ textAlign: "center", fontSize: "2rem", marginBottom: "10px" }}>
                        Instructions (1/2)
                    </h1>
                    <p style={{ textAlign: "center", fontSize: "1.2rem", marginBottom: "20px" }}>
                        In this experiment, you will observe a blue circular object moving in a 2D Physical World.
                    </p>

                    {/* Grid for Images and Captions */}
                    <div
                        style={{
                            display: "grid",
                            gridTemplateRows: "1fr 1fr", // Two rows of equal height
                            gridTemplateColumns: "2fr 1fr", // Two columns of equal width
                            gap: "5px",
                            flexGrow: 1, // Ensures this section takes up available space
                            width: "100%",
                            maxWidth: "1200px", // Restrict maximum width for readability
                        }}
                    >
                        {/* First Image */}
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                textAlign: "center",
                            }}
                        >
                            <img
                                src="/instruc1.png"
                                alt="Example 1"
                                style={{
                                    width: "60%",
                                    maxWidth: "90%", // Prevents it from overflowing
                                    height: "auto",
                                    objectFit: "contain",
                                    marginBottom: "10px",
                                }}
                            />
                            <p style={{ fontSize: "1rem", color: "#555" }}>
                                This is an example of the environment setup with a blue object.
                            </p>
                        </div>

                        {/* Second GIF */}
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                textAlign: "center",
                            }}
                        >
                            <img
                                src="/instruc2.gif"
                                alt="Example 2"
                                style={{
                                    width: "70%",
                                    maxWidth: "90%", // Adjust size flexibly
                                    height: "auto",
                                    objectFit: "contain",
                                    marginBottom: "10px",
                                }}
                            />
                            <p style={{ fontSize: "1rem", color: "#555" }}>
                                The blue object moves with correct <b>frictionless</b> and <b>elastic</b> physical motion & can bounce off walls and barriers.
                            </p>
                        </div>

                        {/* Third Image */}
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                textAlign: "center",
                            }}
                        >
                            <img
                                src="/instruc3.png"
                                alt="Example 3"
                                style={{
                                    width: "60%",
                                    maxWidth: "90%", // Adjust size flexibly
                                    height: "auto",
                                    objectFit: "contain",
                                    marginBottom: "10px",
                                }}
                            />
                            <p style={{ fontSize: "1rem", color: "#555" }}>
                                The occluder never hides any part of the static environment (barriers, green and red regions).
                            </p>
                        </div>

                        {/* Fourth GIF */}
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                textAlign: "center",
                            }}
                        >
                            <img
                                src="/instruc4.gif"
                                alt="Example 4"
                                style={{
                                    width: "70%",
                                    maxWidth: "90%", // Adjust size flexibly
                                    height: "auto",
                                    objectFit: "contain",
                                    marginBottom: "10px",
                                }}
                            />
                            <p style={{ fontSize: "1rem", color: "#555" }}>
                                Occluders can <b>only</b> hide parts of the object’s movement.
                            </p>
                        </div>
                    </div>

                    {/* Next Button */}
                    <div style={{ textAlign: "center", marginTop: "20px" }}>
                        <button
                            onClick={handleNext}
                            style={{
                                padding: "15px 30px",
                                fontSize: "1rem",
                                color: "white",
                                backgroundColor: "#007bff",
                                border: "none",
                                borderRadius: "5px",
                                cursor: "pointer",
                            }}
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}

            {currentInstructionPage === 2 && (
                <div style={{ width: "100%", maxWidth: "800px", position: "relative" }}>
                    <h1 style={{ textAlign: "center", fontSize: "2rem", marginBottom: "20px" }}>
                        Instructions (2/2)
                    </h1>
                    <p style={{ textAlign: "justify", fontSize: "1.2rem", marginBottom: "20px" }}>
                        In this experiment, you will watch the object in motion, and <b>continuously</b> predict whether the blue object will land on the <span style={{ color: "red" }}>red</span> or <span style={{ color: "green" }}>green</span> region by pressing the corresponding keys:
                        <span style={{ color: "red" }}><strong> "F" for Red</strong></span> and <span style={{ color: "green" }}><strong>"J" for Green</strong></span> as the object motion happens in real-time. If you are uncertain, you may avoid pressing any button. <u>If you press both keys simultaneously, your input will be ignored.</u>
                    </p>
                    <p style={{ textAlign: "justify", fontSize: "1.2rem", marginBottom: "20px" }}>
                        Before starting the experiment, you will go through <b>{trialInfo.num_ftrials}</b> familiarization trials to get comfortable with the task.
                        These trials will not affect your final score. Afterward, you will complete <b>{trialInfo.num_trials}</b> experimental trials,
                        and your performance will determine your final score.
                    </p>
                    <p style={{ textAlign: "justify", fontSize: "1.2rem", marginBottom: "20px" }}>
                        Your score is calculated as follows:
                    </p>
                    <div
                        style={{
                            backgroundColor: "#f1f1f1",
                            padding: "20px",
                            borderRadius: "10px",
                            marginBottom: "20px",
                            textAlign: "center",
                        }}
                    >
                        <p style={{ fontSize: "1.2rem" }}>
                            <strong>Score = </strong>20 + 100 × (
                            <span style={{ color: "red" }}>Correct Percentage</span> - <span style={{ color: "green" }}>Wrong Percentage</span>
                            )
                        </p>
                    </div>
                    <p style={{ textAlign: "justify", fontSize: "1.2rem", marginBottom: "20px" }}>
                        A correct guess increases your score significantly, while a wrong guess reduces it. If you are uncertain, pressing a random button would most likely lower your score, as an incorrect guess incurs a penalty. However, making a correct guess will improve your score more than remaining uncertain. <u>It is okay for your guess to change throughout the course of the object's motion.</u>
                    </p>
                    <p style={{ textAlign: "justify", fontSize: "1.2rem", marginBottom: "20px" }}>
                        <b>Try pressing the keys now to see how they are registered.</b> Ensure that they show up in the middle of your screen as expected.
                    </p>

                    {/* Key state visualization */}
                    <div
                        style={{
                            position: "absolute",
                            top: "45%",
                            left: "50%",
                            transform: "translate(-50%, -50%)",
                            display: "flex",
                            justifyContent: "center",
                            gap: "20px",
                            padding: "20px",
                            borderRadius: "10px",
                            zIndex: 1000,
                            backgroundColor: "rgba(255, 255, 255, 0.5)", // Retain the background for key state
                            // boxShadow: "0 4px 10px rgba(0, 0, 0, 0.1)", // Add shadow for a better appearance
                        }}
                    >
                        {renderKeyState("f", "red", keyStates, canvasSize)}
                        {renderKeyState("j", "green", keyStates, canvasSize)}
                    </div>

                    {/* Navigation buttons */}
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: "20px" }}>
                        <button
                            onClick={handleBack}
                            style={{
                                padding: "15px 30px",
                                fontSize: "1rem",
                                color: "white",
                                backgroundColor: "#6c757d",
                                border: "none",
                                borderRadius: "5px",
                                cursor: "pointer",
                            }}
                        >
                            Back
                        </button>
                        <button
                            onClick={handleNext}
                            style={{
                                padding: "15px 30px",
                                fontSize: "1rem",
                                color: "white",
                                backgroundColor: "#007bff",
                                border: "none",
                                borderRadius: "5px",
                                cursor: "pointer",
                            }}
                        >
                            Begin Familiarization Trials
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InstructionsPage;