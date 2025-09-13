import React, { useEffect, useRef, useState } from 'react';
import {renderKeyState, renderEmptyKeyState} from '../components/renderKeyState';
import KeyStateLine from '../components/KeyStateLine'; 
import TransitionPage from './Transition';
import ScoringInstrucPage from './ScoringInstruc';

const ExperimentPage = ({
    sceneData,
    trialInfo,
    isTransitionPage,
    currentFrame,
    isPlaying,
    keyStates,
    recordedKeyStates,
    countdown,
    finished,
    score,
    waitingForScoreSpacebar,
    setWaitingForScoreSpacebar,
    setFinished,
    photodiodeColor,
    canvasSize,
    handlePlayPause,
    fetchNextScene,
    canvasRef,
    isStrictMode,
    onPause
}) => {

    const isInitializedRef = useRef(false);
    const activatedScoringInstruc = useRef(false);
    const strictModeRenderCount = useRef(0);
    const [disableCountdownTrigger, setdisableCountdownTrigger] = useState(false);
    const [showScoringInstruc, setShowScoringInstruc] = useState(false);
    const [showPauseConfirmation, setShowPauseConfirmation] = useState(false);

    useEffect(() => {
        strictModeRenderCount.current += 1;

        if ((strictModeRenderCount.current === 2 | !isStrictMode) && !isInitializedRef.current) {
            // console.log("ExperimentPage initialized (Strict Mode safe)");
            isInitializedRef.current = true;
            fetchNextScene(setdisableCountdownTrigger); // Fetch the first scene
        }
    }, [fetchNextScene]);

    // Scoring instruction page disabled - skip directly to F2
    // useEffect(() => {
    //     if (trialInfo.is_ftrial && trialInfo.ftrial_i === 2 && !activatedScoringInstruc.current) {
    //         activatedScoringInstruc.current = true;
    //         setShowScoringInstruc(true); // Show explanation page after first familiarization trial
    //     }
    // }, [trialInfo]);

    const handleProceed = () => {
        setShowScoringInstruc(false); // Hide explanation page
    };

    const handlePauseClick = () => {
        setShowPauseConfirmation(true);
    };

    const handlePauseConfirm = () => {
        setShowPauseConfirmation(false);
        onPause();
    };

    const handlePauseCancel = () => {
        setShowPauseConfirmation(false);
    };

    // Use refs to avoid stale closure issues
    const stateRef = useRef({});
    stateRef.current = {
        isPlaying,
        finished,
        disableCountdownTrigger,
        waitingForScoreSpacebar,
        isTransitionPage
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.code === 'Space') {
                e.preventDefault(); // Prevent default spacebar behavior (scrolling)
                
                const currentState = stateRef.current;
                
                // Priority 1: Start trial countdown
                if (!currentState.isPlaying && !currentState.finished && 
                    !currentState.disableCountdownTrigger && !currentState.waitingForScoreSpacebar && 
                    !currentState.isTransitionPage) {
                    handlePlayPause(setdisableCountdownTrigger); // Start countdown
                }
                // Priority 2: Continue after trial (skip score display)
                else if (currentState.waitingForScoreSpacebar && !currentState.isTransitionPage) {
                    setWaitingForScoreSpacebar(false);
                    fetchNextScene(setdisableCountdownTrigger);
                }
            }
        };
    
        window.addEventListener('keydown', handleKeyDown);
    
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [handlePlayPause, setWaitingForScoreSpacebar, fetchNextScene, setdisableCountdownTrigger]); // Reduced dependencies
    
    // Scoring instruction page disabled
    // if (showScoringInstruc) {
    //     return <ScoringInstrucPage handleProceed={handleProceed} trialInfo={trialInfo}/>;
    // }

    if (isTransitionPage) {
        return (
            <TransitionPage
                trialInfo={trialInfo}
                fetchNextScene={fetchNextScene}
                setdisableCountdownTrigger={setdisableCountdownTrigger}
            />
        );
    }

    return (
        <div>
            {/* Countdown is handled directly in render frame now */}
            {/* {countdown && (
                <div style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    fontSize: "4rem",
                    color: "black",
                    fontWeight: "bold",
                    background: "rgba(255, 255, 255, 0.8)",
                    padding: "20px",
                    borderRadius: "10px",
                    zIndex: 10,
                }}>
                    {countdown}
                </div>
            )} */}

            <div style={{
                position: "absolute",
                bottom: "10px",
                right: "10px",
                backgroundColor: "rgba(255, 255, 255, 0.8)",
                padding: "10px",
                borderRadius: "8px",
                boxShadow: "0 2px 5px rgba(0, 0, 0, 0.2)",
                zIndex: 100,
            }}>
                <p style={{ margin: 0, fontWeight: "bold", fontSize: "14px" }}>
                    {trialInfo.is_ftrial ?
                        `Familiarization Trial: ${trialInfo.ftrial_i}/${trialInfo.num_ftrials}` :
                        `Trial Number: ${trialInfo.trial_i}/${trialInfo.num_trials}`}
                </p>
            </div>

            {/* Photodiode Sensor Box - Top Right Corner */}
            <div style={{
                position: "absolute",
                top: "10px",
                right: "10px",
                width: "96px",  // 
                height: "192px", // 
                backgroundColor: photodiodeColor,
                border: "2px solid black",
                zIndex: 150, // Higher than trial number display
            }} />

            {/* Pause Button */}
            <div style={{
                position: "absolute",
                bottom: "10px",
                left: "10px",
                zIndex: 100,
            }}>
                <button
                    onClick={handlePauseClick}
                    style={{
                        padding: "8px 16px",
                        fontSize: "14px",
                        color: "white",
                        backgroundColor: "#dc3545",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        boxShadow: "0 2px 5px rgba(0, 0, 0, 0.2)",
                        transition: "background-color 0.3s ease",
                    }}
                    onMouseOver={(e) => (e.target.style.backgroundColor = "#c82333")}
                    onMouseOut={(e) => (e.target.style.backgroundColor = "#dc3545")}
                >
                    Pause Experiment
                </button>
            </div>

            {/* Pause Confirmation Dialog */}
            {showPauseConfirmation && (
                <div style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    backgroundColor: "rgba(0, 0, 0, 0.5)",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    zIndex: 1000,
                }}>
                    <div style={{
                        backgroundColor: "white",
                        padding: "30px",
                        borderRadius: "10px",
                        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
                        textAlign: "center",
                        maxWidth: "400px",
                    }}>
                        <h2 style={{ marginTop: 0, color: "#333" }}>Pause Experiment?</h2>
                        <p style={{ fontSize: "16px", color: "#666", marginBottom: "30px" }}>
                            Are you sure you want to pause the experiment? You can resume from where you left off later.
                        </p>
                        <div style={{ display: "flex", gap: "15px", justifyContent: "center" }}>
                            <button
                                onClick={handlePauseCancel}
                                style={{
                                    padding: "10px 20px",
                                    fontSize: "16px",
                                    color: "#333",
                                    backgroundColor: "#f8f9fa",
                                    border: "1px solid #dee2e6",
                                    borderRadius: "6px",
                                    cursor: "pointer",
                                    transition: "background-color 0.3s ease",
                                }}
                                onMouseOver={(e) => (e.target.style.backgroundColor = "#e9ecef")}
                                onMouseOut={(e) => (e.target.style.backgroundColor = "#f8f9fa")}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handlePauseConfirm}
                                style={{
                                    padding: "10px 20px",
                                    fontSize: "16px",
                                    color: "white",
                                    backgroundColor: "#dc3545",
                                    border: "none",
                                    borderRadius: "6px",
                                    cursor: "pointer",
                                    transition: "background-color 0.3s ease",
                                }}
                                onMouseOver={(e) => (e.target.style.backgroundColor = "#c82333")}
                                onMouseOut={(e) => (e.target.style.backgroundColor = "#dc3545")}
                            >
                                Yes, Pause
                            </button>
                        </div>
                    </div>
                </div>
            )}

            
            {/* Only after the first trial ends */}
            {finished && (trialInfo.is_ftrial && trialInfo.ftrial_i === 1) && (
               <div style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                backgroundColor: "rgba(255, 255, 255, 0.8)",
                backdropFilter: "blur(5px)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                zIndex: 20,
            }}>

                <div>
                    <p style={{
                        fontSize: "1.2rem",
                        fontWeight: "bold",
                        color: "#555",
                        marginTop: "10px",
                        textAlign: "center"
                    }}>
                    Press the <span style={{ color: "blue" }}>Spacebar</span> to continue.
                        </p>
                    </div>
                </div>
            )}

            <div style={{
                display: "flex",
                justifyContent: "center",
                padding: "20px",
                gap: "40px"
            }}>
                <div style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "20px"
                }}>
                    <div>
                        <p style={{
                            fontSize: "1.2rem",
                            fontWeight: "bold",
                            color: "#555",
                            marginTop: "10px",
                            textAlign: "center"
                        }}>
                            {waitingForScoreSpacebar ? (
                                trialInfo.is_ftrial && trialInfo.ftrial_i === 1 ? (
                                    <>Press the <span style={{ color: "blue" }}>Spacebar</span> to continue.</>
                                ) : trialInfo.trial_i === trialInfo.num_trials ? (
                                    <>Almost done! Press the <span style={{ color: "red" }}>Spacebar to finish the experiment.</span></>
                                ) : (
                                    <>Press the <span style={{ color: "blue" }}>Spacebar</span> to move to the next trial.</>
                                )
                            ) : (
                                <>Press the <span style={{ color: "blue" }}>Spacebar</span> to begin the trial.</>
                            )}
                        </p>
                    </div>

                    <canvas
                        ref={canvasRef}
                        width={canvasSize.width}
                        height={canvasSize.height}
                        style={{
                            border: "1px solid black",
                            backgroundColor: "white",
                            width: `${canvasSize.width}px`,
                            height: `${canvasSize.height}px`,
                        }}
                    />

                    {/* <p>Current Frame: <strong>{currentFrame}</strong></p> */}
                </div>

                <div style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    position: "relative",
                    width: "30vw",
                    minWidth: "200px",
                    marginTop: "20vh",
                }}>
                    {/* Key State Indicators */}
                    <div style={{
                        display: "flex",
                        gap: `${canvasSize.width * 0.1}px`,
                        padding: `${canvasSize.width * 0.02}px`,
                        border: "1px solid #ddd",
                        borderRadius: "8px",
                        backgroundColor: "#f9f9f9",
                        width: "100%",
                        justifyContent: "center",
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: `${canvasSize.width * 0.01}px` }}>
                            <h2 style={{ margin: 0, fontWeight: "bold" }}>F</h2>
                            <div style={{
                                width: `${canvasSize.width * 0.04}px`,
                                height: `${canvasSize.width * 0.04}px`,
                                backgroundColor: "red",
                                borderRadius: "50%",
                            }} />
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: `${canvasSize.width * 0.01}px` }}>
                            <h2 style={{ margin: 0, fontWeight: "bold" }}>J</h2>
                            <div style={{
                                width: `${canvasSize.width * 0.04}px`,
                                height: `${canvasSize.width * 0.04}px`,
                                backgroundColor: "green",
                                borderRadius: "50%",
                            }} />
                        </div>
                    </div>

                    {/* Render Key States */}
                    <div style={{
                        position: "absolute",
                        top: `${canvasSize.width * 0.15}px`,
                        display: "flex",
                        gap: `${canvasSize.width * 0.03}px`,
                        justifyContent: "center",
                        width: "100%",
                    }}>
                        {renderKeyState("f", "red", keyStates, canvasSize)}
                        {renderKeyState("j", "green", keyStates, canvasSize)}
                        {renderEmptyKeyState(keyStates, canvasSize)}
                    </div>

                    {/* Add a Spacer to Separate the KeyStateLine */}
                    <div style={{
                        marginTop: `${canvasSize.height * 0.3}px`, // Add space between renderKeyState and KeyStateLine
                        width: "100%",
                    }}>
                        {/* Render KeyStateLine */}
                        {/* <p>Current Frame: <strong>{currentFrame}</strong></p> */}
                        <p>Proportions so far ↓</p>
                        <KeyStateLine recordedKeyStates={recordedKeyStates} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExperimentPage;