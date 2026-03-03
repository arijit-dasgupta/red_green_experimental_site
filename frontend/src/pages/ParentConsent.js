import React, { useEffect } from 'react';
import { useNavigation } from '../contexts/NavigationContext';
import DeclineMessage from '../components/DeclineMessage';

const parseUrlParams = () => {
  const queryParams = new URLSearchParams(window.location.search);
  return {
      prolific_pid: queryParams.get("PROLIFIC_PID") || "default_pid",
      study_id: queryParams.get("STUDY_ID") || "debug_study",
      prolific_session_id: queryParams.get("SESSION_ID") || "debug_session",
  };
};

const ParentConsent = ({ setTrialInfo }) => {
    const { navigate } = useNavigation();
    const [declined, setDeclined] = React.useState(false);

    useEffect(() => {
      const params = parseUrlParams();
      sessionStorage.setItem("prolific_pid", params.prolific_pid);
      sessionStorage.setItem("study_id", params.study_id);
      sessionStorage.setItem("prolific_session_id", params.prolific_session_id);
    }, []);

    const handleConsent = () => {
        navigate("parent-instructions");
    };

    const handleDecline = () => {
        setDeclined(true);
    };

    if (declined) {
        return <DeclineMessage />;
    }

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
                Parent Consent Form
            </h1>

            <div style={{
                fontSize: "1.1rem",
                color: "#555",
                maxWidth: "800px",
                lineHeight: "1.8",
                textAlign: "left",
                backgroundColor: "#ffffff",
                padding: "30px",
                borderRadius: "10px",
                boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                marginBottom: "30px",
            }}>
                <p style={{ marginBottom: "20px" }}>
                    Dear parents, thank you very much for your interest in our study. In today's study, your child will be hearing stories and playing some guessing games. This study aims to explore how children make predictions about physical objects' movements when they have complete or partial visual information of the scene.
                </p>

                <p style={{ marginBottom: "20px" }}>
                    <strong>Procedure:</strong> Your child will first be introduced to Elmo and his red bouncy ball. Next, your child will be introduced to the guessing game step-by-step. After going through a few training trials and familiarized about how to play the game, your child will be doing 30 to 40 individual trials. The whole study should take about 15-25 minutes.
                </p>

                <p style={{ marginBottom: "20px" }}>
                    <strong>Payment:</strong> After you finish the study, we will email you a $5 Amazon gift card within approximately three business days. To be eligible for the gift card, we need to see that there is a child with you, your child must be in the age range for this study, you need to submit a valid consent statement. We will send a gift card even if your child did not finish the whole study or we are not able to use your child's data for other reasons. There are no other direct benefits to you or your child from participating, but we hope you will enjoy the experience. Multiple participations won't result in repeated payments.
                </p>

                <p style={{ marginBottom: "20px" }}>
                    <strong>Your rights as a participant:</strong> You are not waiving any legal claims, rights or remedies because of your participation in this research study. This research is being overseen by an Institutional Review Board (IRB). An IRB is a group of people who perform independent review of research studies. You may also contact the Johns Hopkins University Homewood Institution Review Board at HIRB@jhu.edu for any questions you may have about your rights as a research participant.
                </p>

                <p style={{ marginBottom: "20px" }}>
                    <strong>Participation voluntarity:</strong> You and your child are free to choose whether to be in this study. If you do choose to participate, it's okay to stop at any point during the session. You can pause or stop the session if your child does not want to participate anymore.
                </p>
            </div>

            <div style={{ display: "flex", gap: "20px", marginTop: "20px" }}>
                <button
                    onClick={handleConsent}
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
                    I Consent
                </button>

                <button
                    onClick={handleDecline}
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
                    I do not Consent
                </button>
            </div>
        </div>
    );
};

export default ParentConsent;

