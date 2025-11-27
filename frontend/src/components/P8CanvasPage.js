import React, { useEffect, useRef, useState } from 'react';
import { config } from '../config';

/**
 * Dedicated component for p8: Canvas with audio and image overlay
 * - Audio: 8_ball_intro.mp3
 * - Canvas: T_ball_still trial data
 * - Image: elmo.png on left middle of canvas, 10% size
 * - Canvas size: 600x600 pixels (matching testing trials)
 * - Canvas border: 20px with barrier texture (matching testing trials)
 * - All textures: ball, barrier, sensors, occluder (matching testing trials)
 */
const P8CanvasPage = ({ fetchNextScene, setdisableCountdownTrigger }) => {
    const canvasRef = useRef(null);
    const audioRef = useRef(null);
    const [sceneData, setSceneData] = useState(null);
    const [currentFrame, setCurrentFrame] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [audioFinished, setAudioFinished] = useState(false);
    const [videoFinished, setVideoFinished] = useState(false);
    const animationRef = useRef(null);
    const lastTimestampRef = useRef(null);
    const hasAutoAdvancedRef = useRef(false); // Track if we've already auto-advanced
    
    // Texture refs (matching App.js)
    const ballTextureRef = useRef(null);
    const ballOffscreenCanvasRef = useRef(null);
    const barrierTextureRef = useRef(null);
    const redSensorTextureRef = useRef(null);
    const greenSensorTextureRef = useRef(null);
    const occluderTextureRef = useRef(null);

    // Fixed canvas size (matching testing trials)
    const canvasSize = { width: 600, height: 600 };

    // Load all textures (matching App.js)
    useEffect(() => {
        // Ball texture
        if (config.ballTexturePath && config.ballTexturePath.trim() !== '') {
            const ballTexture = new Image();
            ballTexture.src = config.ballTexturePath;
            ballTexture.onload = () => {
                ballTextureRef.current = ballTexture;
            };
        }

        // Barrier texture
        if (config.barrierTexturePath && config.barrierTexturePath.trim() !== '') {
            const barrierTexture = new Image();
            barrierTexture.src = config.barrierTexturePath;
            barrierTexture.onload = () => {
                barrierTextureRef.current = barrierTexture;
            };
        }

        // Red sensor texture
        if (config.redSensorTexturePath && config.redSensorTexturePath.trim() !== '') {
            const redSensorTexture = new Image();
            redSensorTexture.src = config.redSensorTexturePath;
            redSensorTexture.onload = () => {
                redSensorTextureRef.current = redSensorTexture;
            };
        }

        // Green sensor texture
        if (config.greenSensorTexturePath && config.greenSensorTexturePath.trim() !== '') {
            const greenSensorTexture = new Image();
            greenSensorTexture.src = config.greenSensorTexturePath;
            greenSensorTexture.onload = () => {
                greenSensorTextureRef.current = greenSensorTexture;
            };
        }

        // Occluder texture
        if (config.occluderTexturePath && config.occluderTexturePath.trim() !== '') {
            const occluderTexture = new Image();
            occluderTexture.src = config.occluderTexturePath;
            occluderTexture.onload = () => {
                occluderTextureRef.current = occluderTexture;
            };
        }
    }, []);

    // drawTiledTexture function (matching App.js)
    const drawTiledTexture = (ctx, texture, x, y, width, height) => {
        if (!texture || !texture.complete) return false;
        
        ctx.save();
        
        // Clip to the rectangle bounds
        ctx.beginPath();
        ctx.rect(x, y, width, height);
        ctx.clip();
        
        // Calculate aspect ratios
        const imgRatio = texture.width / texture.height;
        const containerRatio = width / height;
        
        let newW, newH, newX, newY;
        
        // Determine how to fit the image while maintaining aspect ratio
        if (imgRatio > containerRatio) {
            // Image is wider - fit to height, may overflow width
            newH = height;
            newW = height * imgRatio;
            newX = x - (newW - width) / 2; // Center horizontally
            newY = y;
        } else {
            // Image is taller - fit to width, may overflow height
            newW = width;
            newH = width / imgRatio;
            newX = x;
            newY = y - (newH - height) / 2; // Center vertically
        }
        
        // Flip vertically to compensate for the coordinate system flip (scale(1, -1))
        ctx.save();
        ctx.translate(newX, newY + newH);
        ctx.scale(1, -1);
        
        // Draw the full texture image at calculated size
        ctx.drawImage(texture, 0, 0, newW, newH);
        
        ctx.restore();
        ctx.restore();
        
        return true;
    };

    // Load T_ball_still trial data
    useEffect(() => {
        const loadTrialData = async () => {
            try {
                const response = await fetch('/api/load_trial_data/T_ball_still', {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    console.log('P8CanvasPage: Loaded trial data:', data);
                    setSceneData(data);
                } else {
                    const errorText = await response.text();
                    console.error('Failed to load T_ball_still data:', response.status, errorText);
                }
            } catch (error) {
                console.error('Error loading trial data:', error);
            }
        };

        loadTrialData();
    }, []);

    // Render frame function (matching App.js rendering logic)
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

        // Draw barriers with texture (skip frame 0)
        if (frameIndex !== 0) {
            barriers.forEach(({ x, y, width, height }) => {
                const scaledX = x * scale;
                const scaledY = y * scale;
                const scaledWidth = width * scale;
                const scaledHeight = height * scale;
                
                ctx.save();
                // Check if texture path is provided and texture is loaded
                if (config.barrierTexturePath && config.barrierTexturePath.trim() !== '' && 
                    barrierTextureRef.current && barrierTextureRef.current.complete) {
                    if (!drawTiledTexture(ctx, barrierTextureRef.current, scaledX, scaledY, scaledWidth, scaledHeight)) {
                        // Fallback to black fill if texture draw failed
                        ctx.fillStyle = "black";
                        ctx.fillRect(scaledX, scaledY, scaledWidth, scaledHeight);
                    }
                } else {
                    // Use original black fill if no texture path or texture not loaded
                    ctx.fillStyle = "black";
                    ctx.fillRect(scaledX, scaledY, scaledWidth, scaledHeight);
                }
                ctx.restore();
            });
        }

        // Draw sensors with texture
        if (red_sensor) {
            const { x, y, width, height } = red_sensor;
            const scaledX = x * scale;
            const scaledY = y * scale;
            const scaledWidth = width * scale;
            const scaledHeight = height * scale;
            
            ctx.save();
            // Check if texture path is provided and texture is loaded
            if (config.redSensorTexturePath && config.redSensorTexturePath.trim() !== '' && 
                redSensorTextureRef.current && redSensorTextureRef.current.complete) {
                if (!drawTiledTexture(ctx, redSensorTextureRef.current, scaledX, scaledY, scaledWidth, scaledHeight)) {
                    // Fallback to red fill if texture draw failed
                    ctx.fillStyle = "red";
                    ctx.fillRect(scaledX, scaledY, scaledWidth, scaledHeight);
                }
            } else {
                // Use original red fill if no texture path or texture not loaded
                ctx.fillStyle = "red";
                ctx.fillRect(scaledX, scaledY, scaledWidth, scaledHeight);
            }
            ctx.restore();
        }

        if (green_sensor) {
            const { x, y, width, height } = green_sensor;
            const scaledX = x * scale;
            const scaledY = y * scale;
            const scaledWidth = width * scale;
            const scaledHeight = height * scale;
            
            ctx.save();
            // Check if texture path is provided and texture is loaded
            if (config.greenSensorTexturePath && config.greenSensorTexturePath.trim() !== '' && 
                greenSensorTextureRef.current && greenSensorTextureRef.current.complete) {
                if (!drawTiledTexture(ctx, greenSensorTextureRef.current, scaledX, scaledY, scaledWidth, scaledHeight)) {
                    // Fallback to green fill if texture draw failed
                    ctx.fillStyle = "green";
                    ctx.fillRect(scaledX, scaledY, scaledWidth, scaledHeight);
                }
            } else {
                // Use original green fill if no texture path or texture not loaded
                ctx.fillStyle = "green";
                ctx.fillRect(scaledX, scaledY, scaledWidth, scaledHeight);
            }
            ctx.restore();
        }

        // Draw ball with texture and rotation (matching App.js)
        if (step_data && step_data[frameIndex]) {
            const { x, y } = step_data[frameIndex];
            const centerX = (x + radius) * scale;
            const centerY = (y + radius) * scale;
            const ballRadius = scale * radius;
            
            // Debug logging
            if (frameIndex === 0) {
                console.log('P8CanvasPage: Rendering ball at frame 0', {
                    x, y, radius, centerX, centerY, ballRadius, scale,
                    worldWidth, worldHeight, canvasWidth: canvas.width, canvasHeight: canvas.height
                });
            }
            
            // Use texture if path is provided and texture is loaded, otherwise fall back to blue fill
            if (config.ballTexturePath && config.ballTexturePath.trim() !== '' && 
                ballTextureRef.current && ballTextureRef.current.complete) {
                // Use supersampling (render at 2x resolution) for smoother edges
                const supersampleFactor = 2;
                const offscreenSize = Math.ceil(ballRadius * 2 * supersampleFactor);
                
                // Create or reuse offscreen canvas for high-res rendering
                if (!ballOffscreenCanvasRef.current || 
                    ballOffscreenCanvasRef.current.width !== offscreenSize) {
                    ballOffscreenCanvasRef.current = document.createElement('canvas');
                    ballOffscreenCanvasRef.current.width = offscreenSize;
                    ballOffscreenCanvasRef.current.height = offscreenSize;
                }
                
                const offscreenCanvas = ballOffscreenCanvasRef.current;
                const offscreenCtx = offscreenCanvas.getContext('2d');
                
                // Enable high-quality rendering on offscreen canvas
                offscreenCtx.imageSmoothingEnabled = true;
                offscreenCtx.imageSmoothingQuality = 'high';
                
                // Clear the offscreen canvas
                offscreenCtx.clearRect(0, 0, offscreenSize, offscreenSize);
                
                // Draw the ball on the offscreen canvas at higher resolution
                const offscreenCenter = offscreenSize / 2;
                const offscreenRadius = ballRadius * supersampleFactor;
                
                offscreenCtx.save();
                offscreenCtx.beginPath();
                offscreenCtx.arc(offscreenCenter, offscreenCenter, offscreenRadius, 0, 2 * Math.PI);
                offscreenCtx.clip();
                
                // Calculate rotation angle
                let rotationAngle = 0;
                if (config.ballRotationRate !== 0 && isPlaying) {
                    const fps = sceneData.fps || 30;
                    const elapsedSeconds = frameIndex / fps;
                    rotationAngle = (elapsedSeconds * config.ballRotationRate) * (Math.PI / 180);
                }
                
                // Apply rotation if needed
                if (rotationAngle !== 0) {
                    offscreenCtx.translate(offscreenCenter, offscreenCenter);
                    offscreenCtx.rotate(rotationAngle);
                    offscreenCtx.translate(-offscreenCenter, -offscreenCenter);
                }
                
                // Draw texture at higher resolution
                const textureSize = offscreenRadius * 2;
                offscreenCtx.drawImage(
                    ballTextureRef.current,
                    offscreenCenter - offscreenRadius,
                    offscreenCenter - offscreenRadius,
                    textureSize,
                    textureSize
                );
                offscreenCtx.restore();
                
                // Draw the high-res offscreen canvas to the main canvas (scaled down)
                ctx.save();
                ctx.drawImage(
                    offscreenCanvas,
                    centerX - ballRadius,
                    centerY - ballRadius,
                    ballRadius * 2,
                    ballRadius * 2
                );
                ctx.restore();
            } else {
                // Fallback to blue fill if texture not loaded
                ctx.beginPath();
                ctx.arc(centerX, centerY, ballRadius, 0, 2 * Math.PI);
                ctx.fillStyle = "blue";
                ctx.fill();
            }
        }

        // Draw occluders with texture (on top of everything)
        occluders.forEach(({ x, y, width, height }) => {
            const scaledX = x * scale;
            const scaledY = y * scale;
            const scaledWidth = width * scale;
            const scaledHeight = height * scale;
            
            ctx.save();
            // Check if texture path is provided and texture is loaded
            if (config.occluderTexturePath && config.occluderTexturePath.trim() !== '' && 
                occluderTextureRef.current && occluderTextureRef.current.complete) {
                if (!drawTiledTexture(ctx, occluderTextureRef.current, scaledX, scaledY, scaledWidth, scaledHeight)) {
                    // Fallback to gray fill if texture draw failed
                    ctx.fillStyle = "gray";
                    ctx.fillRect(scaledX, scaledY, scaledWidth, scaledHeight);
                }
            } else {
                // Use original gray fill if no texture path or texture not loaded
                ctx.fillStyle = "gray";
                ctx.fillRect(scaledX, scaledY, scaledWidth, scaledHeight);
            }
            ctx.restore();
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
                    setVideoFinished(true);
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

    // Auto-start when scene data is loaded and reset states
    useEffect(() => {
        if (sceneData) {
            setIsPlaying(false);
            setCurrentFrame(0);
            setVideoFinished(false);
            setAudioFinished(false);
            hasAutoAdvancedRef.current = false; // Reset auto-advance flag when new scene loads
            setIsPlaying(true);
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

    // Auto-advance when both audio and video finish (whichever finishes last)
    useEffect(() => {
        if (audioFinished && videoFinished && !hasAutoAdvancedRef.current) {
            // Both finished, auto-advance after a short delay (only once)
            console.log("🎬 P8CanvasPage: Audio and video finished, auto-advancing to next scene...");
            hasAutoAdvancedRef.current = true;
            const timer = setTimeout(() => {
                console.log("🎬 P8CanvasPage: Calling fetchNextScene to load p9...");
                fetchNextScene(setdisableCountdownTrigger);
            }, 500); // 500ms delay for smooth transition
            return () => clearTimeout(timer);
        }
    }, [audioFinished, videoFinished, fetchNextScene, setdisableCountdownTrigger]);

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

    const borderThickness = config.canvasBorderThickness || 0;
    const borderTextureUrl = barrierTextureRef?.current?.src || config.barrierTexturePath || '';
    const hasBorderTexture = borderTextureUrl && barrierTextureRef?.current?.complete;
    
    const borderStyle = hasBorderTexture ? {
        backgroundImage: `url(${borderTextureUrl})`,
        backgroundRepeat: 'repeat',
        backgroundSize: 'auto',
    } : {
        backgroundColor: 'black',
    };

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

            {/* Canvas container - centered on page */}
            <div style={{
                position: "relative",
                display: "inline-block",
            }}>
                {/* Elmo image - positioned absolutely to the left of canvas */}
                <img
                    src="/images/elmo.png"
                    alt=""
                    style={{
                        position: "absolute",
                        right: "100%", // Position to the left of the canvas container
                        marginRight: "20px", // 20px gap between Elmo and canvas
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: `${canvasSize.width * 0.25}px`, // 25% of canvas width
                        height: "auto",
                        maxWidth: "300px",
                        objectFit: "contain",
                    }}
                />

                {/* Canvas with external border (matching Experiment.js) */}
                <div style={{
                    position: "relative",
                    display: "inline-block",
                }}>
                    {/* Border divs positioned around canvas */}
                    {borderThickness > 0 && (
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
                    )}

                    {/* Canvas */}
                    <canvas
                        ref={canvasRef}
                        width={canvasSize.width}
                        height={canvasSize.height}
                        style={{
                            display: "block",
                        }}
                    />
                </div>
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
                {!audioFinished && !videoFinished ? "Playing audio and video..." : 
                 !audioFinished ? "Playing audio..." : 
                 !videoFinished ? "Playing video..." : ""}
            </div>
        </div>
    );
};

export default P8CanvasPage;
