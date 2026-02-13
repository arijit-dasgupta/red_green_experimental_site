import React, { useEffect, useRef, useState, useCallback } from 'react';
import { config } from '../config';
import useUpdateKeyStates from '../hooks/useUpdateKeyStates';
import { usePause } from '../contexts/PauseContext';
/**
 * P5V3Page - Practice Key Pressing with Frozen Canvas and Pulsing
 * 
 * Audio: v3_practice_keys.mp3
 * Canvas: T_v3_area_no_ball trial data - FROZEN on first frame
 * Special behavior: Canvas is frozen but sensors pulse when keys are pressed
 *   - Press F: green sensor pulses
 *   - Press J: red sensor pulses
 * Visual: Canvas + Elmo below
 * Behavior: Audio plays, canvas shows frozen first frame, sensors pulse on key press, auto-advance when audio finishes
 */
const P5V3Page = ({ onComplete }) => {
    console.log("🎬 P5V3Page: Component mounted/rendered");
    const { isPaused, resumeCounter } = usePause();
    const canvasRef = useRef(null);
    const audioRef = useRef(null);
    const [sceneData, setSceneData] = useState(null);
    const [audioFinished, setAudioFinished] = useState(false);
    const [keyStates, setKeyStates] = useState({ f: false, j: false });
    const keyStatesRef = useRef({ f: false, j: false });
    const hasAutoAdvancedRef = useRef(false);
    const animationRef = useRef(null);
    const audioListenerSetupRef = useRef(false);
    const hasStartedAudioRef = useRef(false);
    
    // Texture refs
    const ballTextureRef = useRef(null);
    const barrierTextureRef = useRef(null);
    const redSensorTextureRef = useRef(null);
    const greenSensorTextureRef = useRef(null);
    const occluderTextureRef = useRef(null);

    const canvasSize = { width: 600, height: 600 };

    // Update key states ref when keyStates state changes
    useEffect(() => {
        keyStatesRef.current = keyStates;
    }, [keyStates]);

    // Track key presses using the hook
    useUpdateKeyStates(keyStates, setKeyStates);

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
                console.log('📥 P5V3Page: Loading T_v3_area_no_ball trial data...');
                const response = await fetch('/api/load_trial_data/T_v3_area_no_ball', {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                });

                if (response.ok) {
                    const data = await response.json();
                    console.log('✅ P5V3Page: Successfully loaded trial data');
                    setSceneData(data);
                } else {
                    console.error('❌ P5V3Page: Failed to load trial data:', response.status);
                }
            } catch (error) {
                console.error('❌ P5V3Page: Error loading trial data:', error);
            }
        };
        loadTrialData();
    }, []);

    // Render frame function with pulsing effect for sensors
    const renderFrame = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !sceneData) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { barriers, occluders, red_sensor, green_sensor, worldWidth, worldHeight } = sceneData;
        const currentKeyStates = keyStatesRef.current;

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

        // Draw red sensor (with V2-style pulsing border if J is pressed)
        if (red_sensor) {
            const { x, y, width, height } = red_sensor;
            const scaledX = x * scale;
            const scaledY = y * scale;
            const scaledWidth = width * scale;
            const scaledHeight = height * scale;
            
            const isPulsing = currentKeyStates.j && !currentKeyStates.f;
            
            // Draw pulsing glow FIRST (beneath sensor) - V2 style with glowing border
            if (isPulsing) {
                ctx.save();
                const pulseTime = (performance.now() / 1000) % 1; // 1 second pulse cycle
                const pulseIntensity = 0.5 + 0.5 * Math.sin(pulseTime * Math.PI * 2); // 0.5 to 1.0
                const glowSize = 8 * pulseIntensity; // Pulsing glow size
                
                // Draw glowing border beneath sensor with golden yellow color
                ctx.shadowBlur = 20 * pulseIntensity;
                ctx.shadowColor = "rgba(255, 200, 0, 0.8)"; // Golden yellow with alpha
                ctx.strokeStyle = `rgba(255, 200, 0, ${0.6 + 0.4 * pulseIntensity})`; // Golden yellow with varying alpha
                ctx.lineWidth = 4 * pulseIntensity;
                ctx.strokeRect(scaledX - glowSize, scaledY - glowSize, scaledWidth + glowSize * 2, scaledHeight + glowSize * 2);
                ctx.restore();
            }
            
            // Draw sensor ON TOP of glow
            ctx.save();
            ctx.shadowBlur = 0;
            ctx.shadowColor = "transparent";
            
            if (redSensorTextureRef.current?.complete) {
                drawTiledTexture(ctx, redSensorTextureRef.current, scaledX, scaledY, scaledWidth, scaledHeight);
            } else {
                ctx.fillStyle = "red";
                ctx.fillRect(scaledX, scaledY, scaledWidth, scaledHeight);
            }
            ctx.restore();
        }

        // Draw green sensor (with V2-style pulsing border if F is pressed)
        if (green_sensor) {
            const { x, y, width, height } = green_sensor;
            const scaledX = x * scale;
            const scaledY = y * scale;
            const scaledWidth = width * scale;
            const scaledHeight = height * scale;
            
            const isPulsing = currentKeyStates.f && !currentKeyStates.j;
            
            // Draw pulsing glow FIRST (beneath sensor) - V2 style with glowing border
            if (isPulsing) {
                ctx.save();
                const pulseTime = (performance.now() / 1000) % 1; // 1 second pulse cycle
                const pulseIntensity = 0.5 + 0.5 * Math.sin(pulseTime * Math.PI * 2); // 0.5 to 1.0
                const glowSize = 8 * pulseIntensity; // Pulsing glow size
                
                // Draw glowing border beneath sensor with dark green color
                ctx.shadowBlur = 20 * pulseIntensity;
                ctx.shadowColor = "rgba(0, 102, 0, 0.8)"; // Dark green with alpha
                ctx.strokeStyle = `rgba(0, 102, 0, ${0.6 + 0.4 * pulseIntensity})`; // Dark green with varying alpha
                ctx.lineWidth = 4 * pulseIntensity;
                ctx.strokeRect(scaledX - glowSize, scaledY - glowSize, scaledWidth + glowSize * 2, scaledHeight + glowSize * 2);
                ctx.restore();
            }
            
            // Draw sensor ON TOP of glow
            ctx.save();
            ctx.shadowBlur = 0;
            ctx.shadowColor = "transparent";
            
            if (greenSensorTextureRef.current?.complete) {
                drawTiledTexture(ctx, greenSensorTextureRef.current, scaledX, scaledY, scaledWidth, scaledHeight);
            } else {
                ctx.fillStyle = "green";
                ctx.fillRect(scaledX, scaledY, scaledWidth, scaledHeight);
            }
            ctx.restore();
        }

        // Draw occluders (no ball in this scene)
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

    // Continuous render loop for pulsing animation
    useEffect(() => {
        if (!sceneData || isPaused) {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }
            return;
        }

        const animate = () => {
            renderFrame();
            animationRef.current = requestAnimationFrame(animate);
        };

        animationRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }
        };
    }, [sceneData, renderFrame, isPaused]);

    // Handle pause
    useEffect(() => {
        if (isPaused) {
            console.log('⏸️ P5V3Page: Paused');
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }
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
            console.log('▶️ P5V3Page: Resumed - restarting from beginning');
            
            setAudioFinished(false);
            hasAutoAdvancedRef.current = false;
            hasStartedAudioRef.current = false; // Allow audio to restart
            
            if (audioRef.current) {
                audioRef.current.currentTime = 0;
                audioRef.current.play().catch(e => console.warn('Failed to play audio:', e));
            }
        }
    }, [resumeCounter]);

    // Auto-start when scene data loaded
    useEffect(() => {
        if (sceneData && !hasStartedAudioRef.current) {
            console.log('P5V3Page: Scene data loaded, starting');
            hasStartedAudioRef.current = true;
            
            // Render first frame
            renderFrame();
            
            // Start audio
            if (audioRef.current) {
                audioRef.current.currentTime = 0;
                audioRef.current.play().catch(e => console.error('Audio play failed:', e));
            }
        }
    }, [sceneData, renderFrame]);

    // Listen for audio end - set up once when component mounts
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio || audioListenerSetupRef.current) {
            return;
        }
        
        audioListenerSetupRef.current = true;
        console.log('P5V3Page: Setting up audio end listener (one-time)');

        const handleAudioEnd = () => {
            console.log('🔊 P5V3Page: Audio ended event fired');
            setAudioFinished(true);
        };

        audio.addEventListener('ended', handleAudioEnd);
        
        // Cleanup only on unmount
        return () => {
            console.log('P5V3Page: Removing audio end listener (unmount)');
            audio.removeEventListener('ended', handleAudioEnd);
        };
    }, []); // Empty deps - set up once on mount

    // Poll for audio end as backup and auto-advance directly
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        
        const pollInterval = setInterval(() => {
            // Check if audio has ended using multiple methods
            const isEnded = audio.ended || (audio.duration > 0 && audio.currentTime >= audio.duration - 0.1);
            
            if (isEnded && !hasAutoAdvancedRef.current) {
                console.log('🔊 P5V3Page: Audio ended detected via polling, advancing...');
                console.log(`   Duration: ${audio.duration}, CurrentTime: ${audio.currentTime}, Ended: ${audio.ended}`);
                hasAutoAdvancedRef.current = true;
                clearInterval(pollInterval);
                
                // Advance immediately
                setTimeout(() => {
                    if (onComplete) onComplete();
                }, 300);
            }
        }, 200); // Poll more frequently
        
        return () => clearInterval(pollInterval);
    }, [onComplete]);

    // Auto-advance when audio finishes (via state)
    useEffect(() => {
        if (audioFinished && !hasAutoAdvancedRef.current) {
            console.log('🔊 P5V3Page: Audio finished state detected, advancing...');
            hasAutoAdvancedRef.current = true;
            const timer = setTimeout(() => {
                if (onComplete) onComplete();
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [audioFinished, onComplete]);

    // Skip shortcut
    useEffect(() => {
        const handleKeyPress = (e) => {
            if (e.shiftKey && (e.key === 'S' || e.key === 's')) {
                console.log("⏭️ P5V3Page: Skip pressed");
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
                src="/audios/v3_practice_keys.mp3"
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

            {/* Debug: show current key states */}
            {process.env.NODE_ENV === 'development' && (
                <div style={{
                    position: 'fixed',
                    bottom: '10px',
                    left: '10px',
                    fontSize: '12px',
                    color: '#666',
                    backgroundColor: 'rgba(255,255,255,0.8)',
                    padding: '5px',
                    borderRadius: '4px',
                }}>
                    P5V3 | F: {keyStates.f.toString()} | J: {keyStates.j.toString()}
                </div>
            )}
        </div>
    );
};

export default P5V3Page;
