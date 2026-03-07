import React from 'react';

/**
 * Shown only when the experiment has click-point trials (has_click_trials).
 * Appears after F2 and before the click familiarization trial (F3).
 * Explains that placement happens on random trials at random moments, and sometimes the full path is shown.
 */
const ClickInstructionsPage = ({ handleProceed, trialInfo }) => {
    // Next trial is at ftrial_i (e.g. F3 → ftrial_i 3); after it, num_ftrials - ftrial_i remain
    const remainingAfterThis = Math.max(0, (trialInfo.num_ftrials || 0) - (trialInfo.ftrial_i || 0));

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
                        fontSize: '2rem',
                        color: '#333',
                        marginBottom: '20px',
                        fontWeight: 'bold',
                    }}
                >
                    Placement task (some trials)
                </h1>
                <p
                    style={{
                        fontSize: '1.15rem',
                        color: '#555',
                        marginBottom: '16px',
                        lineHeight: '1.6',
                    }}
                >
                    On <strong>some trials</strong>, the animation will pause at a <strong>random moment</strong>.
                    You will be asked to <strong>click where you think the ball is</strong> in the scene.
                    After you place it, the trial continues so you can see the rest of the path.
                </p>
                <p
                    style={{
                        fontSize: '1.15rem',
                        color: '#333',
                        marginBottom: '16px',
                        lineHeight: '1.6',
                        fontWeight: '600',
                    }}
                >
                    The ball will <strong>disappear</strong> the moment the trial pauses—whether or not it was visible at that time.
                </p>
                <p
                    style={{
                        fontSize: '1.15rem',
                        color: '#555',
                        marginBottom: '16px',
                        lineHeight: '1.6',
                    }}
                >
                    On other trials, the animation will run <strong>all the way to the end</strong> with no placement—just respond with the keys as usual.
                    Which trials include a placement step, and when they pause, is random.
                </p>
                <p
                    style={{
                        fontSize: '1.15rem',
                        color: '#555',
                        marginBottom: '24px',
                        lineHeight: '1.6',
                    }}
                >
                    The <strong>next</strong> familiarization trial will include a placement task.
                    {remainingAfterThis === 0
                        ? ' After it, you will complete the familiarization phase and move on to the main experiment.'
                        : ` After it, you will have ${remainingAfterThis} more familiarization trial${remainingAfterThis !== 1 ? 's' : ''} before the main experiment.`}
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
                    Continue to placement trial
                </button>
            </div>
        </div>
    );
};

export default ClickInstructionsPage;
