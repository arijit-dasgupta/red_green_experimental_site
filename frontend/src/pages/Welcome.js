import React, { useEffect, useState } from 'react';
import { useNavigation } from '../contexts/NavigationContext';


const parseUrlParams = () => {
  const queryParams = new URLSearchParams(window.location.search);
  return {
      prolific_pid: queryParams.get("PROLIFIC_PID") || "default_pid",
      study_id: queryParams.get("STUDY_ID") || "debug_study",
      prolific_session_id: queryParams.get("SESSION_ID") || "debug_session",
  };
};

// Components for different pages
const WelcomePage = ({ setTrialInfo, setShowKeyStateLine, showKeyStateLine, setEnableAudio, enableAudio, setEnablePhotodiode, enablePhotodiode }) => {

    const { navigate } = useNavigation(); // Use the navigation context
    const [sessionId, setSessionId] = useState('');
    const [startFromTrial, setStartFromTrial] = useState('');
    const [isResumeMode, setIsResumeMode] = useState(false);

    useEffect(() => {
      const params = parseUrlParams();
      sessionStorage.setItem("prolific_pid", params.prolific_pid);
      sessionStorage.setItem("study_id", params.study_id);
      sessionStorage.setItem("prolific_session_id", params.prolific_session_id);
  }, []);

    const startExperiment = async () => {
        try {
            const prolific_pid = sessionStorage.getItem("prolific_pid");
            const study_id = sessionStorage.getItem("study_id");
            const prolific_session_id = sessionStorage.getItem("prolific_session_id");

            const response = await fetch(
                `/start_experiment/redgreen?PROLIFIC_PID=${prolific_pid}&STUDY_ID=${study_id}&SESSION_ID=${prolific_session_id}`,
                { method: "POST", 
                    headers: { 
                        // "Content-Type": "application/json",
                        'ngrok-skip-browser-warning': 'true',
                        'User-Agent': 'React-Experiment-App', // Custom User-Agent header
                     } 
                }
            );
            if (!response.ok) {
                const errorData = await response.json();
                if (errorData.error === "duplicate_pid") {
                    alert(errorData.message);
                    return;
                }
                if (errorData.error === "max_participants_reached") {
                    alert(errorData.message);
                    return;
                }
                throw new Error("Failed to start experiment");
            }

            const data = await response.json();
            sessionStorage.setItem("sessionId", data.session_id); // Store session ID for subsequent API calls
            sessionStorage.setItem("startTimeUtc", data.start_time_utc); // Store start time in UTC
            sessionStorage.setItem("timeoutPeriod", data.timeout_period_seconds);
            sessionStorage.setItem("checkTimeoutInterval", data.check_timeout_interval_seconds);            

            setTrialInfo({
                num_trials: data.num_trials,
                num_ftrials: data.num_ftrials,
                unique_trial_id: 0,
                ftrial_i: 0,
                trial_i: 0,
                is_ftrial: false,
                is_trial: false,
            });

            navigate("instructions");
        } catch (error) {
            console.error("Error starting experiment:", error);
            alert("Failed to start the experiment. Please try again.");
        }
    };

    const resumeExperiment = async () => {
        try {
            if (!sessionId.trim()) {
                alert("Please enter a Session ID");
                return;
            }

            const trialNumber = parseInt(startFromTrial);
            if (isNaN(trialNumber) || trialNumber < 1) {
                alert("Please enter a valid trial number (must be 1 or greater)");
                return;
            }

            // Store the session ID and trial number for the backend
            sessionStorage.setItem("sessionId", sessionId.trim());
            sessionStorage.setItem("resumeFromTrial", trialNumber.toString());

            // Set trial info for resume mode
            setTrialInfo({
                num_trials: -1, // Will be updated by backend
                num_ftrials: -1, // Will be updated by backend
                unique_trial_id: 0,
                ftrial_i: 0,
                trial_i: trialNumber, // Set to the trial number we want to resume from
                is_ftrial: false,
                is_trial: false,
            });

            navigate("instructions");
        } catch (error) {
            console.error("Error resuming experiment:", error);
            alert("Failed to resume the experiment. Please try again.");
        }
    };

  return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        backgroundColor: "#f9f9f9",
        padding: "20px",
        textAlign: "center",
      }}>
        <h1 style={{
          fontSize: "2.5rem",
          color: "#333",
          marginBottom: "0px",
          fontWeight: "bold",
        }}>
          Welcome to the Experiment!
        </h1>

        <div style={{
          fontSize: "1.2rem",
          color: "#555",
          maxWidth: "700px",
          lineHeight: "1.2",
          textAlign: "left",
          backgroundColor: "#ffffff",
          padding: "20px",
          borderRadius: "10px",
          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)"
        }}>
          <p><strong>Before you begin:</strong></p>
          <ul style={{ paddingLeft: "20px", marginBottom: "20px" }}>
            <li>You will be asked to <strong>press keys</strong> on the keyboard and <strong>click buttons</strong> on the screen.</li>
          </ul>

          <p><strong>Important:</strong></p>
          <ul style={{ paddingLeft: "20px", marginBottom: "20px" }}>
            <li>Once you begin, <strong>you cannot navigate backward or refresh</strong> the page. You can pause and resume the experiment at any time.</li>
            <li>If you are color-blind, we kindly request you not to participate.</li>
          </ul>

          <p style={{
            marginTop: "20px",
            color: "#FF0000",
            fontWeight: "bold",
            textAlign: "center"
          }}>
            If you don't feel comfortable, you can back out by
            closing the window at any time. But if you're okay with all this,
            click the button below to consent.
          </p>
        </div>

        <div style={{ display: "flex", gap: "20px", marginTop: "20px" }}>
            <button
                onClick={startExperiment}
                style={{
                    padding: "15px 30px",
                    fontSize: "1.2rem",
                    color: "white",
                    backgroundColor: "#28a745",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    boxShadow: "0 2px 5px rgba(0, 0, 0, 0.2)",
                    transition: "background-color 0.3s ease, transform 0.2s ease",
                }}
                onMouseOver={(e) => (e.target.style.backgroundColor = "#218838")}
                onMouseOut={(e) => (e.target.style.backgroundColor = "#28a745")}
                onMouseDown={(e) => (e.target.style.transform = "scale(0.95)")}
                onMouseUp={(e) => (e.target.style.transform = "scale(1)")}
                >
                I Consent to Participate
            </button>

            <button
                onClick={() => setIsResumeMode(!isResumeMode)}
                style={{
                    padding: "15px 30px",
                    fontSize: "1.2rem",
                    color: "white",
                    backgroundColor: "#007bff",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    boxShadow: "0 2px 5px rgba(0, 0, 0, 0.2)",
                    transition: "background-color 0.3s ease, transform 0.2s ease",
                }}
                onMouseOver={(e) => (e.target.style.backgroundColor = "#0056b3")}
                onMouseOut={(e) => (e.target.style.backgroundColor = "#007bff")}
                onMouseDown={(e) => (e.target.style.transform = "scale(0.95)")}
                onMouseUp={(e) => (e.target.style.transform = "scale(1)")}
                >
                {isResumeMode ? "Start New Experiment" : "Resume Experiment"}
            </button>
        </div>

        {/* Toggle Buttons */}
        <div style={{ marginTop: "20px", display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center" }}>
            <button
                onClick={() => setShowKeyStateLine(!showKeyStateLine)}
                style={{
                    padding: "10px 20px",
                    fontSize: "1rem",
                    color: "white",
                    backgroundColor: showKeyStateLine ? "#6c757d" : "#28a745",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    boxShadow: "0 2px 5px rgba(0, 0, 0, 0.2)",
                    transition: "background-color 0.3s ease, transform 0.2s ease",
                }}
                onMouseOver={(e) => (e.target.style.backgroundColor = showKeyStateLine ? "#5a6268" : "#218838")}
                onMouseOut={(e) => (e.target.style.backgroundColor = showKeyStateLine ? "#6c757d" : "#28a745")}
                onMouseDown={(e) => (e.target.style.transform = "scale(0.95)")}
                onMouseUp={(e) => (e.target.style.transform = "scale(1)")}
                >
                {showKeyStateLine ? "Hide Proportion Bar" : "Show Proportion Bar"}
            </button>
            
            <button
                onClick={() => setEnableAudio(!enableAudio)}
                style={{
                    padding: "10px 20px",
                    fontSize: "1rem",
                    color: "white",
                    backgroundColor: enableAudio ? "#6c757d" : "#28a745",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    boxShadow: "0 2px 5px rgba(0, 0, 0, 0.2)",
                    transition: "background-color 0.3s ease, transform 0.2s ease",
                }}
                onMouseOver={(e) => (e.target.style.backgroundColor = enableAudio ? "#5a6268" : "#218838")}
                onMouseOut={(e) => (e.target.style.backgroundColor = enableAudio ? "#6c757d" : "#28a745")}
                onMouseDown={(e) => (e.target.style.transform = "scale(0.95)")}
                onMouseUp={(e) => (e.target.style.transform = "scale(1)")}
                >
                {enableAudio ? "Disable Audio" : "Enable Audio"}
            </button>
            
            <button
                onClick={() => setEnablePhotodiode(!enablePhotodiode)}
                style={{
                    padding: "10px 20px",
                    fontSize: "1rem",
                    color: "white",
                    backgroundColor: enablePhotodiode ? "#6c757d" : "#28a745",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    boxShadow: "0 2px 5px rgba(0, 0, 0, 0.2)",
                    transition: "background-color 0.3s ease, transform 0.2s ease",
                }}
                onMouseOver={(e) => (e.target.style.backgroundColor = enablePhotodiode ? "#5a6268" : "#218838")}
                onMouseOut={(e) => (e.target.style.backgroundColor = enablePhotodiode ? "#6c757d" : "#28a745")}
                onMouseDown={(e) => (e.target.style.transform = "scale(0.95)")}
                onMouseUp={(e) => (e.target.style.transform = "scale(1)")}
                >
                {enablePhotodiode ? "Disable Trial Onset Color Marker" : "Enable Trial Onset Color Marker"}
            </button>
        </div>

        {/* Resume Form */}
        {isResumeMode && (
            <div style={{
                marginTop: "30px",
                padding: "20px",
                backgroundColor: "#ffffff",
                borderRadius: "10px",
                boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                maxWidth: "500px",
                width: "100%"
            }}>
                <h3 style={{ marginTop: 0, color: "#333", textAlign: "center" }}>
                    Resume Experiment
                </h3>
                <p style={{ color: "#666", textAlign: "center", marginBottom: "20px" }}>
                    Enter your Session ID and the trial number where you want to resume.
                    You will still complete the familiarization trials, then jump to the specified trial.
                </p>
                
                <div style={{ marginBottom: "15px" }}>
                    <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold", color: "#333" }}>
                        Session ID:
                    </label>
                    <input
                        type="text"
                        value={sessionId}
                        onChange={(e) => setSessionId(e.target.value)}
                        placeholder="Enter your Session ID"
                        style={{
                            width: "100%",
                            padding: "10px",
                            fontSize: "16px",
                            border: "1px solid #ddd",
                            borderRadius: "5px",
                            boxSizing: "border-box"
                        }}
                    />
                </div>

                <div style={{ marginBottom: "20px" }}>
                    <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold", color: "#333" }}>
                        Start from Trial Number:
                    </label>
                    <input
                        type="number"
                        value={startFromTrial}
                        onChange={(e) => setStartFromTrial(e.target.value)}
                        placeholder="Enter trial number (e.g., 5)"
                        min="1"
                        style={{
                            width: "100%",
                            padding: "10px",
                            fontSize: "16px",
                            border: "1px solid #ddd",
                            borderRadius: "5px",
                            boxSizing: "border-box"
                        }}
                    />
                </div>

                <button
                    onClick={resumeExperiment}
                    style={{
                        width: "100%",
                        padding: "12px",
                        fontSize: "1.1rem",
                        color: "white",
                        backgroundColor: "#17a2b8",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                        boxShadow: "0 2px 5px rgba(0, 0, 0, 0.2)",
                        transition: "background-color 0.3s ease",
                    }}
                    onMouseOver={(e) => (e.target.style.backgroundColor = "#138496")}
                    onMouseOut={(e) => (e.target.style.backgroundColor = "#17a2b8")}
                >
                    Resume Experiment
                </button>
            </div>
        )}

      </div>
  );
};

export default WelcomePage;