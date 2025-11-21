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
            images: [{ src: '/images/old_machine.png', position: 'center', size: '80%' }],
            audio: '/audios/7_area.mp3',
        },
    };

    const currentPageSpec = backstoryPages[currentPage];

    // Reset audio state when page changes
    useEffect(() => {
        console.log("BackstoryPage: Page changed to", currentPage);
        setAudioPlayed(false);
        setAudioFinished(false);
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

    // Listen for audio end event
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleAudioEnd = () => {
            setAudioFinished(true);
        };

        audio.addEventListener('ended', handleAudioEnd);
        return () => {
            audio.removeEventListener('ended', handleAudioEnd);
        };
    }, [currentPage]);

    const handleNext = async () => {
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

                const response = await fetch(
                    `/start_experiment/redgreen?PROLIFIC_PID=${prolific_pid}&STUDY_ID=${study_id}&SESSION_ID=${prolific_session_id}`,
                    { method: "POST", 
                        headers: { 
                            'ngrok-skip-browser-warning': 'true',
                            'User-Agent': 'React-Experiment-App',
                         } 
                    }
                );
                
                if (!response.ok) {
                    const errorData = await response.json();
                    console.error("Error starting experiment:", errorData);
                    return;
                }

                const data = await response.json();
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
    };

    // Add keyboard shortcut for testing: Press 'Q' to skip to next page
    useEffect(() => {
        const handleKeyPress = (e) => {
            if (e.key === 'Q' || e.key === 'q') {
                console.log("SKIP KEY PRESSED: Q key detected in BackstoryPage");
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
    }, [currentPage]);

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
            {currentPageSpec.images.map((image, index) => (
                <img
                    key={index}
                    src={image.src}
                    alt=""
                    style={getImageStyle(image)}
                />
            ))}

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

            {/* Next button (appears after audio finishes) */}
            {audioFinished && (
                <button
                    onClick={handleNext}
                    style={{
                        position: "absolute",
                        bottom: "50px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        padding: "15px 30px",
                        fontSize: "18px",
                        backgroundColor: "#007bff",
                        color: "white",
                        border: "none",
                        borderRadius: "5px",
                        cursor: "pointer",
                        zIndex: 10,
                    }}
                >
                    {currentPage < 7 ? 'Next' : 'Continue to Game'}
                </button>
            )}
        </div>
    );
};

export default BackstoryPage;