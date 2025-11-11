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
    onPause,
    showKeyStateLine,
    enablePhotodiode
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

    useEffect(() => {
        if (trialInfo.is_ftrial && trialInfo.ftrial_i === 2 && !activatedScoringInstruc.current) {
            activatedScoringInstruc.current = true;
            setShowScoringInstruc(true); // Show explanation page after first familiarization trial
        }
    }, [trialInfo]);

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

    useEffect(() => {
        let isSpacePressed = false; // Tracks whether the Spacebar is pressed
    
        const handleKeyUp = (e) => {
            if (e.code === 'Space' && isSpacePressed && !isPlaying && !finished 
                && !disableCountdownTrigger && !isTransitionPage && !showScoringInstruc) {
                // console.log("Spacebar pressed. Starting countdown...");
                isSpacePressed = false; // Set flag to true when Spacebar is pressed
                handlePlayPause(setdisableCountdownTrigger); // Start countdown
            }
        };
    
        const handleKeyDown = (e) => {
            if (e.code === 'Space') {
                isSpacePressed = true; // Reset flag when Spacebar is released
            }
        };
    
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
    
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [handlePlayPause, isPlaying, finished, disableCountdownTrigger, isTransitionPage, showScoringInstruc]);
    
    useEffect(() => {
        let isSpacePressed = false; // Tracks whether the Spacebar is pressed
    
        const handleKeyUp = (e) => {
            if (e.code === 'Space' && isSpacePressed && finished && !isTransitionPage && !showScoringInstruc) {
                // console.log("Spacebar pressed. Fetching next scene...");
                isSpacePressed = false; // Set flag to true when Spacebar is pressed
                fetchNextScene(setdisableCountdownTrigger);
            }
        };
    
        const handleKeyDown = (e) => {
            if (e.code === 'Space') {
                isSpacePressed = true; // Reset flag when Spacebar is released
            }
        };
    
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
    
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [fetchNextScene, finished, isTransitionPage, showScoringInstruc]);
    
    if (showScoringInstruc) {
        return <ScoringInstrucPage handleProceed={handleProceed} trialInfo={trialInfo}/>;
    }

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

            {/* Photodiode Sensor Box - Top Right Corner */}
            {enablePhotodiode && (
                <div style={{
                    position: "absolute",
                    top: "10px",
                    right: "10px",
                    width: "96px",
                    height: "192px",
                    backgroundColor: photodiodeColor,
                    border: "2px solid black",
                    zIndex: 150, // Higher than trial number display
                }} />
            )}

            {/* Trial Number and Pause Button - Bottom Right */}
            <div style={{
                position: "absolute",
                bottom: "10px",
                right: "10px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                zIndex: 100,
            }}>
                {/* Pause Button */}
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
                
                {/* Trial Number */}
                <div style={{
                    backgroundColor: "rgba(255, 255, 255, 0.8)",
                    padding: "10px",
                    borderRadius: "8px",
                    boxShadow: "0 2px 5px rgba(0, 0, 0, 0.2)",
                }}>
                    <p style={{ margin: 0, fontWeight: "bold", fontSize: "14px" }}>
                        {trialInfo.is_ftrial ?
                            `Familiarization Trial: ${trialInfo.ftrial_i}/${trialInfo.num_ftrials}` :
                            `Trial Number: ${trialInfo.trial_i}/${trialInfo.num_trials}`}
                    </p>
                </div>
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
                        boxShadow: "0 4px 10px rgba(0, 0, 0, 0.3)",
                        maxWidth: "400px",
                        textAlign: "center",
                    }}>
                        <h2 style={{ marginTop: 0, color: "#333" }}>Pause Experiment?</h2>
                        <p style={{ color: "#666", marginBottom: "20px" }}>
                            You can resume from where you left off using your Session ID.
                        </p>
                        <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                            <button
                                onClick={handlePauseConfirm}
                                style={{
                                    padding: "10px 20px",
                                    fontSize: "16px",
                                    color: "white",
                                    backgroundColor: "#dc3545",
                                    border: "none",
                                    borderRadius: "5px",
                                    cursor: "pointer",
                                }}
                            >
                                Yes, Pause
                            </button>
                            <button
                                onClick={handlePauseCancel}
                                style={{
                                    padding: "10px 20px",
                                    fontSize: "16px",
                                    color: "white",
                                    backgroundColor: "#6c757d",
                                    border: "none",
                                    borderRadius: "5px",
                                    cursor: "pointer",
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {finished && !(trialInfo.is_ftrial && trialInfo.ftrial_i === 1) && (
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
                    <h1 style={{ fontSize: "3rem", color: "black", marginBottom: "20px" }}>
                        Finished. You scored {score.toFixed(0)}
                    </h1>

                    <div style={{
                        display: "flex",
                        alignItems: "center",
                        width: "80%",
                        marginTop: "20px",
                    }}>
                        <span style={{
                            fontSize: "1rem",
                            fontWeight: "bold",
                            marginRight: "10px",
                            color: "#333"
                        }}>
                            -80
                        </span>

                        <div style={{
                            flexGrow: 1,
                            height: "30px",
                            backgroundColor: "#e0e0e0",
                            borderRadius: "15px",
                            overflow: "hidden",
                            position: "relative",
                            boxShadow: "0 2px 5px rgba(0,0,0,0.2)"
                        }}>
                            <div style={{
                                width: `${((score + 80) / 200) * 100}%`,
                                height: "100%",
                                backgroundColor: (() => {
                                    const normalizedScore = (score + 80) / 200;
                                    if (normalizedScore <= 1 / 3) {
                                        return "#f44336";
                                    } else if (normalizedScore <= 2 / 3) {
                                        return "#ffeb3b";
                                    } else {
                                        return "#4caf50";
                                    }
                                })(),
                                transition: "width 0.5s ease-in-out, background-color 0.5s ease-in-out",
                            }} />
                        </div>

                        <span style={{
                            fontSize: "1rem",
                            fontWeight: "bold",
                            marginLeft: "10px",
                            color: "#333"
                        }}>
                            120
                        </span>
                    </div>

                    <div>
                        <p style={{
                            fontSize: "1.2rem",
                            fontWeight: "bold",
                            color: "#555",
                            marginTop: "10px",
                            textAlign: "center"
                        }}>
                            {trialInfo.is_ftrial && trialInfo.ftrial_i === 1 ? (
                                <>
                                    To understand how your score is calculated, press the <span style={{ color: "blue" }}>Spacebar</span>.
                                </>
                            ) : trialInfo.trial_i === trialInfo.num_trials ? (
                                <>
                                    Almost done! Press the <span style={{ color: "red" }}>Spacebar to finish the experiment.</span>
                                </>
                            ) : (
                                <>
                                    Press the <span style={{ color: "blue" }}>Spacebar</span> to move to the next trial.
                                </>
                            )}
                        </p>
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
                            Press the <span style={{ color: "blue" }}>Spacebar</span> to begin the trial.
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
                    {(() => {
                        // Calculate scaling factor to keep components at reasonable size
                        const baseSize = 400;
                        const maxCanvasDim = Math.max(canvasSize.width, canvasSize.height);
                        const scaleFactor = Math.min(1, baseSize / maxCanvasDim);
                        return (
                            <div style={{
                                display: "flex",
                                gap: `${canvasSize.width * 0.1 * scaleFactor}px`,
                                padding: `${canvasSize.width * 0.02 * scaleFactor}px`,
                                border: "1px solid #ddd",
                                borderRadius: "8px",
                                backgroundColor: "#f9f9f9",
                                width: "100%",
                                justifyContent: "center",
                            }}>
                                <div style={{ display: "flex", alignItems: "center", gap: `${canvasSize.width * 0.01 * scaleFactor}px` }}>
                                    <h2 style={{ margin: 0, fontWeight: "bold", fontSize: `${Math.max(24 * scaleFactor, 18)}px` }}>F</h2>
                                    <div style={{
                                        width: `${canvasSize.width * 0.04 * scaleFactor}px`,
                                        height: `${canvasSize.width * 0.04 * scaleFactor}px`,
                                        backgroundColor: "red",
                                        borderRadius: "50%",
                                    }} />
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: `${canvasSize.width * 0.01 * scaleFactor}px` }}>
                                    <h2 style={{ margin: 0, fontWeight: "bold", fontSize: `${Math.max(24 * scaleFactor, 18)}px` }}>J</h2>
                                    <div style={{
                                        width: `${canvasSize.width * 0.04 * scaleFactor}px`,
                                        height: `${canvasSize.width * 0.04 * scaleFactor}px`,
                                        backgroundColor: "green",
                                        borderRadius: "50%",
                                    }} />
                                </div>
                            </div>
                        );
                    })()}

                    {/* Render Key States */}
                    {(() => {
                        const baseSize = 400;
                        const maxCanvasDim = Math.max(canvasSize.width, canvasSize.height);
                        const scaleFactor = Math.min(1, baseSize / maxCanvasDim);
                        return (
                            <div style={{
                                position: "absolute",
                                top: `${canvasSize.width * 0.15 * scaleFactor}px`,
                                display: "flex",
                                gap: `${canvasSize.width * 0.03 * scaleFactor}px`,
                                justifyContent: "center",
                                width: "100%",
                            }}>
                                {renderKeyState("f", "red", keyStates, canvasSize)}
                                {renderKeyState("j", "green", keyStates, canvasSize)}
                                {renderEmptyKeyState(keyStates, canvasSize)}
                            </div>
                        );
                    })()}

                    {/* Add a Spacer to Separate the KeyStateLine */}
                    {showKeyStateLine && (() => {
                        const baseSize = 400;
                        const maxCanvasDim = Math.max(canvasSize.width, canvasSize.height);
                        const scaleFactor = Math.min(1, baseSize / maxCanvasDim);
                        return (
                            <div style={{
                                marginTop: `${canvasSize.height * 0.3 * scaleFactor}px`, // Add space between renderKeyState and KeyStateLine
                                width: "100%",
                            }}>
                                {/* Render KeyStateLine */}
                                {/* <p>Current Frame: <strong>{currentFrame}</strong></p> */}
                                <p style={{ fontSize: `${Math.max(14 * scaleFactor, 16)}px` }}>Proportions so far ↓</p>
                                <KeyStateLine recordedKeyStates={recordedKeyStates} canvasSize={canvasSize} />
                            </div>
                        );
                    })()}
                </div>
            </div>
        </div>
    );
};

export default ExperimentPage;