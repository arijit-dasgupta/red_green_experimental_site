// App.js
import React from 'react';
import { useState, useRef, useEffect } from 'react';
import './App.css';
import WelcomePage from './pages/Welcome';
import InstructionsPage from './pages/Instructions';
import ExperimentPage from './pages/Experiment';
import FinishPage from './pages/Finish';
import PostExperimentFeedbackPage from './pages/PostExperimentFeedback';
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
import { getApiBase } from './api';


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

  // FPS override - set to null to use FPS from JSON files, or set a number to override
  const OVERRIDE_FPS = null; // Set to null to use JSON FPS, or set to a number (e.g., 30) to override
  const CANVAS_PROPORTION = 0.7;

  const [sceneData, setSceneData] = useState(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [keyStates, setKeyStates] = useState({ f: false, j: false });
  const [countdown, setCountdown] = useState(null);
  const [finished, setFinished] = useState(false);
  const [score, setScore] = useState(-1);
  const [savingStatus, setSavingStatus] = useState(null); // null | 'saving' | 'saved' | 'error'
  const [pauseState, setPauseState] = useState(null); // null | 'awaiting_click' | 'click_placed' (click-point variant)
  const [clickPlacement, setClickPlacement] = useState(null); // { worldX, worldY } after valid click for blue circle
  const [clickInvalidReason, setClickInvalidReason] = useState(null); // 'Outside scene bounds' | 'Overlapping a barrier' | null
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
  const [prolificCompletionUrl, setProlificCompletionUrl] = useState(null);
  const [clickTrialResult, setClickTrialResult] = useState(null); // { isClickTrial: true, diametersAway: number } when trial had click task
  // const [currentPage, setCurrentPage] = useState('welcome');

  const animationRef = useRef(null);
  const canvasRef = useRef(null);
  const isPlayingRef = useRef(false);
  const recordedKeyStates = useRef([]);
  const currentFrameRef = useRef(0);
  const keyStatesRef = useRef({ f: false, j: false });
  const observationOnlyPhaseRef = useRef(false); // true after resume from click until trial end
  const clickPlacementRef = useRef(null); // always current for animation loop
  
  // const [canvasSize, setCanvasSize] = useState({
  //   width: Math.floor((window.innerHeight * CANVAS_PROPORTION) / 20) * 20,
  //   height: Math.floor((window.innerHeight * CANVAS_PROPORTION) / 20) * 20,
  // });

  // NOTE: TODO: CONDITIONAL WINDOW SIZE
  const [canvasSize, setCanvasSize] = useState({
    width: 400,
    height: 400,
  });

  // Get FPS from sceneData if available, otherwise use override or default
  const getFPS = () => {
    if (OVERRIDE_FPS !== null) {
      return OVERRIDE_FPS;
    }
    return sceneData?.fps || 30; // Use FPS from JSON, default to 30
  };

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

          // Draw target (ball) — Fix 5: hide ball when paused awaiting click; it reappears only when they click (drawn on top later)
          const pauseFrameNum = sceneData.pause_at_frame != null ? Number(sceneData.pause_at_frame) : null;
          const hidingBallWhileAwaitingClick = sceneData.has_click_trials && pauseFrameNum !== null && frameIndex === pauseFrameNum && !clickPlacementRef.current;
          const inObservationPhase = clickPlacementRef.current && pauseFrameNum !== null && frameIndex >= pauseFrameNum;
          const ballOverOccluder = inObservationPhase && occluders && occluders.length > 0 && step_data[frameIndex] && occluders.some(({ x: ox, y: oy, width: w, height: h }) => {
              const worldX = step_data[frameIndex].x + radius;
              const worldY = step_data[frameIndex].y + radius;
              return worldX >= ox && worldX <= ox + w && worldY >= oy && worldY <= oy + h;
          });
          // When ball is behind occluder in observation phase we draw it after occluders (Fix 4), so skip here
          if (step_data[frameIndex] && !hidingBallWhileAwaitingClick && !ballOverOccluder) {
              const { x, y } = step_data[frameIndex];
              const ballCenterX = (x + radius) * scale;
              const ballCenterY = (y + radius) * scale;
              ctx.fillStyle = "blue";
              ctx.beginPath();
              ctx.arc(ballCenterX, ballCenterY, scale * radius, 0, 2 * Math.PI);
              ctx.fill();
          }

          // Draw occluders
          ctx.fillStyle = "gray";
          occluders.forEach(({ x, y, width, height }) => {
              ctx.fillRect(x * scale, y * scale, width * scale, height * scale);
          });

          // Fix 4: in observation phase, when ball is behind an occluder, draw it on top (translucent) so it's visible through the occluder
          if (ballOverOccluder && step_data[frameIndex]) {
              const { x, y } = step_data[frameIndex];
              ctx.globalAlpha = 0.5;
              ctx.fillStyle = "blue";
              ctx.beginPath();
              ctx.arc((x + radius) * scale, (y + radius) * scale, scale * radius, 0, 2 * Math.PI);
              ctx.fill();
              ctx.globalAlpha = 1;
          }
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

    // Click-point variant: draw darker dotted blue circle at placement (stays visible during 1s wait and observation; use ref so animation loop sees it)
    const placement = clickPlacementRef.current;
    const pauseFrame = sceneData.pause_at_frame != null ? Number(sceneData.pause_at_frame) : null;
    if (sceneData.has_click_trials && pauseFrame !== null && placement && frameIndex >= pauseFrame) {
        const { worldX, worldY } = placement;
        const r = sceneData.radius || 0.5;
        ctx.strokeStyle = "#001080";
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.arc(worldX * scale, worldY * scale, scale * r, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // Fix 3: during the 1-second after click, draw the REAL ball on top so it "pops" into view (visible even if it was behind an occluder)
    if (sceneData.has_click_trials && pauseFrame !== null && placement && frameIndex === pauseFrame && sceneData.step_data && sceneData.step_data[pauseFrame]) {
        const { x, y } = sceneData.step_data[pauseFrame];
        const ballR = sceneData.radius || 0.5;
        const ballCenterX = (x + ballR) * scale;
        const ballCenterY = (y + ballR) * scale;
        ctx.fillStyle = "blue";
        ctx.beginPath();
        ctx.arc(ballCenterX, ballCenterY, scale * ballR, 0, 2 * Math.PI);
        ctx.fill();
    }

    ctx.restore();
};

  // use several hooks
  useSessionTimeout(navigate, currentPage);
  usePreventNavigation(!["finish", "post_feedback", "welcome", "timeout"].includes(currentPage));
  useUpdateKeyStates(keyStates, setKeyStates);
  useCancelAnimation(animationRef);
  useSyncKeyStatesRef(keyStates, keyStatesRef);
  // useResizeCanvas(sceneData, setCanvasSize, renderFrame, currentFrameRef, CANVAS_PROPORTION, isPlaying); // Use the new hook
  useEffect(() => {
    if (countdown !== null) {
      renderFrame(currentFrame);
    }
  }, [countdown, currentFrame]);

  // Keep ref in sync so animation loop always sees current placement when drawing blue circle
  useEffect(() => {
    clickPlacementRef.current = clickPlacement;
  }, [clickPlacement]);

  // Click-point: when placement is set (during 1s wait or after), redraw so blue circle appears (animation is stopped so no other redraws)
  useEffect(() => {
    if (clickPlacement && sceneData?.pause_at_frame != null && sceneData?.has_click_trials && canvasRef.current) {
      renderFrame(currentFrameRef.current);
    }
  }, [clickPlacement, sceneData?.pause_at_frame, sceneData?.has_click_trials]);

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
        savingStatus={savingStatus}
        clickTrialResult={clickTrialResult}
        pauseState={pauseState}
        clickPlacement={clickPlacement}
        clickInvalidReason={clickInvalidReason}
        onValidPlacement={onValidPlacement}
        setClickInvalidReason={setClickInvalidReason}
        canvasSize={canvasSize}
        handlePlayPause={handlePlayPause}
        fetchNextScene={fetchNextScene}
        canvasRef={canvasRef}
        isStrictMode={isStrictMode}
      />;
    case 'post_feedback':
      return <PostExperimentFeedbackPage navigateToFinish={() => navigate('finish')} />;
    case 'timeout': // Add timeout case
      return <TimeoutPage />;
    case 'finish':
      return <FinishPage averageScore={averageScore} prolificCompletionUrl={prolificCompletionUrl} />;
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
  
      const response = await fetch(getApiBase() + '/load_next_scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json',
                  'ngrok-skip-browser-warning': 'true', // Add this header to skip the browser warning
                  'User-Agent': 'React-Experiment-App', // Custom User-Agent header
                },
        body: JSON.stringify({ session_id: sessionId }), // Pass sessionId in the body
      });
  
      if (!response.ok) throw new Error('Backend Failed to load next scene');
  
      const data = await response.json();
  
      if (data.finish) {
        setFinished(false);
        setSavingStatus(null);
        setPauseState(null);
        setClickPlacement(null);
        setClickInvalidReason(null);
        setClickTrialResult(null);
        observationOnlyPhaseRef.current = false;
        setAverageScore(data.average_score);
        setProlificCompletionUrl(data.prolific_completion_url || null);
        navigate('post_feedback');
        return;
      }
  
      if (data.fam_to_exp_page) {
        setFinished(false); // to disable spacebar pressing
        setSavingStatus(null);
        setPauseState(null);
        setClickPlacement(null);
        setClickInvalidReason(null);
        setClickTrialResult(null);
        observationOnlyPhaseRef.current = false;
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
      setSavingStatus(null);
      setPauseState(null);
      setClickPlacement(null);
      setClickInvalidReason(null);
      setClickTrialResult(null);
      observationOnlyPhaseRef.current = false;
      currentFrameRef.current = 0;
      setIsTransitionPage(false);
  
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
  // console.log("calling animate before return");
  // console.log("sceneData:", sceneData);
  if (!sceneData?.step_data) return;


  const totalFrames = Object.keys(sceneData.step_data).length;
  const frameDuration = 1000 / getFPS();

  if (!animate.lastTimestamp) animate.lastTimestamp = timestamp;

  const timeElapsed = timestamp - animate.lastTimestamp;

  // console.log("Time elapsed:", timeElapsed);
  // console.log('calling animate')

  if (timeElapsed >= frameDuration * 0.98) {
    const nextFrame = currentFrameRef.current + 1;

    // Only record key states when not in observation-only phase (after click resume)
    if (!observationOnlyPhaseRef.current) {
      recordedKeyStates.current.push({
        frame: currentFrameRef.current,
        keys: { ...keyStatesRef.current },
      });
    }

    // Click-point variant: when we reach the pause frame, advance to it, render, then stop
    const pauseAtFrame = sceneData.pause_at_frame;
    const hasClickTrials = sceneData.has_click_trials === true;
    if (hasClickTrials && pauseAtFrame != null && nextFrame === pauseAtFrame) {
      currentFrameRef.current = nextFrame;
      setCurrentFrame(nextFrame);
      renderFrame(nextFrame);
      isPlayingRef.current = false;
      setIsPlaying(false);
      setPauseState('awaiting_click');
      setClickInvalidReason(null);
      animate.lastTimestamp = timestamp;
      return;
    }

    if (nextFrame >= totalFrames) {
        if (!animate.dataSaved) {
          isPlayingRef.current = false;
          setIsPlaying(false);

          animate.dataSaved = true;
          setSavingStatus('saving');

          setTimeout(async () => {
            try {

              const sessionId = sessionStorage.getItem('sessionId');
              if (!sessionId) throw new Error('Session ID not found.');

              const response = await fetch(getApiBase() + '/save_data', {
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
                }),
              });

              if (!response.ok) {
                const errorData = await response.json(); // Parse the JSON error response
                console.error('Backend Error:', errorData.error); // Log the specific error message
                throw new Error('Failed to save data for score: ' + errorData.error);
            }
              const trialResult = await response.json();
              setScore(trialResult.score);
              setSavingStatus('saved');
              // For click-point trials: compute distance in diameters (no score shown)
              if (sceneData.has_click_trials && sceneData.pause_at_frame != null && clickPlacementRef.current && sceneData.step_data && sceneData.step_data[sceneData.pause_at_frame]) {
                const ball = sceneData.step_data[sceneData.pause_at_frame];
                const r = sceneData.radius != null ? Number(sceneData.radius) : 0.5;
                const ballCx = (ball.x != null ? Number(ball.x) : 0) + r;
                const ballCy = (ball.y != null ? Number(ball.y) : 0) + r;
                const dx = clickPlacementRef.current.worldX - ballCx;
                const dy = clickPlacementRef.current.worldY - ballCy;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const diametersAway = dist / (2 * r);
                setClickTrialResult({ isClickTrial: true, diametersAway });
              } else {
                setClickTrialResult(null);
              }
              setFinished(true);
            } catch (error) {
              console.error("Error saving data or fetching score:", error);
              setScore(0);
              setClickTrialResult(null);
              setSavingStatus('error');
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

  // Click-point variant: after valid placement, show blue circle and resume animation after 1s
  const onValidPlacement = (worldX, worldY) => {
    setClickPlacement({ worldX, worldY });
    setPauseState('click_placed');
    setClickInvalidReason(null);
    setTimeout(() => {
      setPauseState(null);
      observationOnlyPhaseRef.current = true;
      isPlayingRef.current = true;
      setIsPlaying(true);
      animationRef.current = requestAnimationFrame(animate);
    }, 1000);
  };

  return (
    <div className="app" style={{ position: "relative" }}>
      <Header />
      {renderCurrentPage()}
    </div>
  );
};

export default App;