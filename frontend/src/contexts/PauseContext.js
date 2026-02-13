// PauseContext.js
import React, { createContext, useContext, useState, useCallback } from 'react';

const PauseContext = createContext();

export const PauseProvider = ({ children }) => {
  const [isPaused, setIsPaused] = useState(false);
  const [resumeCounter, setResumeCounter] = useState(0);

  const pauseStudy = useCallback(() => {
    setIsPaused(true);
  }, []);

  const resumeStudy = useCallback(() => {
    setIsPaused(false);
    setResumeCounter(c => c + 1);
  }, []);

  const value = {
    isPaused,
    resumeCounter,
    pauseStudy,
    resumeStudy,
  };

  return (
    <PauseContext.Provider value={value}>
      {children}
    </PauseContext.Provider>
  );
};

export const usePause = () => {
  const context = useContext(PauseContext);
  if (!context) {
    throw new Error('usePause must be used within a PauseProvider');
  }
  return context;
};
