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
    canvasSize,
    handlePlayPause,
    fetchNextScene,
    canvasRef,
    isStrictMode
}) => {

    const isInitializedRef = useRef(false);
    const activatedScoringInstruc = useRef(false);
    const strictModeRenderCount = useRef(0);
    const [disableCountdownTrigger, setdisableCountdownTrigger] = useState(false);
    const [showScoringInstruc, setShowScoringInstruc] = useState(false);

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
        return <ScoringInstrucPage handleProceed={handleProceed} />;
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
            {countdown && (
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
            )}

            <div style={{
                position: "absolute",
                top: "10px",
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

            {finished && (
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
                    width: `${canvasSize.width * 0.3}px`,
                    minWidth: "200px",
                }}>
                    {/* Key State Indicators */}
                    <div style={{
                        display: "flex",
                        gap: `${canvasSize.width * 0.02}px`,
                        padding: `${canvasSize.width * 0.02}px`,
                        border: "1px solid #ddd",
                        borderRadius: "8px",
                        backgroundColor: "#f9f9f9",
                        width: "100%",
                        justifyContent: "center",
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: `${canvasSize.width * 0.01}px` }}>
                            <p style={{ margin: 0, fontWeight: "bold" }}>F</p>
                            <div style={{
                                width: `${canvasSize.width * 0.04}px`,
                                height: `${canvasSize.width * 0.04}px`,
                                backgroundColor: "red",
                                borderRadius: "50%",
                            }} />
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: `${canvasSize.width * 0.01}px` }}>
                            <p style={{ margin: 0, fontWeight: "bold" }}>J</p>
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
                        marginTop: `${canvasSize.height * 0.5}px`, // Add space between renderKeyState and KeyStateLine
                        width: "100%",
                    }}>
                        {/* Render KeyStateLine */}
                        <p>Current Frame: <strong>{currentFrame}</strong></p>
                        <p>Proportions so far ↓</p>
                        <KeyStateLine recordedKeyStates={recordedKeyStates} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExperimentPage;