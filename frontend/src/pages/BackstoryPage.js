import React, { useEffect, useRef, useState } from 'react';
import { useNavigation } from '../contexts/NavigationContext';

/**
 * Build complete timeline with all media/content information for each page
 */
const buildCompleteTimeline = (backendData, backstoryPages) => {
    const timeline = [];
    
    // Training Pages (P1-P7)
    for (let i = 1; i <= 7; i++) {
        const pageSpec = backstoryPages[i];
        const pageInfo = {
            page: `P${i}`,
            ftrial_i: 0,
            phase: "training",
            type: pageSpec.timedImages ? "timed_images_audio" : "image_audio",
            audio: pageSpec.audio || null,
            images: pageSpec.images || (pageSpec.image ? [pageSpec.image] : []),
            timedImages: pageSpec.timedImagesConfig || null,
            trialData: null,
            videos: null,
            isInteractive: false,
        };
        timeline.push(pageInfo);
    }
    
    // Familiarization Trials (P8-P22) - Map ftrial_i to pages
    // ftrial_i mapping: 1=P8, 2=P9, 3=P10, 4=P11, 5=P12, 6=P14, 7=P15, 8=P16, 9=P17, 10=P18, 11=P19, 12=P20, 13=P21, 14=P22
    const ftrialToPage = {
        1: { page: "P8", audio: "/audios/8_ball_intro.mp3", trialData: "T_ball_still", images: [{ src: "/images/elmo.png", position: "left_middle_canvas", size: "10%" }], type: "canvas_demonstration" },
        2: { page: "P9", audio: "/audios/9_ball_movement.mp3", trialData: "T_ball_move", images: [{ src: "/images/elmo.png", position: "left_middle_canvas", size: "25%" }], type: "canvas_demonstration" },
        3: { page: "P10", audio: "/audios/10_barrier.mp3", trialData: "T_barrier2complex", images: [{ src: "/images/elmo.png", position: "left_middle_canvas", size: "25%" }], type: "canvas_demonstration" },
        4: { page: "P11", audio: ["/audios/11_red_green.mp3", "/audios/12_F_J.mp3"], trialData: "T_red_green", images: [
            { src: "/images/elmo.png", position: "left_middle_canvas", size: "25%" },
            { src: "/images/kermit.png", position: "right_top", size: "20%" },
            { src: "/images/cookiemonster.png", position: "right_bottom", size: "20%" }
        ], videos: ["/videos/Fkey_short.mp4", "/videos/Jkey_short.mp4"], type: "canvas_demonstration" },
        5: { page: "P12", audio: "/audios/13_press_keys.mp3", trialData: "T_red_green", images: null, type: "canvas_demonstration" },
        6: { page: "P14", audio: null, trialData: "T_greeneasy", images: null, type: "interactive_practice", keysSwapped: false },
        7: { page: "P15", audio: null, trialData: "T_redeasy", images: null, type: "interactive_practice", keysSwapped: false },
        8: { page: "P16", audio: null, trialData: "T_greenmid", images: null, type: "interactive_practice", keysSwapped: true },
        9: { page: "P17", audio: null, trialData: "T_redmid", images: null, type: "interactive_practice", keysSwapped: true },
        10: { page: "P18", audio: "/audios/14_switchkeys_onekey.mp3", trialData: "T_blank", images: null, type: "canvas_demonstration" },
        11: { page: "P19", audio: null, trialData: "T_switch_keys_easy", images: null, type: "interactive_practice", keysSwapped: true },
        12: { page: "P20", audio: null, trialData: "T_switch_keys_hard", images: null, type: "interactive_practice", keysSwapped: true },
        13: { page: "P21", audio: "/audios/18_occluder_trimmed.mp3", trialData: "T_occluder_intro", images: null, type: "canvas_demonstration" },
        14: { page: "P22", audio: "/audios/19_final_reminder_corrected.mp3", trialData: null, images: null, videos: ["/videos/final_reminder.mp4", "/videos/Fkey_short.mp4", "/videos/Jkey_short.mp4"], type: "video_demonstration" },
    };
    
    // Add familiarization trials in order from backend (only first 14, ftrial_i 1-14, P8-P22)
    if (backendData.f_trial_order && backendData.f_trial_order.length > 0) {
        // Only process the first 14 familiarization trials (ftrial_i 1-14, corresponding to P8-P22)
        const maxFamiliarizationTrials = 14;
        const familiarizationTrialsToProcess = backendData.f_trial_order.slice(0, maxFamiliarizationTrials);
        
        familiarizationTrialsToProcess.forEach((trialFolderName, idx) => {
            const ftrial_i = idx + 1;
            const pageMapping = ftrialToPage[ftrial_i];
            
            if (pageMapping) {
                // For P22 (ftrial_i = 14), trialData and trialFolderName should be null (it's a video page, not canvas)
                const isP22 = ftrial_i === 14;
                
                timeline.push({
                    page: pageMapping.page,
                    ftrial_i: ftrial_i,
                    phase: "familiarization",
                    type: pageMapping.type,
                    audio: pageMapping.audio || null,
                    images: pageMapping.images || null,
                    videos: pageMapping.videos || null,
                    trialData: isP22 ? null : (pageMapping.trialData !== null && pageMapping.trialData !== undefined ? pageMapping.trialData : trialFolderName),
                    trialFolderName: isP22 ? null : trialFolderName,
                    isInteractive: pageMapping.type === "interactive_practice",
                    keysSwapped: pageMapping.keysSwapped || false,
                });
            }
            // No fallback - if pageMapping doesn't exist for ftrial_i 1-14, something is wrong
        });
    }
    
    // Experimental Trials
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
            training_pages: 7,
            familiarization_trials: backendData.num_ftrials || 0,
            experimental_trials: backendData.num_trials || 0,
        },
        timeline: timeline,
    };
};

/**
 * BackstoryPage component for presenting story content (p1-p7) before familiarization
 * Each page shows images with audio narration
 */
const BackstoryPage = () => {
    const { navigate } = useNavigation();
    const audioRef = useRef(null);
    const [currentPage, setCurrentPage] = useState(1); // 1-7 = training pages (P1-P7)
    const [audioPlayed, setAudioPlayed] = useState(false);
    const [audioFinished, setAudioFinished] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const hasAutoAdvancedRef = useRef(false); // Track if we've already auto-advanced for current page
    const [timelineData, setTimelineData] = useState(null);
    const [experimentStarted, setExperimentStarted] = useState(false);

    // Backstory page specifications (p1-p7) - Using the enhanced content that was working
    const backstoryPages = {
        1: {
            images: [{ src: '/images/elmo.png', position: 'center', size: '30%' }],
            audio: '/audios/1_elmo.mp3',
        },
        2: {
            images: [{ src: '/images/elmo_ball.png', position: 'center', size: '30%' }],
            audio: '/audios/2_elmo_ball.mp3',
        },
        3: {
            images: [{ src: '/images/kermit.png', position: 'left_center', size: '30%' }],
            audio: '/audios/3_kermit.mp3',
        },
        4: {
            images: [
                { src: '/images/kermit.png', position: 'left_center', size: '30%' },
                { src: '/images/grass.png', position: 'right_center', size: '30%' }
            ],
            audio: '/audios/4_kermit_grass.mp3',
        },
        5: {
            images: [{ src: '/images/cookiemonster.png', position: 'left_center', size: '30%' }],
            audio: '/audios/5_cookiemonster.mp3',
        },
        6: {
            images: [
                { src: '/images/cookiemonster.png', position: 'left_center', size: '30%' },
                { src: '/images/lake.png', position: 'right_center', size: '30%' }
            ],
            audio: '/audios/6_cookiemonster_lake.mp3',
        },
        7: {
            timedImages: true, // Flag to indicate this page uses timed images
            timedImagesConfig: [
                { src: '/images/areaintro_1.png', startTime: 0, endTime: 9, position: 'center', size: '90%' },
                { src: '/images/areaintro_2.png', startTime: 9, endTime: 15, position: 'center', size: '90%' },
                { src: '/images/areaintro_3.png', startTime: 15, endTime: null, position: 'center', size: '90%' },
            ],
            images: [{ src: '/images/areaintro_1.png', position: 'center', size: '90%' }], // Default/initial image
            audio: '/audios/7_area.mp3',
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
            console.log("=== COMPLETE EXPERIMENT TIMELINE (JSON) ===");
            console.log(JSON.stringify(completeTimeline, null, 2));
            console.log("============================================");
        }
    }, [currentPage, timelineData, experimentStarted]);

    // Reset audio state when page changes (only for training pages)
    useEffect(() => {
        if (currentPage > 0) {
            console.log("BackstoryPage: Page changed to", currentPage);
            setAudioPlayed(false);
            setAudioFinished(false);
            setCurrentImageIndex(0);
            hasAutoAdvancedRef.current = false; // Reset auto-advance flag when page changes
            if (audioRef.current) {
                audioRef.current.currentTime = 0;
                audioRef.current.pause();
            }
        }
    }, [currentPage]);

    // Auto-play audio when page loads
    useEffect(() => {
        if (audioRef.current && !audioPlayed && currentPageSpec) {
            console.log("BackstoryPage: Attempting to play audio for page", currentPage);
            audioRef.current.play().catch(error => {
                console.log("Audio autoplay prevented:", error);
                setAudioFinished(true); // Show button immediately if autoplay fails
            });
            setAudioPlayed(true);
        }
    }, [audioPlayed, currentPage, currentPageSpec]);

    // Define handleNext before using it in useEffect
    const handleNext = React.useCallback(async () => {
        if (currentPage === 0) {
            // From timeline page, go to first training page
            console.log("BackstoryPage: Moving from timeline to P1");
            setCurrentPage(1);
        } else if (currentPage < 7) {
            // Between training pages
            console.log("BackstoryPage: Moving to next page", currentPage + 1);
            setCurrentPage(currentPage + 1);
        } else {
            // After p7, navigate to experiment phase
            console.log("BackstoryPage: Backstory complete, navigating to experiment");
            navigate('experiment');
        }
    }, [currentPage, navigate]);

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

    // Handle timed image switching for p7
    useEffect(() => {
        const pageSpec = backstoryPages[currentPage];
        if (!pageSpec || !pageSpec.timedImages || !pageSpec.timedImagesConfig) {
            return;
        }

        const audio = audioRef.current;
        if (!audio) return;

        const handleTimeUpdate = () => {
            const currentTime = audio.currentTime;
            const timedImages = pageSpec.timedImagesConfig;
            
            // Find the correct image index based on current time
            for (let i = timedImages.length - 1; i >= 0; i--) {
                const img = timedImages[i];
                if (currentTime >= img.startTime && (img.endTime === null || currentTime < img.endTime)) {
                    setCurrentImageIndex(prevIndex => {
                        if (prevIndex !== i) {
                            return i;
                        }
                        return prevIndex;
                    });
                    break;
                }
            }
        };

        audio.addEventListener('timeupdate', handleTimeUpdate);
        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate);
        };
    }, [currentPage, audioPlayed]);

    // Add keyboard shortcuts for testing: Press 'Q' or 'Shift+S' to skip to next page
    useEffect(() => {
        const handleKeyPress = (e) => {
            if (e.key === 'Q' || e.key === 'q' || (e.shiftKey && (e.key === 'S' || e.key === 's'))) {
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
            {/* Audio element */}
            <audio
                ref={audioRef}
                src={currentPageSpec.audio}
                preload="auto"
            />

            {/* Page indicator */}
            <div style={{
                position: "absolute",
                top: "20px",
                left: "20px",
                fontSize: "18px",
                fontWeight: "bold",
                color: "#333",
                zIndex: 10,
            }}>
                Training Page {currentPage}/7
            </div>

            {/* Images */}
            {currentPageSpec.timedImages && currentPageSpec.timedImagesConfig ? (
                // Render timed images (p7)
                (() => {
                    const currentImage = currentPageSpec.timedImagesConfig[currentImageIndex] || currentPageSpec.timedImagesConfig[0];
                    return (
                        <img
                            key={currentImageIndex}
                            src={currentImage.src}
                            alt=""
                            style={getImageStyle(currentImage)}
                        />
                    );
                })()
            ) : (
                // Render regular images (p1-p6)
                currentPageSpec.images.map((image, index) => (
                    <img
                        key={index}
                        src={image.src}
                        alt=""
                        style={getImageStyle(image)}
                    />
                ))
            )}

            {/* Audio playing indicator */}
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
                    Playing audio...
                </div>
            )}
        </div>
    );
};

export default BackstoryPage;