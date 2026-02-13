import React, { useEffect, useRef, useState, useCallback } from 'react';
import { config } from '../config';
import { usePause } from '../contexts/PauseContext';
/**
 * P13V3Page - Before Test with Timed Overlays
 *
 * Audio: v3_before_test.mp3
 * Canvas: T_v3_before_test trial data - FROZEN on first frame only (all components visible: barriers, sensors, ball, occluder). No animation.
 * Timed overlays (driven by audio time):
 *   0-10s: None
 *   10-11s: v3_keyboard_F.png
 *   11-12s: v3_keyboard_J.png
 *   12s-end: None
 * Visual: Frozen canvas (static image) + overlays
 * Behavior: Auto-play audio, canvas stays on frame 0, auto-advance when audio finishes
 */
const P13V3Page = ({ onComplete }) => {
    // Only log on actual mount, not every render
    useEffect(() => {
        console.log("🎬 P13V3Page: Component MOUNTED");
        return () => console.log("🎬 P13V3Page: Component UNMOUNTED");
    }, []);
    const { isPaused, resumeCounter } = usePause();
    const canvasRef = useRef(null);
    const audioRef = useRef(null);
    const [sceneData, setSceneData] = useState(null);
    const [currentFrame, setCurrentFrame] = useState(0);
    const currentFrameRef = useRef(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [audioFinished, setAudioFinished] = useState(false);
    const [videoFinished, setVideoFinished] = useState(false);
    const [currentOverlay, setCurrentOverlay] = useState(null);
    const [elapsedTime, setElapsedTime] = useState(0);
    const animationRef = useRef(null);
    const lastTimestampRef = useRef(null);
    const hasAutoAdvancedRef = useRef(false);
    const renderFrameRef = useRef(null);
    const overlayTimerRef = useRef(null);
    const startTimeRef = useRef(null);
    const elapsedBeforePauseRef = useRef(0);
    
    // Texture refs
    const ballTextureRef = useRef(null);
    const ballOffscreenCanvasRef = useRef(null);
    const barrierTextureRef = useRef(null);
    const redSensorTextureRef = useRef(null);
    const greenSensorTextureRef = useRef(null);
    const occluderTextureRef = useRef(null);

    const canvasSize = { width: 600, height: 600 };

    // Overlay timing configuration (in seconds) for P13 (Before Test)
    const OVERLAY_TIMINGS = [
        { start: 0, end: 10, image: null },
        { start: 10, end: 11, image: '/images/v3_keyboard_F.png' },
        { start: 11, end: 12, image: '/images/v3_keyboard_J.png' },
        { start: 12, end: Infinity, image: null },
    ];

    // Determine current overlay based on elapsed time
    const getOverlayForTime = (timeInSeconds) => {
        for (const timing of OVERLAY_TIMINGS) {
            if (timeInSeconds >= timing.start && timeInSeconds < timing.end) {
                return timing.image;
            }
        }
        return null;
    };

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

    // Helper to draw tiled textures
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

    // Load trial data
    useEffect(() => {
        const loadTrialData = async () => {
            try {
                console.log('📥 P13V3Page: Loading T_v3_before_test trial data...');
                const response = await fetch('/api/load_trial_data/T_v3_before_test', {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                });

                if (response.ok) {
                    const data = await response.json();
                    console.log('✅ P13V3Page: Successfully loaded trial data');
                    setSceneData(data);
                } else {
                    console.error('❌ P13V3Page: Failed to load trial data:', response.status);
                }
            } catch (error) {
                console.error('❌ P13V3Page: Error loading trial data:', error);
            }
        };
        loadTrialData();
    }, []);

    // Render frame function
    const renderFrame = useCallback((frameIndex) => {
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
        if (barriers) {
            barriers.forEach(({ x, y, width, height }) => {
                const scaledX = x * scale;
                const scaledY = y * scale;
                const scaledWidth = width * scale;
                const scaledHeight = height * scale;
                
                if (barrierTextureRef.current?.complete) {
                    drawTiledTexture(ctx, barrierTextureRef.current, scaledX, scaledY, scaledWidth, scaledHeight);
                } else {
                    ctx.fillStyle = "black";
                    ctx.fillRect(scaledX, scaledY, scaledWidth, scaledHeight);
                }
            });
        }

        // Draw sensors
        if (red_sensor) {
            const { x, y, width, height } = red_sensor;
            if (redSensorTextureRef.current?.complete) {
                drawTiledTexture(ctx, redSensorTextureRef.current, x * scale, y * scale, width * scale, height * scale);
            } else {
                ctx.fillStyle = "red";
                ctx.fillRect(x * scale, y * scale, width * scale, height * scale);
            }
        }

        if (green_sensor) {
            const { x, y, width, height } = green_sensor;
            if (greenSensorTextureRef.current?.complete) {
                drawTiledTexture(ctx, greenSensorTextureRef.current, x * scale, y * scale, width * scale, height * scale);
            } else {
                ctx.fillStyle = "green";
                ctx.fillRect(x * scale, y * scale, width * scale, height * scale);
            }
        }

        // Draw ball
        if (step_data && step_data[frameIndex]) {
            const { x, y } = step_data[frameIndex];
            const centerX = (x + radius) * scale;
            const centerY = (y + radius) * scale;
            const ballRadius = scale * radius;
            
            if (ballTextureRef.current?.complete) {
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

        // Draw occluders
        if (occluders) {
            occluders.forEach(({ x, y, width, height }) => {
                if (occluderTextureRef.current?.complete) {
                    drawTiledTexture(ctx, occluderTextureRef.current, x * scale, y * scale, width * scale, height * scale);
                } else {
                    ctx.fillStyle = "gray";
                    ctx.fillRect(x * scale, y * scale, width * scale, height * scale);
                }
            });
        }

        ctx.restore();
    }, [sceneData]);

    // Store renderFrame in ref
    useEffect(() => {
        renderFrameRef.current = renderFrame;
    }, [renderFrame]);

    // No animation loop - P13 canvas is frozen on first frame only

    // Handle pause
    useEffect(() => {
        if (isPaused) {
            console.log('⏸️ P13V3Page: Paused');
            // Save elapsed time
            if (startTimeRef.current) {
                elapsedBeforePauseRef.current += Date.now() - startTimeRef.current;
            }
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }
            setIsPlaying(false);
            if (audioRef.current) {
                audioRef.current.pause();
            }
        }
    }, [isPaused]);

    // Handle resume - restart audio and overlay, keep canvas frozen on frame 0
    const lastResumeCounterRef = useRef(resumeCounter);
    useEffect(() => {
        if (resumeCounter > 0 && resumeCounter !== lastResumeCounterRef.current) {
            lastResumeCounterRef.current = resumeCounter;
            console.log('▶️ P13V3Page: Resumed - restarting audio, canvas stays frozen');
            setCurrentFrame(0);
            currentFrameRef.current = 0;
            setAudioFinished(false);
            setVideoFinished(true);
            hasAutoAdvancedRef.current = false;
            setElapsedTime(0);
            setCurrentOverlay(null);
            if (overlayTimerRef.current) {
                clearInterval(overlayTimerRef.current);
                overlayTimerRef.current = null;
            }
            if (renderFrameRef.current && sceneData) {
                renderFrameRef.current(0);
            }
            if (audioRef.current) {
                audioRef.current.currentTime = 0;
                audioRef.current.play().catch(e => console.warn('Failed to play audio:', e));
                overlayTimerRef.current = setInterval(() => {
                    const audio = audioRef.current;
                    if (!audio || audio.ended) {
                        if (overlayTimerRef.current) {
                            clearInterval(overlayTimerRef.current);
                            overlayTimerRef.current = null;
                        }
                        return;
                    }
                    const t = audio.currentTime;
                    setElapsedTime(t);
                    setCurrentOverlay(getOverlayForTime(t));
                }, 100);
            }
        }
    }, [resumeCounter, sceneData]);

    // Auto-start when scene data loaded: freeze canvas on frame 0 (all components visible), play audio, drive overlays by audio time
    useEffect(() => {
        if (!sceneData) return;
        console.log('P13V3Page: Scene data loaded, frozen first frame + audio');
        setCurrentFrame(0);
        currentFrameRef.current = 0;
        setVideoFinished(true); // No canvas animation - advance when audio ends only
        setAudioFinished(false);
        hasAutoAdvancedRef.current = false;
        setElapsedTime(0);
        setCurrentOverlay(null);

        if (renderFrameRef.current) {
            renderFrameRef.current(0); // First frame: barriers, sensors, ball, occluders all visible
        }

        if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(e => console.error('Audio play failed:', e));
            if (overlayTimerRef.current) clearInterval(overlayTimerRef.current);
            overlayTimerRef.current = setInterval(() => {
                const audio = audioRef.current;
                if (!audio || audio.ended) {
                    if (overlayTimerRef.current) {
                        clearInterval(overlayTimerRef.current);
                        overlayTimerRef.current = null;
                    }
                    return;
                }
                const t = audio.currentTime;
                setElapsedTime(t);
                setCurrentOverlay(getOverlayForTime(t));
            }, 100);
        }

        return () => {
            if (overlayTimerRef.current) {
                clearInterval(overlayTimerRef.current);
                overlayTimerRef.current = null;
            }
        };
    }, [sceneData]);

    // Listen for audio end (clear overlay timer when audio ends)
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleAudioEnd = () => {
            console.log('🔊 P13V3Page: Audio finished');
            if (overlayTimerRef.current) {
                clearInterval(overlayTimerRef.current);
                overlayTimerRef.current = null;
            }
            setAudioFinished(true);
        };

        audio.addEventListener('ended', handleAudioEnd);
        return () => audio.removeEventListener('ended', handleAudioEnd);
    }, []);

    // Auto-advance when both finish
    useEffect(() => {
        if (audioFinished && videoFinished && !hasAutoAdvancedRef.current) {
            hasAutoAdvancedRef.current = true;
            const timer = setTimeout(() => {
                if (onComplete) onComplete();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [audioFinished, videoFinished, onComplete]);

    // Skip shortcut
    useEffect(() => {
        const handleKeyPress = (e) => {
            if (e.shiftKey && (e.key === 'S' || e.key === 's')) {
                console.log("⏭️ P13V3Page: Skip pressed");
                e.preventDefault();
                if (onComplete) onComplete();
            }
        };
        document.addEventListener('keydown', handleKeyPress, true);
        return () => document.removeEventListener('keydown', handleKeyPress, true);
    }, [onComplete]);

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
        }}>
            
            <audio
                ref={audioRef}
                src="/audios/v3_before_test.mp3"
                preload="auto"
            />

            {/* Canvas with overlay */}
            <div style={{ position: "relative", display: "inline-block" }}>
                {borderThickness > 0 && (
                    <>
                        <div style={{ position: "absolute", top: -borderThickness, left: -borderThickness, width: `${canvasSize.width + (borderThickness * 2)}px`, height: `${borderThickness}px`, ...borderStyle }} />
                        <div style={{ position: "absolute", bottom: -borderThickness, left: -borderThickness, width: `${canvasSize.width + (borderThickness * 2)}px`, height: `${borderThickness}px`, ...borderStyle }} />
                        <div style={{ position: "absolute", top: 0, left: -borderThickness, width: `${borderThickness}px`, height: `${canvasSize.height}px`, ...borderStyle }} />
                        <div style={{ position: "absolute", top: 0, right: -borderThickness, width: `${borderThickness}px`, height: `${canvasSize.height}px`, ...borderStyle }} />
                    </>
                )}
                <canvas
                    ref={canvasRef}
                    width={canvasSize.width}
                    height={canvasSize.height}
                    style={{ display: "block" }}
                />
                
                {/* Overlay image - centered on top of canvas */}
                {currentOverlay && (
                    <img
                        src={currentOverlay}
                        alt="Keyboard"
                        style={{
                            position: "absolute",
                            top: "50%",
                            left: "50%",
                            transform: "translate(-50%, -50%)",
                            width: `${canvasSize.width}px`,
                            height: "auto",
                            objectFit: "contain",
                            pointerEvents: "none",
                        }}
                    />
                )}
            </div>
        </div>
    );
};

export default P13V3Page;
