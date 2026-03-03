import React, { useEffect, useRef, useState } from 'react';
import { useNavigation } from '../contexts/NavigationContext';
import { usePause } from '../contexts/PauseContext';

/**
 * Build complete timeline with all media/content information for each page.
 * 2 training pages (P1–P2) and 11 familiarization pages (P3–P13).
 */
const buildCompleteTimeline = (backendData, backstoryPages) => {
    const timeline = [];
    const numTrainingPages = 2;

    for (let i = 1; i <= numTrainingPages; i++) {
        const pageSpec = backstoryPages[i];
        if (!pageSpec) {
            console.warn(`buildCompleteTimeline: No page spec for P${i}`);
            continue;
        }
        const pageInfo = {
            page: `P${i}`,
            ftrial_i: 0,
            phase: "training",
            type: pageSpec.video ? "video" : "image_audio",
            audio: pageSpec.audio || null,
            images: pageSpec.images || (pageSpec.image ? [pageSpec.image] : []),
            video: pageSpec.video || null,
            trialData: null,
            isInteractive: false,
        };
        timeline.push(pageInfo);
    }

    // Familiarization: ftrial_i 1–11 → P3–P13; trialData matches what each V3 page fetches
    const ftrialToPage = {
        1: { page: "P3", trialData: "T_v3_ball_sensor_red", type: "canvas_demonstration" },
        2: { page: "P4", trialData: "T_v3_keys", type: "canvas_demonstration" },
        3: { page: "P5", trialData: "T_v3_area_no_ball", type: "canvas_demonstration" },
        4: { page: "P6", trialData: "T_v3_green_mid", type: "interactive_practice" },
        5: { page: "P7", trialData: "T_v3_red_mid", type: "interactive_practice" },
        6: { page: "P8", trialData: "T_v3_keyswitch_ball_stable", type: "canvas_demonstration" },
        7: { page: "P9", trialData: "T_v3_keyswitch_practice_1", type: "interactive_practice" },
        8: { page: "P10", trialData: "T_v3_keyswitch_practice_2", type: "interactive_practice" },
        9: { page: "P11", trialData: "T_v3_occluder_intro", type: "canvas_demonstration" },
        10: { page: "P12", trialData: "T_v3_occluder_practice", type: "interactive_practice" },
        11: { page: "P13", trialData: "T_v3_before_test", type: "canvas_demonstration" },
    };

    if (backendData.f_trial_order && backendData.f_trial_order.length > 0) {
        const maxFamiliarizationTrials = 11;
        const familiarizationTrialsToProcess = backendData.f_trial_order.slice(0, maxFamiliarizationTrials);

        familiarizationTrialsToProcess.forEach((trialFolderName, idx) => {
            const ftrial_i = idx + 1;
            const pageMapping = ftrialToPage[ftrial_i];

            if (pageMapping) {
                timeline.push({
                    page: pageMapping.page,
                    ftrial_i: ftrial_i,
                    phase: "familiarization",
                    type: pageMapping.type,
                    audio: null,
                    images: null,
                    videos: null,
                    trialData: pageMapping.trialData !== null && pageMapping.trialData !== undefined ? pageMapping.trialData : trialFolderName,
                    trialFolderName: trialFolderName,
                    isInteractive: pageMapping.type === "interactive_practice",
                    keysSwapped: pageMapping.keysSwapped || false,
                });
            }
        });
    }

    if (backendData.randomized_trial_order && backendData.randomized_trial_order.length > 0) {
        backendData.randomized_trial_order.forEach((trialFolderName, idx) => {
            timeline.push({
                page: null,
                ftrial_i: null,
                trial_i: idx,
                phase: "experimental",
                type: "interactive_trial",
                audio: null,
                images: null,
                videos: null,
                trialData: trialFolderName,
                trialFolderName: trialFolderName,
                isInteractive: true,
            });
        });
    }

    return {
        summary: {
            total_items: timeline.length,
            training_pages: numTrainingPages,
            familiarization_trials: backendData.num_ftrials || 0,
            experimental_trials: backendData.num_trials || 0,
        },
        timeline: timeline,
    };
};

/**
 * BackstoryPage component for presenting story content (p1-p3) before familiarization
 * V2: 3 training pages - Elmo intro, Elmo + ball, Neighborhood video
 */
const BackstoryPage = () => {
    console.log("🎬 BackstoryPage: Component mounted/rendered");
    const { navigate } = useNavigation();
    const { isPaused, resumeCounter } = usePause();
    const audioRef = useRef(null);
    const videoRef = useRef(null);
    const [currentPage, setCurrentPage] = useState(1);
    const maxTrainingPages = 2;
    const [audioPlayed, setAudioPlayed] = useState(false);
    const [audioFinished, setAudioFinished] = useState(false);
    const [audioElapsedTime, setAudioElapsedTime] = useState(0); // Track audio elapsed time for timed images
    const hasAutoAdvancedRef = useRef(false); // Track if we've already auto-advanced for current page
    const [timelineData, setTimelineData] = useState(null);
    const [experimentStarted, setExperimentStarted] = useState(false);

    const backstoryPages = {
        1: {
            images: [
                { src: '/images/v3_elmo.png', position: 'center', size: '30%', showUntil: 1 },
                { src: '/images/v3_elmo_ball.png', position: 'center', size: '30%', showAfter: 1 }
            ],
            audio: '/audios/v3_elmo_ball.mp3',
            video: null,
        },
        2: {
            images: null,
            audio: null,
            video: '/videos/v3_area.mp4',
        },
    };

    // Start experiment session when component mounts (before showing timeline)
    useEffect(() => {
        if (!experimentStarted) {
            const startExperimentSession = async () => {
                try {
                    const prolific_pid = sessionStorage.getItem("prolific_pid");
                    const study_id = sessionStorage.getItem("study_id");
                    const prolific_session_id = sessionStorage.getItem("prolific_session_id");
                    
                    console.log("BackstoryPage: Starting experiment session to get timeline");

                    const timestamp = Date.now();
                    const random = Math.random().toString(36).substring(2, 9);
                    const testPid = prolific_pid || `test_${timestamp}_${random}`;
                    const testStudyId = study_id || 'test_study';
                    const testSessionId = prolific_session_id || `test_session_${timestamp}_${random}`;

                    const response = await fetch(
                        `/start_experiment/redgreen?PROLIFIC_PID=${testPid}&STUDY_ID=${testStudyId}&SESSION_ID=${testSessionId}`,
                        { method: "POST", 
                            headers: { 
                                'ngrok-skip-browser-warning': 'true',
                                'User-Agent': 'React-Experiment-App',
                             } 
                        }
                    );
                    
                    if (!response.ok) {
                        console.error("Error starting experiment session");
                        return;
                    }

                    const data = await response.json();
                    sessionStorage.setItem("sessionId", data.session_id);
                    sessionStorage.setItem("startTimeUtc", data.start_time_utc);
                    sessionStorage.setItem("timeoutPeriod", data.timeout_period_seconds);
                    sessionStorage.setItem("checkTimeoutInterval", data.check_timeout_interval_seconds);

                    setTimelineData({
                        full_timeline: data.full_timeline || [],
                        f_trial_order: data.f_trial_order || [],
                        randomized_trial_order: data.randomized_trial_order || [],
                        num_ftrials: data.num_ftrials || 0,
                        num_trials: data.num_trials || 0,
                    });

                    setExperimentStarted(true);
                } catch (error) {
                    console.error("Error starting experiment session:", error);
                }
            };
            
            startExperimentSession();
        }
    }, [experimentStarted]);

    const currentPageSpec = backstoryPages[currentPage];

    // Print timeline JSON when P1 loads (currentPage === 1)
    useEffect(() => {
        if (currentPage === 1 && timelineData && experimentStarted) {
            const completeTimeline = buildCompleteTimeline(timelineData, backstoryPages);
            console.log("=== COMPLETE EXPERIMENT TIMELINE (JSON) - V2 ===");
            console.log(JSON.stringify(completeTimeline, null, 2));
            console.log("================================================");
        }
    }, [currentPage, timelineData, experimentStarted]);

    // Reset audio/video state when page changes
    useEffect(() => {
        if (currentPage > 0) {
            console.log("BackstoryPage: Page changed to", currentPage);
            setAudioPlayed(false);
            setAudioFinished(false);
            setAudioElapsedTime(0); // Reset elapsed time for timed images
            hasAutoAdvancedRef.current = false;
            if (audioRef.current) {
                audioRef.current.currentTime = 0;
                audioRef.current.pause();
            }
            if (videoRef.current) {
                videoRef.current.currentTime = 0;
                videoRef.current.pause();
            }
        }
    }, [currentPage]);

    // Track audio elapsed time for timed image switching (V3 P1)
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleTimeUpdate = () => {
            setAudioElapsedTime(audio.currentTime);
        };

        audio.addEventListener('timeupdate', handleTimeUpdate);
        return () => audio.removeEventListener('timeupdate', handleTimeUpdate);
    }, [currentPage]);

    // Auto-play audio when page loads (for pages with audio)
    useEffect(() => {
        if (currentPageSpec && currentPageSpec.audio && audioRef.current && !audioPlayed) {
            console.log("BackstoryPage: Attempting to play audio for page", currentPage);
            audioRef.current.play().catch(error => {
                console.log("Audio autoplay prevented:", error);
                setAudioFinished(true);
            });
            setAudioPlayed(true);
        }
    }, [audioPlayed, currentPage, currentPageSpec]);

    // Auto-play video when page loads (for pages with video)
    useEffect(() => {
        if (currentPageSpec && currentPageSpec.video && videoRef.current && !audioPlayed) {
            console.log("BackstoryPage: Attempting to play video for page", currentPage);
            videoRef.current.play().catch(error => {
                console.log("Video autoplay prevented:", error);
                setAudioFinished(true);
            });
            setAudioPlayed(true);
        }
    }, [audioPlayed, currentPage, currentPageSpec]);

    // Handle global pause state - pause audio/video when paused
    useEffect(() => {
        if (isPaused) {
            console.log('⏸️ BackstoryPage: Study paused - pausing audio/video');
            if (audioRef.current) {
                audioRef.current.pause();
            }
            if (videoRef.current) {
                videoRef.current.pause();
            }
        }
    }, [isPaused]);

    // Handle resume - reset and restart from beginning of current page
    const lastResumeCounterRef = useRef(resumeCounter);
    useEffect(() => {
        // Only trigger reset when resumeCounter actually increments (not on initial mount)
        if (resumeCounter > 0 && resumeCounter !== lastResumeCounterRef.current) {
            lastResumeCounterRef.current = resumeCounter;
            console.log('▶️ BackstoryPage: Study resumed - restarting current page from beginning');
            
            // Reset state for current page
            setAudioPlayed(false);
            setAudioFinished(false);
            hasAutoAdvancedRef.current = false;
            
            // Reset and restart audio/video
            if (currentPageSpec && currentPageSpec.audio && audioRef.current) {
                audioRef.current.currentTime = 0;
                audioRef.current.play().catch(e => console.warn('Failed to play audio:', e));
                setAudioPlayed(true);
            }
            if (currentPageSpec && currentPageSpec.video && videoRef.current) {
                videoRef.current.currentTime = 0;
                videoRef.current.play().catch(e => console.warn('Failed to play video:', e));
                setAudioPlayed(true);
            }
        }
    }, [resumeCounter, currentPageSpec]);

    // Define handleNext before using it in useEffect
    const handleNext = React.useCallback(async () => {
        if (currentPage < maxTrainingPages) {
            // Between training pages
            console.log("BackstoryPage: Moving to next page", currentPage + 1);
            setCurrentPage(currentPage + 1);
        } else {
            // After last training page, navigate to experiment phase
            console.log("BackstoryPage: Backstory complete, navigating to experiment");
            navigate('experiment');
        }
    }, [currentPage, maxTrainingPages, navigate]);

    // Listen for audio end event and auto-advance
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleAudioEnd = () => {
            setAudioFinished(true);
            // Auto-advance to next page after a short delay (only once)
            if (!hasAutoAdvancedRef.current) {
                hasAutoAdvancedRef.current = true;
                setTimeout(() => {
                    handleNext();
                }, 500); // 500ms delay for smooth transition
            }
        };

        audio.addEventListener('ended', handleAudioEnd);
        return () => {
            audio.removeEventListener('ended', handleAudioEnd);
        };
    }, [currentPage, handleNext]);

    // Listen for video end event and auto-advance
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleVideoEnd = () => {
            setAudioFinished(true);
            // Auto-advance to next page after a short delay (only once)
            if (!hasAutoAdvancedRef.current) {
                hasAutoAdvancedRef.current = true;
                setTimeout(() => {
                    handleNext();
                }, 500); // 500ms delay for smooth transition
            }
        };

        video.addEventListener('ended', handleVideoEnd);
        return () => {
            video.removeEventListener('ended', handleVideoEnd);
        };
    }, [currentPage, handleNext]);

    // Add keyboard shortcuts for testing: Press 'Q' or 'Shift+Control+S' to skip to next page
    useEffect(() => {
        const handleKeyPress = (e) => {
            if (e.key === 'Q' || e.key === 'q' || (e.shiftKey && e.ctrlKey && (e.key === 'S' || e.key === 's'))) {
                console.log("SKIP KEY PRESSED: Skip key detected in BackstoryPage");
                e.preventDefault();
                e.stopPropagation();
                handleNext();
                return false;
            }
        };
        
        document.addEventListener('keydown', handleKeyPress, true);
        return () => {
            document.removeEventListener('keydown', handleKeyPress, true);
        };
    }, [handleNext]);


    if (!currentPageSpec) {
        return <div>Page {currentPage} not found</div>;
    }

    const getImageStyle = (img) => {
        let style = {
            width: img.size || "30%",
            height: "auto",
            maxWidth: "100%",
            objectFit: "contain",
            position: "absolute",
        };

        // Handle positioning
        if (img.position === 'center') {
            style.left = "50%";
            style.top = "50%";
            style.transform = "translate(-50%, -50%)";
        } else if (img.position === 'left_center') {
            style.left = "25%";
            style.top = "50%";
            style.transform = "translate(-50%, -50%)";
        } else if (img.position === 'right_center') {
            style.left = "75%";
            style.top = "50%";
            style.transform = "translate(-50%, -50%)";
        }
        
        return style;
    };

    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "100vh",
            background: "#ffffff", // White background
            padding: "20px",
            position: "relative",
        }}>
            {/* Audio element (for P1 and P2) */}
            {currentPageSpec.audio && (
                <audio
                    ref={audioRef}
                    src={currentPageSpec.audio}
                    preload="auto"
                />
            )}

            {/* Video element (for P2/P3) - fixed height 600px to match canvas size on other pages */}
            {currentPageSpec.video && (
                <div style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                    minHeight: "600px",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    background: "#ffffff",
                }}>
                    <video
                        ref={videoRef}
                        src={currentPageSpec.video}
                        style={{
                            height: "600px",
                            minHeight: "600px",
                            width: "auto",
                            objectFit: "contain",
                            border: "none",
                            outline: "none",
                            boxShadow: "none",
                            display: "block",
                        }}
                        preload="auto"
                    />
                </div>
            )}

            {/* Page indicator removed to keep UI clean for participants */}

            {/* Images (for P1 and P2) - with timed display support */}
            {currentPageSpec.images && currentPageSpec.images
                .filter((image) => {
                    // Filter images based on showUntil and showAfter properties
                    if (image.showUntil !== undefined && audioElapsedTime >= image.showUntil) {
                        return false; // Hide after showUntil time
                    }
                    if (image.showAfter !== undefined && audioElapsedTime < image.showAfter) {
                        return false; // Hide before showAfter time
                    }
                    return true;
                })
                .map((image, index) => (
                    <img
                        key={index}
                        src={image.src}
                        alt=""
                        style={getImageStyle(image)}
                    />
                ))}

            {/* Audio/Video playing indicator */}
            {audioPlayed && !audioFinished && (
                <div style={{
                    position: "absolute",
                    bottom: "150px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    fontSize: "16px",
                    color: "#666",
                    fontStyle: "italic",
                }}>
                    {/* V2: Removed distracting "Playing..." text */}
                </div>
            )}
        </div>
    );
};

export default BackstoryPage;
