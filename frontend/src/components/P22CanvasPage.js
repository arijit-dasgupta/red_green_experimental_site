import React, { useEffect, useRef, useState } from 'react';
import { config } from '../config';
import { usePause } from '../contexts/PauseContext';

/**
 * P22CanvasPage (V2) - P18: Before Test
 * 
 * Content: Frozen canvas (first frame of T_v2_occluder_intro) with audio and keyboard overlays
 * - Canvas: T_v2_occluder_intro (first frame only, frozen, all components visible)
 * - Audio: v2_before_test.mp3
 * - Keyboard overlays at timed intervals
 * - Auto-advances after audio finishes
 */
const P22CanvasPage = ({ fetchNextScene, setdisableCountdownTrigger }) => {
    console.log("🎬 P22CanvasPage (V2 P18): Component mounted/rendered");
    const { isPaused, resumeCounter } = usePause();
    const canvasRef = useRef(null);
    const audioRef = useRef(null);
    const [sceneData, setSceneData] = useState(null);
    const [audioFinished, setAudioFinished] = useState(false);
    const [currentOverlay, setCurrentOverlay] = useState(null);
    const hasAutoAdvancedRef = useRef(false);
    const hasRenderedRef = useRef(false);
    const renderFrameRef = useRef(null);
    const overlayTimerRef = useRef(null);
    const hasStartedRef = useRef(false);
    
    // Texture refs (matching App.js)
    const ballTextureRef = useRef(null);
    const ballOffscreenCanvasRef = useRef(null);
    const barrierTextureRef = useRef(null);
    const redSensorTextureRef = useRef(null);
    const greenSensorTextureRef = useRef(null);
    const occluderTextureRef = useRef(null);

    // Fixed canvas size (matching testing trials)
    const canvasSize = { width: 600, height: 600 };

    // Overlay schedule for P18 (v2_before_test.mp3)
    const overlaySchedule = [
        { start: 0, end: 16, overlay: null },
        { start: 16, end: 19, overlay: '/images/keyboard_F.png' },
        { start: 19, end: 21, overlay: null },
        { start: 21, end: 24, overlay: '/images/keyboard_J.png' },
        { start: 24, end: 27, overlay: null },
        { start: 27, end: 29, overlay: '/images/keyboard_both.png' },
        { start: 29, end: 9999, overlay: null },
    ];

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

    // Load T_v2_occluder_intro trial data
    useEffect(() => {
        const loadTrialData = async () => {
            try {
                console.log('📥 P22CanvasPage: Loading T_v2_occluder_intro trial data...');
                const response = await fetch('/api/load_trial_data/T_v2_occluder_intro', {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    const frameCount = Object.keys(data.step_data || {}).length;
                    console.log('✅ P22CanvasPage: Successfully loaded trial data');
                    console.log('📊 P22CanvasPage: Data summary:', {
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
                    console.error('❌ P22CanvasPage: Failed to load T_v2_occluder_intro data:', response.status, errorText);
                }
            } catch (error) {
                console.error('❌ P22CanvasPage: Error loading trial data:', error);
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

        // Draw barriers with texture (always show from frame 0)
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

        // Draw ball with texture (no rotation for static frame)
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
                
                // No rotation for static frame
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
    }, [sceneData]);

    // Store renderFrame in ref
    useEffect(() => {
        renderFrameRef.current = renderFrame;
    }, [renderFrame]);

    // Render first frame when scene data is loaded
    useEffect(() => {
        if (sceneData && !hasRenderedRef.current) {
            // Wait a bit for textures to load
            const timer = setTimeout(() => {
                console.log('🎨 P22CanvasPage: Rendering frozen first frame');
                if (renderFrameRef.current) {
                    renderFrameRef.current(0);
                }
                hasRenderedRef.current = true;
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [sceneData]);

    // Re-render when textures might have loaded
    useEffect(() => {
        if (sceneData && hasRenderedRef.current) {
            const timer = setTimeout(() => {
                if (renderFrameRef.current) {
                    renderFrameRef.current(0);
                }
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [sceneData]);

    // Auto-play audio when page loads
    useEffect(() => {
        if (audioRef.current && sceneData && !hasStartedRef.current) {
            hasStartedRef.current = true;
            console.log("P22CanvasPage: Attempting to play audio");
            audioRef.current.play().catch(error => {
                console.log("Audio autoplay prevented:", error);
                setAudioFinished(true);
            });
        }
    }, [sceneData]);

    // Update overlay based on audio time
    useEffect(() => {
        if (!audioRef.current) return;

        const updateOverlay = () => {
            const currentTime = audioRef.current?.currentTime || 0;
            for (const { start, end, overlay } of overlaySchedule) {
                if (currentTime >= start && currentTime < end) {
                    setCurrentOverlay(overlay);
                    break;
                }
            }
        };

        overlayTimerRef.current = setInterval(updateOverlay, 100);

        return () => {
            if (overlayTimerRef.current) {
                clearInterval(overlayTimerRef.current);
            }
        };
    }, []);

    // Handle audio end
    const handleAudioEnd = () => {
        console.log("P22CanvasPage: Audio finished");
        setAudioFinished(true);
        // Keep overlay visible until page transitions
    };

    // Handle global pause state
    useEffect(() => {
        if (isPaused) {
            console.log('⏸️ P22CanvasPage: Study paused - pausing audio');
            if (audioRef.current) {
                audioRef.current.pause();
            }
            if (overlayTimerRef.current) {
                clearInterval(overlayTimerRef.current);
                overlayTimerRef.current = null;
            }
        }
    }, [isPaused]);

    // Handle resume - reset and restart from beginning
    const lastResumeCounterRef = useRef(resumeCounter);
    useEffect(() => {
        if (resumeCounter > 0 && resumeCounter !== lastResumeCounterRef.current) {
            lastResumeCounterRef.current = resumeCounter;
            console.log('▶️ P22CanvasPage: Study resumed - resetting and restarting from beginning');
            
            // Reset all state
            setAudioFinished(false);
            setCurrentOverlay(null);
            hasAutoAdvancedRef.current = false;
            hasStartedRef.current = false;
            
            // Re-render the canvas
            if (renderFrameRef.current) {
                renderFrameRef.current(0);
            }
            
            // Reset and restart audio
            if (audioRef.current) {
                audioRef.current.currentTime = 0;
                audioRef.current.play().catch(e => console.warn('Failed to play audio:', e));
                hasStartedRef.current = true;
            }

            // Restart overlay timer
            if (overlayTimerRef.current) {
                clearInterval(overlayTimerRef.current);
            }
            const updateOverlay = () => {
                const currentTime = audioRef.current?.currentTime || 0;
                for (const { start, end, overlay } of overlaySchedule) {
                    if (currentTime >= start && currentTime < end) {
                        setCurrentOverlay(overlay);
                        break;
                    }
                }
            };
            overlayTimerRef.current = setInterval(updateOverlay, 100);
        }
    }, [resumeCounter]);

    // Auto-advance when audio finishes
    useEffect(() => {
        if (audioFinished && !hasAutoAdvancedRef.current) {
            hasAutoAdvancedRef.current = true;
            setTimeout(() => {
                console.log("P22CanvasPage: Auto-advancing to next page");
                fetchNextScene(setdisableCountdownTrigger);
            }, 500);
        }
    }, [audioFinished, fetchNextScene, setdisableCountdownTrigger]);

    // Add keyboard shortcut for testing: Press 'Shift+S' to skip
    useEffect(() => {
        const handleKeyPress = (e) => {
            if (e.shiftKey && (e.key === 'S' || e.key === 's')) {
                console.log("SKIP KEY PRESSED: Skip key detected in P22CanvasPage");
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
            {/* Audio element */}
            <audio
                ref={audioRef}
                src="/audios/v2_before_test.mp3"
                preload="auto"
                onEnded={handleAudioEnd}
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
                Before Test
            </div>

            {/* Canvas container with border */}
            <div style={{
                position: "relative",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
            }}>
                <div style={{
                    position: "relative",
                    border: "20px solid",
                    borderImage: `url(${config.barrierTexturePath}) 30 round`,
                    backgroundColor: "#333",
                }}>
                    <canvas
                        ref={canvasRef}
                        width={canvasSize.width}
                        height={canvasSize.height}
                        style={{ display: "block" }}
                    />

                    {/* Keyboard overlay image - positioned on top of canvas */}
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

            {/* Progress indicator */}
            <div style={{
                position: "absolute",
                bottom: "20px",
                right: "20px",
                fontSize: "14px",
                color: "#999",
            }}>
                Familiarization 15/15
            </div>
        </div>
    );
};

export default P22CanvasPage;
