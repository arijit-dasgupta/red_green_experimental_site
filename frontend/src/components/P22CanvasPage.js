import React, { useEffect, useRef, useState } from 'react';

/**
 * Dedicated component for p22: Video with audio and video overlays
 * - Audio: 19_final_reminder.mp3 (starts immediately)
 * - Main video: final_reminder.mp4 (appears immediately, starts playing at 22 seconds into audio)
 * - Videos (visual only, muted, centered overlay, 70% size):
 *   - Fkey_short.mp4 plays 47 seconds into 19_final_reminder.mp3
 *   - Jkey_short.mp4 plays 52 seconds into 19_final_reminder.mp3
 * - Auto-advance when 19_final_reminder.mp3 finishes
 */
const P22CanvasPage = ({ fetchNextScene, setdisableCountdownTrigger }) => {
    console.log("🎬 P22CanvasPage: Component mounted/rendered");
    const audioRef = useRef(null); // Audio: 19_final_reminder.mp3
    const mainVideoRef = useRef(null); // Main video: final_reminder.mp4
    const fkeyVideoRef = useRef(null); // Fkey_short.mp4 video
    const jkeyVideoRef = useRef(null); // Jkey_short.mp4 video
    const [audioFinished, setAudioFinished] = useState(false);
    const [fkeyVideoPlaying, setFkeyVideoPlaying] = useState(false);
    const [jkeyVideoPlaying, setJkeyVideoPlaying] = useState(false);
    const hasAutoAdvancedRef = useRef(false); // Track if we've already auto-advanced
    const mainVideoTimerRef = useRef(null); // Timer for starting main video at 22s
    const fkeyVideoTimerRef = useRef(null); // Timer for starting Fkey video at 47s
    const jkeyVideoTimerRef = useRef(null); // Timer for starting Jkey video at 56s

    // Listen for audio play and set up video timers
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleAudioPlay = () => {
            console.log('▶️ P22CanvasPage: Audio started playing');
            console.log('🔍 P22CanvasPage: Checking video refs...');
            console.log('🔍 P22CanvasPage: mainVideoRef.current:', mainVideoRef.current);
            console.log('🔍 P22CanvasPage: fkeyVideoRef.current:', fkeyVideoRef.current);
            console.log('🔍 P22CanvasPage: jkeyVideoRef.current:', jkeyVideoRef.current);
            
            // Set timer to start main video at 22 seconds
            if (mainVideoTimerRef.current) {
                clearTimeout(mainVideoTimerRef.current);
            }
            console.log("⏰ P22CanvasPage: Setting timer to start main video at 22 seconds...");
            mainVideoTimerRef.current = setTimeout(() => {
                console.log("⏰ P22CanvasPage: Timer fired at 22s! Starting main video...");
                console.log("🔍 P22CanvasPage: mainVideoRef.current at timer fire:", mainVideoRef.current);
                if (mainVideoRef.current) {
                    console.log("🎬 P22CanvasPage: Starting final_reminder.mp4 video (22 seconds into audio)");
                    console.log("🔍 P22CanvasPage: Video readyState:", mainVideoRef.current.readyState);
                    mainVideoRef.current.currentTime = 0;
                    const videoPlayPromise = mainVideoRef.current.play();
                    if (videoPlayPromise !== undefined) {
                        videoPlayPromise
                            .then(() => {
                                console.log('✅ P22CanvasPage: Main video started successfully');
                            })
                            .catch(error => {
                                console.error("❌ P22CanvasPage: Main video autoplay prevented:", error);
                            });
                    }
                } else {
                    console.error("❌ P22CanvasPage: mainVideoRef.current is null!");
                }
            }, 22000); // 22 seconds

            // Set timer to start Fkey video at 47 seconds
            if (fkeyVideoTimerRef.current) {
                clearTimeout(fkeyVideoTimerRef.current);
            }
            console.log("⏰ P22CanvasPage: Setting timer to start Fkey video at 47 seconds...");
            fkeyVideoTimerRef.current = setTimeout(() => {
                console.log("⏰ P22CanvasPage: Timer fired at 47s! Starting Fkey video...");
                console.log("🔍 P22CanvasPage: fkeyVideoRef.current at timer fire:", fkeyVideoRef.current);
                if (fkeyVideoRef.current) {
                    console.log("🎬 P22CanvasPage: Starting Fkey_short.mp4 video (47 seconds into audio)");
                    console.log("🔍 P22CanvasPage: Video readyState:", fkeyVideoRef.current.readyState);
                    fkeyVideoRef.current.currentTime = 0;
                    // Ensure video is visible
                    setFkeyVideoPlaying(true);
                    const videoPlayPromise = fkeyVideoRef.current.play();
                    if (videoPlayPromise !== undefined) {
                        videoPlayPromise
                            .then(() => {
                                console.log('✅ P22CanvasPage: Fkey video started successfully');
                            })
                            .catch(error => {
                                console.error("❌ P22CanvasPage: Fkey video autoplay prevented:", error);
                                setFkeyVideoPlaying(false);
                            });
                    }
                } else {
                    console.error("❌ P22CanvasPage: fkeyVideoRef.current is null!");
                }
            }, 47000); // 47 seconds

            // Set timer to start Jkey video at 52 seconds
            if (jkeyVideoTimerRef.current) {
                clearTimeout(jkeyVideoTimerRef.current);
            }
            console.log("⏰ P22CanvasPage: Setting timer to start Jkey video at 52 seconds...");
            jkeyVideoTimerRef.current = setTimeout(() => {
                console.log("⏰ P22CanvasPage: Timer fired at 52s! Starting Jkey video...");
                console.log("🔍 P22CanvasPage: jkeyVideoRef.current at timer fire:", jkeyVideoRef.current);
                if (jkeyVideoRef.current) {
                    console.log("🎬 P22CanvasPage: Starting Jkey_short.mp4 video (52 seconds into audio)");
                    console.log("🔍 P22CanvasPage: Video readyState:", jkeyVideoRef.current.readyState);
                    jkeyVideoRef.current.currentTime = 0;
                    // Ensure video is visible
                    setJkeyVideoPlaying(true);
                    const videoPlayPromise = jkeyVideoRef.current.play();
                    if (videoPlayPromise !== undefined) {
                        videoPlayPromise
                            .then(() => {
                                console.log('✅ P22CanvasPage: Jkey video started successfully');
                            })
                            .catch(error => {
                                console.error("❌ P22CanvasPage: Jkey video autoplay prevented:", error);
                                setJkeyVideoPlaying(false);
                            });
                    }
                } else {
                    console.error("❌ P22CanvasPage: jkeyVideoRef.current is null!");
                }
            }, 52000); // 52 seconds
        };

        const handleAudioEnd = () => {
            console.log('🏁 P22CanvasPage: Audio (19_final_reminder.mp3) ended at', new Date().toISOString());
            if (audioRef.current) {
                console.log(`⏱️ P22CanvasPage: Audio actual duration: ${audioRef.current.duration.toFixed(2)}s`);
            }
            setAudioFinished(true);
        };

        audio.addEventListener('play', handleAudioPlay);
        audio.addEventListener('ended', handleAudioEnd);
        return () => {
            audio.removeEventListener('play', handleAudioPlay);
            audio.removeEventListener('ended', handleAudioEnd);
            // Clean up timers
            if (mainVideoTimerRef.current) {
                clearTimeout(mainVideoTimerRef.current);
            }
            if (fkeyVideoTimerRef.current) {
                clearTimeout(fkeyVideoTimerRef.current);
            }
            if (jkeyVideoTimerRef.current) {
                clearTimeout(jkeyVideoTimerRef.current);
            }
        };
    }, []);

    // Listen for video ends (for logging only)
    useEffect(() => {
        const fkeyVideo = fkeyVideoRef.current;
        if (fkeyVideo) {
            const handleFkeyVideoEnd = () => {
                console.log('🏁 P22CanvasPage: Fkey video ended');
                setFkeyVideoPlaying(false);
            };
            fkeyVideo.addEventListener('ended', handleFkeyVideoEnd);
            return () => {
                fkeyVideo.removeEventListener('ended', handleFkeyVideoEnd);
            };
        }
    }, []);

    useEffect(() => {
        const jkeyVideo = jkeyVideoRef.current;
        if (jkeyVideo) {
            const handleJkeyVideoEnd = () => {
                console.log('🏁 P22CanvasPage: Jkey video ended');
                setJkeyVideoPlaying(false);
            };
            jkeyVideo.addEventListener('ended', handleJkeyVideoEnd);
            return () => {
                jkeyVideo.removeEventListener('ended', handleJkeyVideoEnd);
            };
        }
    }, []);

    // Auto-start audio when component mounts
    useEffect(() => {
        // Reset states
            setAudioFinished(false);
            setFkeyVideoPlaying(false);
            setJkeyVideoPlaying(false);
        hasAutoAdvancedRef.current = false;
            
            // Clean up any running timers
        if (mainVideoTimerRef.current) {
            clearTimeout(mainVideoTimerRef.current);
            mainVideoTimerRef.current = null;
        }
            if (fkeyVideoTimerRef.current) {
                clearTimeout(fkeyVideoTimerRef.current);
                fkeyVideoTimerRef.current = null;
            }
        if (jkeyVideoTimerRef.current) {
            clearTimeout(jkeyVideoTimerRef.current);
            jkeyVideoTimerRef.current = null;
        }
            
            // Start audio playback
            if (audioRef.current) {
                console.log('🔊 P22CanvasPage: Starting audio playback');
                console.log('🔊 P22CanvasPage: Audio src:', audioRef.current.src);
                console.log('🔊 P22CanvasPage: Audio readyState:', audioRef.current.readyState);
                audioRef.current.currentTime = 0; // Reset audio to start
                const playPromise = audioRef.current.play();
                if (playPromise !== undefined) {
                    playPromise
                        .then(() => {
                            console.log('✅ P22CanvasPage: Audio playback started successfully');
                            console.log('🔊 P22CanvasPage: Audio duration:', audioRef.current.duration, 'seconds');
                            console.log(`📊 P22CanvasPage: Audio should finish at ${audioRef.current.duration.toFixed(2)}s`);
                        })
                        .catch(error => {
                            console.error("❌ P22CanvasPage: Audio autoplay prevented:", error);
                        });
                }
            } else {
                console.error('❌ P22CanvasPage: Audio ref is null - cannot play audio');
            }
    }, []);

    // Auto-advance when audio finishes
    useEffect(() => {
        if (audioFinished && !hasAutoAdvancedRef.current) {
            // Audio finished, auto-advance after a short delay (only once)
            console.log("🎬 P22CanvasPage: Audio (19_final_reminder.mp3) finished, auto-advancing to next scene...");
            hasAutoAdvancedRef.current = true;
            
            // Clean up any running timers
            if (mainVideoTimerRef.current) {
                clearTimeout(mainVideoTimerRef.current);
            }
            if (fkeyVideoTimerRef.current) {
                clearTimeout(fkeyVideoTimerRef.current);
            }
            if (jkeyVideoTimerRef.current) {
                clearTimeout(jkeyVideoTimerRef.current);
            }
            
            const timer = setTimeout(() => {
                console.log("🎬 P22CanvasPage: Calling fetchNextScene to load next page...");
                fetchNextScene(setdisableCountdownTrigger);
            }, 500); // 500ms delay for smooth transition
            return () => clearTimeout(timer);
        }
    }, [audioFinished, fetchNextScene, setdisableCountdownTrigger]);

    // Add keyboard shortcut: Press 'Shift+S' to skip to next page
    useEffect(() => {
        const handleKeyPress = (e) => {
            if (e.shiftKey && (e.key === 'S' || e.key === 's')) {
                console.log("SKIP KEY PRESSED: Shift+S detected in P22CanvasPage, skipping to next page");
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

    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "100vh",
            background: "#ffffff",
            padding: "20px",
            position: "relative",
        }}>
            {/* Audio: 19_final_reminder.mp3 */}
            <audio
                ref={audioRef}
                src="/audios/19_final_reminder.mp3"
                preload="auto"
                onLoadedData={() => console.log('🔊 P22CanvasPage: Audio loaded, duration:', audioRef.current?.duration)}
                onPlay={() => console.log('▶️ P22CanvasPage: Audio started playing')}
                onPause={() => console.log('⏸️ P22CanvasPage: Audio paused')}
                onEnded={() => console.log('🏁 P22CanvasPage: Audio ended')}
                onError={(e) => console.error('❌ P22CanvasPage: Audio error:', e)}
            />

            {/* Main video: final_reminder.mp4 - always visible, starts playing at 22s */}
            <div style={{
                position: "relative",
                display: "inline-block",
                maxWidth: "80vw",
                maxHeight: "80vh",
            }}>
                <video
                    ref={mainVideoRef}
                    src="/videos/final_reminder.mp4"
                    muted
                    playsInline
                    preload="auto"
                    style={{
                        maxWidth: "100%",
                        maxHeight: "100%",
                        display: "block",
                    }}
                    onLoadStart={() => console.log('📹 P22CanvasPage: Main video load started')}
                    onLoadedData={() => {
                        console.log('📹 P22CanvasPage: Main video loaded, readyState:', mainVideoRef.current?.readyState);
                    }}
                    onCanPlay={() => console.log('📹 P22CanvasPage: Main video can play')}
                    onPlay={() => console.log('▶️ P22CanvasPage: Main video playing')}
                    onEnded={() => console.log('🏁 P22CanvasPage: Main video ended')}
                    onError={(e) => {
                        console.error('❌ P22CanvasPage: Main video error:', e);
                        console.error('❌ P22CanvasPage: Video error details:', e.target?.error);
                    }}
                />
            </div>

            {/* Video overlays - always rendered but hidden when not playing, positioned fixed in center of viewport */}
            {/* Fkey video - always in DOM so ref is available, use opacity instead of display for better browser compatibility */}
            <div style={{
                position: "fixed",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                zIndex: 9999, // Very high z-index to be on top of everything
                pointerEvents: "none", // Don't block interactions
                backgroundColor: "transparent",
                opacity: fkeyVideoPlaying ? 1 : 0,
                visibility: fkeyVideoPlaying ? "visible" : "hidden",
                display: "block", // Always display so video can play
            }}>
                <video
                    ref={fkeyVideoRef}
                    src="/videos/Fkey_short.mp4"
                    muted
                    playsInline
                    preload="auto"
                    style={{
                        width: "70vw",
                        height: "auto",
                        maxHeight: "70vh",
                        display: "block",
                    }}
                    onLoadStart={() => console.log('📹 P22CanvasPage: Fkey video load started')}
                    onLoadedData={() => {
                        console.log('📹 P22CanvasPage: Fkey video loaded, readyState:', fkeyVideoRef.current?.readyState);
                    }}
                    onCanPlay={() => console.log('📹 P22CanvasPage: Fkey video can play')}
                    onPlay={() => {
                        console.log('▶️ P22CanvasPage: Fkey video playing');
                        setFkeyVideoPlaying(true);
                    }}
                    onEnded={() => {
                        console.log('🏁 P22CanvasPage: Fkey video ended');
                        setFkeyVideoPlaying(false);
                    }}
                    onError={(e) => {
                        console.error('❌ P22CanvasPage: Fkey video error:', e);
                        console.error('❌ P22CanvasPage: Video error details:', e.target?.error);
                    }}
                />
            </div>
            {/* Jkey video - always in DOM so ref is available, use opacity instead of display for better browser compatibility */}
            <div style={{
                position: "fixed",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                zIndex: 9999, // Very high z-index to be on top of everything
                pointerEvents: "none", // Don't block interactions
                backgroundColor: "transparent",
                opacity: jkeyVideoPlaying ? 1 : 0,
                visibility: jkeyVideoPlaying ? "visible" : "hidden",
                display: "block", // Always display so video can play
            }}>
                <video
                    ref={jkeyVideoRef}
                    src="/videos/Jkey_short.mp4"
                    muted
                    playsInline
                    preload="auto"
                    style={{
                        width: "70vw",
                        height: "auto",
                        maxHeight: "70vh",
                        display: "block",
                    }}
                    onLoadStart={() => console.log('📹 P22CanvasPage: Jkey video load started')}
                    onLoadedData={() => {
                        console.log('📹 P22CanvasPage: Jkey video loaded, readyState:', jkeyVideoRef.current?.readyState);
                    }}
                    onCanPlay={() => console.log('📹 P22CanvasPage: Jkey video can play')}
                    onPlay={() => {
                        console.log('▶️ P22CanvasPage: Jkey video playing');
                        setJkeyVideoPlaying(true);
                    }}
                    onEnded={() => {
                        console.log('🏁 P22CanvasPage: Jkey video ended');
                        setJkeyVideoPlaying(false);
                    }}
                    onError={(e) => {
                        console.error('❌ P22CanvasPage: Jkey video error:', e);
                        console.error('❌ P22CanvasPage: Video error details:', e.target?.error);
                    }}
                />
            </div>

            {/* Audio/video playing indicator - always rendered to prevent layout shift */}
            <div style={{
                marginTop: "20px",
                fontSize: "1.2rem",
                color: "#666",
                fontStyle: "italic",
                minHeight: "30px", // Fixed height to prevent layout shift
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
            }}>
                {!audioFinished ? "Playing audio and video..." : ""}
            </div>
        </div>
    );
};

export default P22CanvasPage;
