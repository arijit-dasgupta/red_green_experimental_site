import React, { useRef, useEffect, useState } from 'react';
import VisualCountdownRing from './VisualCountdownRing';

const BREAK_DURATION_SEC = 30;

/**
 * BreakPage - Shown between blocks/trials when the experiment triggers a break.
 * Visual countdown only (no digits).
 */
const BreakPage = ({ onContinue }) => {
  const audioRef = useRef(null);
  const [secondsLeft, setSecondsLeft] = useState(BREAK_DURATION_SEC);
  const intervalRef = useRef(null);
  const hasAutoContinuedRef = useRef(false);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.play().catch(e => console.warn('Break audio autoplay:', e));
    }
  }, []);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (secondsLeft === 0 && !hasAutoContinuedRef.current) {
      hasAutoContinuedRef.current = true;
      onContinue();
    }
  }, [secondsLeft, onContinue]);

  const handleContinue = () => {
    if (hasAutoContinuedRef.current) return;
    hasAutoContinuedRef.current = true;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    onContinue();
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100%',
      background: 'linear-gradient(135deg, #e6f2ff 0%, #f0f8ff 50%, #ffffff 100%)',
      padding: '20px',
      textAlign: 'center',
    }}>
      <audio ref={audioRef} src="/audios/v3_break.mp3" preload="auto" />
      <h1 style={{ fontSize: '2rem', color: '#333', marginBottom: '20px' }}>
        Time for a short break!
      </h1>
      <p style={{ fontSize: '1.2rem', color: '#555', maxWidth: '520px', marginBottom: '18px' }}>
        Take a breath. We&apos;ll continue when the green circle finishes, or click Continue to go on whenever you&apos;re ready.
      </p>
      <div style={{ marginBottom: '30px' }}>
        <VisualCountdownRing
          size={140}
          strokeWidth={14}
          color="#28a745"
          trackColor="rgba(40,167,69,0.15)"
          progress={secondsLeft / BREAK_DURATION_SEC}
          label={secondsLeft}
        />
      </div>
      <button
        onClick={handleContinue}
        style={{
          padding: '15px 40px',
          fontSize: '1.2rem',
          color: 'white',
          backgroundColor: '#28a745',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          boxShadow: '0 2px 5px rgba(0, 0, 0, 0.2)',
        }}
      >
        Continue
      </button>
    </div>
  );
};

export default BreakPage;
