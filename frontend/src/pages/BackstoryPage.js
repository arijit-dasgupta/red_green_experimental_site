import React, { useEffect, useRef, useState } from 'react';
import { useNavigation } from '../contexts/NavigationContext';

/**
 * BackstoryPage component for presenting story content (p1-p7) before familiarization
 * Each page shows images with audio narration
 */
const BackstoryPage = () => {
    const { navigate } = useNavigation();
    const audioRef = useRef(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [audioPlayed, setAudioPlayed] = useState(false);
    const [audioFinished, setAudioFinished] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const hasAutoAdvancedRef = useRef(false); // Track if we've already auto-advanced for current page

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

    const currentPageSpec = backstoryPages[currentPage];

    // Reset audio state when page changes
    useEffect(() => {
        console.log("BackstoryPage: Page changed to", currentPage);
        setAudioPlayed(false);
        setAudioFinished(false);
        setCurrentImageIndex(0);
        hasAutoAdvancedRef.current = false; // Reset auto-advance flag when page changes
        if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.pause();
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
        if (currentPage < 7) {
            console.log("BackstoryPage: Moving to next page", currentPage + 1);
            setCurrentPage(currentPage + 1);
        } else {
            console.log("BackstoryPage: Backstory complete, starting experiment session");
            // After p7, we need to start the experiment session and go to experiment phase
            try {
                const prolific_pid = sessionStorage.getItem("prolific_pid");
                const study_id = sessionStorage.getItem("study_id");
                const prolific_session_id = sessionStorage.getItem("prolific_session_id");
                
                console.log("BackstoryPage: Prolific parameters:", {
                    prolific_pid,
                    study_id,
                    prolific_session_id
                });

                // Use test values if Prolific parameters are missing (for development/testing)
                // Generate unique IDs to avoid duplicate_pid errors
                const timestamp = Date.now();
                const random = Math.random().toString(36).substring(2, 9);
                const testPid = prolific_pid || `test_${timestamp}_${random}`;
                const testStudyId = study_id || 'test_study';
                const testSessionId = prolific_session_id || `test_session_${timestamp}_${random}`;

                console.log("BackstoryPage: Using parameters:", {
                    testPid,
                    testStudyId,
                    testSessionId
                });

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
                    let errorData;
                    const contentType = response.headers.get("content-type");
                    try {
                        if (contentType && contentType.includes("application/json")) {
                            errorData = await response.json();
                        } else {
                            const text = await response.text();
                            console.error("Error starting experiment - Non-JSON response:", text.substring(0, 200));
                            errorData = { message: `Server error (${response.status}): ${text.substring(0, 100)}` };
                        }
                    } catch (parseError) {
                        console.error("Error parsing error response:", parseError);
                        errorData = { message: `Server error (${response.status}): Unable to parse response` };
                    }
                    console.error("Error starting experiment - Status:", response.status);
                    console.error("Error starting experiment - Data:", errorData);
                    console.error("Error starting experiment - Message:", errorData.message || 'No message');
                    return;
                }

                let data;
                try {
                    data = await response.json();
                } catch (parseError) {
                    console.error("Error parsing success response:", parseError);
                    const text = await response.text();
                    console.error("Response text:", text.substring(0, 200));
                    throw new Error("Failed to parse server response as JSON");
                }
                sessionStorage.setItem("sessionId", data.session_id);
                sessionStorage.setItem("startTimeUtc", data.start_time_utc);
                sessionStorage.setItem("timeoutPeriod", data.timeout_period_seconds);
                sessionStorage.setItem("checkTimeoutInterval", data.check_timeout_interval_seconds);

                console.log("BackstoryPage: Experiment session started, navigating to experiment");
                navigate('experiment');
            } catch (error) {
                console.error("Error starting experiment:", error);
            }
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
                Backstory {currentPage}/7
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