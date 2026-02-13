import React, { useEffect, useRef, useState } from 'react';
import { config } from '../config';
import { usePause } from '../contexts/PauseContext';

/**
 * Dedicated component for p18: Canvas with audio
 * - Audio: 14_switchkeys_onekey.mp3
 * - Canvas: T_blank trial data
 * - Canvas size: 600x600 pixels (matching testing trials)
 * - Canvas border: 20px with barrier texture (matching testing trials)
 * - All textures: ball, barrier, sensors, occluder (matching testing trials)
 */
const P18CanvasPage = ({ fetchNextScene, setdisableCountdownTrigger }) => {
    console.log("🎬 P18CanvasPage: Component mounted/rendered");
    const { isPaused, resumeCounter } = usePause();
    const canvasRef = useRef(null);
    const audioRef = useRef(null); // Audio: 14_switchkeys_onekey.mp3
    const [sceneData, setSceneData] = useState(null);
    const [currentFrame, setCurrentFrame] = useState(0);
    const currentFrameRef = useRef(0); // Use ref to track current frame for animation loop
    const [isPlaying, setIsPlaying] = useState(false);
    const [audioFinished, setAudioFinished] = useState(false);
    const [videoFinished, setVideoFinished] = useState(false);
    const animationRef = useRef(null);
    const lastTimestampRef = useRef(null);
    const hasAutoAdvancedRef = useRef(false); // Track if we've already auto-advanced
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

    // Load T_blank trial data
    useEffect(() => {
        console.log('🚨 P18CanvasPage: useEffect for loadTrialData is RUNNING!');
        const loadTrialData = async () => {
            try {
                const trialFolderName = 'T_blank';
                console.log('📥 P18CanvasPage: Loading T_blank trial data from /api/load_trial_data/T_blank...');
                console.log('🔍 P18CanvasPage: VERIFY - trialFolderName =', trialFolderName);
                console.log('🚨 P18CanvasPage: ABOUT TO FETCH with trialFolderName:', trialFolderName);
                // Add cache-busting timestamp to ensure fresh data
                const apiUrl = `/api/load_trial_data/${trialFolderName}?t=${Date.now()}`;
                console.log('🔍 P18CanvasPage: VERIFY - API URL =', apiUrl);
                console.log('🔍 P18CanvasPage: FULL API URL =', window.location.origin + apiUrl);
                const response = await fetch(apiUrl, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Cache-Control': 'no-cache'
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    const frameCount = Object.keys(data.step_data || {}).length;
                    console.log('✅ P18CanvasPage: Successfully loaded trial data');
                    console.log('🔍 P18CanvasPage: BACKEND should have loaded from: backend/trial_data/chs_training_zoom/T_blank/simulation_data.json');
                    console.log('📊 P18CanvasPage: Data summary:', {
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
                    console.error('❌ P18CanvasPage: Failed to load T_blank data:', response.status, errorText);
                }
            } catch (error) {
                console.error('❌ P18CanvasPage: Error loading trial data:', error);
            }
        };

        loadTrialData();
    }, []);

    // Render frame function (matching App.js rendering logic)
    const renderFrame = React.useCallback((frameIndex) => {
        const canvas = canvasRef.current;
        if (!canvas || !sceneData) {
            console.log('P18CanvasPage: renderFrame skipped - canvas or sceneData missing', { canvas: !!canvas, sceneData: !!sceneData });
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
                console.log('P18CanvasPage: Rendering ball at frame 0', {
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
    }, [sceneData, ballTextureRef, barrierTextureRef, redSensorTextureRef, greenSensorTextureRef, occluderTextureRef, ballOffscreenCanvasRef, isPlaying]);

    // Animation loop
    useEffect(() => {
        if (!isPlaying || !sceneData) {
            // Cancel animation if not playing
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
            
            // Calculate how many frames should have advanced based on elapsed time
            // Cap at 5 frames per update to avoid huge jumps that look choppy
            const framesToAdvance = Math.min(Math.floor(elapsed / frameTime), 5);
            
            if (framesToAdvance > 0) {
                // Use ref to get current frame value (avoids stale closure issues)
                const nextFrame = currentFrameRef.current + framesToAdvance;

                if (nextFrame < maxFrames) {
                    // Advance to the correct frame (may skip frames if browser is slow)
                    currentFrameRef.current = nextFrame;
                    setCurrentFrame(nextFrame);
                    renderFrame(nextFrame);
                    // Update lastTimestamp to account for the frames we advanced
                    lastTimestampRef.current = timestamp - (elapsed % frameTime);
                    // Continue animation
                    if (isPlaying) {
                        animationRef.current = requestAnimationFrame(animate);
                    }
                } else {
                    // Video finished - render the last frame
                    currentFrameRef.current = maxFrames - 1;
                    setCurrentFrame(maxFrames - 1);
                    renderFrame(maxFrames - 1);
                    setIsPlaying(false);
                    setVideoFinished(true);
                    if (startTimeRef.current) {
                        const actualDuration = (timestamp - startTimeRef.current) / 1000;
                        const expectedDuration = maxFrames / (sceneData.fps || 30);
                        console.log(`🏁 P18CanvasPage: Video finished - Frame ${maxFrames - 1}/${maxFrames}`);
                        console.log(`⏱️ P18CanvasPage: Expected duration: ${expectedDuration.toFixed(2)}s, Actual duration: ${actualDuration.toFixed(2)}s`);
                    }
                    lastTimestampRef.current = null;
                }
            } else {
                // Not enough time elapsed, continue animation
                if (isPlaying) {
                    animationRef.current = requestAnimationFrame(animate);
                }
            }
        };

        // Start animation loop
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

    // Handle global pause state - stop animation when paused
    useEffect(() => {
        if (isPaused) {
            console.log('⏸️ P18CanvasPage: Study paused - stopping animation and audio');
            // Stop animation
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }
            setIsPlaying(false);
            
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
            console.log('▶️ P18CanvasPage: Study resumed - resetting and restarting from beginning');
            
            // Reset all state to beginning
            setIsPlaying(false);
            setCurrentFrame(0);
            currentFrameRef.current = 0;
            setAudioFinished(false);
            setVideoFinished(false);
            hasAutoAdvancedRef.current = false;
            lastTimestampRef.current = null;
            
            // Reset and restart audio
            if (audioRef.current) {
                audioRef.current.currentTime = 0;
                audioRef.current.play().catch(e => console.warn('Failed to play audio:', e));
            }
            
            // Restart animation after a brief delay
            setTimeout(() => {
                if (renderFrameRef.current && sceneData) {
                    renderFrameRef.current(0);
                    setIsPlaying(true);
                }
            }, 100);
        }
    }, [resumeCounter, sceneData]);

    // Track start time for duration calculation
    const startTimeRef = useRef(null);

    // Auto-start when scene data is loaded and reset states
    useEffect(() => {
        if (sceneData) {
            const maxFrames = Object.keys(sceneData.step_data || {}).length;
            const fps = sceneData.fps || 30;
            const expectedVideoDuration = maxFrames / fps;
            console.log('P18CanvasPage: Scene data loaded, starting animation and audio');
            console.log(`📊 P18CanvasPage: Video info - Frames: ${maxFrames}, FPS: ${fps}, Expected duration: ${expectedVideoDuration.toFixed(2)}s`);
            setIsPlaying(false);
            setCurrentFrame(0);
            currentFrameRef.current = 0; // Reset ref as well
            setVideoFinished(false);
            setAudioFinished(false);
            hasAutoAdvancedRef.current = false; // Reset auto-advance flag when new scene loads
            startTimeRef.current = null; // Reset start time
            lastTimestampRef.current = null; // Reset animation timestamp
            
            // Render first frame immediately
            renderFrame(0);
            
            // Start video animation after a brief delay to ensure state is set
            setTimeout(() => {
                startTimeRef.current = performance.now();
                console.log('🎬 P18CanvasPage: Starting video animation at', new Date().toISOString());
                setIsPlaying(true);
            }, 100);
            
            // Start audio playback
            if (audioRef.current) {
                console.log('🔊 P18CanvasPage: Starting audio playback');
                console.log('🔊 P18CanvasPage: Audio src:', audioRef.current.src);
                console.log('🔊 P18CanvasPage: Audio readyState:', audioRef.current.readyState);
                audioRef.current.currentTime = 0; // Reset audio to start
                const playPromise = audioRef.current.play();
                if (playPromise !== undefined) {
                    playPromise
                        .then(() => {
                            console.log('✅ P18CanvasPage: Audio playback started successfully');
                            console.log('🔊 P18CanvasPage: Audio duration:', audioRef.current.duration, 'seconds');
                            console.log(`📊 P18CanvasPage: Audio should finish at ${audioRef.current.duration.toFixed(2)}s`);
                        })
                        .catch(error => {
                            console.error("❌ P18CanvasPage: Audio autoplay prevented:", error);
                        });
                }
            } else {
                console.error('❌ P18CanvasPage: Audio ref is null - cannot play audio');
            }
        }
    }, [sceneData]);

    // Listen for audio end
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleAudioEnd = () => {
            console.log('🏁 P18CanvasPage: Audio (14_switchkeys_onekey.mp3) ended at', new Date().toISOString());
            if (audioRef.current) {
                console.log(`⏱️ P18CanvasPage: Audio actual duration: ${audioRef.current.duration.toFixed(2)}s`);
            }
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
            console.log("🎬 P18CanvasPage: Audio and video finished, auto-advancing to next scene...");
            hasAutoAdvancedRef.current = true;
            const timer = setTimeout(() => {
                console.log("🎬 P18CanvasPage: Calling fetchNextScene to load next page...");
                fetchNextScene(setdisableCountdownTrigger);
            }, 500); // 500ms delay for smooth transition
            return () => clearTimeout(timer);
        }
    }, [audioFinished, videoFinished, fetchNextScene, setdisableCountdownTrigger]);

    // Add keyboard shortcut: Press 'Shift+S' to skip to next page
    useEffect(() => {
        const handleKeyPress = (e) => {
            if (e.shiftKey && (e.key === 'S' || e.key === 's')) {
                console.log("SKIP KEY PRESSED: Shift+S detected in P18CanvasPage, skipping to next page");
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
                src="/audios/v2_switch_keys.mp3"
                preload="auto"
                onLoadedData={() => console.log('🔊 P18CanvasPage: Audio loaded, duration:', audioRef.current?.duration)}
                onPlay={() => console.log('▶️ P18CanvasPage: Audio started playing')}
                onPause={() => console.log('⏸️ P18CanvasPage: Audio paused')}
                onEnded={() => console.log('🏁 P18CanvasPage: Audio ended')}
                onError={(e) => console.error('❌ P18CanvasPage: Audio error:', e)}
            />

            {/* Canvas container - centered on page */}
            <div style={{
                position: "relative",
                display: "inline-block",
            }}>
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
                {/* V2: Removed distracting "Playing..." text */}
            </div>
        </div>
    );
};

export default P18CanvasPage;

