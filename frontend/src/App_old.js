import React, { useState, useEffect, useRef } from "react";
import './App.css';

const App = () => {
  console.log("App component rendered");
  const [sceneData, setSceneData] = useState(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [keyStates, setKeyStates] = useState({ f: false, j: false });
  const [countdown, setCountdown] = useState(null);
  const [finished, setFinished] = useState(false);
  const [score, setScore] = useState(-1);
  const [trialInfo, setTrialInfo] = useState({ ftrial_i: 0, trial_i: 0, is_ftrial: false, is_trial: false, num_trials: -1, num_ftrials: -1 });
  const [isTransitionPage, setIsTransitionPage] = useState(false);
  const [currentPage, setCurrentPage] = useState("welcome"); 
  const [averageScore, setAverageScore] = useState(null);

  const FPS = 20;
  const CANVAS_PROPORTION = 0.7;
  
  const enableFetchCurrentPage = useRef(true);
  const [enableUpdateCurrentPage, setEnableUpdateCurrentPage] = useState(false);
  const isInitializedRef = useRef(false); // Track if `fetchNextScene` has been called
  const animationRef = useRef(null);
  const canvasRef = useRef(null);
  const isPlayingRef = useRef(false);
  const recordedKeyStates = useRef([]);
  const currentFrameRef = useRef(0);
  const keyStatesRef = useRef({ f: false, j: false });
  
  const [canvasSize, setCanvasSize] = useState({
    width: Math.floor((window.innerHeight * CANVAS_PROPORTION) / 20) * 20, // Initialize as 0 until sceneData is available
    height: Math.floor((window.innerHeight * CANVAS_PROPORTION) / 20) * 20,
  });
  
  // useEffect(() => {
  //   const handleBeforeUnload = (event) => {
  //     if (isPlaying) {
  //       event.preventDefault();
  //       event.returnValue = ""; // Some browsers require this for custom messages.
  //     }
  //   };
  
  //   if (isPlaying) {
  //     window.addEventListener("beforeunload", handleBeforeUnload);
  //   } else {
  //     window.removeEventListener("beforeunload", handleBeforeUnload);
  //   }
  
  //   return () => {
  //     window.removeEventListener("beforeunload", handleBeforeUnload);
  //   };
  // }, [isPlaying]);

  // Fetch the current page from the backend on mount
  useEffect(() => {
    const fetchCurrentPage = async () => {
      try {
        console.log("Fetching current page...");
        const response = await fetch("/get_current_page", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        if (!response.ok) throw new Error("Failed to fetch current page");

        const data = await response.json();
        console.log("Fetched current page:", data.currentPage);

        // Update state only if necessary
        if (data.currentPage && data.currentPage !== currentPage) {
          setCurrentPage(data.currentPage);
        }
      } catch (error) {
        console.error("Error fetching current page:", error);
      }
    };

    if (enableFetchCurrentPage.current) {
      enableFetchCurrentPage.current = false; // Mark as fetched
      fetchCurrentPage();
    }
  }, []); // Run only once on mount


  useEffect(() => {
  // Only update if currentPage has changed due to user interaction and not on initial load
    console.log(enableFetchCurrentPage.current);
    if (!enableUpdateCurrentPage.current) {
      setEnableUpdateCurrentPage(true);
      return; // Skip the update on initial load
    }
    const updateCurrentPage = async (page) => {
      try {
        console.log("Updating current page:", page);
        await fetch("/update_current_page", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentPage: page }),
        });
      } catch (error) {
        console.error("Error updating current page:", error);
      }
    };

    updateCurrentPage(currentPage);
  }, [currentPage]); // Runs only when `currentPage` changes after the initial load

  useEffect(() => {
    if (enableUpdateCurrentPage) {
      console.log("State successfully updated to true!");
    }
  }, [enableUpdateCurrentPage]);


  useEffect(() => {
    const handleResize = () => {
      if (sceneData) {
        const worldWidth = sceneData.worldWidth || 20;
        const worldHeight = sceneData.worldHeight || 20;
  
        // Update canvas size to multiples of world dimensions
        const newCanvasSize = {
          width: Math.floor((window.innerHeight * CANVAS_PROPORTION) / worldWidth) * worldWidth,
          height: Math.floor((window.innerHeight * CANVAS_PROPORTION) / worldHeight) * worldHeight,
        };
  
        setCanvasSize(newCanvasSize);
  
        // Explicitly re-render the current frame after resizing
        setTimeout(() => renderFrame(currentFrameRef.current), 0);
      }
    };
  
    window.addEventListener("resize", handleResize);
  
    // Initial render when `sceneData` changes
    if (sceneData) handleResize();
  
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [sceneData]); // Re-run whenever `sceneData` changes
  

  const fetchNextScene = async () => {
    try {
      const response = await fetch("/load_next_scene", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
  
      if (!response.ok) throw new Error("Failed to load next scene");

      const data = await response.json();

    // Check if we received the finish page data
      if (data.finish) { // Assuming `isFinishPage` indicates experiment is finished
        setAverageScore(data.average_score); 
        setCurrentPage("finish"); 
        return;
      }

      // Check if familiarization trials are complete
      if (data.fam_to_exp_page) {
        setIsTransitionPage(true); // Show the transition page
        return;
      }
  
      setSceneData(data);
      setTrialInfo({
        ftrial_i: data.ftrial_i,
        trial_i: data.trial_i,
        is_ftrial: data.is_ftrial,
        is_trial: data.is_trial,
        num_trials: data.num_trials,
        num_ftrials: data.num_ftrials,
      });
      setCurrentFrame(0);
      recordedKeyStates.current = [];
      setFinished(false);
      currentFrameRef.current = 0;
  
      // Resize and re-render after loading new scene data
      const worldWidth = data.worldWidth || 20;
      const worldHeight = data.worldHeight || 20;
      const newCanvasSize = {
        width: Math.floor((window.innerHeight * CANVAS_PROPORTION) / worldWidth) * worldWidth,
        height: Math.floor((window.innerHeight * CANVAS_PROPORTION) / worldHeight) * worldHeight,
      };
      setCanvasSize(newCanvasSize);
  
      // Render the first frame of the new scene
    // Ensure canvas is ready before calling renderFrame

    renderFrame(0);
    } catch (error) {
      console.error("Error loading next scene:", error);
      alert("Failed to load the next scene.");
    }
  };

  useEffect(() => {
    if (!isInitializedRef.current) {
      // Only fetch the next scene once
      isInitializedRef.current = true;
      fetchNextScene();
    }
  }, []);

  const renderFrame = (frameIndex) => {
    if (!sceneData || !canvasRef.current) return; // Check if canvasRef is valid
  
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const scale = Math.min(
      canvas.width / sceneData.worldWidth,
      canvas.height / sceneData.worldHeight
    );
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(1, -1);
    ctx.translate(0, -canvas.height);
  
    const { barriers, occluders, step_data, red_sensor, green_sensor, radius } = sceneData;
  
    // Draw barriers
    ctx.fillStyle = "black";
    barriers.forEach(({ x, y, width, height }) => {
      ctx.fillRect(x * scale, y * scale, width * scale, height * scale);
    });
  
    // Draw sensors
    if (red_sensor) {
      ctx.fillStyle = "red";
      const { x, y, width, height } = red_sensor;
      ctx.fillRect(x * scale, y * scale, width * scale, height * scale);
    }
  
    if (green_sensor) {
      ctx.fillStyle = "green";
      const { x, y, width, height } = green_sensor;
      ctx.fillRect(x * scale, y * scale, width * scale, height * scale);
    }
  
    // Draw target
    if (step_data[frameIndex]) {
      ctx.fillStyle = "blue";
      const { x, y } = step_data[frameIndex];
      ctx.beginPath();
      ctx.arc((x + radius) * scale, (y + radius) * scale, scale * sceneData.radius, 0, 2 * Math.PI);
      ctx.fill();
    }
  
    // Draw occluders
    ctx.fillStyle = "gray";
    occluders.forEach(({ x, y, width, height }) => {
      ctx.fillRect(x * scale, y * scale, width * scale, height * scale);
    });
  
    ctx.restore();
  };


  const animate = (timestamp) => {
    if (!sceneData?.step_data) return;
  
    const totalFrames = Object.keys(sceneData.step_data).length;
    const frameDuration = 1000 / FPS;
  
    if (!animate.lastTimestamp) animate.lastTimestamp = timestamp;
  
    const timeElapsed = timestamp - animate.lastTimestamp;
  
    if (timeElapsed >= frameDuration * 0.98) {
      recordedKeyStates.current.push({
        frame: currentFrameRef.current,
        keys: { ...keyStatesRef.current },
      });
  
      setCurrentFrame((prevFrame) => {
        const nextFrame = prevFrame + 1;
        currentFrameRef.current = nextFrame;
  
        if (nextFrame >= totalFrames) {
          if (!animate.dataSaved) {
            isPlayingRef.current = false;
            setIsPlaying(false);
  
            // Mark as saved to prevent duplicate calls
            animate.dataSaved = true;
  
            // Introduce a 2-second delay before showing the "Finished" overlay
            setTimeout(async () => {
              try {
                const response = await fetch("/save_data", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ recordedKeyStates: recordedKeyStates.current }),
                });
  
                if (!response.ok) throw new Error("Failed to save data for score");
  
                const trialResult = await response.json(); // Wait for the JSON response
                setScore(trialResult.score); // Set the score from the response
                setFinished(true); // Set finished state
              } catch (error) {
                console.error("Error saving data or fetching score:", error);
                setScore(0); // Default score in case of an error
                setFinished(true);
              }
            }, 1000);
          }
  
          return prevFrame;
        }
  
        renderFrame(nextFrame);
        return nextFrame;
      });
  
      animate.lastTimestamp = timestamp;
    }
  
    if (isPlayingRef.current) {
      animationRef.current = requestAnimationFrame(animate);
    }
  };

  const handlePlayPause = () => {
    if (isPlayingRef.current) return;

    let countdownValue = 3;
    setCountdown(countdownValue);

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
    }, 1000);
  };

  useEffect(() => {
    if (sceneData && canvasRef.current) {
      renderFrame(currentFrameRef.current);
    }
  }, [canvasSize]); // Re-run whenever `canvasSize` changes

  useEffect(() => {
    return () => cancelAnimationFrame(animationRef.current);
  }, []);

  useEffect(() => {
    currentFrameRef.current = currentFrame;
  }, [currentFrame]);

  useEffect(() => {
    keyStatesRef.current = keyStates;
  }, [keyStates]);

  useEffect(() => {
    const handleKey = (isDown) => (e) => {
      if (e.key === "f" || e.key === "j") {
        setKeyStates(prev => ({ ...prev, [e.key]: isDown }));
      }
    };

    window.addEventListener("keydown", handleKey(true));
    window.addEventListener("keyup", handleKey(false));

    return () => {
      window.removeEventListener("keydown", handleKey(true));
      window.removeEventListener("keyup", handleKey(false));
    };
  }, []);

  useEffect(() => {
    if (sceneData) renderFrame(0);
  }, [sceneData]);

  const renderKeyState = (key, color) => {
    // Suppress visualization if both keys are pressed
    if (keyStates.f && keyStates.j) {
      return null; // Do not render any key state if both are pressed
    }
  
    // Render visualization for individual key presses
    return keyStates[key] && (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: `${canvasSize.width * 0.01}px` }}>
        <div style={{
          width: `${canvasSize.width * 0.12}px`,
          height: `${canvasSize.width * 0.12}px`,
          backgroundColor: color,
          animation: "pulse-vibrate 0.75s infinite",
          boxShadow: `0 0 ${canvasSize.width * 0.08}px ${color}B3`
        }} />
        <span style={{ color, fontWeight: "bold" }}>
          {color.charAt(0).toUpperCase() + color.slice(1)}
        </span>
      </div>
    );
  };

  return (
      <div style={{ position: "relative", height: "100vh" }}>
        {currentPage === "welcome" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              height: "100vh",
              backgroundColor: "#f9f9f9",
            }}
          >
            <h1 style={{ fontSize: "2rem", color: "#333", marginBottom: "20px" }}>
              Welcome to the Red-Green Experiment
            </h1>
            <p style={{ fontSize: "1.2rem", color: "#555", marginBottom: "30px" }}>
              Press the start button below to begin a session of the experiment.
            </p>
            <button
              onClick={() => setCurrentPage("instructions")}
              style={{
                padding: "15px 30px",
                fontSize: "1.2rem",
                color: "white",
                backgroundColor: "#007bff",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer",
              }}
            >
              Start
            </button>
          </div>
        )}

        {currentPage === "instructions" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            height: "100vh",
            backgroundColor: "#f9f9f9",
          }}
        >
          <h1 style={{ fontSize: "2rem", color: "#333", marginBottom: "20px" }}>
            Instructions
          </h1>
          <div style={{ fontSize: "1.2rem", color: "#555", marginBottom: "30px", maxWidth: "600px", lineHeight: "1.5" }}>
            <p>
              In this experiment, you will observe a circular object (blue) moving
              with an initial velocity. The object follows the laws of physics,
              bouncing off walls and barriers (black rectangles). It does not lose
              energy due to collisions.
            </p>
            <p>
              Occluders (grey rectangles) can hide the blue object, but no barriers
              are hidden under occlusion. Your task is to observe where the object
              might go when it passes under occluders.
            </p>
            <p>
              Your goal is to predict where the blue object will land in relation
              to the red and green regions. Use the keys "F" and "J" to indicate
              your choice of red or green.
            </p>
            <p>
              The familiarization trials do not contribute to your final score.
              The experimental trials will, and your score will depend on your
              accuracy.
            </p>
            <p>
              Number of familiarization trials: {trialInfo.num_ftrials}
              <br />
              Number of experimental trials: {trialInfo.num_trials}
            </p>
          </div>
          <button
            onClick={() => setCurrentPage("experiment")}
            style={{
              padding: "15px 30px",
              fontSize: "1.2rem",
              color: "white",
              backgroundColor: "#007bff",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            Begin Familiarization Trials
          </button>
        </div>
      )}
      {currentPage === "experiment" && (
      <div>
        {/* Existing experiment code */}
      {isTransitionPage ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            height: "100vh",
            backgroundColor: "#f9f9f9",
          }}
        >
          <h1 style={{ fontSize: "2rem", color: "#333", marginBottom: "20px" }}>
            All {trialInfo.num_ftrials} familiarization trials are complete.
          </h1>
          <p style={{ fontSize: "1.2rem", color: "#555", marginBottom: "30px" }}>
            Press "Next" to begin the experiment, where you will face {trialInfo.num_trials} trials.
          </p>
          <button
            onClick={() => {
              setIsTransitionPage(false); // Move to regular trials
              fetchNextScene(); // Fetch the first regular trial
            }}
            style={{
              padding: "15px 30px",
              fontSize: "1.2rem",
              color: "white",
              backgroundColor: "#007bff",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            Next
          </button>
        </div>
      ) : (
        <>
      {countdown && (
        <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          fontSize: "4rem",
          color: "black",
          fontWeight: "bold",
          background: "rgba(255, 255, 255, 0.8)",
          padding: "20px",
          borderRadius: "10px",
          zIndex: 10,
        }}>
          {countdown}
        </div>
      )}

      <div style={{
        position: "absolute",
        top: "10px",
        right: "10px",
        backgroundColor: "rgba(255, 255, 255, 0.8)",
        padding: "10px",
        borderRadius: "8px",
        boxShadow: "0 2px 5px rgba(0, 0, 0, 0.2)",
        zIndex: 100,
      }}>
        <p style={{ margin: 0, fontWeight: "bold", fontSize: "14px" }}>
          {trialInfo.is_ftrial ? `Familiarization Trial: ${trialInfo.ftrial_i}/${trialInfo.num_ftrials}` : `Trial Number: ${trialInfo.trial_i}/${trialInfo.num_trials}`}
        </p>
      </div>

      {finished && (
        <div style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          backgroundColor: "rgba(255, 255, 255, 0.8)",
          backdropFilter: "blur(5px)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 20,
        }}>
          <h1 style={{ fontSize: "3rem", color: "black", marginBottom: "20px" }}>
            Finished. You scored {score.toFixed(0)}
          </h1>
          
        {/* Progress Bar */}
        <div style={{
          display: "flex",
          alignItems: "center",
          width: "80%",
          marginTop: "20px",
        }}>
          {/* Min Score Label */}
          <span style={{
            fontSize: "1rem",
            fontWeight: "bold",
            marginRight: "10px",
            color: "#333"
          }}>
            -80
          </span>

          {/* Progress Bar */}
          <div style={{
            flexGrow: 1,
            height: "30px",
            backgroundColor: "#e0e0e0",
            borderRadius: "15px",
            overflow: "hidden",
            position: "relative",
            boxShadow: "0 2px 5px rgba(0,0,0,0.2)"
          }}>
            <div style={{
              width: `${((score + 80) / 200) * 100}%`, // Normalize score to -80 to 120 range
              height: "100%",
              backgroundColor: (() => {
                const normalizedScore = (score + 80) / 200; // Normalize score to 0-1 range
                if (normalizedScore <= 1 / 3) {
                  return "#f44336"; // Red for bottom third
                } else if (normalizedScore <= 2 / 3) {
                  return "#ffeb3b"; // Yellow for middle third
                } else {
                  return "#4caf50"; // Green for top third
                }
              })(), // Use a function to dynamically determine the color
              transition: "width 0.5s ease-in-out, background-color 0.5s ease-in-out",
            }} />
          </div>

          {/* Max Score Label */}
          <span style={{
            fontSize: "1rem",
            fontWeight: "bold",
            marginLeft: "10px",
            color: "#333"
          }}>
            120
          </span>
        </div>
          <button
            onClick={fetchNextScene}
            style={{
              padding: "15px 30px",
              fontSize: "1.5rem",
              color: "white",
              backgroundColor: "blue",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
            }}>
            Next Scene
          </button>
        </div>
      )}

      <div style={{ 
        display: "flex", 
        justifyContent: "center",
        padding: "20px",
        gap: "40px"
      }}>
        {/* Left side - Canvas and controls */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "20px"
        }}>
        <div>
          <button
            onClick={handlePlayPause}
            disabled={isPlaying} // Disable the button when animation is playing
            style={{
              backgroundColor: isPlaying ? "black" : "black", // Change color when disabled
              color: "white",
              padding: "10px",
              margin: "10px",
              borderRadius: "5px",
              cursor: isPlaying ? "not-allowed" : "pointer", // Show not-allowed cursor
              filter: isPlaying ? "blur(1px)" : "none", // Add blur when disabled
              opacity: isPlaying ? 0.5 : 1, // Make the button semi-transparent when disabled
            }}
          >
            Start
          </button>
        </div>
          
          <canvas
            ref={canvasRef}
            width={canvasSize.width}
            height={canvasSize.height}
            style={{
              border: "1px solid black",
              backgroundColor: "white",
              width: `${canvasSize.width}px`,
              height: `${canvasSize.height}px`,
            }}
          />
          
          <p>Current Frame: <strong>{currentFrame}</strong></p>
        </div>

        {/* Right side - Legend and state indicators */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          position: "relative",
          width: `${canvasSize.width * 0.3}px`,
          minWidth: "200px"
        }}>
          {/* Legend */}
          <div style={{
            display: "flex",
            gap: `${canvasSize.width * 0.02}px`,
            padding: `${canvasSize.width * 0.02}px`,
            border: "1px solid #ddd",
            borderRadius: "8px",
            backgroundColor: "#f9f9f9",
            width: "100%",
            justifyContent: "center"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: `${canvasSize.width * 0.01}px` }}>
              <p style={{ margin: 0, fontWeight: "bold" }}>F</p>
              <div style={{
                width: `${canvasSize.width * 0.04}px`,
                height: `${canvasSize.width * 0.04}px`,
                backgroundColor: "red",
                borderRadius: "50%",
              }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: `${canvasSize.width * 0.01}px` }}>
              <p style={{ margin: 0, fontWeight: "bold" }}>J</p>
              <div style={{
                width: `${canvasSize.width * 0.04}px`,
                height: `${canvasSize.width * 0.04}px`,
                backgroundColor: "green",
                borderRadius: "50%",
              }} />
            </div>
          </div>

          {/* Key state visualization */}
          <div style={{
            position: "absolute",
            top: `${canvasSize.width * 0.15}px`,
            display: "flex",
            gap: `${canvasSize.width * 0.03}px`,
            justifyContent: "center",
            width: "100%"
          }}>
            {renderKeyState("f", "red")}
            {renderKeyState("j", "green")}
          </div>
        </div>
      </div>
      </>
      )}
      </div>
    )}
      {currentPage === "finish" && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                height: "100vh",
                backgroundColor: "#f9f9f9",
              }}
            >
              <h1 style={{ fontSize: "2rem", color: "#333", marginBottom: "20px" }}>
                Thank You!
              </h1>
              <p style={{ fontSize: "1.2rem", color: "#555", marginBottom: "30px" }}>
                You have completed the experiment. Your average score is:
              </p>
              <p style={{ fontSize: "2rem", color: "#007bff", marginBottom: "30px" }}>
                {averageScore !== null ? averageScore.toFixed(2) : "Calculating..."}
              </p>      
            </div>
          )}
    </div>
  );
};

export default App;