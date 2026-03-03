import React, { useEffect, useRef, useState } from 'react';
import { usePause } from '../contexts/PauseContext';
/**
 * P1V3Page - Elmo + Ball Introduction
 * 
 * Audio: v3_elmo_ball.mp3
 * Visual: v3_elmo.png (0-3s), v3_elmo_ball.png (3s-end)
 * Behavior: Auto-play audio, timed image switching, auto-advance when complete
 */
const P1V3Page = ({ onComplete }) => {
    const { isPaused } = usePause();
    const [currentImage, setCurrentImage] = useState('/images/v3_elmo.png');
    const [isComplete, setIsComplete] = useState(false);
    const audioRef = useRef(null);
    const timerRef = useRef(null);
    const startTimeRef = useRef(null);
    const elapsedBeforePauseRef = useRef(0);

    // Image switching at 3 seconds
    const IMAGE_SWITCH_TIME = 3000; // 3 seconds

    useEffect(() => {
        console.log('🎬 P1V3Page: Component mounted');
        
        // Start audio playback
        if (audioRef.current) {
            audioRef.current.play().catch(error => {
                console.warn('P1V3Page: Audio autoplay failed:', error);
            });
        }

        // Start timing for image switch
        startTimeRef.current = Date.now();
        
        const checkImageSwitch = () => {
            const elapsed = elapsedBeforePauseRef.current + (Date.now() - startTimeRef.current);
            if (elapsed >= IMAGE_SWITCH_TIME && currentImage === '/images/v3_elmo.png') {
                setCurrentImage('/images/v3_elmo_ball.png');
                console.log('🖼️ P1V3Page: Switched to elmo_ball image');
            }
        };

        timerRef.current = setInterval(checkImageSwitch, 100);

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [currentImage]);

    // Handle pause/resume
    useEffect(() => {
        if (isPaused) {
            console.log('⏸️ P1V3Page: Paused');
            // Save elapsed time
            if (startTimeRef.current) {
                elapsedBeforePauseRef.current += Date.now() - startTimeRef.current;
            }
            // Pause audio
            if (audioRef.current) {
                audioRef.current.pause();
            }
            // Clear timer
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        } else if (!isPaused && elapsedBeforePauseRef.current > 0) {
            console.log('▶️ P1V3Page: Resumed');
            // Reset start time
            startTimeRef.current = Date.now();
            // Resume audio
            if (audioRef.current) {
                audioRef.current.play().catch(error => {
                    console.warn('P1V3Page: Audio resume failed:', error);
                });
            }
            // Restart timer
            const checkImageSwitch = () => {
                const elapsed = elapsedBeforePauseRef.current + (Date.now() - startTimeRef.current);
                if (elapsed >= IMAGE_SWITCH_TIME && currentImage === '/images/v3_elmo.png') {
                    setCurrentImage('/images/v3_elmo_ball.png');
                }
            };
            timerRef.current = setInterval(checkImageSwitch, 100);
        }
    }, [isPaused, currentImage]);

    // Handle audio end
    const handleAudioEnd = () => {
        console.log('🔊 P1V3Page: Audio finished');
        setIsComplete(true);
        // Small delay before advancing
        setTimeout(() => {
            if (onComplete) {
                onComplete();
            }
        }, 500);
    };

    // Handle skip (Shift+Control+S)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.shiftKey && e.ctrlKey && (e.key === 'S' || e.key === 's')) {
                console.log('⏭️ P1V3Page: Skip key pressed');
                if (onComplete) {
                    onComplete();
                }
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onComplete]);

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            backgroundColor: '#f5f5f5',
            padding: '20px',
        }}>
            
            {/* Audio element */}
            <audio
                ref={audioRef}
                src="/audios/v3_elmo_ball.mp3"
                onEnded={handleAudioEnd}
            />

            {/* Image display */}
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                maxWidth: '800px',
                width: '100%',
            }}>
                <img
                    src={currentImage}
                    alt="Elmo"
                    style={{
                        maxWidth: '100%',
                        maxHeight: '70vh',
                        objectFit: 'contain',
                        transition: 'opacity 0.3s ease-in-out',
                    }}
                />
            </div>

            {/* Debug info */}
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
                    P1V3 | Image: {currentImage.split('/').pop()} | Complete: {isComplete.toString()}
                </div>
            )}
        </div>
    );
};

export default P1V3Page;
