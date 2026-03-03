import React, { useEffect, useRef, useState, useCallback } from 'react';
import { config } from '../config';
import { usePause } from '../contexts/PauseContext';
/**
 * P11V3Page - Occluder Introduction Demo
 * 
 * Audio: v3_occluder.mp3
 * Canvas: T_v3_occluder_intro trial data
 * Visual: Canvas with Elmo below
 * Behavior: Phased occluder reveal - show components for 2s, reveal occluder, then animate
 * Updated: 2026-02-12
 */
const P11V3Page = ({ onComplete }) => {
    const { isPaused, resumeCounter } = usePause();
    
    // Only log on actual mount, not every render; cleanup on unmount (e.g. when skipping)
    useEffect(() => {
        console.log("🎬 P11V3Page: Component MOUNTED");
        return () => {
            console.log("🎬 P11V3Page: Component UNMOUNTED");
            if (occluderFlashTimerRef.current) {
                clearTimeout(occluderFlashTimerRef.current);
                occluderFlashTimerRef.current = null;
            }
            if (animationStartTimerRef.current) {
                clearTimeout(animationStartTimerRef.current);
                animationStartTimerRef.current = null;
            }
            occluderFlashTimersRef.current.forEach(t => clearTimeout(t));
            occluderFlashTimersRef.current = [];
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }
            if (audioRef.current) {
                audioRef.current.pause().catch(() => {});
                audioRef.current.currentTime = 0;
            }
        };
    }, []);
    const canvasRef = useRef(null);
    const audioRef = useRef(null);
    const [sceneData, setSceneData] = useState(null);
    const [currentFrame, setCurrentFrame] = useState(0);
    const currentFrameRef = useRef(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [audioFinished, setAudioFinished] = useState(false);
    const [videoFinished, setVideoFinished] = useState(false);
    const [showOccluder, setShowOccluder] = useState(false);
    const animationRef = useRef(null);
    const lastTimestampRef = useRef(null);
    const hasAutoAdvancedRef = useRef(false);
    const renderFrameRef = useRef(null);
    const occluderFlashTimerRef = useRef(null);
    const animationStartTimerRef = useRef(null);
    const occluderFlashTimersRef = useRef([]);
    const lastSceneDataRef = useRef(null); // Track scene data to prevent duplicate initialization
    const onCompleteRef = useRef(onComplete); // Store onComplete in ref to avoid cleanup issues
    
    const OCCLUDER_FLASH_DELAY = 4000; // Delay before starting occluder flash sequence
    const OCCLUDER_FLASH_DURATION = 1500; // Duration of the occluder flash sequence
    
    // Keep onCompleteRef synced
    useEffect(() => {
        onCompleteRef.current = onComplete;
    }, [onComplete]);
    
    // Texture refs
    const ballTextureRef = useRef(null);
    const ballOffscreenCanvasRef = useRef(null);
    const barrierTextureRef = useRef(null);
    const redSensorTextureRef = useRef(null);
    const greenSensorTextureRef = useRef(null);
    const occluderTextureRef = useRef(null);

    const canvasSize = { width: 600, height: 600 };

    const [texturesLoaded, setTexturesLoaded] = useState(false);

    // Load all textures, then set texturesLoaded so we don't render with fallback colors
    useEffect(() => {
        const promises = [];
        const load = (path, ref) => {
            if (!path || path.trim() === '') return;
            promises.push(new Promise((resolve) => {
                const img = new Image();
                img.onload = () => { ref.current = img; resolve(); };
                img.onerror = () => resolve();
                img.src = path;
            }));
        };
        load(config.ballTexturePath, ballTextureRef);
        load(config.barrierTexturePath, barrierTextureRef);
        load(config.redSensorTexturePath, redSensorTextureRef);
        load(config.greenSensorTexturePath, greenSensorTextureRef);
        load(config.occluderTexturePath, occluderTextureRef);
        Promise.all(promises).then(() => setTexturesLoaded(true));
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
                console.log('📥 P11V3Page: Loading T_v3_occluder_intro trial data...');
                const response = await fetch('/api/load_trial_data/T_v3_occluder_intro', {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                });

                if (response.ok) {
                    const data = await response.json();
                    console.log('✅ P11V3Page: Successfully loaded trial data');
                    setSceneData(data);
                } else {
                    console.error('❌ P11V3Page: Failed to load trial data:', response.status);
                }
            } catch (error) {
                console.error('❌ P11V3Page: Error loading trial data:', error);
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
            const scaledX = x * scale;
            const scaledY = y * scale;
            const scaledWidth = width * scale;
            const scaledHeight = height * scale;
            
            if (redSensorTextureRef.current?.complete) {
                drawTiledTexture(ctx, redSensorTextureRef.current, scaledX, scaledY, scaledWidth, scaledHeight);
            } else {
                ctx.fillStyle = "#bbb";
                ctx.fillRect(scaledX, scaledY, scaledWidth, scaledHeight);
            }
        }

        if (green_sensor) {
            const { x, y, width, height } = green_sensor;
            const scaledX = x * scale;
            const scaledY = y * scale;
            const scaledWidth = width * scale;
            const scaledHeight = height * scale;
            
            if (greenSensorTextureRef.current?.complete) {
                drawTiledTexture(ctx, greenSensorTextureRef.current, scaledX, scaledY, scaledWidth, scaledHeight);
            } else {
                ctx.fillStyle = "#bbb";
                ctx.fillRect(scaledX, scaledY, scaledWidth, scaledHeight);
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
                
                // Calculate rotation angle
                let rotationAngle = 0;
                if (config.ballRotationRate !== 0) {
                    const fps = sceneData.fps || 30;
                    const elapsedSeconds = frameIndex / fps;
                    // Keep orientation tied to frame index so the last frame does not snap when playback stops.
                    rotationAngle = (elapsedSeconds * config.ballRotationRate) * (Math.PI / 180);
                }
                
                // Apply rotation if needed
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
                ctx.fillStyle = "#999";
                ctx.fill();
            }
        }

        // Draw occluders (only if showOccluder is true)
        if (occluders && showOccluder) {
            occluders.forEach(({ x, y, width, height }) => {
                const scaledX = x * scale;
                const scaledY = y * scale;
                const scaledWidth = width * scale;
                const scaledHeight = height * scale;
                
                if (occluderTextureRef.current?.complete) {
                    drawTiledTexture(ctx, occluderTextureRef.current, scaledX, scaledY, scaledWidth, scaledHeight);
                } else {
                    ctx.fillStyle = "gray";
                    ctx.fillRect(scaledX, scaledY, scaledWidth, scaledHeight);
                }
            });
        }

        ctx.restore();
    }, [sceneData, isPlaying, showOccluder]);

    // Store renderFrame in ref
    useEffect(() => {
        renderFrameRef.current = renderFrame;
    }, [renderFrame]);

    // Re-render when showOccluder changes
    useEffect(() => {
        if (sceneData && renderFrameRef.current && !isPlaying) {
            renderFrameRef.current(currentFrameRef.current);
        }
    }, [showOccluder, sceneData, isPlaying]);

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

    // Handle pause
    useEffect(() => {
        if (isPaused) {
            console.log('⏸️ P11V3Page: Paused');
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

    // Handle resume - restart with phased sequence
    const lastResumeCounterRef = useRef(resumeCounter);
    useEffect(() => {
        if (resumeCounter > 0 && resumeCounter !== lastResumeCounterRef.current) {
            lastResumeCounterRef.current = resumeCounter;
            console.log('▶️ P11V3Page: Resumed - restarting phased sequence');
            
            setIsPlaying(false);
            setCurrentFrame(0);
            currentFrameRef.current = 0;
            setAudioFinished(false);
            setVideoFinished(false);
            setShowOccluder(true); // Show occluder from the start
            hasAutoAdvancedRef.current = false;
            lastTimestampRef.current = null;
            
            // Clear any existing timers
            if (occluderFlashTimerRef.current) {
                clearTimeout(occluderFlashTimerRef.current);
            }
            if (animationStartTimerRef.current) {
                clearTimeout(animationStartTimerRef.current);
            }
            occluderFlashTimersRef.current.forEach(t => clearTimeout(t));
            occluderFlashTimersRef.current = [];
            
            if (renderFrameRef.current && sceneData) {
                renderFrameRef.current(0);
                
                // Start audio immediately
                if (audioRef.current) {
                    audioRef.current.currentTime = 0;
                    audioRef.current.play().catch(e => console.warn('Failed to play audio:', e));
                }
                
                // After delay, flash occluder twice within 1.5s, then start animation
                occluderFlashTimerRef.current = setTimeout(() => {
                    const flashInterval = OCCLUDER_FLASH_DURATION / 4;
                    occluderFlashTimersRef.current.push(setTimeout(() => { setShowOccluder(false); }, 0));
                    occluderFlashTimersRef.current.push(setTimeout(() => { setShowOccluder(true); }, flashInterval));
                    occluderFlashTimersRef.current.push(setTimeout(() => { setShowOccluder(false); }, flashInterval * 2));
                    occluderFlashTimersRef.current.push(setTimeout(() => { setShowOccluder(true); }, flashInterval * 3));
                    
                    animationStartTimerRef.current = setTimeout(() => {
                        setShowOccluder(true);
                        setIsPlaying(true);
                    }, OCCLUDER_FLASH_DURATION);
                }, OCCLUDER_FLASH_DELAY);
            }
        }
    }, [resumeCounter, sceneData]);

    // Auto-start when scene data loaded - phased sequence for occluder reveal
    useEffect(() => {
        if (!texturesLoaded) return;
        // Use scene data ID to prevent duplicate initialization
        const sceneDataId = sceneData ? JSON.stringify(Object.keys(sceneData.step_data || {}).sort()) : null;
        const isNewSceneData = sceneData && sceneDataId !== lastSceneDataRef.current;
        
        if (isNewSceneData) {
            lastSceneDataRef.current = sceneDataId;
            console.log('P11V3Page: Scene data loaded, starting phased sequence');
            setIsPlaying(false);
            setCurrentFrame(0);
            currentFrameRef.current = 0;
            setVideoFinished(false);
            setAudioFinished(false);
            setShowOccluder(true); // Show occluder from the start
            hasAutoAdvancedRef.current = false;
            lastTimestampRef.current = null;
            
            // Clear any existing timers
            if (occluderFlashTimerRef.current) {
                clearTimeout(occluderFlashTimerRef.current);
            }
            if (animationStartTimerRef.current) {
                clearTimeout(animationStartTimerRef.current);
            }
            occluderFlashTimersRef.current.forEach(t => clearTimeout(t));
            occluderFlashTimersRef.current = [];
            
            // Phase 1: Show first frame WITH occluder and start audio immediately
            if (renderFrameRef.current) {
                renderFrameRef.current(0);
            }
            console.log('P11V3Page: Phase 1 - Showing all components including occluder, starting audio');
            
            // Start audio immediately
            if (audioRef.current) {
                audioRef.current.currentTime = 0;
                audioRef.current.play().catch(e => console.error('Audio play failed:', e));
            }
            
            // Phase 2: After delay, flash occluder twice within 1.5s to draw attention
            occluderFlashTimerRef.current = setTimeout(() => {
                console.log('P11V3Page: Phase 2 - Flashing occluder');
                const flashInterval = OCCLUDER_FLASH_DURATION / 4;
                occluderFlashTimersRef.current.push(setTimeout(() => { setShowOccluder(false); }, 0));
                occluderFlashTimersRef.current.push(setTimeout(() => { setShowOccluder(true); }, flashInterval));
                occluderFlashTimersRef.current.push(setTimeout(() => { setShowOccluder(false); }, flashInterval * 2));
                occluderFlashTimersRef.current.push(setTimeout(() => { setShowOccluder(true); }, flashInterval * 3));
                
                // Phase 3: After flash completes, start animation
                animationStartTimerRef.current = setTimeout(() => {
                    console.log('P11V3Page: Phase 3 - Starting animation');
                    setShowOccluder(true);
                    setIsPlaying(true);
                }, OCCLUDER_FLASH_DURATION);
            }, OCCLUDER_FLASH_DELAY);
        }
        // Don't clear timers on cleanup - they should complete their sequence
    }, [sceneData, texturesLoaded]);
    
    // Cleanup timers only on unmount
    useEffect(() => {
        return () => {
            if (occluderFlashTimerRef.current) {
                clearTimeout(occluderFlashTimerRef.current);
            }
            if (animationStartTimerRef.current) {
                clearTimeout(animationStartTimerRef.current);
            }
            occluderFlashTimersRef.current.forEach(t => clearTimeout(t));
        };
    }, []);

    // Listen for audio end
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleAudioEnd = () => {
            console.log('🔊 P11V3Page: Audio finished');
            setAudioFinished(true);
        };

        audio.addEventListener('ended', handleAudioEnd);
        return () => audio.removeEventListener('ended', handleAudioEnd);
    }, []);

    // Auto-advance when both finish
    useEffect(() => {
        if (audioFinished && videoFinished && !hasAutoAdvancedRef.current) {
            hasAutoAdvancedRef.current = true;
            console.log("🎬 P11V3Page: Both audio and video finished, advancing in 500ms");
            const timer = setTimeout(() => {
                console.log("🎬 P11V3Page: Auto-advancing now");
                if (onCompleteRef.current) onCompleteRef.current();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [audioFinished, videoFinished]);

    // Skip shortcut
    // Skip shortcut - clean up immediately before calling onComplete to prevent lingering audio
    useEffect(() => {
        const handleKeyPress = (e) => {
            if (e.shiftKey && e.ctrlKey && (e.key === 'S' || e.key === 's')) {
                console.log("⏭️ P11V3Page: Skip pressed - cleaning up before advancing");
                e.preventDefault();
                if (occluderFlashTimerRef.current) { clearTimeout(occluderFlashTimerRef.current); occluderFlashTimerRef.current = null; }
                if (animationStartTimerRef.current) { clearTimeout(animationStartTimerRef.current); animationStartTimerRef.current = null; }
                occluderFlashTimersRef.current.forEach(t => clearTimeout(t)); occluderFlashTimersRef.current = [];
                if (animationRef.current) { cancelAnimationFrame(animationRef.current); animationRef.current = null; }
                if (audioRef.current) { try { audioRef.current.pause(); audioRef.current.currentTime = 0; } catch(e2) {} }
                if (onCompleteRef.current) onCompleteRef.current();
            }
        };
        document.addEventListener('keydown', handleKeyPress, true);
        return () => document.removeEventListener('keydown', handleKeyPress, true);
    }, []);

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
                src="/audios/v3_occluder.mp3"
                preload="auto"
            />

            {/* Canvas with border - only child so it stays centered */}
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

export default P11V3Page;
