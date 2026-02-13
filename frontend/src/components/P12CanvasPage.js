import React, { useEffect, useRef, useState } from 'react';
import { config } from '../config';
import { usePause } from '../contexts/PauseContext';

/**
 * V2 P7: Canvas with keys audio and timed keyboard overlay images
 * - Audio: v2_keys.mp3
 * - Canvas: T_v2_bg_no_occluder trial data (V2)
 * - Timed keyboard overlays:
 *   | Time    | Overlay           |
 *   | 0-6s    | None              |
 *   | 6-11s   | keyboard.png      |
 *   | 11-13s  | None              |
 *   | 13-16s  | keyboard_F.png    |
 *   | 16-17s  | None              |
 *   | 17-20s  | keyboard_J.png    |
 *   | 20-24s  | None              |
 *   | 24-26s  | keyboard_F.png    |
 *   | 26-29s  | None              |
 *   | 29s-end | keyboard_J.png    |
 * - Auto-advance when audio finishes
 * - Canvas size: 600x600 pixels
 */
const P12CanvasPage = ({ fetchNextScene, setdisableCountdownTrigger }) => {
    console.log("🎬 P12CanvasPage (V2 P7): Component mounted/rendered");
    const { isPaused, resumeCounter } = usePause();
    const canvasRef = useRef(null);
    const audioRef = useRef(null);
    const [sceneData, setSceneData] = useState(null);
    const [currentFrame, setCurrentFrame] = useState(0);
    const currentFrameRef = useRef(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [audioFinished, setAudioFinished] = useState(false);
    const [videoFinished, setVideoFinished] = useState(false);
    const [currentOverlay, setCurrentOverlay] = useState(null); // Current overlay image
    const animationRef = useRef(null);
    const lastTimestampRef = useRef(null);
    const hasAutoAdvancedRef = useRef(false);
    const overlayTimerRef = useRef(null);
    const renderFrameRef = useRef(null); // Store renderFrame function reference
    
    // Texture refs
    const ballTextureRef = useRef(null);
    const ballOffscreenCanvasRef = useRef(null);
    const barrierTextureRef = useRef(null);
    const redSensorTextureRef = useRef(null);
    const greenSensorTextureRef = useRef(null);
    const occluderTextureRef = useRef(null);

    const canvasSize = { width: 600, height: 600 };

    // Timed overlay schedule (in seconds)
    const overlaySchedule = [
        { start: 0, end: 6, overlay: null },
        { start: 6, end: 11, overlay: '/images/keyboard.png' },
        { start: 11, end: 13, overlay: null },
        { start: 13, end: 16, overlay: '/images/keyboard_F.png' },
        { start: 16, end: 17, overlay: null },
        { start: 17, end: 20, overlay: '/images/keyboard_J.png' },
        { start: 20, end: 24, overlay: null },
        { start: 24, end: 26, overlay: '/images/keyboard_F.png' },
        { start: 26, end: 29, overlay: null },
        { start: 29, end: 9999, overlay: '/images/keyboard_J.png' }, // Until end
    ];

    // Load all textures
    useEffect(() => {
        if (config.ballTexturePath && config.ballTexturePath.trim() !== '') {
            const img = new Image();
            img.src = config.ballTexturePath;
            img.onload = () => { ballTextureRef.current = img; };
        }
        if (config.barrierTexturePath && config.barrierTexturePath.trim() !== '') {
            const img = new Image();
            img.src = config.barrierTexturePath;
            img.onload = () => { barrierTextureRef.current = img; };
        }
        if (config.redSensorTexturePath && config.redSensorTexturePath.trim() !== '') {
            const img = new Image();
            img.src = config.redSensorTexturePath;
            img.onload = () => { redSensorTextureRef.current = img; };
        }
        if (config.greenSensorTexturePath && config.greenSensorTexturePath.trim() !== '') {
            const img = new Image();
            img.src = config.greenSensorTexturePath;
            img.onload = () => { greenSensorTextureRef.current = img; };
        }
        if (config.occluderTexturePath && config.occluderTexturePath.trim() !== '') {
            const img = new Image();
            img.src = config.occluderTexturePath;
            img.onload = () => { occluderTextureRef.current = img; };
        }
    }, []);

    // Preload overlay images
    useEffect(() => {
        const overlayImages = ['/images/keyboard.png', '/images/keyboard_F.png', '/images/keyboard_J.png'];
        overlayImages.forEach(src => {
            const img = new Image();
            img.src = src;
        });
    }, []);

    const drawTiledTexture = (ctx, texture, x, y, width, height) => {
        if (!texture || !texture.complete) return false;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, width, height);
        ctx.clip();
        const imgRatio = texture.width / texture.height;
        const containerRatio = width / height;
        let newW, newH, newX, newY;
        if (imgRatio > containerRatio) {
            newH = height;
            newW = height * imgRatio;
            newX = x - (newW - width) / 2;
            newY = y;
        } else {
            newW = width;
            newH = width / imgRatio;
            newX = x;
            newY = y - (newH - height) / 2;
        }
        ctx.save();
        ctx.translate(newX, newY + newH);
        ctx.scale(1, -1);
        ctx.drawImage(texture, 0, 0, newW, newH);
        ctx.restore();
        ctx.restore();
        return true;
    };

    // Load T_v2_bg_no_occluder trial data
    useEffect(() => {
        const loadTrialData = async () => {
            try {
                console.log('📥 P12CanvasPage: Loading T_v2_bg_no_occluder trial data...');
                const response = await fetch('/api/load_trial_data/T_v2_bg_no_occluder', {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                });

                if (response.ok) {
                    const data = await response.json();
                    console.log('✅ P12CanvasPage: Successfully loaded trial data');
                    setSceneData(data);
                } else {
                    console.error('❌ P12CanvasPage: Failed to load trial data');
                }
            } catch (error) {
                console.error('❌ P12CanvasPage: Error loading trial data:', error);
            }
        };
        loadTrialData();
    }, []);

    // Render frame function
    const renderFrame = React.useCallback((frameIndex) => {
        const canvas = canvasRef.current;
        if (!canvas || !sceneData) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { barriers, occluders, step_data, red_sensor, green_sensor, radius, worldWidth, worldHeight } = sceneData;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const scale = Math.min(canvas.width / worldWidth, canvas.height / worldHeight);

        ctx.save();
        ctx.scale(1, -1);
        ctx.translate(0, -canvas.height);

        // Draw barriers
        if (frameIndex !== 0) {
            barriers.forEach(({ x, y, width, height }) => {
                const scaledX = x * scale;
                const scaledY = y * scale;
                const scaledWidth = width * scale;
                const scaledHeight = height * scale;
                ctx.save();
                if (barrierTextureRef.current && barrierTextureRef.current.complete) {
                    if (!drawTiledTexture(ctx, barrierTextureRef.current, scaledX, scaledY, scaledWidth, scaledHeight)) {
                        ctx.fillStyle = "black";
                        ctx.fillRect(scaledX, scaledY, scaledWidth, scaledHeight);
                    }
                } else {
                    ctx.fillStyle = "black";
                    ctx.fillRect(scaledX, scaledY, scaledWidth, scaledHeight);
                }
                ctx.restore();
            });
        }

        // Draw sensors
        if (red_sensor) {
            const { x, y, width, height } = red_sensor;
            ctx.save();
            if (redSensorTextureRef.current && redSensorTextureRef.current.complete) {
                if (!drawTiledTexture(ctx, redSensorTextureRef.current, x * scale, y * scale, width * scale, height * scale)) {
                    ctx.fillStyle = "red";
                    ctx.fillRect(x * scale, y * scale, width * scale, height * scale);
                }
            } else {
                ctx.fillStyle = "red";
                ctx.fillRect(x * scale, y * scale, width * scale, height * scale);
            }
            ctx.restore();
        }

        if (green_sensor) {
            const { x, y, width, height } = green_sensor;
            ctx.save();
            if (greenSensorTextureRef.current && greenSensorTextureRef.current.complete) {
                if (!drawTiledTexture(ctx, greenSensorTextureRef.current, x * scale, y * scale, width * scale, height * scale)) {
                    ctx.fillStyle = "green";
                    ctx.fillRect(x * scale, y * scale, width * scale, height * scale);
                }
            } else {
                ctx.fillStyle = "green";
                ctx.fillRect(x * scale, y * scale, width * scale, height * scale);
            }
            ctx.restore();
        }

        // Draw ball
        if (step_data && step_data[frameIndex]) {
            const { x, y } = step_data[frameIndex];
            const centerX = (x + radius) * scale;
            const centerY = (y + radius) * scale;
            const ballRadius = scale * radius;
            
            if (ballTextureRef.current && ballTextureRef.current.complete) {
                const supersampleFactor = 2;
                const offscreenSize = Math.ceil(ballRadius * 2 * supersampleFactor);
                
                if (!ballOffscreenCanvasRef.current || ballOffscreenCanvasRef.current.width !== offscreenSize) {
                    ballOffscreenCanvasRef.current = document.createElement('canvas');
                    ballOffscreenCanvasRef.current.width = offscreenSize;
                    ballOffscreenCanvasRef.current.height = offscreenSize;
                }
                
                const offscreenCanvas = ballOffscreenCanvasRef.current;
                const offscreenCtx = offscreenCanvas.getContext('2d');
                offscreenCtx.imageSmoothingEnabled = true;
                offscreenCtx.imageSmoothingQuality = 'high';
                offscreenCtx.clearRect(0, 0, offscreenSize, offscreenSize);
                
                const offscreenCenter = offscreenSize / 2;
                const offscreenRadius = ballRadius * supersampleFactor;
                
                offscreenCtx.save();
                offscreenCtx.beginPath();
                offscreenCtx.arc(offscreenCenter, offscreenCenter, offscreenRadius, 0, 2 * Math.PI);
                offscreenCtx.clip();
                
                let rotationAngle = 0;
                if (config.ballRotationRate !== 0 && isPlaying) {
                    const fps = sceneData.fps || 30;
                    const elapsedSeconds = frameIndex / fps;
                    rotationAngle = (elapsedSeconds * config.ballRotationRate) * (Math.PI / 180);
                }
                
                if (rotationAngle !== 0) {
                    offscreenCtx.translate(offscreenCenter, offscreenCenter);
                    offscreenCtx.rotate(rotationAngle);
                    offscreenCtx.translate(-offscreenCenter, -offscreenCenter);
                }
                
                const textureSize = offscreenRadius * 2;
                offscreenCtx.drawImage(ballTextureRef.current, offscreenCenter - offscreenRadius, offscreenCenter - offscreenRadius, textureSize, textureSize);
                offscreenCtx.restore();
                
                ctx.save();
                ctx.drawImage(offscreenCanvas, centerX - ballRadius, centerY - ballRadius, ballRadius * 2, ballRadius * 2);
                ctx.restore();
            } else {
                ctx.beginPath();
                ctx.arc(centerX, centerY, ballRadius, 0, 2 * Math.PI);
                ctx.fillStyle = "blue";
                ctx.fill();
            }
        }

        // Draw occluders
        occluders.forEach(({ x, y, width, height }) => {
            ctx.save();
            if (occluderTextureRef.current && occluderTextureRef.current.complete) {
                if (!drawTiledTexture(ctx, occluderTextureRef.current, x * scale, y * scale, width * scale, height * scale)) {
                    ctx.fillStyle = "gray";
                    ctx.fillRect(x * scale, y * scale, width * scale, height * scale);
                }
            } else {
                ctx.fillStyle = "gray";
                ctx.fillRect(x * scale, y * scale, width * scale, height * scale);
            }
            ctx.restore();
        });

        ctx.restore();
    }, [sceneData, isPlaying]);

    // Animation loop
    useEffect(() => {
        if (!isPlaying || !sceneData) {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }
            return;
        }

        const animate = (timestamp) => {
            if (!lastTimestampRef.current) {
                lastTimestampRef.current = timestamp;
            }

            const elapsed = timestamp - lastTimestampRef.current;
            const frameTime = 1000 / (sceneData.fps || 30);
            const maxFrames = Object.keys(sceneData.step_data || {}).length;
            const framesToAdvance = Math.min(Math.floor(elapsed / frameTime), 5);
            
            if (framesToAdvance > 0) {
                const nextFrame = currentFrameRef.current + framesToAdvance;
                if (nextFrame < maxFrames) {
                    currentFrameRef.current = nextFrame;
                    setCurrentFrame(nextFrame);
                    renderFrame(nextFrame);
                    lastTimestampRef.current = timestamp - (elapsed % frameTime);
                    if (isPlaying) {
                        animationRef.current = requestAnimationFrame(animate);
                    }
                } else {
                    currentFrameRef.current = maxFrames - 1;
                    setCurrentFrame(maxFrames - 1);
                    renderFrame(maxFrames - 1);
                    setIsPlaying(false);
                    setVideoFinished(true);
                    console.log(`🏁 P12CanvasPage: Video finished`);
                    lastTimestampRef.current = null;
                }
            } else {
                if (isPlaying) {
                    animationRef.current = requestAnimationFrame(animate);
                }
            }
        };

        animationRef.current = requestAnimationFrame(animate);
        
        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }
            lastTimestampRef.current = null;
        };
    }, [isPlaying, sceneData, renderFrame]);

    // Store renderFrame in ref so it can be used in resume effect
    useEffect(() => {
        renderFrameRef.current = renderFrame;
    }, [renderFrame]);

    const startTimeRef = useRef(null);

    // Handle global pause state - stop animation when paused
    useEffect(() => {
        if (isPaused) {
            console.log('⏸️ P12CanvasPage: Study paused - stopping animation and audio');
            // Stop animation
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }
            setIsPlaying(false);
            
            // Clear overlay timer
            if (overlayTimerRef.current) {
                clearInterval(overlayTimerRef.current);
                overlayTimerRef.current = null;
            }
            
            // Pause audio
            if (audioRef.current) {
                audioRef.current.pause();
            }
        }
    }, [isPaused]);

    // Handle resume - reset and restart from beginning
    const lastResumeCounterRef = useRef(resumeCounter);
    useEffect(() => {
        // Only trigger reset when resumeCounter actually increments (not on initial mount)
        if (resumeCounter > 0 && resumeCounter !== lastResumeCounterRef.current) {
            lastResumeCounterRef.current = resumeCounter;
            console.log('▶️ P12CanvasPage: Study resumed - resetting and restarting from beginning');
            
            // Reset all state to beginning
            setIsPlaying(false);
            setCurrentFrame(0);
            currentFrameRef.current = 0;
            setAudioFinished(false);
            setVideoFinished(false);
            setCurrentOverlay(null);
            hasAutoAdvancedRef.current = false;
            lastTimestampRef.current = null;
            startTimeRef.current = null;
            
            // Clear overlay timer
            if (overlayTimerRef.current) {
                clearInterval(overlayTimerRef.current);
                overlayTimerRef.current = null;
            }
            
            // Restart from beginning
            if (renderFrameRef.current && sceneData) {
                setTimeout(() => {
                    renderFrameRef.current(0);
                    
                    // Reset and restart audio
                    if (audioRef.current) {
                        audioRef.current.currentTime = 0;
                        audioRef.current.play().catch(e => console.warn('Failed to play audio:', e));
                    }
                    
                    // Restart video and overlay timer
                    startTimeRef.current = performance.now();
                    setIsPlaying(true);
                }, 100);
            }
        }
    }, [resumeCounter, sceneData]);

    // Auto-start when scene data is loaded
    useEffect(() => {
        if (sceneData) {
            console.log('P12CanvasPage: Scene data loaded, starting animation and audio');
            setIsPlaying(false);
            setCurrentFrame(0);
            currentFrameRef.current = 0;
            setVideoFinished(false);
            setAudioFinished(false);
            setCurrentOverlay(null);
            hasAutoAdvancedRef.current = false;
            startTimeRef.current = null;
            lastTimestampRef.current = null;
            
            renderFrame(0);
            
            setTimeout(() => {
                startTimeRef.current = performance.now();
                console.log('🎬 P12CanvasPage: Starting video animation');
                setIsPlaying(true);
            }, 100);
            
            if (audioRef.current) {
                console.log('🔊 P12CanvasPage: Starting audio playback');
                audioRef.current.currentTime = 0;
                audioRef.current.play()
                    .then(() => console.log('✅ P12CanvasPage: Audio playback started'))
                    .catch(error => console.error("❌ P12CanvasPage: Audio autoplay prevented:", error));
            }
        }
    }, [sceneData]);

    // Update overlay based on audio time
    useEffect(() => {
        if (!audioRef.current) return;

        const updateOverlay = () => {
            const currentTime = audioRef.current?.currentTime || 0;
            const schedule = overlaySchedule.find(s => currentTime >= s.start && currentTime < s.end);
            const newOverlay = schedule?.overlay || null;
            setCurrentOverlay(newOverlay);
        };

        // Update overlay every 100ms
        overlayTimerRef.current = setInterval(updateOverlay, 100);

        return () => {
            if (overlayTimerRef.current) {
                clearInterval(overlayTimerRef.current);
            }
        };
    }, []);

    // Listen for audio end
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleAudioEnd = () => {
            console.log('🏁 P12CanvasPage: Audio ended');
            setAudioFinished(true);
            // Keep overlay visible until page transitions (don't clear it here)
        };

        audio.addEventListener('ended', handleAudioEnd);
        return () => audio.removeEventListener('ended', handleAudioEnd);
    }, []);

    // Auto-advance when audio finishes (audio is the longer one)
    useEffect(() => {
        if (audioFinished && !hasAutoAdvancedRef.current) {
            console.log("🎬 P12CanvasPage: Audio finished, auto-advancing to next scene...");
            hasAutoAdvancedRef.current = true;
            const timer = setTimeout(() => {
                fetchNextScene(setdisableCountdownTrigger);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [audioFinished, fetchNextScene, setdisableCountdownTrigger]);

    // Keyboard shortcut: Shift+S to skip
    useEffect(() => {
        const handleKeyPress = (e) => {
            if (e.shiftKey && (e.key === 'S' || e.key === 's')) {
                console.log("SKIP KEY PRESSED: Shift+S detected in P12CanvasPage");
                e.preventDefault();
                e.stopPropagation();
                fetchNextScene(setdisableCountdownTrigger);
                return false;
            }
        };
        
        document.addEventListener('keydown', handleKeyPress, true);
        return () => document.removeEventListener('keydown', handleKeyPress, true);
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

    // Image sizes - matching P6 for consistency
    const elmoImageSize = canvasSize.width * 0.25;

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
                src="/audios/v2_keys.mp3"
                preload="auto"
                onLoadedData={() => console.log('🔊 P12CanvasPage: Audio loaded')}
                onEnded={() => console.log('🏁 P12CanvasPage: Audio ended')}
                onError={(e) => console.error('❌ P12CanvasPage: Audio error:', e)}
            />

            {/* Canvas container */}
            <div style={{
                position: "relative",
                display: "inline-block",
            }}>
                {/* Elmo image - positioned absolutely to the left of canvas (matching P6) */}
                <img
                    src="/images/elmo.png"
                    alt=""
                    style={{
                        position: "absolute",
                        right: "100%",
                        marginRight: "20px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: `${elmoImageSize}px`,
                        height: "auto",
                        maxWidth: "300px",
                        objectFit: "contain",
                    }}
                />

                <div style={{
                    position: "relative",
                    display: "inline-block",
                }}>
                    {/* Border divs */}
                    {borderThickness > 0 && (
                        <>
                            <div style={{
                                position: "absolute",
                                top: -borderThickness,
                                left: -borderThickness,
                                width: `${canvasSize.width + (borderThickness * 2)}px`,
                                height: `${borderThickness}px`,
                                ...borderStyle,
                            }} />
                            <div style={{
                                position: "absolute",
                                bottom: -borderThickness,
                                left: -borderThickness,
                                width: `${canvasSize.width + (borderThickness * 2)}px`,
                                height: `${borderThickness}px`,
                                ...borderStyle,
                            }} />
                            <div style={{
                                position: "absolute",
                                top: 0,
                                left: -borderThickness,
                                width: `${borderThickness}px`,
                                height: `${canvasSize.height}px`,
                                ...borderStyle,
                            }} />
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
                        style={{ display: "block" }}
                    />

                    {/* Keyboard overlay image - positioned on top of canvas, same width as canvas */}
                    {currentOverlay && (
                        <img
                            src={currentOverlay}
                            alt=""
                            style={{
                                position: "absolute",
                                bottom: "10px",
                                left: "50%",
                                transform: "translateX(-50%)",
                                width: `${canvasSize.width}px`,
                                height: "auto",
                                zIndex: 10,
                            }}
                        />
                    )}
                </div>
            </div>

            {/* Spacer for layout consistency */}
            <div style={{ marginTop: "20px", minHeight: "30px" }} />
        </div>
    );
};

export default P12CanvasPage;
