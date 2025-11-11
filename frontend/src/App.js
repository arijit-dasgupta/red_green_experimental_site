// App.js
import React, { useState, useRef, useEffect, useCallback } from 'react';
import './App.css';
import WelcomePage from './pages/Welcome';
import InstructionsPage from './pages/Instructions';
import ExperimentPage from './pages/Experiment';
import FinishPage from './pages/Finish';
import TimeoutPage from './pages/Timeout';
import Header from './components/Header';
import { useNavigation } from './contexts/NavigationContext';
// HOOKS to maintain robustness of experiment
import usePreventNavigation from './hooks/usePreventNavigation';
import useResizeCanvas from './hooks/useResizeCanvas';
import useUpdateKeyStates from './hooks/useUpdateKeyStates';
import useCancelAnimation from './hooks/useCancelAnimation';
import useSyncKeyStatesRef from './hooks/useSyncKeyStatesRef';
import useSessionTimeout from './hooks/useSessionTimeout';


const App = () => {
  const [isStrictMode, setIsStrictMode] = useState(false); // Track Strict Mode
  const renderCountRef = useRef(0);
  const enableStrictModeCheck = useRef(true);

  useEffect(() => {
      // Increment the render count (Strict Mode double-renders components in development)
      renderCountRef.current += 1;

      if (renderCountRef.current > 1 && enableStrictModeCheck.current) {
          // If renderCount > 1, Strict Mode is active
          setIsStrictMode(true);
          enableStrictModeCheck.current = false; // Disable
          // console.log("Detected Strict Mode: Double render occurred.");
      }
  }, []); // Runs only on initial renders


  const { currentPage, navigate } = useNavigation(); // Access currentPage and navigate from context

  const FPS = 30; // This was kept fixed because of the standard refresh rate of the screen
  const CANVAS_PROPORTION = 0.7;

  const [sceneData, setSceneData] = useState(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [keyStates, setKeyStates] = useState({ f: false, j: false });
  const [countdown, setCountdown] = useState(null);
  const [finished, setFinished] = useState(false);
  const [score, setScore] = useState(-1);
  const [trialInfo, setTrialInfo] = useState({ 
    ftrial_i: 0, 
    trial_i: 0, 
    unique_trial_id: 0,
    is_ftrial: false, 
    is_trial: false, 
    num_trials: -1, 
    num_ftrials: -1 
  });
  const [isTransitionPage, setIsTransitionPage] = useState(false);
  const [averageScore, setAverageScore] = useState(null);
  const [waitingForScoreSpacebar, setWaitingForScoreSpacebar] = useState(false);
  const [photodiodeColor, setPhotodiodeColor] = useState("white"); // "black" for first frame, "white" for last frame
  
  // Audio context and tones for precise timing
  const audioContextRef = useRef(null);
  const startToneRef = useRef(null);
  const endToneRef = useRef(null);

  const animationRef = useRef(null);
  const canvasRef = useRef(null);
  const isPlayingRef = useRef(false);
  const recordedKeyStates = useRef([]);
  const currentFrameRef = useRef(0);
  const keyStatesRef = useRef({ f: false, j: false });
  
  // const [canvasSize, setCanvasSize] = useState({
  //   width: Math.floor((window.innerHeight * CANVAS_PROPORTION) / 20) * 20,
  //   height: Math.floor((window.innerHeight * CANVAS_PROPORTION) / 20) * 20,
  // });

  // NOTE: TODO: CONDITIONAL WINDOW SIZE
  const [canvasSize, setCanvasSize] = useState({
    width: 400,
    height: 400,
  });

  const renderFrame = (frameIndex) => {

    if (!sceneData || !canvasRef.current) {
        console.error("Scene data or canvas not available:", { sceneData, canvasRef });
        return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        console.error("Failed to get 2D context for canvas.");
        return;
    }

    const scale = Math.min(
        canvas.width / sceneData.worldWidth,
        canvas.height / sceneData.worldHeight
    );

    // const scale = 20;

    console.log("Rendering frame:", frameIndex, "Scale:", scale);
    console.log("Canvas size:", canvas.width, canvas.height);
    console.log("window size:", window.innerWidth, window.innerHeight);

    // ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(1, -1);
    ctx.translate(0, -canvas.height);


    try {
        const { barriers, occluders, step_data, red_sensor, green_sensor, radius, counterbalance } = sceneData;

        if (frameIndex !==0) { 
          // Draw barriers
          ctx.fillStyle = "black";
          barriers.forEach(({ x, y, width, height }) => {
              ctx.fillRect(x * scale, y * scale, width * scale, height * scale);
          });

          // Draw sensors
          if (red_sensor) {
              ctx.fillStyle = "red";
              const { x, y, width, height } = counterbalance ? green_sensor : red_sensor;
              ctx.fillRect(x * scale, y * scale, width * scale, height * scale);
          }

          if (green_sensor) {
              ctx.fillStyle = "green";
              const { x, y, width, height } = counterbalance ? red_sensor : green_sensor;
              ctx.fillRect(x * scale, y * scale, width * scale, height * scale);
          }

          // Draw target
          if (step_data[frameIndex]) {
              ctx.fillStyle = "blue";
              const { x, y } = step_data[frameIndex];
              ctx.beginPath();
              ctx.arc((x + radius) * scale, (y + radius) * scale, scale * radius, 0, 2 * Math.PI);
              ctx.fill();
          }

          // Draw occluders
          ctx.fillStyle = "gray";
          occluders.forEach(({ x, y, width, height }) => {
              ctx.fillRect(x * scale, y * scale, width * scale, height * scale);
          });
        }

        if (frameIndex ===0) { 
          if (countdown !== null) {
            ctx.save();
            ctx.scale(1, -1); // Flip for proper text rendering
            ctx.translate(0, -canvas.height);
        
            const padding = 10; // Padding around the text
            const fontSize = 48;
            ctx.font = `${fontSize}px Helvetica`; // Adjust font size and style
            const textWidth = ctx.measureText(countdown).width;
            const textHeight = fontSize; // Approximate height of the text
        
            const textX = canvas.width / 2;
            const textY = canvas.height / 2;
        
            // Draw background rectangle
            ctx.fillStyle = "rgba(255, 255, 255, 0.8)"; // Semi-transparent white background
            ctx.fillRect(
              textX - textWidth / 2 - padding, // X position
              textY - padding, // Y position
              textWidth + padding * 2, // Width
              textHeight + padding * 2 // Height
            );
            
            // Draw text
            ctx.fillStyle = "black"; // Text color
            ctx.textAlign = "center"; // Center horizontally
            ctx.textBaseline = "middle"; // Align to the top vertically
            ctx.fillText(countdown, textX, textY); 
        
            ctx.restore();
        }
      }

    } catch (error) {
        console.error("Error rendering frame:", error);
    }

    ctx.restore();
};

  // use several hooks
  useSessionTimeout(navigate, currentPage);
  usePreventNavigation(!["finish", "welcome", "timeout"].includes(currentPage));
  useUpdateKeyStates(keyStates, setKeyStates);
  useCancelAnimation(animationRef);
  useSyncKeyStatesRef(keyStates, keyStatesRef);
  // useResizeCanvas(sceneData, setCanvasSize, renderFrame, currentFrameRef, CANVAS_PROPORTION, isPlaying); // Use the new hook
  
  // Initialize audio context and pre-generate tones for precise timing
  const initializeAudio = useCallback(() => {
    if (!audioContextRef.current) {
      try {
        // Create AudioContext
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        console.log("Audio context initialized for trial synchronization");
        
        // Pre-generate start tone (1000Hz, 50ms)
        const sampleRate = audioContextRef.current.sampleRate;
        const duration = 50; // in milli-seconds
        const frameCount = sampleRate * duration / 1000;
        const startBuffer = audioContextRef.current.createBuffer(1, frameCount, sampleRate);
        const startData = startBuffer.getChannelData(0);
        
        for (let i = 0; i < frameCount; i++) {
          startData[i] = Math.sin(2 * Math.PI * 1000 * i / sampleRate) * 0.3; // 1000Hz at 30% volume
        }
        startToneRef.current = startBuffer;
        
        // Pre-generate end tone (500Hz, 50ms)
        const endBuffer = audioContextRef.current.createBuffer(1, frameCount, sampleRate);
        const endData = endBuffer.getChannelData(0);
        
        for (let i = 0; i < frameCount; i++) {
          endData[i] = Math.sin(2 * Math.PI * 500 * i / sampleRate) * 0.3; // 500Hz at 30% volume
        }
        endToneRef.current = endBuffer;
        
      } catch (error) {
        console.warn("Audio context initialization failed:", error);
      }
    }
  }, []);

  // Play audio tone with minimal latency
  const playTone = useCallback((toneType) => {
    if (!audioContextRef.current || !startToneRef.current || !endToneRef.current) {
      console.warn("Audio not initialized, skipping tone");
      return;
    }

    try {
      // Resume audio context if it was suspended (browser autoplay policy)
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }

      const source = audioContextRef.current.createBufferSource();
      source.buffer = toneType === 'start' ? startToneRef.current : endToneRef.current;
      source.connect(audioContextRef.current.destination);
      
      // Play immediately - this is the most time-critical part
      source.start(0);
      
      console.log(`${toneType} tone played at:`, new Date().toISOString());
    } catch (error) {
      console.warn("Failed to play tone:", error);
    }
  }, []);

  // Initialize audio context on first user interaction (to comply with browser autoplay policies)
  useEffect(() => {
    const handleFirstInteraction = () => {
      initializeAudio();
      // Remove listeners after first interaction
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };

    window.addEventListener('click', handleFirstInteraction);
    window.addEventListener('keydown', handleFirstInteraction);

    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
  }, [initializeAudio]);

  useEffect(() => {
    if (countdown !== null) {
      renderFrame(currentFrame);
    }
  }, [countdown, currentFrame]);
  

 // Render current page based on state instead of routes
const renderCurrentPage = () => {

  switch (currentPage) {
    case 'welcome':
      return <WelcomePage
      setTrialInfo={setTrialInfo} 
    />;
    case 'instructions':
      return <InstructionsPage keyStates={keyStates} canvasSize={canvasSize} trialInfo={trialInfo} />
    case 'experiment':
      return <ExperimentPage
        sceneData={sceneData}
        trialInfo={trialInfo}
        isTransitionPage={isTransitionPage}
        currentFrame={currentFrame}
        isPlaying={isPlaying}
        keyStates={keyStates}
        recordedKeyStates={recordedKeyStates}
        countdown={countdown}
        finished={finished}
        score={score}
        waitingForScoreSpacebar={waitingForScoreSpacebar}
        setWaitingForScoreSpacebar={setWaitingForScoreSpacebar}
        setFinished={setFinished}
        photodiodeColor={photodiodeColor}
        canvasSize={canvasSize}
        handlePlayPause={handlePlayPause}
        fetchNextScene={fetchNextScene}
        canvasRef={canvasRef}
        isStrictMode={isStrictMode}
        onPause={handlePause}
      />;
    case 'timeout': // Add timeout case
      return <TimeoutPage />;
    case 'finish':
      return <FinishPage averageScore={averageScore} />;
    default:
      return <WelcomePage setTrialInfo={setTrialInfo} />;
  }
};


  const fetchNextScene = async (setdisableCountdownTrigger) => {
    
    try {
      const sessionId = sessionStorage.getItem('sessionId');
      if (!sessionId) {
        throw new Error('Session ID not found. Please start the experiment again.');
      }
  
      // Check if this is a resume operation
      const resumeFromTrial = sessionStorage.getItem('resumeFromTrial');
      const requestBody = { session_id: sessionId };
      
      if (resumeFromTrial) {
        requestBody.resume_from_trial = parseInt(resumeFromTrial);
        // Clear the resume flag after first use
        sessionStorage.removeItem('resumeFromTrial');
      }

      const response = await fetch('/load_next_scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json',
                  'ngrok-skip-browser-warning': 'true', // Add this header to skip the browser warning
                  'User-Agent': 'React-Experiment-App', // Custom User-Agent header
                },
        body: JSON.stringify(requestBody), // Pass sessionId and optional resume_from_trial in the body
      });
  
      if (!response.ok) throw new Error('Backend Failed to load next scene');
  
      const data = await response.json();
  
      if (data.finish) {
        setFinished(false);
        setAverageScore(data.average_score);
        navigate('finish');
        return;
      }
  
      if (data.fam_to_exp_page) {
        setFinished(false); // to disable spacebar pressing
        setIsTransitionPage(true);
        return;
      }

      // Clear the canvas to prevent showing the previous scene
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
  
      setdisableCountdownTrigger(false); // Enable countdown trigger
      setSceneData(data);
      setTrialInfo({
        ftrial_i: data.ftrial_i,
        trial_i: data.trial_i,
        unique_trial_id: data.unique_trial_id,
        is_ftrial: data.is_ftrial,
        is_trial: data.is_trial,
        num_trials: data.num_trials,
        num_ftrials: data.num_ftrials,
      });
      setCurrentFrame(0);
      recordedKeyStates.current = [];
      setFinished(false);
      currentFrameRef.current = 0;
      setIsTransitionPage(false);
      setWaitingForScoreSpacebar(false); // Reset score spacebar state for new trial
      setPhotodiodeColor("white"); // Reset photodiode to white for new trial
      animate.firstFrameUtc = null; // Reset timing data for new trial

      const worldWidth = data.worldWidth || 20;
      const worldHeight = data.worldHeight || 20;
      // const newCanvasSize = {
      //   width: Math.floor((window.innerHeight * CANVAS_PROPORTION) / worldWidth) * worldWidth,
      //   height: Math.floor((window.innerHeight * CANVAS_PROPORTION) / worldHeight) * worldHeight,
      // };
      // setCanvasSize(newCanvasSize);

      if (isPlaying) {
        renderFrame(0);
      }
    } catch (error) {
      console.error("Error loading next scene:", error);
      alert("Frontend Failed to load the next scene.");
    }
  };

const animate = (timestamp) => {
  if (!sceneData?.step_data) return;

  const totalFrames = Object.keys(sceneData.step_data).length;
  const frameDuration = 1000 / FPS;

  if (!animate.lastTimestamp) animate.lastTimestamp = timestamp;
  const timeElapsed = timestamp - animate.lastTimestamp;

  if (timeElapsed >= frameDuration * 0.98) {
    const currentUtcTime = new Date().toISOString();
    
    // Store first frame UTC time for reference and set photodiode to black
    if (!animate.firstFrameUtc) {
      animate.firstFrameUtc = currentUtcTime;
      setPhotodiodeColor("black"); // Set to black on first frame
      playTone("start"); // Play start tone immediately with photodiode change
    }
    
    recordedKeyStates.current.push({
      frame: currentFrameRef.current,
      keys: { ...keyStatesRef.current },
      utc_timestamp: currentUtcTime,
    });
    // console.log("Recorded key states:", keyStatesRef.current);
    // console.log('recording the states of keys')
    // setCurrentFrame((prevFrame) => {
      // const nextFrame = prevFrame + 1;
      const nextFrame = currentFrameRef.current + 1;
      // currentFrameRef.current = nextFrame;

      if (nextFrame >= totalFrames) {
        if (!animate.dataSaved) {
          isPlayingRef.current = false;
          setIsPlaying(false);
          setPhotodiodeColor("white"); // Set to white on last frame
          playTone("end"); // Play end tone immediately with photodiode change
          animate.dataSaved = true;

          setTimeout(async () => {
            try {

              const sessionId = sessionStorage.getItem('sessionId');
              if (!sessionId) throw new Error('Session ID not found.');

              // Get last frame UTC time
              const lastFrameUtc = recordedKeyStates.current.length > 0 
                ? recordedKeyStates.current[recordedKeyStates.current.length - 1].utc_timestamp 
                : animate.firstFrameUtc;

              const response = await fetch('/save_data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json',
                  'ngrok-skip-browser-warning': 'true',
                  'User-Agent': 'React-Experiment-App', // Custom User-Agent header
                 },
                body: JSON.stringify({
                  session_id: sessionId,
                  trial_i: sceneData.trial_i, // Include trial_id in the payload
                  ftrial_i: sceneData.ftrial_i,
                  unique_trial_id: sceneData.unique_trial_id,
                  is_ftrial: sceneData.is_ftrial,
                  is_trial: sceneData.is_trial,
                  recordedKeyStates: recordedKeyStates.current,
                  counterbalance: sceneData.counterbalance,
                  first_frame_utc: animate.firstFrameUtc,
                  last_frame_utc: lastFrameUtc,
                }),
              });

              if (!response.ok) {
                const errorData = await response.json(); // Parse the JSON error response
                console.error('Backend Error:', errorData.error); // Log the specific error message
                throw new Error('Failed to save data for score: ' + errorData.error);
            }
              const trialResult = await response.json();
              setScore(trialResult.score);
              setFinished(true);
            } catch (error) {
              console.error("Error saving data or fetching score:", error);
              setScore(0);
              setFinished(true);
            }
          }, 500);
        }

        // return prevFrame;
        return;
      }
      currentFrameRef.current = nextFrame;
      setCurrentFrame(nextFrame);
      renderFrame(nextFrame);
      // return nextFrame;
    // });

    animate.lastTimestamp = timestamp;
  }

  if (isPlayingRef.current) {
    animationRef.current = requestAnimationFrame(animate);
  }
};

  const handlePlayPause = (setdisableCountdownTrigger) => {
    if (isPlayingRef.current) return;

    let countdownValue = 3;
    setCountdown(countdownValue);
    setdisableCountdownTrigger(true);

    const countdownInterval = setInterval(() => {
      countdownValue -= 1;
      setCountdown(countdownValue);

      if (countdownValue === 0) {
        clearInterval(countdownInterval);
        setCountdown(null);
        isPlayingRef.current = true;
        setIsPlaying(true);
        animationRef.current = requestAnimationFrame(animate);
      }
    }, 750);
  };

  const handlePause = () => {
    // Stop animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    isPlayingRef.current = false;
    setIsPlaying(false);
    
    // Navigate to welcome page
    navigate('welcome');
  };


  const sessionId = sessionStorage.getItem('sessionId');

  return (
    <div className="app" style={{ position: "relative" }}>
      {currentPage !== 'welcome' && <Header sessionId={sessionId} />}
      {renderCurrentPage()}
    </div>
  );
};

export default App;