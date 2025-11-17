import React from 'react';
import { useNavigation } from '../contexts/NavigationContext';

const FinalWordsToParents = ({ setTrialInfo }) => {
    const { navigate } = useNavigation();

    const startStudy = async () => {
        try {
            const prolific_pid = sessionStorage.getItem("prolific_pid");
            const study_id = sessionStorage.getItem("study_id");
            const prolific_session_id = sessionStorage.getItem("prolific_session_id");

            const response = await fetch(
                `/start_experiment/redgreen?PROLIFIC_PID=${prolific_pid}&STUDY_ID=${study_id}&SESSION_ID=${prolific_session_id}`,
                { method: "POST", 
                    headers: { 
                        'ngrok-skip-browser-warning': 'true',
                        'User-Agent': 'React-Experiment-App',
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
            sessionStorage.setItem("sessionId", data.session_id);
            sessionStorage.setItem("startTimeUtc", data.start_time_utc);
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

            navigate("experiment");
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
            minHeight: "100vh",
            background: "linear-gradient(135deg, #e6f2ff 0%, #f0f8ff 50%, #ffffff 100%)",
            padding: "20px",
            textAlign: "center",
        }}>
            <h1 style={{
                fontSize: "2.5rem",
                color: "#333",
                marginBottom: "20px",
                fontWeight: "bold",
            }}>
                Final Words to Parents
            </h1>

            <div style={{
                fontSize: "1.2rem",
                color: "#555",
                maxWidth: "700px",
                lineHeight: "1.8",
                textAlign: "left",
                backgroundColor: "#ffffff",
                padding: "30px",
                borderRadius: "10px",
                boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                marginBottom: "30px",
            }}>
                <p style={{ marginBottom: "20px", fontWeight: "bold" }}>
                    We will start the study very soon. Before that, just a reminder:
                </p>

                <ul style={{ paddingLeft: "20px", marginBottom: "20px" }}>
                    <li style={{ marginBottom: "15px" }}>
                        Please make sure you are in a quiet room.
                    </li>
                    <li style={{ marginBottom: "15px" }}>
                        Please make sure you're in a well-lit room, and remove any strong backlighting.
                    </li>
                    <li style={{ marginBottom: "15px" }}>
                        Please make sure you have removed distracting objects, such as toys, food, phones, etc.
                    </li>
                    <li style={{ marginBottom: "15px" }}>
                        Please help your child to find the computer keys if they have trouble. But while the video is playing, please do not instruct your child which key they should press.
                    </li>
                    <li style={{ marginBottom: "15px" }}>
                        You may pause the study by clicking the "pause study" button on the bottom-right corner.
                    </li>
                </ul>
            </div>

            <button
                onClick={startStudy}
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
                Start Study
            </button>
        </div>
    );
};

export default FinalWordsToParents;

