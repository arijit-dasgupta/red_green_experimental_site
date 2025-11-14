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
const WelcomePage = ({ setTrialInfo }) => {

    const { navigate } = useNavigation(); // Use the navigation context

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


  return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        background: "linear-gradient(135deg, #e6f2ff 0%, #f0f8ff 50%, #ffffff 100%)",
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
            <li>Once you begin, <strong>you cannot navigate backward or refresh</strong> the page.</li>
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
                onClick={() => navigate('thankyou')}
                style={{
                    padding: "15px 30px",
                    fontSize: "1.2rem",
                    color: "white",
                    backgroundColor: "#dc3545",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    boxShadow: "0 2px 5px rgba(0, 0, 0, 0.2)",
                    transition: "background-color 0.3s ease, transform 0.2s ease",
                }}
                onMouseOver={(e) => (e.target.style.backgroundColor = "#c82333")}
                onMouseOut={(e) => (e.target.style.backgroundColor = "#dc3545")}
                onMouseDown={(e) => (e.target.style.transform = "scale(0.95)")}
                onMouseUp={(e) => (e.target.style.transform = "scale(1)")}
                >
                I do not Consent to participate
            </button>
        </div>

      </div>
  );
};

export default WelcomePage;