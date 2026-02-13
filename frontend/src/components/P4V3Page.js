import React, { useEffect, useRef, useState, useCallback } from 'react';
import { config } from '../config';
import { usePause } from '../contexts/PauseContext';
/**
 * P4V3Page - Keys Introduction with Timed Overlays
 * 
 * Audio: v3_keys.mp3
 * Canvas: T_v3_keys trial data (FROZEN on first frame)
 * Timed overlays:
 *   0-2s: None
 *   2-5s: v3_keyboard.png
 *   5-12s: v3_keyboard_hands.png
 *   12-15s: None
 *   15-19s: v3_keyboard_F.png
 *   19-20s: None
 *   20-25s: v3_keyboard_J.png
 *   25s-end: None
 * Visual: Frozen canvas + overlays + Elmo below
 * Behavior: Auto-play audio, canvas stays frozen, overlays based on audio time, auto-advance when audio finishes
 */
const P4V3Page = ({ onComplete }) => {
    console.log("🎬 P4V3Page: Component mounted/rendered");
    const { isPaused, resumeCounter } = usePause();
    const canvasRef = useRef(null);
    const audioRef = useRef(null);
    const [sceneData, setSceneData] = useState(null);
    const [audioFinished, setAudioFinished] = useState(false);
    const [currentOverlay, setCurrentOverlay] = useState(null);
    const hasAutoAdvancedRef = useRef(false);
    const renderFrameRef = useRef(null);
    
    // Texture refs
    const ballTextureRef = useRef(null);
    const ballOffscreenCanvasRef = useRef(null);
    const barrierTextureRef = useRef(null);
    const redSensorTextureRef = useRef(null);
    const greenSensorTextureRef = useRef(null);
    const occluderTextureRef = useRef(null);

    const canvasSize = { width: 600, height: 600 };

    // Overlay timing configuration (in seconds)
    const OVERLAY_TIMINGS = [
        { start: 0, end: 2, image: null },
        { start: 2, end: 5, image: '/images/v3_keyboard.png' },
        { start: 5, end: 12, image: '/images/v3_keyboard_hands.png' },
        { start: 12, end: 15, image: null },
        { start: 15, end: 19, image: '/images/v3_keyboard_F.png' },
        { start: 19, end: 20, image: null },
        { start: 20, end: 25, image: '/images/v3_keyboard_J.png' },
        { start: 25, end: Infinity, image: null },
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
                console.log('📥 P4V3Page: Loading T_v3_keys trial data...');
                const response = await fetch('/api/load_trial_data/T_v3_keys', {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                });

                if (response.ok) {
                    const data = await response.json();
                    console.log('✅ P4V3Page: Successfully loaded trial data');
                    setSceneData(data);
                } else {
                    console.error('❌ P4V3Page: Failed to load trial data:', response.status);
                }
            } catch (error) {
                console.error('❌ P4V3Page: Error loading trial data:', error);
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

        // Ball not drawn on P4 (transparent/invisible like P5) - keys intro shows canvas without ball
        // step_data still used for frame index; ball position is simply not rendered

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

    // Overlay timer - based on audio time
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleTimeUpdate = () => {
            if (!isPaused) {
                const timeInSeconds = audio.currentTime;
                const newOverlay = getOverlayForTime(timeInSeconds);
                setCurrentOverlay(newOverlay);
            }
        };

        audio.addEventListener('timeupdate', handleTimeUpdate);
        return () => audio.removeEventListener('timeupdate', handleTimeUpdate);
    }, [isPaused]);

    // Canvas is frozen on first frame - no animation loop needed
    // Just render the first frame once when scene data is loaded

    // Handle pause
    useEffect(() => {
        if (isPaused) {
            console.log('⏸️ P4V3Page: Paused');
            if (audioRef.current) {
                audioRef.current.pause();
            }
        }
    }, [isPaused]);

    // Handle resume
    const lastResumeCounterRef = useRef(resumeCounter);
    useEffect(() => {
        if (resumeCounter > 0 && resumeCounter !== lastResumeCounterRef.current) {
            lastResumeCounterRef.current = resumeCounter;
            console.log('▶️ P4V3Page: Resumed - restarting from beginning');
            
            setAudioFinished(false);
            hasAutoAdvancedRef.current = false;
            setCurrentOverlay(null);
            
            // Re-render frozen frame
            if (renderFrameRef.current && sceneData) {
                renderFrameRef.current(0);
            }
            
            // Restart audio
            if (audioRef.current) {
                audioRef.current.currentTime = 0;
                audioRef.current.play().catch(e => console.warn('Failed to play audio:', e));
            }
        }
    }, [resumeCounter, sceneData]);

    // Auto-start when scene data loaded - render frozen first frame and start audio
    useEffect(() => {
        if (sceneData) {
            console.log('P4V3Page: Scene data loaded, rendering frozen first frame');
            setAudioFinished(false);
            hasAutoAdvancedRef.current = false;
            setCurrentOverlay(null);
            
            // Render frozen first frame (frame 0)
            renderFrame(0);
            
            // Start audio
            if (audioRef.current) {
                audioRef.current.currentTime = 0;
                audioRef.current.play().catch(e => console.error('Audio play failed:', e));
            }
        }
    }, [sceneData, renderFrame]);

    // Listen for audio end
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleAudioEnd = () => {
            console.log('🔊 P4V3Page: Audio finished');
            setAudioFinished(true);
        };

        audio.addEventListener('ended', handleAudioEnd);
        return () => audio.removeEventListener('ended', handleAudioEnd);
    }, []);

    // Auto-advance when audio finishes (canvas is frozen, so only audio matters)
    useEffect(() => {
        if (audioFinished && !hasAutoAdvancedRef.current) {
            hasAutoAdvancedRef.current = true;
            console.log('P4V3Page: Audio finished, auto-advancing');
            const timer = setTimeout(() => {
                if (onComplete) onComplete();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [audioFinished, onComplete]);

    // Skip shortcut
    useEffect(() => {
        const handleKeyPress = (e) => {
            if (e.shiftKey && (e.key === 'S' || e.key === 's')) {
                console.log("⏭️ P4V3Page: Skip pressed");
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
            position: "relative",
        }}>
            <audio
                ref={audioRef}
                src="/audios/v3_keys.mp3"
                preload="auto"
            />

            {/* Canvas with overlay - only child so it stays centered */}
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

            {/* Elmo below canvas - absolutely positioned so canvas stays centered */}
            <img
                src="/images/v3_elmo_trimmed.png"
                alt="Elmo"
                style={{
                    position: "absolute",
                    left: "50%",
                    top: `calc(50% + ${canvasSize.height / 2 + 20}px)`,
                    transform: "translateX(-50%)",
                    width: `${canvasSize.width * 0.3 * 0.7}px`,
                    height: "auto",
                    objectFit: "contain",
                }}
            />
        </div>
    );
};

export default P4V3Page;
