import React, { useState } from 'react';

const PostExperimentFeedbackPage = ({ navigateToFinish }) => {
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    // Require a non-empty response before proceeding
    if (!feedback || feedback.trim().length === 0) {
      setError('Please enter a response before continuing.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const sessionId = sessionStorage.getItem('sessionId');
      if (!sessionId) {
        throw new Error('Session ID not found. Please contact the experimenter.');
      }

      const response = await fetch('/save_post_experiment_feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          'User-Agent': 'React-Experiment-App',
        },
        body: JSON.stringify({
          session_id: sessionId,
          feedback_text: feedback,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.error || 'Failed to save feedback.';
        throw new Error(message);
      }

      navigateToFinish();
    } catch (err) {
      console.error('Error saving post-experiment feedback:', err);
      setError(err.message || 'Failed to save feedback. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: '#f1f5f9',
        padding: '20px',
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          padding: '30px',
          borderRadius: '10px',
          boxShadow: '0 4px 10px rgba(0, 0, 0, 0.1)',
          textAlign: 'left',
          width: '100%',
          maxWidth: '700px',
        }}
      >
        <h1 style={{ fontSize: '1.8rem', color: '#1f2937', marginBottom: '16px' }}>
          A few final thoughts
        </h1>
        <p style={{ fontSize: '1rem', color: '#4b5563', marginBottom: '16px' }}>
          We are interested in how people experienced the trials in this experiment.
          Depending on the specific set of trials you were assigned to, there{' '}
          <strong>may or may not</strong> have been some trials that were repeated during the experiment (i.e., seeing the exact same trials with the same physical outcomes).
        </p>
        <p style={{ fontSize: '1rem', color: '#4b5563', marginBottom: '16px' }}>
          Please briefly describe, in your own words:
        </p>
        <ul style={{ fontSize: '0.95rem', color: '#4b5563', marginBottom: '16px', paddingLeft: '20px' }}>
          <li>whether you ever felt that you were seeing the exact same trial again, and</li>
          <li>if you did feel that you were seeing repeated trials, whether you felt you were using what you learned on earlier trials to change how you predicted the outcome of the repeated trial.</li>
        </ul>
        <p style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '16px' }}>
          There are no right or wrong answers here – we are just interested in your
          experience. You can write as much or as little as you like.
        </p>

        <form onSubmit={handleSubmit}>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={6}
            style={{
              width: '100%',
              padding: '10px',
              fontSize: '1rem',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              resize: 'vertical',
              marginBottom: '12px',
            }}
            placeholder="Type your response here..."
          />
          {error && (
            <p style={{ color: '#b91c1c', fontSize: '0.9rem', marginBottom: '8px' }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: '10px 20px',
              fontSize: '1rem',
              color: 'white',
              backgroundColor: submitting ? '#9ca3af' : '#007bff',
              borderRadius: '5px',
              border: 'none',
              cursor: submitting ? 'default' : 'pointer',
            }}
          >
            {submitting ? 'Saving...' : 'Continue to final page'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default PostExperimentFeedbackPage;

