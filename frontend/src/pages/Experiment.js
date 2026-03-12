import React, { useEffect, useRef, useState } from 'react';
import {renderKeyState, renderEmptyKeyState} from '../components/renderKeyState';
import KeyStateLine from '../components/KeyStateLine'; 
import TransitionPage from './Transition';
import ScoringInstrucPage from './ScoringInstruc';
import ClickInstructionsPage from './ClickInstructions';
import { getApiBase } from '../api';

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
    savingStatus,
    clickTrialResult,
    pauseState,
    clickPlacement,
    clickInvalidReason,
    onValidPlacement,
    setClickInvalidReason,
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
    const [showClickInstructions, setShowClickInstructions] = useState(false);
    const [mousePos, setMousePos] = useState(null); // { x, y } in canvas pixel coords when awaiting click
    const canvasWrapperRef = useRef(null);

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
            setShowScoringInstruc(true); // After F1: show scoring instructions before F2
        }
    }, [trialInfo]);

    // After F2: show click instructions before F3 (when this experiment has click trials and we have a third fam trial)
    const shownClickInstrucForF3Ref = useRef(false);
    useEffect(() => {
        if (
            trialInfo.is_ftrial &&
            trialInfo.ftrial_i === 3 &&
            sceneData?.has_click_trials &&
            !shownClickInstrucForF3Ref.current
        ) {
            shownClickInstrucForF3Ref.current = true;
            setShowClickInstructions(true);
        }
    }, [trialInfo.is_ftrial, trialInfo.ftrial_i, sceneData?.has_click_trials]);

    // Fix 1: when entering click phase, clear mouse position so ball is not shown until user hovers over the scene
    const wasClickAwaitingRef = useRef(false);
    const isEnteringClickPhase = pauseState === 'awaiting_click';
    useEffect(() => {
        if (isEnteringClickPhase && !wasClickAwaitingRef.current) {
            setMousePos(null);
        }
        wasClickAwaitingRef.current = isEnteringClickPhase;
    }, [isEnteringClickPhase]);

    const handleProceed = () => {
        setShowScoringInstruc(false);
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
            if (e.code === 'Space' && isSpacePressed && finished && savingStatus !== 'saving' && !isTransitionPage && !showScoringInstruc && !showClickInstructions) {
                isSpacePressed = false;
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
    }, [fetchNextScene, finished, savingStatus, isTransitionPage, showScoringInstruc, showClickInstructions]);

    const handleCanvasMouseMove = (e) => {
        if (pauseState !== 'awaiting_click' || !canvasRef.current || !sceneData) return;
        const rect = canvasRef.current.getBoundingClientRect();
        setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };
    const handleCanvasMouseLeave = () => setMousePos(null);
    const handleCanvasClick = async (e) => {
        if (pauseState !== 'awaiting_click' || !canvasRef.current || !sceneData || !onValidPlacement) return;
        setClickInvalidReason(null);
        const rect = canvasRef.current.getBoundingClientRect();
        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;
        const scale = Math.min(
            canvasRef.current.width / (sceneData.worldWidth || 20),
            canvasRef.current.height / (sceneData.worldHeight || 20)
        );
        const worldX = canvasX / scale;
        const worldY = (canvasRef.current.height - canvasY) / scale;
        const r = sceneData.radius || 0.5;
        const worldWidth = sceneData.worldWidth || 20;
        const worldHeight = sceneData.worldHeight || 20;
        const barriers = sceneData.barriers || [];
        if (worldX - r < 0 || worldX + r > worldWidth || worldY - r < 0 || worldY + r > worldHeight) {
            setClickInvalidReason('Outside scene bounds');
            return;
        }
        const overBarrier = barriers.some(({ x: bx, y: by, width: bw, height: bh }) => {
            // Axis-aligned rectangle [bx, bx + bw] x [by, by + bh]
            const cx = worldX;
            const cy = worldY;

            const insideX = cx >= bx && cx <= bx + bw;
            const insideY = cy >= by && cy <= by + bh;

            // Center inside rectangle → definite overlap
            if (insideX && insideY) {
                return true;
            }

            // Overlap with horizontal edges when horizontally aligned with rectangle
            if (insideX) {
                const distY = Math.min(Math.abs(cy - by), Math.abs(cy - (by + bh)));
                return distY < r;
            }

            // Overlap with vertical edges when vertically aligned with rectangle
            if (insideY) {
                const distX = Math.min(Math.abs(cx - bx), Math.abs(cx - (bx + bw)));
                return distX < r;
            }

            // Corner case: distance to nearest corner
            const cornerX = cx < bx ? bx : bx + bw;
            const cornerY = cy < by ? by : by + bh;
            const dx = cx - cornerX;
            const dy = cy - cornerY;
            return dx * dx + dy * dy < r * r;
        });
        if (overBarrier) {
            setClickInvalidReason('Overlapping a barrier');
            return;
        }
        let ball_x = null;
        let ball_y = null;
        let diameters_away = null;
        const stepAtPause = sceneData.step_data && sceneData.step_data[sceneData.pause_at_frame];
        if (stepAtPause != null) {
            ball_x = stepAtPause.x != null ? Number(stepAtPause.x) : null;
            ball_y = stepAtPause.y != null ? Number(stepAtPause.y) : null;
            if (ball_x != null && ball_y != null && r > 0) {
                const ballCx = ball_x + r;
                const ballCy = ball_y + r;
                const dx = worldX - ballCx;
                const dy = worldY - ballCy;
                diameters_away = Math.sqrt(dx * dx + dy * dy) / (2 * r);
            }
        }
        try {
            const sessionId = sessionStorage.getItem('sessionId');
            if (!sessionId) throw new Error('Session ID not found');
            const res = await fetch(getApiBase() + '/save_pause_click', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true', 'User-Agent': 'React-Experiment-App' },
                body: JSON.stringify({
                    session_id: sessionId,
                    trial_id: sceneData.unique_trial_id,
                    pause_frame: sceneData.pause_at_frame,
                    click_x: worldX,
                    click_y: worldY,
                    radius: r,
                    ball_x,
                    ball_y,
                    diameters_away,
                }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to save click');
            }
            onValidPlacement(worldX, worldY);
        } catch (err) {
            console.error(err);
            setClickInvalidReason(err.message || 'Failed to save');
        }
    };

    const isClickAwaiting = pauseState === 'awaiting_click';
    const isClickPlaced = pauseState === 'click_placed';
    const isObservationOnly = clickPlacement && sceneData?.pause_at_frame != null && !finished && !isClickAwaiting && !isClickPlaced;
    const showRedGreenPanel = !isClickAwaiting && !isClickPlaced && !isObservationOnly;
    const scale = sceneData && canvasRef.current ? Math.min(
        canvasRef.current.width / (sceneData.worldWidth || 20),
        canvasRef.current.height / (sceneData.worldHeight || 20)
    ) : 20;
    const ballRadiusPx = sceneData ? scale * (sceneData.radius || 0.5) : 10;
    const overOccluder = mousePos && sceneData?.occluders?.length && (() => {
        const worldX = mousePos.x / scale;
        const worldY = ((canvasRef.current?.height || 400) - mousePos.y) / scale;
        return sceneData.occluders.some(({ x: ox, y: oy, width: w, height: h }) =>
            worldX >= ox && worldX <= ox + w && worldY >= oy && worldY <= oy + h
        );
    })();
    
    if (showScoringInstruc) {
        return <ScoringInstrucPage handleProceed={handleProceed} trialInfo={trialInfo} />;
    }

    if (showClickInstructions) {
        return <ClickInstructionsPage handleProceed={() => setShowClickInstructions(false)} trialInfo={trialInfo} />;
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
                    {clickTrialResult?.isClickTrial ? (
                        <>
                            {clickTrialResult.diametersAway < 1.0 ? (
                                <h1 style={{ fontSize: "3rem", color: "#2e7d32", marginBottom: "8px", textAlign: "center" }}>
                                    You placed the ball near the correct location!
                                </h1>
                            ) : (
                                <h1 style={{ fontSize: "3rem", color: "black", marginBottom: "8px", textAlign: "center" }}>
                                    You were{" "}
                                    <span style={{
                                        color: (() => {
                                            const d = clickTrialResult.diametersAway;
                                            if (d <= 2.0) return "#2e7d32";
                                            if (d <= 3.5) return "#ef6c00";
                                            return "#c62828";
                                        })(),
                                        fontWeight: "bold",
                                    }}>
                                        {clickTrialResult.diametersAway.toFixed(1)}
                                    </span>{" "}
                                    balls away from the correct location.
                                </h1>
                            )}
                        </>
                    ) : (
                        <>
                            <h1 style={{ fontSize: "3rem", color: "black", marginBottom: "8px" }}>
                                You scored {score.toFixed(0)}
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
                        </>
                    )}

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

                    <div
                        style={{
                            position: "relative",
                            display: "inline-block",
                            outline: isClickAwaiting ? "4px solid #FFC107" : "none",
                            outlineOffset: "4px",
                            boxShadow: isClickAwaiting ? "0 0 20px rgba(255, 193, 7, 0.9)" : "none",
                        }}
                    >
                        <canvas
                            ref={canvasRef}
                            width={canvasSize.width}
                            height={canvasSize.height}
                            style={{
                                border: "1px solid black",
                                backgroundColor: "white",
                                width: `${canvasSize.width}px`,
                                height: `${canvasSize.height}px`,
                                display: "block",
                            }}
                        />
                        {isClickAwaiting && (
                            <div
                                style={{
                                    position: "absolute",
                                    top: 0,
                                    left: 0,
                                    width: canvasSize.width,
                                    height: canvasSize.height,
                                    cursor: "none",
                                    zIndex: 5,
                                }}
                                onMouseMove={handleCanvasMouseMove}
                                onMouseLeave={handleCanvasMouseLeave}
                                onClick={handleCanvasClick}
                            >
                                {mousePos && (
                                    <div
                                        style={{
                                            position: "absolute",
                                            left: mousePos.x - ballRadiusPx,
                                            top: mousePos.y - ballRadiusPx,
                                            width: ballRadiusPx * 2,
                                            height: ballRadiusPx * 2,
                                            borderRadius: "50%",
                                            backgroundColor: "blue",
                                            opacity: overOccluder ? 0.5 : 1,
                                            pointerEvents: "none",
                                        }}
                                    />
                                )}
                            </div>
                        )}
                    </div>
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
                    {showRedGreenPanel && (
                        <>
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
                            <div style={{ marginTop: `${canvasSize.height * 0.3}px`, width: "100%" }}>
                                <p>Proportions so far ↓</p>
                                <KeyStateLine recordedKeyStates={recordedKeyStates} />
                            </div>
                        </>
                    )}
                    {isClickAwaiting && (
                        <div style={{
                            padding: "16px",
                            border: "1px solid #ddd",
                            borderRadius: "8px",
                            backgroundColor: "#f9f9f9",
                            width: "100%",
                        }}>
                            <p style={{ margin: "0 0 8px 0", fontWeight: "bold", color: "#333" }}>
                                {mousePos
                                    ? "Click to place the ball where you think it is located in the scene."
                                    : "Hover over the scene to show the ball, then click to place it where you think it is located."}
                            </p>
                            {clickInvalidReason && (
                                <p style={{ margin: 0, color: "#c62828", fontSize: "0.95rem" }}>
                                    Invalid position: {clickInvalidReason}
                                </p>
                            )}
                        </div>
                    )}
                    {isClickPlaced && (
                        <div style={{
                            padding: "16px",
                            border: "1px solid #4caf50",
                            borderRadius: "8px",
                            backgroundColor: "#e8f5e9",
                            width: "100%",
                        }}>
                            <p style={{ margin: 0, fontWeight: "bold", color: "#2e7d32" }}>
                                Placement recorded. Resuming in 1 second…
                            </p>
                        </div>
                    )}
                    {isObservationOnly && (
                        <div style={{
                            padding: "16px",
                            border: "1px solid #ddd",
                            borderRadius: "8px",
                            backgroundColor: "#f5f5f5",
                            width: "100%",
                        }}>
                            <p style={{ margin: 0, color: "#666" }}>Observe the path until the end of the trial.</p>
                            {sceneData?.ball_ever_occluded && (
                                <p style={{ margin: "8px 0 0 0", color: "#666", fontSize: "0.95rem" }}>
                                    Occluded object is made visible so you can see the path.
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ExperimentPage;