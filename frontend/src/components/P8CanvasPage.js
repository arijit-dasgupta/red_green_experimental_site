import React, { useEffect, useRef, useState } from 'react';
import { config } from '../config';

/**
 * Dedicated component for p8: Canvas with audio and image overlay
 * - Audio: 8_ball_intro.mp3
 * - Canvas: T_ball_still trial data
 * - Image: elmo.png on left middle of canvas, 10% size
 */
const P8CanvasPage = ({ fetchNextScene, setdisableCountdownTrigger }) => {
    const canvasRef = useRef(null);
    const audioRef = useRef(null);
    const [sceneData, setSceneData] = useState(null);
    const [currentFrame, setCurrentFrame] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [audioFinished, setAudioFinished] = useState(false);
    const animationRef = useRef(null);
    const lastTimestampRef = useRef(null);
    const ballTextureRef = useRef(null);
    const occluderTextureRef = useRef(null);

    // Load textures
    useEffect(() => {
        const ballTexture = new Image();
        ballTexture.src = config.ballTexturePath || '/ball.png';
        ballTexture.onload = () => {
            ballTextureRef.current = ballTexture;
        };

        const occluderTexture = new Image();
        occluderTexture.src = config.occluderTexturePath || '/cloud.jpg';
        occluderTexture.onload = () => {
            occluderTextureRef.current = occluderTexture;
        };
    }, []);

    // Load T_ball_still trial data
    useEffect(() => {
        const loadTrialData = async () => {
            try {
                // Fetch the specific trial data from backend
                const response = await fetch('/load_trial_data/T_ball_still', {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    setSceneData(data);
                } else {
                    // Fallback: try to load from a direct path or use a default structure
                    console.error('Failed to load T_ball_still data, using fallback');
                    // We'll need to create a backend endpoint or load it differently
                }
            } catch (error) {
                console.error('Error loading trial data:', error);
            }
        };

        loadTrialData();
    }, []);

    // Render frame function
    const renderFrame = (frameIndex) => {
        const canvas = canvasRef.current;
        if (!canvas || !sceneData) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { barriers, occluders, step_data, red_sensor, green_sensor, radius, worldWidth, worldHeight } = sceneData;

        // Enable high-quality rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Calculate scale
        const scale = Math.min(canvas.width / worldWidth, canvas.height / worldHeight);

        // Transform coordinate system (flip Y to match website's coordinate system)
        ctx.save();
        ctx.scale(1, -1);
        ctx.translate(0, -canvas.height);

        // Draw barriers (skip frame 0)
        if (frameIndex !== 0) {
            barriers.forEach(({ x, y, width, height }) => {
                const scaledX = x * scale;
                const scaledY = y * scale;
                const scaledWidth = width * scale;
                const scaledHeight = height * scale;
                
                ctx.fillStyle = "black";
                ctx.fillRect(scaledX, scaledY, scaledWidth, scaledHeight);
            });
        }

        // Draw sensors
        if (red_sensor) {
            const { x, y, width, height } = red_sensor;
            ctx.fillStyle = "red";
            ctx.fillRect(x * scale, y * scale, width * scale, height * scale);
        }

        if (green_sensor) {
            const { x, y, width, height } = green_sensor;
            ctx.fillStyle = "green";
            ctx.fillRect(x * scale, y * scale, width * scale, height * scale);
        }

        // Draw ball
        if (step_data && step_data[frameIndex]) {
            const ballPos = step_data[frameIndex];
            const ballX = ballPos.x * scale;
            const ballY = ballPos.y * scale;
            const ballRadius = (radius || 0.5) * scale;

            if (ballTextureRef.current && ballTextureRef.current.complete) {
                // Draw textured ball with rotation
                const size = ballRadius * 2;
                const timeSeconds = frameIndex / (sceneData.fps || 30);
                const rotationDegrees = (timeSeconds * (config.ballRotationRate || 180)) % 360;
                
                ctx.save();
                ctx.translate(ballX, ballY);
                ctx.rotate((rotationDegrees * Math.PI) / 180);
                ctx.drawImage(ballTextureRef.current, -ballRadius, -ballRadius, size, size);
                ctx.restore();
            } else {
                ctx.fillStyle = "blue";
                ctx.beginPath();
                ctx.arc(ballX, ballY, ballRadius, 0, 2 * Math.PI);
                ctx.fill();
            }
        }

        // Draw occluders (on top of everything)
        occluders.forEach(({ x, y, width, height }) => {
            const scaledX = x * scale;
            const scaledY = y * scale;
            const scaledWidth = width * scale;
            const scaledHeight = height * scale;
            
            if (occluderTextureRef.current && occluderTextureRef.current.complete) {
                // Simple texture drawing (can be improved with tiling if needed)
                ctx.drawImage(occluderTextureRef.current, scaledX, scaledY, scaledWidth, scaledHeight);
            } else {
                ctx.fillStyle = "gray";
                ctx.fillRect(scaledX, scaledY, scaledWidth, scaledHeight);
            }
        });

        ctx.restore();
    };

    // Animation loop
    useEffect(() => {
        if (!isPlaying || !sceneData) return;

        const animate = (timestamp) => {
            if (!lastTimestampRef.current) {
                lastTimestampRef.current = timestamp;
            }

            const elapsed = timestamp - lastTimestampRef.current;
            const frameTime = 1000 / (sceneData.fps || 30);
            
            if (elapsed >= frameTime) {
                const nextFrame = currentFrame + 1;
                const maxFrames = Object.keys(sceneData.step_data || {}).length;

                if (nextFrame < maxFrames) {
                    setCurrentFrame(nextFrame);
                    renderFrame(nextFrame);
                    lastTimestampRef.current = timestamp;
                } else {
                    setIsPlaying(false);
                }
            }

            if (isPlaying) {
                animationRef.current = requestAnimationFrame(animate);
            }
        };

        animationRef.current = requestAnimationFrame(animate);
        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [isPlaying, currentFrame, sceneData]);

    // Auto-start when scene data is loaded
    useEffect(() => {
        if (sceneData && !isPlaying) {
            setIsPlaying(true);
            setCurrentFrame(0);
            renderFrame(0);
        }
    }, [sceneData]);

    // Auto-play audio
    useEffect(() => {
        if (audioRef.current && !audioFinished) {
            audioRef.current.play().catch(error => {
                console.log("Audio autoplay prevented:", error);
            });
        }
    }, []);

    // Listen for audio end
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
    }, []);

    // Handle next button
    const handleNext = () => {
        fetchNextScene(setdisableCountdownTrigger);
    };

    // Add keyboard shortcut: Press 'Shift+S' to skip to next page
    useEffect(() => {
        const handleKeyPress = (e) => {
            if (e.shiftKey && (e.key === 'S' || e.key === 's')) {
                console.log("SKIP KEY PRESSED: Shift+S detected in P8CanvasPage, skipping to next page");
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

    // Calculate canvas size
    const canvasSize = sceneData ? {
        width: Math.min(800, window.innerWidth * 0.8),
        height: Math.min(600, window.innerHeight * 0.8)
    } : { width: 800, height: 600 };

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
            <audio
                ref={audioRef}
                src="/audios/8_ball_intro.mp3"
                preload="auto"
            />

            {/* Canvas container with elmo image */}
            <div style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "20px",
            }}>
                {/* Elmo image - left of canvas, vertically centered */}
                <img
                    src="/images/elmo.png"
                    alt=""
                    style={{
                        width: `${canvasSize.width * 0.1}px`, // 10% of canvas width
                        height: "auto",
                        maxWidth: "150px",
                        objectFit: "contain",
                    }}
                />

                {/* Canvas */}
                <canvas
                    ref={canvasRef}
                    width={canvasSize.width}
                    height={canvasSize.height}
                    style={{
                        border: "2px solid #000",
                        display: "block",
                    }}
                />
            </div>

            {/* Next button appears after audio finishes */}
            {audioFinished && (
                <button
                    onClick={handleNext}
                    style={{
                        marginTop: "30px",
                        padding: "15px 30px",
                        fontSize: "1.2rem",
                        color: "white",
                        backgroundColor: "#007bff",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontWeight: "bold",
                        boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",
                    }}
                >
                    Next
                </button>
            )}

            {/* Audio playing indicator */}
            {!audioFinished && (
                <div style={{
                    marginTop: "20px",
                    fontSize: "1.2rem",
                    color: "#666",
                    fontStyle: "italic",
                }}>
                    Playing audio...
                </div>
            )}
        </div>
    );
};

export default P8CanvasPage;

