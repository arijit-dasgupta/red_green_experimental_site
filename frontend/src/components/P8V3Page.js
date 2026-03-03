import React, { useEffect, useRef, useState, useCallback } from 'react';
import { config } from '../config';
import { usePause } from '../contexts/PauseContext';
/**
 * P8V3Page - Switch Keys Introduction Demo
 * 
 * Audio: v3_before_practice_switching.mp3
 * Canvas: T_v3_keyswitch_ball_stable trial data
 * Visual: Canvas with Elmo below (v3_elmo_trimmed.png)
 * Behavior: Auto-play audio + canvas animation, auto-advance when both finish
 */
const P8V3Page = ({ onComplete }) => {
    const { isPaused, resumeCounter } = usePause();
    
    // Only log on actual mount, not every render
    useEffect(() => {
        console.log("🎬 P8V3Page: Component MOUNTED");
        return () => console.log("🎬 P8V3Page: Component UNMOUNTED");
    }, []);
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
    const renderFrameRef = useRef(null);
    const onCompleteRef = useRef(onComplete); // Store onComplete in ref to avoid cleanup issues
    
    const ballTextureRef = useRef(null);
    const ballOffscreenCanvasRef = useRef(null);
    const barrierTextureRef = useRef(null);
    const redSensorTextureRef = useRef(null);
    const greenSensorTextureRef = useRef(null);
    const occluderTextureRef = useRef(null);

    const canvasSize = { width: 600, height: 600 };

    // Keep onCompleteRef synced
    useEffect(() => {
        onCompleteRef.current = onComplete;
    }, [onComplete]);

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

    useEffect(() => {
        const loadTrialData = async () => {
            try {
                console.log('📥 P8V3Page: Loading T_v3_keyswitch_ball_stable trial data...');
                const response = await fetch('/api/load_trial_data/T_v3_keyswitch_ball_stable', {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                });

                if (response.ok) {
                    const data = await response.json();
                    console.log('✅ P8V3Page: Successfully loaded trial data');
                    setSceneData(data);
                } else {
                    console.error('❌ P8V3Page: Failed to load trial data:', response.status);
                }
            } catch (error) {
                console.error('❌ P8V3Page: Error loading trial data:', error);
            }
        };
        loadTrialData();
    }, []);

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

        if (barriers) {
            barriers.forEach(({ x, y, width, height }) => {
                if (barrierTextureRef.current?.complete) {
                    drawTiledTexture(ctx, barrierTextureRef.current, x * scale, y * scale, width * scale, height * scale);
                } else {
                    ctx.fillStyle = "black";
                    ctx.fillRect(x * scale, y * scale, width * scale, height * scale);
                }
            });
        }

        if (red_sensor) {
            const { x, y, width, height } = red_sensor;
            if (redSensorTextureRef.current?.complete) {
                drawTiledTexture(ctx, redSensorTextureRef.current, x * scale, y * scale, width * scale, height * scale);
            } else {
                ctx.fillStyle = "#bbb";
                ctx.fillRect(x * scale, y * scale, width * scale, height * scale);
            }
        }

        if (green_sensor) {
            const { x, y, width, height } = green_sensor;
            if (greenSensorTextureRef.current?.complete) {
                drawTiledTexture(ctx, greenSensorTextureRef.current, x * scale, y * scale, width * scale, height * scale);
            } else {
                ctx.fillStyle = "#bbb";
                ctx.fillRect(x * scale, y * scale, width * scale, height * scale);
            }
        }

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
                offscreenCtx.clearRect(0, 0, offscreenSize, offscreenSize);
                
                const offscreenCenter = offscreenSize / 2;
                const offscreenRadius = ballRadius * supersampleFactor;
                
                offscreenCtx.save();
                offscreenCtx.beginPath();
                offscreenCtx.arc(offscreenCenter, offscreenCenter, offscreenRadius, 0, 2 * Math.PI);
                offscreenCtx.clip();
                
                // Ball rotation when animation is playing (ball speed !== 0)
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
                
                offscreenCtx.drawImage(ballTextureRef.current, offscreenCenter - offscreenRadius, offscreenCenter - offscreenRadius, offscreenRadius * 2, offscreenRadius * 2);
                offscreenCtx.restore();
                
                ctx.save();
                ctx.drawImage(offscreenCanvas, centerX - ballRadius, centerY - ballRadius, ballRadius * 2, ballRadius * 2);
                ctx.restore();
            } else {
                ctx.beginPath();
                ctx.arc(centerX, centerY, ballRadius, 0, 2 * Math.PI);
                ctx.fillStyle = "#999";
                ctx.fill();
            }
        }

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
    }, [sceneData, isPlaying]);

    useEffect(() => {
        renderFrameRef.current = renderFrame;
    }, [renderFrame]);

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
                    if (renderFrameRef.current) renderFrameRef.current(nextFrame);
                    lastTimestampRef.current = timestamp - (elapsed % frameTime);
                    if (isPlaying) {
                        animationRef.current = requestAnimationFrame(animate);
                    }
                } else {
                    currentFrameRef.current = maxFrames - 1;
                    setCurrentFrame(maxFrames - 1);
                    if (renderFrameRef.current) renderFrameRef.current(maxFrames - 1);
                    setIsPlaying(false);
                    console.log("🎬 P8V3Page: Video animation finished");
                    setVideoFinished(true);
                    lastTimestampRef.current = null;
                }
            } else {
                if (isPlaying) {
                    animationRef.current = requestAnimationFrame(animate);
                }
            }
        };

        if (isPlaying) {
            animationRef.current = requestAnimationFrame(animate);
        }

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }
            lastTimestampRef.current = null;
        };
    }, [isPlaying, sceneData]);

    useEffect(() => {
        if (isPaused) {
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

    const lastResumeCounterRef = useRef(resumeCounter);
    useEffect(() => {
        if (resumeCounter > 0 && resumeCounter !== lastResumeCounterRef.current) {
            lastResumeCounterRef.current = resumeCounter;
            
            setIsPlaying(false);
            setCurrentFrame(0);
            currentFrameRef.current = 0;
            setAudioFinished(false);
            setVideoFinished(false);
            hasAutoAdvancedRef.current = false;
            lastTimestampRef.current = null;
            
            if (audioRef.current) {
                audioRef.current.currentTime = 0;
                audioRef.current.play().catch(e => console.warn('Failed to play audio:', e));
            }
            
            setTimeout(() => {
                if (renderFrameRef.current && sceneData) {
                    renderFrameRef.current(0);
                    setIsPlaying(true);
                }
            }, 100);
        }
    }, [resumeCounter, sceneData]);

    // Auto-start when scene data loaded (do not depend on renderFrame to avoid re-running when isPlaying changes)
    useEffect(() => {
        if (!sceneData || !texturesLoaded) return;
        setIsPlaying(false);
        setCurrentFrame(0);
        currentFrameRef.current = 0;
        setVideoFinished(false);
        setAudioFinished(false);
        hasAutoAdvancedRef.current = false;
        lastTimestampRef.current = null;

        if (renderFrameRef.current) {
            renderFrameRef.current(0);
        }

        const startTimer = setTimeout(() => {
            setIsPlaying(true);
        }, 100);

        if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(e => console.error('Audio play failed:', e));
        }

        return () => clearTimeout(startTimer);
    }, [sceneData, texturesLoaded]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleAudioEnd = () => {
            console.log("🔊 P8V3Page: Audio ended event fired");
            setAudioFinished(true);
        };

        audio.addEventListener('ended', handleAudioEnd);
        return () => audio.removeEventListener('ended', handleAudioEnd);
    }, []);

    // Polling backup for auto-advance (handles window losing focus)
    useEffect(() => {
        const pollInterval = setInterval(() => {
            if (hasAutoAdvancedRef.current) {
                return; // Already advancing, don't clear - let it complete
            }

            const audio = audioRef.current;
            const audioEnded = audio && (audio.ended || audio.currentTime >= audio.duration - 0.1);
            
            // Check if video should be finished based on frame count
            const maxFrames = sceneData ? Object.keys(sceneData.step_data || {}).length : 0;
            const videoEnded = maxFrames > 0 && currentFrameRef.current >= maxFrames - 1;
            
            if (audioEnded && videoEnded && !hasAutoAdvancedRef.current) {
                console.log("⏱️ P8V3Page: Polling detected completion, auto-advancing");
                hasAutoAdvancedRef.current = true;
                clearInterval(pollInterval);
                if (onCompleteRef.current) onCompleteRef.current();
            }
        }, 200);

        return () => clearInterval(pollInterval);
    }, [sceneData]);

    // Handle visibility change (window regaining focus)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (!document.hidden && sceneData) {
                // Check if we should complete when window refocuses
                const audio = audioRef.current;
                const audioEnded = audio && (audio.ended || audio.currentTime >= audio.duration - 0.1);
                const maxFrames = Object.keys(sceneData.step_data || {}).length;
                const videoEnded = maxFrames > 0 && currentFrameRef.current >= maxFrames - 1;
                
                if (audioEnded && videoEnded && !hasAutoAdvancedRef.current) {
                    console.log("👁️ P8V3Page: Window refocus detected completion, auto-advancing");
                    hasAutoAdvancedRef.current = true;
                    if (onCompleteRef.current) onCompleteRef.current();
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [sceneData]);

    useEffect(() => {
        if (audioFinished && videoFinished && !hasAutoAdvancedRef.current) {
            hasAutoAdvancedRef.current = true;
            console.log("🎬 P8V3Page: Both audio and video finished, advancing in 500ms");
            const timer = setTimeout(() => {
                console.log("🎬 P8V3Page: Auto-advancing now");
                if (onCompleteRef.current) onCompleteRef.current();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [audioFinished, videoFinished]);

    useEffect(() => {
        const handleKeyPress = (e) => {
            if (e.shiftKey && e.ctrlKey && (e.key === 'S' || e.key === 's')) {
                e.preventDefault();
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
                src="/audios/v3_before_practice_switching.mp3"
                preload="auto"
            />

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

export default P8V3Page;
