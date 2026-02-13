import React, { useState, useEffect, useCallback } from 'react';
import { usePause } from '../contexts/PauseContext';

/**
 * StudyControls Component
 * 
 * Provides Pause and Stop buttons for the experiment, similar to the jsPsych implementation.
 * - Pause: Pauses all videos/audio, shows overlay, logs pause events
 * - Stop: Ends the study and navigates to a thank-you page
 * 
 * Props:
 * - onStop: Function to call when stop button is clicked
 * - onPause: Optional function to call when pause button is clicked
 * - onResume: Optional function to call when resume button is clicked
 * - showControls: Boolean to show/hide controls (default: true)
 */
const StudyControls = ({ onStop, onPause, onResume, showControls = true }) => {
    const { isPaused, pauseStudy, resumeStudy } = usePause();
    const [isHovered, setIsHovered] = useState(false);
    const [pauseEvents, setPauseEvents] = useState([]);

    // Function to pause all media (videos and audio) on the page
    const pauseAllMedia = useCallback(() => {
        // Pause all video elements
        const videos = document.querySelectorAll('video');
        videos.forEach(video => {
            if (!video.paused) {
                video.pause();
            }
        });

        // Pause all audio elements
        const audios = document.querySelectorAll('audio');
        audios.forEach(audio => {
            if (!audio.paused) {
                audio.pause();
            }
        });

        console.log('📹 StudyControls: All media paused');
    }, []);

    // Function to resume all media
    const resumeAllMedia = useCallback(() => {
        // Resume all video elements
        const videos = document.querySelectorAll('video');
        videos.forEach(video => {
            if (video.paused && video.currentTime > 0) {
                video.play().catch(e => console.warn('Could not resume video:', e));
            }
        });

        // Resume all audio elements
        const audios = document.querySelectorAll('audio');
        audios.forEach(audio => {
            if (audio.paused && audio.currentTime > 0) {
                audio.play().catch(e => console.warn('Could not resume audio:', e));
            }
        });

        console.log('📹 StudyControls: All media resumed');
    }, []);

    // Handle pause/resume button click
    const handlePauseResume = useCallback(() => {
        const now = new Date();
        const event = {
            event_type: isPaused ? 'resume' : 'pause',
            timestamp: now.toISOString(),
            time_since_page_load: performance.now()
        };

        // Log the event
        console.log('⏸️ StudyControls:', event);
        setPauseEvents(prev => [...prev, event]);

        if (!isPaused) {
            // Pause the study
            pauseAllMedia();
            pauseStudy(); // Update global pause state
            if (onPause) onPause(event);
        } else {
            // Resume the study - don't resume media here, let components restart
            // resumeAllMedia(); // Components will restart from beginning
            resumeStudy(); // Update global pause state (triggers reset in components)
            if (onResume) onResume(event);
        }
    }, [isPaused, pauseAllMedia, pauseStudy, resumeStudy, onPause, onResume]);

    // Handle stop button click
    const handleStop = useCallback(() => {
        const now = new Date();
        const event = {
            event_type: 'stop_study',
            timestamp: now.toISOString(),
            time_since_page_load: performance.now(),
            pause_events: pauseEvents
        };

        console.log('🛑 StudyControls: Study stopped', event);

        // Pause all media first
        pauseAllMedia();

        // Call the onStop callback
        if (onStop) {
            onStop(event);
        }
    }, [pauseAllMedia, onStop, pauseEvents]);

    // Keyboard shortcut: Escape to pause/resume
    useEffect(() => {
        const handleKeyPress = (e) => {
            if (e.key === 'Escape') {
                handlePauseResume();
            }
        };

        document.addEventListener('keydown', handleKeyPress);
        return () => document.removeEventListener('keydown', handleKeyPress);
    }, [handlePauseResume]);

    if (!showControls) return null;

    return (
        <>
            {/* Dedicated top bar - reserves space so buttons never overlap canvas/video */}
            <div
                style={{
                    width: '100%',
                    minHeight: '48px',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    backgroundColor: '#f0f0f0',
                    borderBottom: '1px solid #ddd',
                    zIndex: 9999,
                    opacity: isHovered ? 1 : 0.85,
                    transition: 'opacity 0.3s ease',
                }}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                {/* Pause/Resume Button */}
                <button
                    onClick={handlePauseResume}
                    style={{
                        fontSize: '12px',
                        padding: '5px 15px',
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontFamily: 'Arial, sans-serif',
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(0, 0, 0, 0.7)'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = 'rgba(0, 0, 0, 0.5)'}
                >
                    {isPaused ? 'Resume' : 'Pause Study'}
                </button>

                {/* Stop Button */}
                <button
                    onClick={handleStop}
                    style={{
                        fontSize: '12px',
                        padding: '5px 15px',
                        backgroundColor: 'rgba(139, 0, 0, 0.5)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontFamily: 'Arial, sans-serif',
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(139, 0, 0, 0.7)'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = 'rgba(139, 0, 0, 0.5)'}
                >
                    Stop Study
                </button>
            </div>

            {/* Pause overlay */}
            {isPaused && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100vw',
                        height: '100vh',
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        color: 'white',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 9998,
                        fontSize: '1.5em',
                    }}
                >
                    <p style={{ marginBottom: '20px' }}>The study is paused.</p>
                    <p style={{ fontSize: '0.8em', color: '#aaa' }}>
                        Click the "Resume" button or press Escape to continue.
                    </p>
                </div>
            )}
        </>
    );
};

export default StudyControls;
