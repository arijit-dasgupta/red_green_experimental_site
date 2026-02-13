import React, { useEffect, useRef, useState } from 'react';
import { config } from '../config';
import { usePause } from '../contexts/PauseContext';

/**
 * V2 P6: Canvas with sensors intro audio
 * - Audio: v2_sensors.mp3 (single audio, starts immediately)
 * - Canvas: T_v2_ball_sensor_red trial data
 * - Static first frame shown immediately, animation starts after 14 seconds
 * - Images: elmo.png on left middle of canvas
 * - Auto-advance when audio finishes
 * - Canvas size: 600x600 pixels (matching testing trials)
 * - Canvas border: 20px with barrier texture (matching testing trials)
 */
const P11CanvasPage = ({ fetchNextScene, setdisableCountdownTrigger }) => {
    console.log("🎬 P11CanvasPage (V2 P6): Component mounted/rendered");
    const { isPaused, resumeCounter } = usePause();
    const canvasRef = useRef(null);
    const audioRef = useRef(null);
    const [sceneData, setSceneData] = useState(null);
    const [currentFrame, setCurrentFrame] = useState(0);
    const currentFrameRef = useRef(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [audioFinished, setAudioFinished] = useState(false);
    const [videoFinished, setVideoFinished] = useState(false);
    const animationRef = useRef(null);
    const lastTimestampRef = useRef(null);
    const hasAutoAdvancedRef = useRef(false);
    const renderFrameRef = useRef(null); // Store renderFrame function reference
    
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
            const img = new Image();
            img.src = config.ballTexturePath;
            img.onload = () => { ballTextureRef.current = img; };
            img.onerror = () => { console.error("Failed to load ball texture:", config.ballTexturePath); };
        }

        // Barrier texture
        if (config.barrierTexturePath && config.barrierTexturePath.trim() !== '') {
            const img = new Image();
            img.src = config.barrierTexturePath;
            img.onload = () => { barrierTextureRef.current = img; };
            img.onerror = () => { console.error("Failed to load barrier texture:", config.barrierTexturePath); };
        }

        // Red sensor texture
        if (config.redSensorTexturePath && config.redSensorTexturePath.trim() !== '') {
            const img = new Image();
            img.src = config.redSensorTexturePath;
            img.onload = () => { redSensorTextureRef.current = img; };
            img.onerror = () => { console.error("Failed to load red sensor texture:", config.redSensorTexturePath); };
        }

        // Green sensor texture
        if (config.greenSensorTexturePath && config.greenSensorTexturePath.trim() !== '') {
            const img = new Image();
            img.src = config.greenSensorTexturePath;
            img.onload = () => { greenSensorTextureRef.current = img; };
            img.onerror = () => { console.error("Failed to load green sensor texture:", config.greenSensorTexturePath); };
        }

        // Occluder texture
        if (config.occluderTexturePath && config.occluderTexturePath.trim() !== '') {
            const img = new Image();
            img.src = config.occluderTexturePath;
            img.onload = () => { occluderTextureRef.current = img; };
            img.onerror = () => { console.error("Failed to load occluder texture:", config.occluderTexturePath); };
        }
    }, []);

    // Helper to draw tiled textures (copied from App.js)
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

    // Load T_v2_ball_sensor_red trial data (V2)
    useEffect(() => {
        const loadTrialData = async () => {
            try {
                console.log('📥 P11CanvasPage: Loading T_v2_ball_sensor_red trial data...');
                const response = await fetch('/api/load_trial_data/T_v2_ball_sensor_red', {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    const frameCount = Object.keys(data.step_data || {}).length;
                    console.log('✅ P11CanvasPage: Successfully loaded trial data');
                    console.log('📊 P11CanvasPage: Data summary:', {
                        numFrames: frameCount,
                        fps: data.fps,
                        worldWidth: data.worldWidth,
                        worldHeight: data.worldHeight,
                        hasBarriers: (data.barriers || []).length > 0,
                        hasOccluders: (data.occluders || []).length > 0,
                        hasRedSensor: !!data.red_sensor,
                        hasGreenSensor: !!data.green_sensor,
                        radius: data.radius
                    });
                    setSceneData(data);
                } else {
                    const errorText = await response.text();
                    console.error('❌ P11CanvasPage: Failed to load T_v2_ball_sensor_red data:', response.status, errorText);
                }
            } catch (error) {
                console.error('❌ P11CanvasPage: Error loading trial data:', error);
            }
        };

        loadTrialData();
    }, []);

    // Render frame function (matching App.js rendering logic)
    const renderFrame = React.useCallback((frameIndex) => {
        const canvas = canvasRef.current;
        if (!canvas || !sceneData) {
            return;
        }

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

        // Draw barriers with texture (show from frame 0 for P6)
        barriers.forEach(({ x, y, width, height }) => {
            const scaledX = x * scale;
            const scaledY = y * scale;
            const scaledWidth = width * scale;
            const scaledHeight = height * scale;
            
            ctx.save();
            if (config.barrierTexturePath && config.barrierTexturePath.trim() !== '' && 
                barrierTextureRef.current && barrierTextureRef.current.complete) {
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

        // Draw sensors with texture
        if (red_sensor) {
            const { x, y, width, height } = red_sensor;
            const scaledX = x * scale;
            const scaledY = y * scale;
            const scaledWidth = width * scale;
            const scaledHeight = height * scale;
            
            ctx.save();
            if (config.redSensorTexturePath && config.redSensorTexturePath.trim() !== '' && 
                redSensorTextureRef.current && redSensorTextureRef.current.complete) {
                if (!drawTiledTexture(ctx, redSensorTextureRef.current, scaledX, scaledY, scaledWidth, scaledHeight)) {
                    ctx.fillStyle = "red";
                    ctx.fillRect(scaledX, scaledY, scaledWidth, scaledHeight);
                }
            } else {
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
            if (config.greenSensorTexturePath && config.greenSensorTexturePath.trim() !== '' && 
                greenSensorTextureRef.current && greenSensorTextureRef.current.complete) {
                if (!drawTiledTexture(ctx, greenSensorTextureRef.current, scaledX, scaledY, scaledWidth, scaledHeight)) {
                    ctx.fillStyle = "green";
                    ctx.fillRect(scaledX, scaledY, scaledWidth, scaledHeight);
                }
            } else {
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
            
            if (config.ballTexturePath && config.ballTexturePath.trim() !== '' && 
                ballTextureRef.current && ballTextureRef.current.complete) {
                const supersampleFactor = 2;
                const offscreenSize = Math.ceil(ballRadius * 2 * supersampleFactor);
                
                if (!ballOffscreenCanvasRef.current || 
                    ballOffscreenCanvasRef.current.width !== offscreenSize) {
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
                offscreenCtx.drawImage(
                    ballTextureRef.current,
                    offscreenCenter - offscreenRadius,
                    offscreenCenter - offscreenRadius,
                    textureSize,
                    textureSize
                );
                offscreenCtx.restore();
                
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
            if (config.occluderTexturePath && config.occluderTexturePath.trim() !== '' && 
                occluderTextureRef.current && occluderTextureRef.current.complete) {
                if (!drawTiledTexture(ctx, occluderTextureRef.current, scaledX, scaledY, scaledWidth, scaledHeight)) {
                    ctx.fillStyle = "gray";
                    ctx.fillRect(scaledX, scaledY, scaledWidth, scaledHeight);
                }
            } else {
                ctx.fillStyle = "gray";
                ctx.fillRect(scaledX, scaledY, scaledWidth, scaledHeight);
            }
            ctx.restore();
        });

        ctx.restore();
    }, [sceneData, isPlaying]);

    // Store renderFrame in ref so it can be used in resume effect
    useEffect(() => {
        renderFrameRef.current = renderFrame;
    }, [renderFrame]);

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
                    console.log(`🏁 P11CanvasPage: Video finished`);
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

    // Track start time for duration calculation
    const startTimeRef = useRef(null);

    // Track if we've paused after initial 1-second play
    const hasPausedAfterInitialPlayRef = useRef(false);
    
    // Track animation delay timeouts so they can be cancelled when paused
    const initialPlayTimeoutRef = useRef(null);
    const resumePlayTimeoutRef = useRef(null);

    // Handle global pause state - stop animation when paused
    useEffect(() => {
        if (isPaused) {
            console.log('⏸️ P11CanvasPage: Study paused - stopping animation and audio');
            // Stop animation
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }
            setIsPlaying(false);
            
            // Clear animation delay timeouts
            if (initialPlayTimeoutRef.current) {
                clearTimeout(initialPlayTimeoutRef.current);
                initialPlayTimeoutRef.current = null;
            }
            if (resumePlayTimeoutRef.current) {
                clearTimeout(resumePlayTimeoutRef.current);
                resumePlayTimeoutRef.current = null;
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
            console.log('▶️ P11CanvasPage: Study resumed - resetting and restarting from beginning');
            
            // Reset all state to beginning
            setIsPlaying(false);
            setCurrentFrame(0);
            currentFrameRef.current = 0;
            setAudioFinished(false);
            setVideoFinished(false);
            hasAutoAdvancedRef.current = false;
            hasPausedAfterInitialPlayRef.current = false;
            startTimeRef.current = null;
            lastTimestampRef.current = null;
            
            // Clear any existing timeouts
            if (initialPlayTimeoutRef.current) {
                clearTimeout(initialPlayTimeoutRef.current);
                initialPlayTimeoutRef.current = null;
            }
            if (resumePlayTimeoutRef.current) {
                clearTimeout(resumePlayTimeoutRef.current);
                resumePlayTimeoutRef.current = null;
            }
            
            // Restart from beginning - static frozen scene
            if (renderFrameRef.current && sceneData) {
                setTimeout(() => {
                    renderFrameRef.current(0);
                    console.log('🖼️ P11CanvasPage: Restarting - showing static frozen scene');
                    
                    // Mark video as finished immediately since we're not animating
                    setVideoFinished(true);
                    
                    // Reset and restart audio
                    if (audioRef.current) {
                        audioRef.current.currentTime = 0;
                        audioRef.current.play().catch(e => console.warn('Failed to play audio:', e));
                    }
                }, 100);
            }
        }
    }, [resumeCounter, sceneData]);

    // Auto-start when scene data is loaded
    useEffect(() => {
        if (sceneData) {
            const maxFrames = Object.keys(sceneData.step_data || {}).length;
            const fps = sceneData.fps || 30;
            const expectedVideoDuration = maxFrames / fps;
            console.log('P11CanvasPage: Scene data loaded, starting animation and audio');
            console.log(`📊 P11CanvasPage: Video info - Frames: ${maxFrames}, FPS: ${fps}, Expected duration: ${expectedVideoDuration.toFixed(2)}s`);
            setIsPlaying(false);
            setCurrentFrame(0);
            currentFrameRef.current = 0;
            setVideoFinished(false);
            setAudioFinished(false);
            hasAutoAdvancedRef.current = false;
            hasPausedAfterInitialPlayRef.current = false;
            startTimeRef.current = null;
            lastTimestampRef.current = null;
            
            // Render first frame immediately (barriers now show from frame 0)
            // P6: Show static scene - no animation, just frozen frame
            renderFrame(0);
            console.log('🖼️ P11CanvasPage: Showing static frozen scene (no animation)');
            
            // Mark video as finished immediately since we're not animating
            setVideoFinished(true);
            
            // Start audio playback immediately
            if (audioRef.current) {
                console.log('🔊 P11CanvasPage: Starting audio playback');
                audioRef.current.currentTime = 0;
                const playPromise = audioRef.current.play();
                if (playPromise !== undefined) {
                    playPromise
                        .then(() => {
                            console.log('✅ P11CanvasPage: Audio playback started successfully');
                        })
                        .catch(error => {
                            console.error("❌ P11CanvasPage: Audio autoplay prevented:", error);
                        });
                }
            }
        }
    }, [sceneData]);

    // Listen for audio end
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleAudioEnd = () => {
            console.log('🏁 P11CanvasPage: Audio ended');
            setAudioFinished(true);
        };

        audio.addEventListener('ended', handleAudioEnd);
        return () => {
            audio.removeEventListener('ended', handleAudioEnd);
        };
    }, []);

    // Auto-advance when BOTH audio AND video finish
    useEffect(() => {
        if (audioFinished && videoFinished && !hasAutoAdvancedRef.current) {
            console.log("🎬 P11CanvasPage: Both audio and video finished, auto-advancing to next scene...");
            hasAutoAdvancedRef.current = true;
            
            const timer = setTimeout(() => {
                console.log("🎬 P11CanvasPage: Calling fetchNextScene to load next page...");
                fetchNextScene(setdisableCountdownTrigger);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [audioFinished, videoFinished, fetchNextScene, setdisableCountdownTrigger]);

    // Add keyboard shortcut: Press 'Shift+S' to skip to next page
    useEffect(() => {
        const handleKeyPress = (e) => {
            if (e.shiftKey && (e.key === 'S' || e.key === 's')) {
                console.log("SKIP KEY PRESSED: Shift+S detected in P11CanvasPage, skipping to next page");
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

    // Image sizes
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
            {/* V2: Single audio for sensors intro */}
            <audio
                ref={audioRef}
                src="/audios/v2_sensors.mp3"
                preload="auto"
                onLoadedData={() => console.log('🔊 P11CanvasPage: Audio loaded, duration:', audioRef.current?.duration)}
                onPlay={() => console.log('▶️ P11CanvasPage: Audio started playing')}
                onEnded={() => console.log('🏁 P11CanvasPage: Audio ended')}
                onError={(e) => console.error('❌ P11CanvasPage: Audio error:', e)}
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

            {/* Spacer for layout consistency */}
            <div style={{
                marginTop: "20px",
                minHeight: "30px",
            }}>
            </div>
        </div>
    );
};

export default P11CanvasPage;
