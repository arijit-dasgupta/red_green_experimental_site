import React, { useRef, useEffect } from 'react';

/**
 * BreakPage - Shown between blocks/trials when the experiment triggers a break.
 * User clicks Continue to call onContinue and resume.
 */
const BreakPage = ({ onContinue }) => {
  const audioRef = useRef(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.play().catch(e => console.warn('Break audio autoplay:', e));
    }
  }, []);

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
      <p style={{ fontSize: '1.2rem', color: '#555', maxWidth: '500px', marginBottom: '30px' }}>
        When you're ready, click the button below to continue.
      </p>
      <button
        onClick={onContinue}
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
