import React, { useEffect, useRef, useState } from 'react';
import {renderKeyState, renderEmptyKeyState} from '../components/renderKeyState';
import TransitionPage from './Transition';

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
    canvasSize,
    handlePlayPause,
    fetchNextScene,
    canvasRef,
    isStrictMode
}) => {

    const isInitializedRef = useRef(false);
    const strictModeRenderCount = useRef(0);
    const [disableCountdownTrigger, setdisableCountdownTrigger] = useState(false);

    useEffect(() => {
        strictModeRenderCount.current += 1;

        if ((strictModeRenderCount.current === 2 | !isStrictMode) && !isInitializedRef.current) {
            // console.log("ExperimentPage initialized (Strict Mode safe)");
            isInitializedRef.current = true;
            fetchNextScene(setdisableCountdownTrigger); // Fetch the first scene
        }
    }, [fetchNextScene]);


    useEffect(() => {
        let isSpacePressed = false; // Tracks whether the Spacebar is pressed
    
        const handleKeyUp = (e) => {
            if (e.code === 'Space' && isSpacePressed && !isPlaying && !finished 
                && !disableCountdownTrigger && !isTransitionPage) {
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
    }, [handlePlayPause, isPlaying, finished, disableCountdownTrigger, isTransitionPage]);
    
    useEffect(() => {
        let isSpacePressed = false; // Tracks whether the Spacebar is pressed
    
        const handleKeyUp = (e) => {
            if (e.code === 'Space' && isSpacePressed && finished && !isTransitionPage) {
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
    }, [fetchNextScene, finished, isTransitionPage]);

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

            {/* Progress Bar - Bottom Right - Sesame Street Theme */}
            <div style={{
                position: "absolute",
                bottom: "20px",
                right: "20px",
                zIndex: 100,
            }}>
                {(() => {
                    const isFamiliarization = trialInfo.is_ftrial;
                    const current = isFamiliarization ? trialInfo.ftrial_i : trialInfo.trial_i;
                    const total = isFamiliarization ? trialInfo.num_ftrials : trialInfo.num_trials;
                    const progress = total > 0 ? current / total : 0;
                    const progressPercent = Math.min(100, Math.max(0, progress * 100));
                    
                    // Sesame Street colors: red, yellow, blue, green
                    const colors = ['#E31C23', '#F4C430', '#1BA1E2', '#6BBF59'];
                    const currentColor = colors[current % colors.length];
                    
                    return (
                        <div style={{
                            backgroundColor: "rgba(255, 255, 255, 0.95)",
                            padding: "12px 16px",
                            borderRadius: "12px",
                            boxShadow: "0 3px 8px rgba(0, 0, 0, 0.15)",
                            minWidth: "200px",
                            border: `2px solid ${currentColor}`,
                        }}>
                            {/* Progress Bar Container */}
                            <div style={{
                                width: "100%",
                                height: "24px",
                                backgroundColor: "#f0f0f0",
                                borderRadius: "12px",
                                overflow: "hidden",
                                position: "relative",
                                marginBottom: "8px",
                                boxShadow: "inset 0 2px 4px rgba(0, 0, 0, 0.1)",
                            }}>
                                {/* Progress Fill */}
                                <div style={{
                                    width: `${progressPercent}%`,
                                    height: "100%",
                                    backgroundColor: currentColor,
                                    borderRadius: "12px",
                                    transition: "width 0.3s ease",
                                    position: "relative",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "flex-end",
                                    paddingRight: "4px",
                                }}>
                                    {/* Cute character indicator */}
                                    {progressPercent > 10 && (
                                        <span style={{
                                            fontSize: "16px",
                                            filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.2))",
                                        }}>
                                            🎈
                                        </span>
                                    )}
                                </div>
                            </div>
                            
                            {/* Progress Text */}
                            <div style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                fontSize: "13px",
                                fontWeight: "600",
                                color: "#333",
                            }}>
                                <span style={{ color: currentColor }}>
                                    {isFamiliarization ? "🎯 Practice" : "⭐ Trial"}
                                </span>
                                <span style={{ color: "#666" }}>
                                    {current} / {total}
                                </span>
                            </div>
                        </div>
                    );
                })()}
            </div>

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
                    <div style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "20px"
                    }}>
                        <div style={{
                            fontSize: "6rem",
                            lineHeight: "1"
                        }}>
                            👍
                        </div>
                        <div>
                            <p style={{
                                fontSize: "1.8rem",
                                fontWeight: "bold",
                                color: "#333",
                                marginBottom: "15px",
                                textAlign: "center"
                            }}>
                                Great job! You're doing awesome! 🎉
                            </p>
                            <p style={{
                                fontSize: "1.2rem",
                                fontWeight: "bold",
                                color: "#555",
                                textAlign: "center"
                            }}>
                                Press the <span style={{ color: "blue" }}>Spacebar</span> to continue.
                            </p>
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
                <div style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "20px"
                }}>
                    <div style={{
                        fontSize: "6rem",
                        lineHeight: "1"
                    }}>
                        👍
                    </div>
                    <div>
                        <p style={{
                            fontSize: "1.8rem",
                            fontWeight: "bold",
                            color: "#333",
                            marginBottom: "15px",
                            textAlign: "center"
                        }}>
                            Great job! You're doing awesome! 🎉
                        </p>
                        <p style={{
                            fontSize: "1.2rem",
                            fontWeight: "bold",
                            color: "#555",
                            textAlign: "center"
                        }}>
                            Press the <span style={{ color: "blue" }}>Spacebar</span> to continue.
                        </p>
                    </div>
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

                </div>
            </div>
        </div>
    );
};

export default ExperimentPage;