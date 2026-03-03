import React, { useEffect, useRef } from 'react';
import { useNavigation } from '../contexts/NavigationContext';
import DeclineMessage from '../components/DeclineMessage';

const ChildAssent = () => {
    const { navigate } = useNavigation();
    const [declined, setDeclined] = React.useState(false);
    const audioRef = useRef(null);

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.play().catch(() => {});
        }
    }, []);

    const handleAssent = () => {
        navigate("final-words-parents");
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
            <audio
                ref={audioRef}
                src="/audios/v3_child_assent.mp3"
                preload="auto"
            />

            <h1 style={{
                fontSize: "2.5rem",
                color: "#2C6EB5",
                marginBottom: "30px",
                fontWeight: "bold",
            }}>
                Child Assent
            </h1>

            <div style={{
                fontSize: "1.3rem",
                color: "#555",
                maxWidth: "800px",
                lineHeight: "1.8",
                textAlign: "left",
                backgroundColor: "#ffffff",
                padding: "40px",
                borderRadius: "10px",
                boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                marginBottom: "30px",
            }}>
                <p style={{ marginBottom: "15px" }}>
                    Hi there! Welcome to our game!
                </p>
                <p style={{ marginBottom: "15px" }}>
                    Today we're going to play a fun game with Elmo and his red bouncy ball.
                </p>
                <p style={{ marginBottom: "15px" }}>
                    If you ever want to take a break or stop playing, that's totally okay—just let your grown-up know and they can help you.
                </p>
                <p style={{ 
                    marginBottom: "15px",
                    fontSize: "1.4rem",
                    fontWeight: "bold",
                    color: "#2C6EB5",
                    textAlign: "center"
                }}>
                    Are you ready to play?
                </p>
            </div>

            <div style={{ display: "flex", gap: "20px", marginTop: "20px" }}>
                <button
                    onClick={handleAssent}
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
                    Yes, continue to play game
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
                    No, do not want to play
                </button>
            </div>
        </div>
    );
};

export default ChildAssent;
