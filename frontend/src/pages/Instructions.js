import React, { useState } from 'react';
import { useNavigation } from '../contexts/NavigationContext';
import {renderKeyState, renderEmptyKeyState} from '../components/renderKeyState';

const InstructionsPage = ({ trialInfo, keyStates, canvasSize }) => {
    const { navigate } = useNavigation();
    const [currentPage, setCurrentPage] = useState(1);

    const handleNext = () => {
        if (currentPage < 5) setCurrentPage(currentPage + 1);
        else navigate("experiment");
    };

    const handleBack = () => {
        if (currentPage > 1) setCurrentPage(currentPage - 1);
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minHeight: "100vh", backgroundColor: "#f9f9f9", padding: "20px" }}>
            {currentPage === 1 && <InstructionPage1 handleNext={handleNext} />}
            {currentPage === 2 && <InstructionPage2 handleNext={handleNext} handleBack={handleBack} />}
            {currentPage === 3 && <InstructionPage3 handleNext={handleNext} handleBack={handleBack} />}
            {currentPage === 4 && <InstructionPage4 keyStates={keyStates} canvasSize={canvasSize} handleNext={handleNext} handleBack={handleBack} />}
            {currentPage === 5 && <InstructionPage5 handleNext={handleNext} handleBack={handleBack} trialInfo={trialInfo}/>}
        </div>
    );
};


const InstrucNavigationButtons = ({ handleNext, handleBack, isLastPage }) => (
    <div
        style={{
            display: "flex",
            justifyContent: handleBack ? "space-between" : "center",
            marginTop: "20px",
            width: "100%",
            maxWidth: "800px",
        }}
    >
        {handleBack && (
            <button
                onClick={handleBack}
                style={{
                    padding: "15px 30px",
                    fontSize: "1.2rem",
                    color: "white",
                    backgroundColor: "#6c757d",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    boxShadow: "0 2px 5px rgba(0, 0, 0, 0.2)",
                    transition: "background-color 0.3s ease, transform 0.2s ease",
                }}
                onMouseOver={(e) => (e.target.style.backgroundColor = "#5a6268")}
                onMouseOut={(e) => (e.target.style.backgroundColor = "#6c757d")}
                onMouseDown={(e) => (e.target.style.transform = "scale(0.95)")}
                onMouseUp={(e) => (e.target.style.transform = "scale(1)")}
            >
                Back
            </button>
        )}
        <button
            onClick={handleNext}
            style={{
                padding: "15px 30px",
                fontSize: "1.2rem",
                color: "white",
                backgroundColor: isLastPage ? "#28a745" : "#007bff",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                boxShadow: "0 2px 5px rgba(0, 0, 0, 0.2)",
                transition: "background-color 0.3s ease, transform 0.2s ease",
            }}
            onMouseOver={(e) =>
                (e.target.style.backgroundColor = isLastPage ? "#218838" : "#0056b3")
            }
            onMouseOut={(e) =>
                (e.target.style.backgroundColor = isLastPage ? "#28a745" : "#007bff")
            }
            onMouseDown={(e) => (e.target.style.transform = "scale(0.95)")}
            onMouseUp={(e) => (e.target.style.transform = "scale(1)")}
        >
            {isLastPage ? "Start the First Familiarization Trial" : "Next"}
        </button>
    </div>
);


const InstructionPage1 = ({ handleNext }) => (
    <div 
    style={{
        textAlign: "center",
        maxWidth: "800px",
        margin: "0 auto",
        padding: "20px",
        backgroundColor: "#f9f9f9",
        borderRadius: "10px",
        boxShadow: "0 4px 10px rgba(0, 0, 0, 0.1)",
    }}>
        <h1>Instructions (1/5)</h1>
        <p style={{ fontSize: "1.25rem" }}>In this experiment, you will observe a <span style={{ color: "blue" }}><strong> blue </strong></span> circular object moving in a 2D Physical World.
        The blue object moves with correct <b>frictionless</b> and <b>elastic</b> physical motion & can bounce off walls and black rectangular barriers.
        </p>
        <img src="/instruc1.gif" alt="Example 1" style={{ width: "100%", maxWidth: "400px", marginBottom: "20px" }} />
        <InstrucNavigationButtons handleNext={handleNext} />
    </div>
);

const InstructionPage2 = ({ handleNext, handleBack }) => (
    <div 
    style={{
        textAlign: "center",
        maxWidth: "800px",
        margin: "0 auto",
        padding: "20px",
        backgroundColor: "#f9f9f9",
        borderRadius: "10px",
        boxShadow: "0 4px 10px rgba(0, 0, 0, 0.1)",
    }}>
        <h1>Instructions (2/5)</h1>
        <p style={{ fontSize: "1.2rem" }}>
            The 2D world also contains <span style={{ color: "gray" }}><strong>gray</strong></span>
            <b> occluders</b> which hide the path of the moving blue object.
        </p>
        <div
            style={{
                display: "flex",
                justifyContent: "space-between", // Distribute space between items
                alignItems: "center", // Align items at the top
                gap: "10px", // Space between the images
                flexWrap: "wrap", // Ensure wrapping on smaller screens
                marginBottom: "20px",
            }}
        >
            <div style={{ textAlign: "center", flex: "1 1 calc(50% - 10px)" }}>
                <img
                    src="/occ_no_hide_barrier.png"
                    alt="Occluder Example"
                    style={{
                        width: "100%",
                        height: "auto",
                        objectFit: "contain",
                        marginBottom: "10px",
                    }}
                />
                <p style={{ fontSize: "1rem", color: "#555" }}>
                    The occluder <b>never</b> hides any part of the static environment.
                </p>
            </div>
            <div style={{ textAlign: "center", flex: "1 1 calc(50% - 10px)" }}>
                <img
                    src="/instruc2.gif"
                    alt="Motion Example"
                    style={{
                        width: "100%",
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
        <InstrucNavigationButtons handleNext={handleNext} handleBack={handleBack} />
    </div>
);

const InstructionPage3 = ({ handleNext, handleBack }) => (
    <div 
    style={{
        textAlign: "center",
        maxWidth: "800px",
        margin: "0 auto",
        padding: "20px",
        backgroundColor: "#f9f9f9",
        borderRadius: "10px",
        boxShadow: "0 4px 10px rgba(0, 0, 0, 0.1)",
    }}>
        <h1>Instructions (3/5)</h1>
        <p style={{ fontSize: "1.2rem" }}>Your goal in this experiment is to watch a video like the one below, and <b>continuously predict as fast as possible</b> (in real time as you watch the video)
         whether the moving object will hit the <span style={{ color: "red" }}><strong> red </strong></span> region or the <span style={{ color: "green" }}><strong> green </strong></span> region first. 
         The trial will end once the ball will hit one of the 2 regions, <span style={{ color: "red" }}><strong> red </strong></span> or <span style={{ color: "green" }}><strong> green </strong></span>.</p>
        <img src="/instruc3.gif" alt="Example 1" style={{ width: "100%", maxWidth: "400px", marginBottom: "0px" }} />
        <p style={{ fontSize: "1.2rem"}}>In this example, the ball hit the red region.</p>
        <InstrucNavigationButtons handleNext={handleNext} handleBack={handleBack} />
    </div>
);

const InstructionPage4 = ({ handleNext, handleBack, trialInfo, keyStates, canvasSize }) => (
    <div 
    style={{
        textAlign: "center",
        maxWidth: "800px",
        margin: "0 auto",
        padding: "20px",
        backgroundColor: "#f9f9f9",
        borderRadius: "10px",
        boxShadow: "0 4px 10px rgba(0, 0, 0, 0.1)",
    }}>
        <h1>Instructions (4/5)</h1>
        <p style={{ fontSize: "1.2rem" }}>To make your decision on <span style={{ color: "red" }}><strong> red </strong></span> or <span style={{ color: "green" }}><strong> green </strong></span>:
        Hold down on <span style={{ color: "red" }}><strong> "F" for Red</strong></span> or <span style={{ color: "green" }}><strong>"J" for Green</strong></span> as the object motion happens in real-time. <b>However</b>, if you are uncertain, you may avoid holding down on any key. <b>If you hold both keys at the same time, your input will be ignored.</b>
        </p>
        <p style={{ fontSize: "1.2rem" }}>As your response is recorded for every frame of the video, you must hold down the keys as you watch the video unfold
            even if you feel certain of the outcome. <b>Do not just press the buttons once to record your decision</b>.
        </p>
        <p style={{ fontSize: "1.2rem" }}>
            To test this. <i><b>Try holding down either one of the buttons right now to see how they are registered</b></i>. You should see the 
            response appear on your screen in the form or a red or green box. Try holding down both at the same time, you should see the response disappear.
        </p>
        <div style={{justifyContent: "center", display: "flex", gap: "20px"}}>
        <div style={{
            display: "flex",
            gap: `${canvasSize.width * 0.01}px`,
            padding: `${canvasSize.width * 0.01}px`,
            border: "1px solid #ddd",
            borderRadius: "8px",
            backgroundColor: "#f9f9f9",
            width: "40%",
            justifyContent: "center",
            
        }}>
            <div style={{ display: "flex", alignItems: "center", gap: `${canvasSize.width * 0.01}px` }}>
                <p style={{ margin: 0, fontWeight: "bold" }}>F</p>
                <div style={{
                    width: `${canvasSize.width * 0.03}px`,
                    height: `${canvasSize.width * 0.03}px`,
                    backgroundColor: "red",
                    borderRadius: "50%",
                }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: `${canvasSize.width * 0.01}px` }}>
                <p style={{ margin: 0, fontWeight: "bold" }}>J</p>
                <div style={{
                    width: `${canvasSize.width * 0.03}px`,
                    height: `${canvasSize.width * 0.03}px`,
                    backgroundColor: "green",
                    borderRadius: "50%",
                }} />
            </div>
        </div>
        </div>

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
                // backgroundColor: "rgba(255, 255, 255, 0.5)", // Retain the background for key state
                // boxShadow: "0 4px 10px rgba(0, 0, 0, 0.1)", // Add shadow for a better appearance
            }}
        >
        </div>
            {renderKeyState("f", "red", keyStates, canvasSize)}
            {renderKeyState("j", "green", keyStates, canvasSize)}
            {renderEmptyKeyState(keyStates, canvasSize)}
        <p style={{ fontSize: "1.2rem" }}>
            <b>If you DO NOT see a <span style={{ color: "red" }}> red </span> or <span style={{ color: "green" }}> green </span> box</b>, then your 'f' and 'j' keys are not being registered. In this case (very unlikely), we kindly request for 
            you to return the study as no data will be logged otherwise, and let us know via message immediately. Thank you.
        </p>
        <p style={{ fontSize: "1.2rem" }}>
            It is okay for you to be uncertain at any point of the object's movement. It is also 
            okay for you to change your mind during the course of a video. Such moments may happen.
        </p>
        <InstrucNavigationButtons handleNext={handleNext} handleBack={handleBack} />
    </div>
);

const InstructionPage5 = ({ handleNext, handleBack, trialInfo }) => (
    <div
        style={{
            textAlign: "center",
            maxWidth: "800px",
            margin: "0 auto",
            padding: "20px",
            backgroundColor: "#f9f9f9",
            borderRadius: "10px",
            boxShadow: "0 4px 10px rgba(0, 0, 0, 0.1)",
        }}
    >
        <h1 style={{ fontSize: "2rem", marginBottom: "20px" }}>Instructions (5/5)</h1>
        <p style={{ fontSize: "1.2rem", lineHeight: "1.6", marginBottom: "20px", textAlign: "justify" }}>
            You will now begin the <strong>familiarization trials</strong> to get used to the task (practice rounds). 
            These trials will help you understand the task before proceeding to the main experiment. 
        </p>
        {/* <p style={{ fontSize: "1.2rem", lineHeight: "1.6", marginBottom: "20px", textAlign: "justify" }}>
            The familiarization phase consists of <strong>{trialInfo.num_ftrials}</strong> trials. 
            Afterward, you will complete <strong>{trialInfo.num_trials}</strong> trials for the main experiment.
        </p>
        <p style={{ fontSize: "1.2rem", lineHeight: "1.6", marginBottom: "20px", textAlign: "justify" }}>
        <b>You will be scored based on how quickly and accurately you perform per trial.</b> Details of how 
        you are scored will be shown soon. The faster you make the correct decision, 
        the higher you will score, <b>however</b> making the wrong decision leads to a penalty. 
        <strong> Remember to hold down on the key continuously when you decide on red or green, 
        even if you change your mind</strong>. 
        </p> */}
        <p style={{ fontSize: "1.2rem", lineHeight: "1.6", marginBottom: "20px", textAlign: "justify" }}>
            Remember to hold down <span style={{ color: "red" }}><strong> "F" for Red</strong></span> or <span style={{ color: "green" }}><strong>"J" for Green</strong></span> as the object motion happens in real-time.
        </p>
        <p style={{ fontSize: "1.2rem", lineHeight: "1.6", marginBottom: "20px", textAlign: "justify" }}>
            Click the button below to begin the first familiarization trial.
        </p>
        <InstrucNavigationButtons handleNext={handleNext} handleBack={handleBack} isLastPage />
    </div>
);

export default InstructionsPage;
