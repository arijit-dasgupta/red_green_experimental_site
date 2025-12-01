import React, { useEffect, useRef, useState } from 'react';
import {renderKeyState, renderEmptyKeyState} from '../components/renderKeyState';
import TransitionPage from './Transition';
import { config } from '../config';
import { getFamiliarizationPageType } from '../utils/familiarizationPageTypes';
import P8CanvasPage from '../components/P8CanvasPage';
import P9CanvasPage from '../components/P9CanvasPage';
import P10CanvasPage from '../components/P10CanvasPage';
import P11CanvasPage from '../components/P11CanvasPage';
import P12CanvasPage from '../components/P12CanvasPage';
import P14CanvasPage from '../components/P14CanvasPage';
import P15CanvasPage from '../components/P15CanvasPage';
import P16CanvasPage from '../components/P16CanvasPage';
import P17CanvasPage from '../components/P17CanvasPage';
import P18CanvasPage from '../components/P18CanvasPage';
import P19CanvasPage from '../components/P19CanvasPage';
import P20CanvasPage from '../components/P20CanvasPage';
import P21CanvasPage from '../components/P21CanvasPage';
import P22CanvasPage from '../components/P22CanvasPage';

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
    isStrictMode,
    redSensorTextureRef,
    greenSensorTextureRef,
    barrierTextureRef
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

    // Add keyboard shortcut for testing: Press 'Shift+S' to skip to next page
    useEffect(() => {
        const handleKeyPress = (e) => {
            if (e.shiftKey && (e.key === 'S' || e.key === 's')) {
                console.log("SKIP KEY PRESSED: Shift+S detected in ExperimentPage, skipping to next page");
                e.preventDefault();
                e.stopPropagation();
                fetchNextScene(setdisableCountdownTrigger);
                return false;
            }
        };
        
        document.addEventListener('keydown', handleKeyPress, true);
        return () => {
            document.removeEventListener('keydown', handleKeyPress, true);
        };
    }, [fetchNextScene, setdisableCountdownTrigger]);

    if (isTransitionPage) {
        return (
            <TransitionPage
                trialInfo={trialInfo}
                fetchNextScene={fetchNextScene}
                setdisableCountdownTrigger={setdisableCountdownTrigger}
            />
        );
    }

    // Check if this is p8, p9, p10, or p11 (special canvas pages)
    // After BackstoryPage (p1-p7), the first familiarization trial is ftrial_i=1, which should be p8
    // The second familiarization trial is ftrial_i=2, which should be p9
    // The third familiarization trial is ftrial_i=3, which should be p10
    // The fourth familiarization trial is ftrial_i=4, which should be p11
    const familiarizationPageType = trialInfo.is_ftrial ? getFamiliarizationPageType(trialInfo.ftrial_i) : null;
    // p8 is the first familiarization trial (ftrial_i === 1) after backstory
    // p9 is the second familiarization trial (ftrial_i === 2) after backstory
    // p10 is the third familiarization trial (ftrial_i === 3) after backstory
    // p11 is the fourth familiarization trial (ftrial_i === 4) after backstory
    // p12 is the fifth familiarization trial (ftrial_i === 5) after backstory
    // p14 is the sixth familiarization trial (ftrial_i === 6) after backstory (interactive practice)
    // p15 is the seventh familiarization trial (ftrial_i === 7) after backstory (interactive practice)
    // p16 is the eighth familiarization trial (ftrial_i === 8) after backstory (interactive practice)
    // p17 is the ninth familiarization trial (ftrial_i === 9) after backstory (interactive practice)
    // p18 is the tenth familiarization trial (ftrial_i === 10) after backstory (demonstration)
    // Note: getFamiliarizationPageType(1) returns 'p1', but we want p8 to be rendered for ftrial_i === 1
    const isP8 = trialInfo.is_ftrial && trialInfo.ftrial_i === 1;
    const isP9 = trialInfo.is_ftrial && trialInfo.ftrial_i === 2;
    const isP10 = trialInfo.is_ftrial && trialInfo.ftrial_i === 3;
    const isP11 = trialInfo.is_ftrial && trialInfo.ftrial_i === 4;
    const isP12 = trialInfo.is_ftrial && trialInfo.ftrial_i === 5;
    const isP14 = trialInfo.is_ftrial && trialInfo.ftrial_i === 6;
    const isP15 = trialInfo.is_ftrial && trialInfo.ftrial_i === 7;
    const isP16 = trialInfo.is_ftrial && trialInfo.ftrial_i === 8;
    const isP17 = trialInfo.is_ftrial && trialInfo.ftrial_i === 9;
    const isP18 = trialInfo.is_ftrial && trialInfo.ftrial_i === 10;
    const isP19 = trialInfo.is_ftrial && trialInfo.ftrial_i === 11;
    const isP20 = trialInfo.is_ftrial && trialInfo.ftrial_i === 12;
    const isP21 = trialInfo.is_ftrial && trialInfo.ftrial_i === 13;
    const isP22 = trialInfo.is_ftrial && trialInfo.ftrial_i === 14;
    
    // Debug: Explicitly log isP18 calculation - ALWAYS log when ftrial_i is 10
    if (trialInfo.ftrial_i === 10) {
        console.log("🔍 ExperimentPage: DEBUG - ftrial_i is 10!", {
            is_ftrial: trialInfo.is_ftrial,
            ftrial_i: trialInfo.ftrial_i,
            isP18: isP18,
            'trialInfo.is_ftrial': trialInfo.is_ftrial,
            'trialInfo.ftrial_i': trialInfo.ftrial_i,
            'trialInfo.ftrial_i === 10': trialInfo.ftrial_i === 10,
            'trialInfo.is_ftrial && trialInfo.ftrial_i === 10': trialInfo.is_ftrial && trialInfo.ftrial_i === 10
        });
    }
    
    // Debug: Explicitly log isP19 calculation - ALWAYS log when ftrial_i is 11
    if (trialInfo.ftrial_i === 11) {
        console.log("🔍 ExperimentPage: DEBUG - ftrial_i is 11!", {
            is_ftrial: trialInfo.is_ftrial,
            ftrial_i: trialInfo.ftrial_i,
            isP19: isP19,
            'trialInfo.is_ftrial': trialInfo.is_ftrial,
            'trialInfo.ftrial_i': trialInfo.ftrial_i,
            'trialInfo.ftrial_i === 11': trialInfo.ftrial_i === 11,
            'trialInfo.is_ftrial && trialInfo.ftrial_i === 11': trialInfo.is_ftrial && trialInfo.ftrial_i === 11
        });
    }
    
    // Debug: Explicitly log isP20 calculation - ALWAYS log when ftrial_i is 12
    if (trialInfo.ftrial_i === 12) {
        console.log("🔍 ExperimentPage: DEBUG - ftrial_i is 12!", {
            is_ftrial: trialInfo.is_ftrial,
            ftrial_i: trialInfo.ftrial_i,
            isP20: isP20,
            'trialInfo.is_ftrial': trialInfo.is_ftrial,
            'trialInfo.ftrial_i': trialInfo.ftrial_i,
            'trialInfo.ftrial_i === 12': trialInfo.ftrial_i === 12,
            'trialInfo.is_ftrial && trialInfo.ftrial_i === 12': trialInfo.is_ftrial && trialInfo.ftrial_i === 12
        });
    }
    
    // Debug: Explicitly log isP21 calculation - ALWAYS log when ftrial_i is 13
    if (trialInfo.ftrial_i === 13) {
        console.log("🔍 ExperimentPage: DEBUG - ftrial_i is 13!", {
            is_ftrial: trialInfo.is_ftrial,
            ftrial_i: trialInfo.ftrial_i,
            isP21: isP21,
            'trialInfo.is_ftrial': trialInfo.is_ftrial,
            'trialInfo.ftrial_i': trialInfo.ftrial_i,
            'trialInfo.ftrial_i === 13': trialInfo.ftrial_i === 13,
            'trialInfo.is_ftrial && trialInfo.ftrial_i === 13': trialInfo.is_ftrial && trialInfo.ftrial_i === 13
        });
    }
    
    // Debug: Explicitly log isP22 calculation - ALWAYS log when ftrial_i is 14
    if (trialInfo.ftrial_i === 14) {
        console.log("🔍 ExperimentPage: DEBUG - ftrial_i is 14!", {
            is_ftrial: trialInfo.is_ftrial,
            ftrial_i: trialInfo.ftrial_i,
            isP22: isP22,
            'trialInfo.is_ftrial': trialInfo.is_ftrial,
            'trialInfo.ftrial_i': trialInfo.ftrial_i,
            'trialInfo.ftrial_i === 14': trialInfo.ftrial_i === 14,
            'trialInfo.is_ftrial && trialInfo.ftrial_i === 14': trialInfo.is_ftrial && trialInfo.ftrial_i === 14
        });
    }
    
    console.log("🔍 ExperimentPage: Checking for p8/p9/p10/p11/p12/p14/p15/p16/p17/p18/p19/p20/p21/p22", {
            is_ftrial: trialInfo.is_ftrial,
            ftrial_i: trialInfo.ftrial_i,
            familiarizationPageType,
            isP8,
            isP9,
            isP10,
            isP11,
            isP12,
            isP14,
            isP15,
            isP16,
            isP17,
            isP18,
            isP19,
            isP20,
            isP21,
            isP22,
            isP22,
            unique_trial_id: trialInfo.unique_trial_id,
            trialInfo
        });
    
    if (isP8) {
        console.log("✅ ExperimentPage: DETECTED P8 - Rendering P8CanvasPage");
    } else if (isP9) {
        console.log("✅ ExperimentPage: DETECTED P9 - Rendering P9CanvasPage");
        console.log("🎬 ExperimentPage: P9 should load T_ball_move trial data");
    } else if (isP10) {
        console.log("✅ ExperimentPage: DETECTED P10 - Rendering P10CanvasPage");
        console.log("🎬 ExperimentPage: P10 should load T_barrier2complex trial data");
    } else if (isP11) {
        console.log("✅ ExperimentPage: DETECTED P11 - Rendering P11CanvasPage");
        console.log("🎬 ExperimentPage: P11 should load T_red_green trial data");
    } else if (isP12) {
        console.log("✅ ExperimentPage: DETECTED P12 - Rendering P12CanvasPage");
        console.log("🎬 ExperimentPage: P12 should load T_red_green trial data");
    } else if (isP14) {
        console.log("✅ ExperimentPage: DETECTED P14 - Rendering P14CanvasPage");
        console.log("🎬 ExperimentPage: P14 should load T_greeneasy trial data (interactive practice)");
    } else if (isP15) {
        console.log("✅ ExperimentPage: DETECTED P15 - Rendering P15CanvasPage");
        console.log("🎬 ExperimentPage: P15 should load T_redeasy trial data (interactive practice)");
    } else if (isP16) {
        console.log("✅ ExperimentPage: DETECTED P16 - Rendering P16CanvasPage");
        console.log("🎬 ExperimentPage: P16 should load T_greenmid trial data (interactive practice)");
    } else if (isP17) {
        console.log("✅ ExperimentPage: DETECTED P17 - Rendering P17CanvasPage");
        console.log("🎬 ExperimentPage: P17 should load T_redmid trial data (interactive practice)");
    } else if (isP18) {
        console.log("✅ ExperimentPage: DETECTED P18 - Rendering P18CanvasPage");
        console.log("🎬 ExperimentPage: P18 should load T_blank trial data (demonstration)");
    } else if (isP19) {
        console.log("✅ ExperimentPage: DETECTED P19 - Rendering P19CanvasPage");
        console.log("🎬 ExperimentPage: P19 should load T_switch_keys_easy trial data (interactive practice)");
    } else if (trialInfo.is_ftrial) {
        console.log("ℹ️ ExperimentPage: Familiarization trial but not p8/p9/p10/p11/p12/p14/p15/p16/p17/p18/p19/p20/p21, ftrial_i:", trialInfo.ftrial_i);
    }
    
    if (isP8) {
        console.log("ExperimentPage: Rendering P8CanvasPage");
        return (
            <P8CanvasPage
                fetchNextScene={fetchNextScene}
                setdisableCountdownTrigger={setdisableCountdownTrigger}
            />
        );
    }
    
    if (isP9) {
        console.log("ExperimentPage: Rendering P9CanvasPage");
        return (
            <P9CanvasPage
                fetchNextScene={fetchNextScene}
                setdisableCountdownTrigger={setdisableCountdownTrigger}
            />
        );
    }
    
    if (isP10) {
        console.log("ExperimentPage: Rendering P10CanvasPage");
        return (
            <P10CanvasPage
                fetchNextScene={fetchNextScene}
                setdisableCountdownTrigger={setdisableCountdownTrigger}
            />
        );
    }
    
    if (isP11) {
        console.log("ExperimentPage: Rendering P11CanvasPage");
        return (
            <P11CanvasPage
                fetchNextScene={fetchNextScene}
                setdisableCountdownTrigger={setdisableCountdownTrigger}
            />
        );
    }
    
    if (isP12) {
        console.log("ExperimentPage: Rendering P12CanvasPage");
        return (
            <P12CanvasPage
                fetchNextScene={fetchNextScene}
                setdisableCountdownTrigger={setdisableCountdownTrigger}
            />
        );
    }
    
    if (isP14) {
        console.log("ExperimentPage: Rendering P14CanvasPage");
        return (
            <P14CanvasPage
                fetchNextScene={fetchNextScene}
                setdisableCountdownTrigger={setdisableCountdownTrigger}
            />
        );
    }
    
    if (isP15) {
        console.log("ExperimentPage: Rendering P15CanvasPage");
        return (
            <P15CanvasPage
                key={`p15-${trialInfo.unique_trial_id}`}
                fetchNextScene={fetchNextScene}
                setdisableCountdownTrigger={setdisableCountdownTrigger}
            />
        );
    }
    
    if (isP16) {
        console.log("ExperimentPage: Rendering P16CanvasPage");
        return (
            <P16CanvasPage
                key={`p16-${trialInfo.unique_trial_id}`}
                fetchNextScene={fetchNextScene}
                setdisableCountdownTrigger={setdisableCountdownTrigger}
            />
        );
    }
    
    if (isP17) {
        console.log("ExperimentPage: Rendering P17CanvasPage");
        return (
            <P17CanvasPage
                key={`p17-${trialInfo.unique_trial_id}`}
                fetchNextScene={fetchNextScene}
                setdisableCountdownTrigger={setdisableCountdownTrigger}
            />
        );
    }
    
    if (isP18) {
        console.log("✅ ExperimentPage: RENDERING P18CanvasPage - isP18 is TRUE");
        console.log("🔍 ExperimentPage: P18 details", {
            is_ftrial: trialInfo.is_ftrial,
            ftrial_i: trialInfo.ftrial_i,
            unique_trial_id: trialInfo.unique_trial_id,
            'P18CanvasPage component': typeof P18CanvasPage
        });
        
        // Double-check that component is available
        if (!P18CanvasPage) {
            console.error("❌ ExperimentPage: P18CanvasPage component is not imported!");
            return <div>Error: P18CanvasPage not found</div>;
        }
        
        return (
            <P18CanvasPage
                key={`p18-${trialInfo.unique_trial_id}`}
                fetchNextScene={fetchNextScene}
                setdisableCountdownTrigger={setdisableCountdownTrigger}
            />
        );
    }
    
    if (isP19) {
        console.log("✅ ExperimentPage: RENDERING P19CanvasPage - isP19 is TRUE");
        console.log("🔍 ExperimentPage: P19 details", {
            is_ftrial: trialInfo.is_ftrial,
            ftrial_i: trialInfo.ftrial_i,
            unique_trial_id: trialInfo.unique_trial_id,
            'P19CanvasPage component': typeof P19CanvasPage
        });
        
        // Double-check that component is available
        if (!P19CanvasPage) {
            console.error("❌ ExperimentPage: P19CanvasPage component is not imported!");
            return <div>Error: P19CanvasPage not found</div>;
        }
        
        return (
            <P19CanvasPage
                key={`p19-${trialInfo.unique_trial_id}`}
                fetchNextScene={fetchNextScene}
                setdisableCountdownTrigger={setdisableCountdownTrigger}
            />
        );
    }
    
    if (isP20) {
        console.log("✅ ExperimentPage: RENDERING P20CanvasPage - isP20 is TRUE");
        console.log("🔍 ExperimentPage: P20 details", {
            is_ftrial: trialInfo.is_ftrial,
            ftrial_i: trialInfo.ftrial_i,
            unique_trial_id: trialInfo.unique_trial_id,
            'P20CanvasPage component': typeof P20CanvasPage
        });
        
        // Double-check that component is available
        if (!P20CanvasPage) {
            console.error("❌ ExperimentPage: P20CanvasPage component is not imported!");
            return <div>Error: P20CanvasPage not found</div>;
        }
        
        return (
            <P20CanvasPage
                key={`p20-${trialInfo.unique_trial_id}`}
                fetchNextScene={fetchNextScene}
                setdisableCountdownTrigger={setdisableCountdownTrigger}
            />
        );
    }
    
    if (isP21) {
        console.log("✅ ExperimentPage: RENDERING P21CanvasPage - isP21 is TRUE");
        console.log("🔍 ExperimentPage: P21 details", {
            is_ftrial: trialInfo.is_ftrial,
            ftrial_i: trialInfo.ftrial_i,
            unique_trial_id: trialInfo.unique_trial_id,
            'P21CanvasPage component': typeof P21CanvasPage
        });
        
        // Double-check that component is available
        if (!P21CanvasPage) {
            console.error("❌ ExperimentPage: P21CanvasPage component is not imported!");
            return <div>Error: P21CanvasPage not found</div>;
        }
        
        return (
            <P21CanvasPage
                key={`p21-${trialInfo.unique_trial_id}`}
                fetchNextScene={fetchNextScene}
                setdisableCountdownTrigger={setdisableCountdownTrigger}
            />
        );
    }
    
    if (isP22) {
        console.log("✅ ExperimentPage: RENDERING P22CanvasPage - isP22 is TRUE");
        console.log("🔍 ExperimentPage: P22 details", {
            is_ftrial: trialInfo.is_ftrial,
            ftrial_i: trialInfo.ftrial_i,
            unique_trial_id: trialInfo.unique_trial_id,
            'P22CanvasPage component': typeof P22CanvasPage
        });
        
        // Double-check that component is available
        if (!P22CanvasPage) {
            console.error("❌ ExperimentPage: P22CanvasPage component is not imported!");
            return <div>Error: P22CanvasPage not found</div>;
        }
        
        return (
            <P22CanvasPage
                key={`p22-${trialInfo.unique_trial_id}`}
                fetchNextScene={fetchNextScene}
                setdisableCountdownTrigger={setdisableCountdownTrigger}
            />
        );
    }
    
    // Debug: Log if we reach here without matching p8-p22
    if (trialInfo.is_ftrial) {
        console.error("❌ ExperimentPage: ERROR - is_ftrial is true but none of p8-p22 matched!", {
            ftrial_i: trialInfo.ftrial_i,
            isP8, isP9, isP10, isP11, isP12, isP14, isP15, isP16, isP17, isP18, isP19, isP20, isP21, isP22,
            familiarizationPageType
        });
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
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "100vh",
                padding: "20px",
                gap: "30px",
                background: "linear-gradient(135deg, #e6f2ff 0%, #f0f8ff 50%, #ffffff 100%)",
            }}>
                {/* Canvas Container - Centered */}
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

                    {/* Canvas with external border */}
                    <div style={{
                        position: "relative",
                        display: "inline-block",
                    }}>
                        {/* Border divs positioned around canvas */}
                        {(() => {
                            const borderThickness = config.canvasBorderThickness || 0;
                            const borderTextureUrl = barrierTextureRef?.current?.src || config.barrierTexturePath || '';
                            const hasTexture = borderTextureUrl && barrierTextureRef?.current?.complete;
                            
                            if (borderThickness <= 0) {
                                return null;
                            }
                            
                            const borderStyle = hasTexture ? {
                                backgroundImage: `url(${borderTextureUrl})`,
                                backgroundRepeat: 'repeat',
                                backgroundSize: 'auto',
                            } : {
                                backgroundColor: 'black',
                            };
                            
                            return (
                                <>
                                    {/* Top border */}
                                    <div style={{
                                        position: "absolute",
                                        top: -borderThickness,
                                        left: -borderThickness,
                                        width: `${canvasSize.width + (borderThickness * 2)}px`,
                                        height: `${borderThickness}px`,
                                        ...borderStyle,
                                    }} />
                                    {/* Bottom border */}
                                    <div style={{
                                        position: "absolute",
                                        bottom: -borderThickness,
                                        left: -borderThickness,
                                        width: `${canvasSize.width + (borderThickness * 2)}px`,
                                        height: `${borderThickness}px`,
                                        ...borderStyle,
                                    }} />
                                    {/* Left border */}
                                    <div style={{
                                        position: "absolute",
                                        top: 0,
                                        left: -borderThickness,
                                        width: `${borderThickness}px`,
                                        height: `${canvasSize.height}px`,
                                        ...borderStyle,
                                    }} />
                                    {/* Right border */}
                                    <div style={{
                                        position: "absolute",
                                        top: 0,
                                        right: -borderThickness,
                                        width: `${borderThickness}px`,
                                        height: `${canvasSize.height}px`,
                                        ...borderStyle,
                                    }} />
                                </>
                            );
                        })()}
                        
                        <canvas
                            ref={canvasRef}
                            width={canvasSize.width}
                            height={canvasSize.height}
                            style={{
                                backgroundColor: "white",
                                width: `${canvasSize.width}px`,
                                height: `${canvasSize.height}px`,
                                display: "block",
                                position: "relative",
                                zIndex: 1,
                            }}
                        />
                    </div>
                </div>

                {/* Key State Indicators - Below Canvas, Texture-based */}
                <div style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "15px",
                    width: "100%",
                    maxWidth: `${Math.max(canvasSize.width, 600)}px`,
                    padding: "0 20px",
                }}>
                    {/* Active Key States Row */}
                    {(() => {
                        const baseSize = 400;
                        const maxCanvasDim = Math.max(canvasSize.width, canvasSize.height);
                        const scaleFactor = Math.min(1, baseSize / maxCanvasDim);
                        return (
                            <div style={{
                                display: "flex",
                                gap: `${Math.max(canvasSize.width * 0.15, 40)}px`,
                                justifyContent: "center",
                                alignItems: "center",
                                width: "100%",
                            }}>
                                {renderKeyState("f", redSensorTextureRef, keyStates, canvasSize)}
                                {renderKeyState("j", greenSensorTextureRef, keyStates, canvasSize)}
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