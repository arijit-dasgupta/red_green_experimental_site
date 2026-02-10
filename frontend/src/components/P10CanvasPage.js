import React, { useEffect, useRef, useState } from 'react';
import { config } from '../config';
import useUpdateKeyStates from '../hooks/useUpdateKeyStates';
import { usePause } from '../contexts/PauseContext';

/**
 * Dedicated component for P17 (ftrial_i=14): Interactive canvas page (occluder practice trial)
 * - Canvas: T_v2_occluder_practice trial data (V2)
 * - Auto-starts without spacebar
 * - Shows 3-2-1 countdown before starting
 * - Shows key press indicators (F for green grassland, J for yellow flower)
 * - Records key states during playback
 * - Auto-advances when finished
 * - Canvas size: 600x600 pixels (matching testing trials)
 * - Canvas border: 20px with barrier texture (matching testing trials)
 * - All textures: ball, barrier, sensors, occluder (matching testing trials)
 * - V2: Elmo removed from this page
 */
const P10CanvasPage = ({ fetchNextScene, setdisableCountdownTrigger }) => {
    console.log("🎬 P10CanvasPage: Component mounted/rendered");
    const { isPaused, resumeCounter } = usePause();
    const canvasRef = useRef(null);
    const [sceneData, setSceneData] = useState(null);
    const [currentFrame, setCurrentFrame] = useState(0);
    const currentFrameRef = useRef(0); // Use ref to track current frame for animation loop
    const [isPlaying, setIsPlaying] = useState(false);
    const [videoFinished, setVideoFinished] = useState(false);
    const [showCongratulations, setShowCongratulations] = useState(false);
    const [keyStates, setKeyStates] = useState({ f: false, j: false });
    const [countdown, setCountdown] = useState(null);
    const animationRef = useRef(null);
    const lastTimestampRef = useRef(null);
    const hasAutoAdvancedRef = useRef(false); // Track if we've already auto-advanced
    const recordedKeyStates = useRef([]); // Record key states during playback
    const keyStatesRef = useRef({ f: false, j: false }); // Ref for key states in animation loop
    const startTimeRef = useRef(null);
    const countdownIntervalRef = useRef(null); // Store countdown interval ID
    const renderFrameRef = useRef(null); // Store renderFrame function reference
    const lastSceneDataRef = useRef(null); // Track which sceneData we've already processed
    const congratulationsTimerRef = useRef(null); // Store congratulations auto-advance timer
    const startAudioRef = useRef(null); // Audio element for start sound file
    const endAudioRef = useRef(null); // Audio element for end sound file
    const firstFramePlayedRef = useRef(false); // Track if start sound has been played
    
    // Texture refs (matching App.js)
    const ballTextureRef = useRef(null);
    const ballOffscreenCanvasRef = useRef(null);
    const barrierTextureRef = useRef(null);
    const redSensorTextureRef = useRef(null);
    const greenSensorTextureRef = useRef(null);
    const occluderTextureRef = useRef(null);

    // Fixed canvas size (matching testing trials)
    const canvasSize = { width: 600, height: 600 };

    // Load start audio file
    useEffect(() => {
        if (config.startingAudioPath && config.startingAudioPath.trim() !== '') {
            const audio = new Audio(config.startingAudioPath);
            audio.preload = 'auto';
            audio.onloadeddata = () => {
                startAudioRef.current = audio;
                console.log('P10CanvasPage: Starting audio file loaded:', config.startingAudioPath);
            };
            audio.onerror = () => {
                console.warn('P10CanvasPage: Failed to load starting audio file from:', config.startingAudioPath);
                startAudioRef.current = null;
            };
        }
    }, []);

    // Load end audio file
    useEffect(() => {
        if (config.endingAudioPath && config.endingAudioPath.trim() !== '') {
            const audio = new Audio(config.endingAudioPath);
            audio.preload = 'auto';
            audio.onloadeddata = () => {
                endAudioRef.current = audio;
                console.log('P10CanvasPage: Ending audio file loaded:', config.endingAudioPath);
            };
            audio.onerror = () => {
                console.warn('P10CanvasPage: Failed to load ending audio file from:', config.endingAudioPath);
                endAudioRef.current = null;
            };
        }
    }, []);

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

    // Update key states ref when keyStates state changes
    useEffect(() => {
        keyStatesRef.current = keyStates;
    }, [keyStates]);

    // Track key presses using the hook
    useUpdateKeyStates(keyStates, setKeyStates);

    // Load T_v2_occluder_practice trial data (V2)
    useEffect(() => {
        const loadTrialData = async () => {
            try {
                console.log('📥 P10CanvasPage: Loading T_v2_occluder_practice trial data from /api/load_trial_data/T_v2_occluder_practice...');
                const response = await fetch('/api/load_trial_data/T_v2_occluder_practice', {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    const frameCount = Object.keys(data.step_data || {}).length;
                    console.log('✅ P10CanvasPage: Successfully loaded trial data');
                    console.log('📊 P10CanvasPage: Data summary:', {
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
                    console.error('❌ P10CanvasPage: Failed to load T_v2_occluder_practice data:', response.status, errorText);
                }
            } catch (error) {
                console.error('❌ P10CanvasPage: Error loading trial data:', error);
            }
        };

        loadTrialData();
    }, []);

    // Render frame function (matching App.js rendering logic)
    const renderFrame = React.useCallback((frameIndex) => {
        const canvas = canvasRef.current;
        if (!canvas || !sceneData) {
            console.log('P10CanvasPage: renderFrame skipped - canvas or sceneData missing', { canvas: !!canvas, sceneData: !!sceneData });
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

        // Draw sensors with texture and highlight when keys are pressed
        if (red_sensor) {
            const { x, y, width, height } = red_sensor;
            const scaledX = x * scale;
            const scaledY = y * scale;
            const scaledWidth = width * scale;
            const scaledHeight = height * scale;
            
            // Use keyStatesRef to avoid dependency on keyStates state
            const currentKeyStates = keyStatesRef.current;
            
            // Draw pulsing glow effect FIRST (beneath sensor) when J key is pressed (J key = red sensor)
            if (currentKeyStates.j && !currentKeyStates.f && isPlaying) {
                ctx.save();
                const pulseTime = (performance.now() / 1000) % 1; // 1 second pulse cycle
                const pulseIntensity = 0.5 + 0.5 * Math.sin(pulseTime * Math.PI * 2); // 0.5 to 1.0
                const glowSize = 8 * pulseIntensity; // Pulsing glow size
                
                // Draw glowing border beneath sensor with golden yellow color (RGB: 255, 200, 0 - yellow flower)
                ctx.shadowBlur = 20 * pulseIntensity;
                ctx.shadowColor = "rgba(255, 200, 0, 0.8)"; // Golden yellow with alpha
                ctx.strokeStyle = `rgba(255, 200, 0, ${0.6 + 0.4 * pulseIntensity})`; // Golden yellow with varying alpha
                ctx.lineWidth = 4 * pulseIntensity;
                ctx.strokeRect(scaledX - glowSize, scaledY - glowSize, scaledWidth + glowSize * 2, scaledHeight + glowSize * 2);
                ctx.restore();
            }
            
            // Draw sensor ON TOP of glow
            ctx.save();
            // Ensure no shadow effects on sensor
            ctx.shadowBlur = 0;
            ctx.shadowColor = "transparent";
            
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
            
            // Use keyStatesRef to avoid dependency on keyStates state
            const currentKeyStates = keyStatesRef.current;
            
            // Draw pulsing glow effect FIRST (beneath sensor) when F key is pressed (F key = green sensor)
            if (currentKeyStates.f && !currentKeyStates.j && isPlaying) {
                ctx.save();
                const pulseTime = (performance.now() / 1000) % 1; // 1 second pulse cycle
                const pulseIntensity = 0.5 + 0.5 * Math.sin(pulseTime * Math.PI * 2); // 0.5 to 1.0
                const glowSize = 8 * pulseIntensity; // Pulsing glow size
                
                // Draw glowing border beneath sensor with dark green color (RGB: 0, 102, 0 - dark green)
                ctx.shadowBlur = 20 * pulseIntensity;
                ctx.shadowColor = "rgba(0, 102, 0, 0.8)"; // Dark green with alpha
                ctx.strokeStyle = `rgba(0, 102, 0, ${0.6 + 0.4 * pulseIntensity})`; // Dark green with varying alpha
                ctx.lineWidth = 4 * pulseIntensity;
                ctx.strokeRect(scaledX - glowSize, scaledY - glowSize, scaledWidth + glowSize * 2, scaledHeight + glowSize * 2);
                ctx.restore();
            }
            
            // Draw sensor ON TOP of glow
            ctx.save();
            // Ensure no shadow effects on sensor
            ctx.shadowBlur = 0;
            ctx.shadowColor = "transparent";
            
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
                console.log('P10CanvasPage: Rendering ball at frame 0', {
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

        // Note: Countdown is now displayed as a separate div element, not drawn on canvas

        ctx.restore();
    }, [sceneData, ballTextureRef, barrierTextureRef, redSensorTextureRef, greenSensorTextureRef, occluderTextureRef, ballOffscreenCanvasRef, isPlaying, countdown]);

    // Store renderFrame in ref so it can be used in other useEffects
    useEffect(() => {
        renderFrameRef.current = renderFrame;
    }, [renderFrame]);

    // Re-render frame 0 when countdown changes (but don't show it - white overlay covers it)
    useEffect(() => {
        if (countdown !== null && sceneData && renderFrameRef.current) {
            // Still render frame 0 in the background, but it will be covered by white overlay
            renderFrameRef.current(0);
        }
    }, [countdown, sceneData]);

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
                // Record key states for each frame we advance
                for (let i = 0; i < framesToAdvance; i++) {
                    const frameToRecord = currentFrameRef.current + i;
                    if (frameToRecord < maxFrames) {
                        recordedKeyStates.current.push({
                            frame: frameToRecord,
                            keys: { ...keyStatesRef.current },
                            utc_timestamp: new Date().toISOString(),
                        });
                    }
                }

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
                    // Video finished - render the last frame and record final key state
                    currentFrameRef.current = maxFrames - 1;
                    setCurrentFrame(maxFrames - 1);
                    renderFrame(maxFrames - 1);
                    recordedKeyStates.current.push({
                        frame: maxFrames - 1,
                        keys: { ...keyStatesRef.current },
                        utc_timestamp: new Date().toISOString(),
                    });
                    setIsPlaying(false);
                    setVideoFinished(true);
                    
                    // Play end sound
                    if (endAudioRef.current) {
                        endAudioRef.current.currentTime = 0;
                        endAudioRef.current.play().catch(error => {
                            console.warn('P10CanvasPage: Failed to play end audio:', error);
                        });
                        console.log('🔊 P10CanvasPage: End sound played');
                    }
                    
                    if (startTimeRef.current) {
                        const actualDuration = (timestamp - startTimeRef.current) / 1000;
                        const expectedDuration = maxFrames / (sceneData.fps || 30);
                        console.log(`🏁 P10CanvasPage: Video finished - Frame ${maxFrames - 1}/${maxFrames}`);
                        console.log(`⏱️ P10CanvasPage: Expected duration: ${expectedDuration.toFixed(2)}s, Actual duration: ${actualDuration.toFixed(2)}s`);
                        console.log(`📊 P10CanvasPage: Recorded ${recordedKeyStates.current.length} key state frames`);
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

    // Handle global pause state - stop animation when paused
    useEffect(() => {
        if (isPaused) {
            console.log('⏸️ P10CanvasPage: Study paused - stopping animation and timers');
            // Stop animation
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }
            setIsPlaying(false);
            
            // Clear countdown timer
            if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
                countdownIntervalRef.current = null;
            }
            
            // Clear congratulations timer
            if (congratulationsTimerRef.current) {
                clearTimeout(congratulationsTimerRef.current);
                congratulationsTimerRef.current = null;
            }
        }
    }, [isPaused]);

    // Handle resume - reset and restart from beginning
    const lastResumeCounterRef = useRef(resumeCounter);
    useEffect(() => {
        // Only trigger reset when resumeCounter actually increments (not on initial mount)
        if (resumeCounter > 0 && resumeCounter !== lastResumeCounterRef.current) {
            lastResumeCounterRef.current = resumeCounter;
            console.log('▶️ P10CanvasPage: Study resumed - resetting and restarting from beginning');
            
            // Reset all state to beginning
            setIsPlaying(false);
            setCurrentFrame(0);
            currentFrameRef.current = 0;
            setVideoFinished(false);
            setShowCongratulations(false);
            hasAutoAdvancedRef.current = false;
            firstFramePlayedRef.current = false;
            startTimeRef.current = null;
            lastTimestampRef.current = null;
            recordedKeyStates.current = [];
            
            // Clear any existing timers
            if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
                countdownIntervalRef.current = null;
            }
            if (congratulationsTimerRef.current) {
                clearTimeout(congratulationsTimerRef.current);
                congratulationsTimerRef.current = null;
            }
            
            // Force re-trigger the countdown by clearing lastSceneDataRef
            lastSceneDataRef.current = null;
            
            // Re-render first frame
            if (renderFrameRef.current && sceneData) {
                renderFrameRef.current(0);
                
                // Start countdown (3-2-1) after a brief delay
                setTimeout(() => {
                    let countdownValue = 3;
                    setCountdown(countdownValue);
                    setdisableCountdownTrigger(true);
                    
                    countdownIntervalRef.current = setInterval(() => {
                        countdownValue -= 1;
                        setCountdown(countdownValue);
                        
                        if (countdownValue === 0) {
                            if (countdownIntervalRef.current) {
                                clearInterval(countdownIntervalRef.current);
                                countdownIntervalRef.current = null;
                            }
                            setCountdown(null);
                            
                            // Record initial key state
                            recordedKeyStates.current.push({
                                frame: 0,
                                keys: { ...keyStatesRef.current },
                                utc_timestamp: new Date().toISOString(),
                            });
                            
                            // Start video animation after countdown
                            startTimeRef.current = performance.now();
                            console.log('🎬 P10CanvasPage: Restarting video animation after resume');
                            setIsPlaying(true);
                            
                            // Play start sound
                            if (startAudioRef.current) {
                                startAudioRef.current.currentTime = 0;
                                startAudioRef.current.play().catch(error => {
                                    console.warn('P10CanvasPage: Failed to play start audio:', error);
                                });
                            }
                        }
                    }, 750);
                }, 100);
            }
        }
    }, [resumeCounter, sceneData, setdisableCountdownTrigger]);

    // Auto-start countdown when scene data is loaded (only once per sceneData)
    useEffect(() => {
        // Check if this is a new sceneData (by checking if step_data keys are different)
        const sceneDataId = sceneData ? JSON.stringify(Object.keys(sceneData.step_data || {}).sort()) : null;
        const isNewSceneData = sceneData && sceneDataId !== lastSceneDataRef.current;
        
        if (isNewSceneData) {
            lastSceneDataRef.current = sceneDataId; // Mark this sceneData as processed
            
            // Clear any existing countdown interval
            if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
                countdownIntervalRef.current = null;
            }
            
            const maxFrames = Object.keys(sceneData.step_data || {}).length;
            const fps = sceneData.fps || 30;
            const expectedVideoDuration = maxFrames / fps;
            console.log('P10CanvasPage: Scene data loaded, starting countdown automatically');
            console.log(`📊 P10CanvasPage: Video info - Frames: ${maxFrames}, FPS: ${fps}, Expected duration: ${expectedVideoDuration.toFixed(2)}s`);
            setIsPlaying(false);
            setCurrentFrame(0);
            currentFrameRef.current = 0; // Reset ref as well
            setVideoFinished(false);
            setShowCongratulations(false);
            hasAutoAdvancedRef.current = false; // Reset auto-advance flag when new scene loads
            firstFramePlayedRef.current = false; // Reset start sound flag
            if (congratulationsTimerRef.current) {
                clearTimeout(congratulationsTimerRef.current);
                congratulationsTimerRef.current = null;
            }
            startTimeRef.current = null; // Reset start time
            lastTimestampRef.current = null; // Reset animation timestamp
            recordedKeyStates.current = []; // Reset recorded key states
            
            // Render first frame immediately (use ref to avoid dependency issues)
            if (renderFrameRef.current) {
                renderFrameRef.current(0);
            }
            
            // Start countdown (3-2-1)
            let countdownValue = 3;
            setCountdown(countdownValue);
            setdisableCountdownTrigger(true);
            
            countdownIntervalRef.current = setInterval(() => {
                countdownValue -= 1;
                setCountdown(countdownValue);
                
                if (countdownValue === 0) {
                    if (countdownIntervalRef.current) {
                        clearInterval(countdownIntervalRef.current);
                        countdownIntervalRef.current = null;
                    }
                    setCountdown(null);
                    
                    // Record initial key state
                    recordedKeyStates.current.push({
                        frame: 0,
                        keys: { ...keyStatesRef.current },
                        utc_timestamp: new Date().toISOString(),
                    });
                    
                    // Start video animation after countdown
                    startTimeRef.current = performance.now();
                    console.log('🎬 P10CanvasPage: Starting video animation at', new Date().toISOString());
                    setIsPlaying(true);
                    
                    // Play start sound
                    if (startAudioRef.current) {
                        startAudioRef.current.currentTime = 0;
                        startAudioRef.current.play().catch(error => {
                            console.warn('P10CanvasPage: Failed to play start audio:', error);
                        });
                        console.log('🔊 P10CanvasPage: Start sound played');
                    }
                }
            }, 750); // 750ms between countdown numbers
            
            return () => {
                if (countdownIntervalRef.current) {
                    clearInterval(countdownIntervalRef.current);
                    countdownIntervalRef.current = null;
                }
            };
        }
    }, [sceneData, setdisableCountdownTrigger]);

    // Show congratulations page when video finishes
    useEffect(() => {
        console.log("🔍 P10CanvasPage: Checking videoFinished state:", { videoFinished, showCongratulations });
        if (videoFinished && !showCongratulations) {
            console.log("🎉 P10CanvasPage: Video finished, showing congratulations page...");
            setShowCongratulations(true);
        }
    }, [videoFinished, showCongratulations]);

    // Auto-advance 2s after congratulations page is shown
    useEffect(() => {
        console.log("🔍 P10CanvasPage: Auto-advance useEffect running", { showCongratulations, hasAutoAdvanced: hasAutoAdvancedRef.current, timerExists: !!congratulationsTimerRef.current });
        
        if (showCongratulations && !congratulationsTimerRef.current && !hasAutoAdvancedRef.current) {
            console.log("⏱️ P10CanvasPage: Setting up auto-advance timer (2s delay)...");
            hasAutoAdvancedRef.current = true;
            
            congratulationsTimerRef.current = setTimeout(() => {
                console.log("🎬 P10CanvasPage: Timer fired! Auto-advancing to next page...");
                const timerId = congratulationsTimerRef.current;
                congratulationsTimerRef.current = null;
                
                // Call fetchNextScene
                console.log("🎬 P10CanvasPage: Calling fetchNextScene...");
                if (fetchNextScene) {
                    const result = fetchNextScene(setdisableCountdownTrigger);
                    // Handle both promise and non-promise returns
                    if (result && typeof result.then === 'function') {
                        result.then(() => {
                            console.log("✅ P10CanvasPage: fetchNextScene completed");
                        }).catch((error) => {
                            console.error("❌ P10CanvasPage: fetchNextScene error:", error);
                        });
                    } else {
                        console.log("✅ P10CanvasPage: fetchNextScene called (non-promise return)");
                    }
                } else {
                    console.error("❌ P10CanvasPage: fetchNextScene is not defined!");
                }
            }, 2000); // 2 second delay after congratulations page
            
            console.log("⏱️ P10CanvasPage: Timer set with ID:", congratulationsTimerRef.current);
        }
        
        return () => {
            // Only cleanup if showCongratulations becomes false (component state change)
            // Don't cleanup on every render - we want the timer to complete
            if (congratulationsTimerRef.current && !showCongratulations) {
                console.log("🧹 P10CanvasPage: Cleaning up auto-advance timer (showCongratulations is false)");
                clearTimeout(congratulationsTimerRef.current);
                congratulationsTimerRef.current = null;
                hasAutoAdvancedRef.current = false; // Reset flag if we're cleaning up
            }
        };
    }, [showCongratulations, fetchNextScene, setdisableCountdownTrigger]);

    // Add keyboard shortcut: Press 'Shift+S' to skip to next page
    useEffect(() => {
        const handleKeyPress = (e) => {
            if (e.shiftKey && (e.key === 'S' || e.key === 's')) {
                console.log("SKIP KEY PRESSED: Shift+S detected in P10CanvasPage, skipping to next page");
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
            {/* V2: Elmo removed from P17 (Occluder practice) page */}
            
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
                    
                    {/* White overlay during countdown - covers canvas to hide video */}
                    {countdown !== null && (
                        <div style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: `${canvasSize.width}px`,
                            height: `${canvasSize.height}px`,
                            backgroundColor: "#ffffff",
                            zIndex: 10, // Above canvas but below countdown number
                        }} />
                    )}
                    
                    {/* Countdown number displayed on top of white overlay */}
                    {countdown !== null && (
                        <div style={{
                            position: "absolute",
                            top: "50%",
                            left: "50%",
                            transform: "translate(-50%, -50%)",
                            fontSize: "48px",
                            fontWeight: "bold",
                            color: "#000000",
                            zIndex: 20, // Above white overlay
                            pointerEvents: "none",
                        }}>
                            {countdown}
                        </div>
                    )}
                </div>
            </div>

            {/* Key State Indicators - Below Canvas, Image-based (conditionally shown based on config) */}
            {config.showKeyIndicators && (
            <div style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "15px",
                width: "100%",
                maxWidth: `${Math.max(canvasSize.width, 600)}px`,
                padding: "0 20px",
                marginTop: "20px",
            }}>
                {/* Active Key States Row */}
                {(() => {
                    const baseSize = 400;
                    const maxCanvasDim = Math.max(canvasSize.width, canvasSize.height);
                    const scaleFactor = Math.min(1, baseSize / maxCanvasDim);
                    const size = "70px";
                    
                    return (
                        <div style={{
                            display: "flex",
                            gap: `${Math.max(canvasSize.width * 0.15, 40)}px`,
                            justifyContent: "center",
                            alignItems: "center",
                            width: "100%",
                        }}>
                            {/* Show grass icon when F key is pressed (for green grassland) */}
                            {keyStates.f && !keyStates.j && (
                                <div style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    gap: `${canvasSize.width * 0.01 * scaleFactor}px`,
                                }}>
                                    <div
                                        style={{
                                            width: size,
                                            height: size,
                                            borderRadius: "8px",
                                            overflow: "hidden",
                                            animation: "subtle-pulse 1.5s ease-in-out infinite",
                                            boxShadow: `0 0 ${Math.max(canvasSize.width * 0.02 * scaleFactor, 4)}px rgba(0, 0, 0, 0.2)`,
                                            marginTop: `${canvasSize.width * 0.03 * scaleFactor}px`,
                                            border: "2px solid rgba(255, 255, 255, 0.8)",
                                            backgroundColor: "#f0f0f0",
                                            position: "relative",
                                        }}
                                    >
                                        <img
                                            src="/images/icon_green.png"
                                            alt="Green Grassland"
                                            style={{
                                                width: "100%",
                                                height: "100%",
                                                objectFit: "contain",
                                                display: "block",
                                            }}
                                        />
                                    </div>
                                </div>
                            )}
                            
                            {/* Show flower icon when J key is pressed (for yellow flower garden) */}
                            {keyStates.j && !keyStates.f && (
                                <div style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    gap: `${canvasSize.width * 0.01 * scaleFactor}px`,
                                }}>
                                    <div
                                        style={{
                                            width: size,
                                            height: size,
                                            borderRadius: "8px",
                                            overflow: "hidden",
                                            animation: "subtle-pulse 1.5s ease-in-out infinite",
                                            boxShadow: `0 0 ${Math.max(canvasSize.width * 0.02 * scaleFactor, 4)}px rgba(0, 0, 0, 0.2)`,
                                            marginTop: `${canvasSize.width * 0.03 * scaleFactor}px`,
                                            border: "2px solid rgba(255, 255, 255, 0.8)",
                                            backgroundColor: "#f0f0f0",
                                            position: "relative",
                                        }}
                                    >
                                        <img
                                            src="/images/icon_yellow.png"
                                            alt="Yellow Flower Garden"
                                            style={{
                                                width: "100%",
                                                height: "100%",
                                                objectFit: "contain",
                                                display: "block",
                                            }}
                                        />
                                    </div>
                                </div>
                            )}
                            
                            {/* Empty placeholder when both or neither keys are pressed */}
                            {((keyStates.f && keyStates.j) || (!keyStates.f && !keyStates.j)) && (
                                <div style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    gap: `${canvasSize.width * 0.01 * scaleFactor}px`,
                                }}>
                                    <div
                                        style={{
                                            width: size,
                                            height: size,
                                            borderRadius: "8px",
                                            boxShadow: `0 0 ${Math.max(canvasSize.width * 0.02 * scaleFactor, 4)}px rgba(0, 0, 0, 0.1)`,
                                            marginTop: `${canvasSize.width * 0.03 * scaleFactor}px`,
                                            backgroundColor: "#e0e0e0",
                                            border: "2px dashed #999",
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })()}
            </div>
            )}

            {/* Congratulations page - shown after video finishes */}
            {showCongratulations && (
                <div style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    backgroundColor: "rgba(255, 255, 255, 0.8)",
                    backdropFilter: "blur(5px)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    zIndex: 20,
                }}>
                    <div style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "20px"
                    }}>
                        <div style={{
                            fontSize: "6rem",
                            lineHeight: "1"
                        }}>
                            👍
                        </div>
                        <div>
                            <p style={{
                                fontSize: "1.8rem",
                                fontWeight: "bold",
                                color: "#333",
                                marginBottom: "15px",
                                textAlign: "center"
                            }}>
                                Great job! You're doing awesome! 🎉
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default P10CanvasPage;
