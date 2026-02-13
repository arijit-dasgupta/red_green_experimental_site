import React, { useEffect, useRef, useState } from 'react';
import { usePause } from '../contexts/PauseContext';
// Video height matches canvas height on other V3 pages; width scales to preserve aspect ratio
const VIDEO_HEIGHT = 600;

/**
 * P2V3Page - Area Video Introduction
 * 
 * Visual: v3_area.mp4 (video with embedded audio)
 * Behavior: Auto-play video, auto-advance when complete
 */
const P2V3Page = ({ onComplete }) => {
    const { isPaused } = usePause();
    const [isComplete, setIsComplete] = useState(false);
    const videoRef = useRef(null);
    const wasPlayingRef = useRef(false);

    useEffect(() => {
        console.log('🎬 P2V3Page: Component mounted');
        
        // Start video playback
        if (videoRef.current) {
            videoRef.current.play().catch(error => {
                console.warn('P2V3Page: Video autoplay failed:', error);
            });
        }
    }, []);

    // Handle pause/resume
    useEffect(() => {
        if (!videoRef.current) return;
        
        if (isPaused) {
            console.log('⏸️ P2V3Page: Paused');
            wasPlayingRef.current = !videoRef.current.paused;
            videoRef.current.pause();
        } else if (wasPlayingRef.current) {
            console.log('▶️ P2V3Page: Resumed');
            videoRef.current.play().catch(error => {
                console.warn('P2V3Page: Video resume failed:', error);
            });
        }
    }, [isPaused]);

    // Handle video end
    const handleVideoEnd = () => {
        console.log('📹 P2V3Page: Video finished');
        setIsComplete(true);
        // Small delay before advancing
        setTimeout(() => {
            if (onComplete) {
                onComplete();
            }
        }, 500);
    };

    // Handle skip (Shift+S)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.shiftKey && (e.key === 'S' || e.key === 's')) {
                console.log('⏭️ P2V3Page: Skip key pressed');
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
            
            {/* Video display - height 600px, width auto; wrapper prevents flex shrink */}
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: `${VIDEO_HEIGHT}px`,
                flexShrink: 0,
            }}>
                <video
                    ref={videoRef}
                    src="/videos/v3_area.mp4"
                    onEnded={handleVideoEnd}
                    style={{
                        height: `${VIDEO_HEIGHT}px`,
                        minHeight: `${VIDEO_HEIGHT}px`,
                        width: 'auto',
                        objectFit: 'contain',
                        display: 'block',
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
                    P2V3 | Video | Complete: {isComplete.toString()}
                </div>
            )}
        </div>
    );
};

export default P2V3Page;
