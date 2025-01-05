import React from 'react';

const ScoringInstrucPage = ({ handleProceed }) => {
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                padding: '20px',
                backgroundColor: '#ffffff',
                boxSizing: 'border-box',
                textAlign: 'center',
            }}
        >
            <div
                style={{
                    backgroundColor: '#f9f9f9',
                    borderRadius: '10px',
                    padding: '30px',
                    maxWidth: '800px',
                    boxShadow: '0 4px 10px rgba(0, 0, 0, 0.1)',
                }}
            >
                <h1
                    style={{
                        fontSize: '2.5rem',
                        color: '#333',
                        marginBottom: '20px',
                        fontWeight: 'bold',
                    }}
                >
                    Final Instructions
                </h1>
                <p
                    style={{
                        fontSize: '1.2rem',
                        color: '#555',
                        marginBottom: '20px',
                        lineHeight: '1.6',
                    }}
                >
                    Great job on finishing your first familiarization trial! You would have noticed that you were given a score at the end of the trial. 
                    Your score is a measure of how well you have performed on each trial, and <strong> it is based on how accurately and quickly you responded to the stimuli. The faster you hold down on the correct key, the better your score.</strong> 
                </p>
                <p
                    style={{
                        fontSize: '1.2rem',
                        color: '#555',
                        marginBottom: '20px',
                        lineHeight: '1.6',
                    }}
                >
                    It is calculated as follows:
                </p>
                <div
                    style={{
                        backgroundColor: '#f1f1f1',
                        padding: '20px',
                        borderRadius: '10px',
                        marginBottom: '20px',
                        textAlign: 'center',
                        boxShadow: '0 2px 5px rgba(0, 0, 0, 0.1)',
                    }}
                >
                    <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                        Score = 20 + 100 × (
                        <span style={{ color: 'green', fontWeight: 'bold' }}>Correct Percentage</span> - 
                        <span style={{ color: 'red', fontWeight: 'bold' }}> Wrong Percentage</span>
                        )
                    </p>
                </div>
                <p
                    style={{
                        fontSize: '1.2rem',
                        color: '#555',
                        marginBottom: '20px',
                        lineHeight: '1.6',
                    }}
                >
                    A correct guess increases your score significantly, while a wrong guess reduces it. If you are uncertain, pressing a random button may lower your score as an incorrect guess incurs a penalty. However, making a correct guess will improve your score more than remaining uncertain.
                </p>
                <p
                    style={{
                        fontSize: '1.2rem',
                        color: '#555',
                        marginBottom: '20px',
                        lineHeight: '1.6',
                    }}
                >
                    Your scores for the familiarization trial do not contribute to your final score of the experiment, but the main experiment scores will count.
                </p>
                <button
                    onClick={handleProceed}
                    style={{
                        padding: '15px 30px',
                        fontSize: '1.2rem',
                        color: 'white',
                        backgroundColor: '#007bff',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        boxShadow: '0 2px 5px rgba(0, 0, 0, 0.2)',
                        transition: 'background-color 0.3s ease, transform 0.2s ease',
                    }}
                    onMouseOver={(e) => (e.target.style.backgroundColor = '#0056b3')}
                    onMouseOut={(e) => (e.target.style.backgroundColor = '#007bff')}
                    onMouseDown={(e) => (e.target.style.transform = 'scale(0.95)')}
                    onMouseUp={(e) => (e.target.style.transform = 'scale(1)')}
                >
                    Continue with the Next Familiarization Trial
                </button>
            </div>
        </div>
    );
};

export default ScoringInstrucPage;
