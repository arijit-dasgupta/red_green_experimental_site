import dash
from dash import dcc, html, dash_table
from dash.dependencies import Input, Output
import requests
import pandas as pd
import plotly.graph_objs as go
import dash_bootstrap_components as dbc

# Fetch data from the Flask API
def fetch_sessions():
    try:
        response = requests.get("http://127.0.0.1:5000/sessions")
        if response.status_code == 200:
            return response.json()
        else:
            return []
    except Exception as e:
        print(f"Error fetching sessions: {e}")
        return []

# Initialize Dash App
app = dash.Dash(__name__, external_stylesheets=[dbc.themes.BOOTSTRAP])
server = app.server

# Initial Data
sessions_data = fetch_sessions()

# Prepare Sessions DataFrame
def prepare_sessions_dataframe(sessions):
    df = pd.DataFrame(sessions)
    return df[[
        "id", "start_time", "study_id", "prolific_pid", 
        "prolific_session_id", "average_score", "completed", 
        "num_ftrials_completed", "num_trials_completed"
    ]]

# Define Layout
app.layout = html.Div(
    [
        html.H1("REDGREEN Experiment Dashboard", style={"textAlign": "center"}),
        dcc.Interval(
            id="interval-component",
            interval=30 * 1000,  # Refresh every 30 seconds (in milliseconds)
            n_intervals=0,
        ),
        html.Div(
            [
                html.H3("Session Overview"),
                dash_table.DataTable(
                    id="session-table",
                    columns=[
                        {"name": "Session ID", "id": "id"},
                        {"name": "Start Time", "id": "start_time"},
                        {"name": "Study ID", "id": "study_id"},
                        {"name": "Prolific PID", "id": "prolific_pid"},
                        {"name": "Prolific Session ID", "id": "prolific_session_id"},
                        {"name": "Average Score", "id": "average_score"},
                        {"name": "Completed", "id": "completed"},
                        {"name": "Familiarization Trials Completed", "id": "num_ftrials_completed"},
                        {"name": "Regular Trials Completed", "id": "num_trials_completed"},
                    ],
                    style_table={"overflowX": "auto"},
                    style_cell={"textAlign": "center"},
                    page_size=10,
                ),
            ],
            style={"marginBottom": "50px"},
        ),
        html.Div(
            [
                html.H3("Participant Trial Scores"),
                dcc.Dropdown(
                    id="participant-dropdown",
                    options=[
                        {"label": session["prolific_pid"], "value": session["prolific_pid"]}
                        for session in sessions_data
                    ],
                    placeholder="Select a participant",
                ),
                dcc.Graph(id="trial-scores"),
            ],
            style={"marginBottom": "50px"},
        ),
        html.Div(
            [
                html.H3("Button Press Distribution (Red, Green, Uncertain)"),
                dcc.Dropdown(
                    id="trial-distribution-dropdown",
                    options=[
                        {"label": session["prolific_pid"], "value": session["prolific_pid"]}
                        for session in sessions_data
                    ] + [{"label": "Aggregate", "value": "aggregate"}],
                    placeholder="Select a participant or view aggregate",
                ),
                dcc.Graph(id="button-distribution"),
            ],
        ),
    ],
    style={"padding": "20px"},
)

# Define Callbacks for Live Updates
@app.callback(
    [
        Output("session-table", "data"),
        Output("trial-scores", "figure"),
        Output("button-distribution", "figure"),
    ],
    [Input("interval-component", "n_intervals"), Input("participant-dropdown", "value"), Input("trial-distribution-dropdown", "value")],
)
def update_dashboard(n_intervals, selected_participant, selected_distribution):
    # Fetch updated data
    sessions = fetch_sessions()

    # Prepare DataFrame for Session Table
    sessions_df = prepare_sessions_dataframe(sessions)
    session_table_data = sessions_df.to_dict("records")

    # Participant Trial Scores Plot
    trial_scores_figure = {
        "data": [],
        "layout": {"title": "Select a participant to view trial scores"},
    }
    if selected_participant:
        participant_data = next((s for s in sessions if s["prolific_pid"] == selected_participant), None)
        if participant_data and "trial_scores" in participant_data:
            trial_scores = participant_data["trial_scores"]
            trial_scores_df = pd.DataFrame(trial_scores)
            trial_scores_figure = {
                "data": [
                    go.Scatter(
                        x=trial_scores_df["trial_index"],
                        y=trial_scores_df["score"],
                        mode="lines+markers",
                        name="Trial Scores",
                    )
                ],
                "layout": {"title": f"Trial Scores for Participant {selected_participant}"},
            }

    # Button Distribution Plot
    button_distribution_figure = {
        "data": [],
        "layout": {"title": "Select a participant or aggregate to view button distribution"},
    }
    if selected_distribution:
        if selected_distribution == "aggregate":
            all_time_series = [session["time_series_data"] for session in sessions]
            aggregate_time_series = {
                "red": pd.DataFrame([ts["red"] for ts in all_time_series]).mean(axis=0),
                "green": pd.DataFrame([ts["green"] for ts in all_time_series]).mean(axis=0),
                "uncertain": pd.DataFrame([ts["uncertain"] for ts in all_time_series]).mean(axis=0),
            }
            frames = range(len(aggregate_time_series["red"]))
            button_distribution_figure = {
                "data": [
                    go.Scatter(x=frames, y=aggregate_time_series["red"], mode="lines", name="Red"),
                    go.Scatter(x=frames, y=aggregate_time_series["green"], mode="lines", name="Green"),
                    go.Scatter(x=frames, y=aggregate_time_series["uncertain"], mode="lines", name="Uncertain"),
                ],
                "layout": {"title": "Aggregate Button Press Distribution"},
            }
        else:
            participant_data = next((s for s in sessions if s["prolific_pid"] == selected_distribution), None)
            if participant_data and "time_series_data" in participant_data:
                time_series_data = participant_data["time_series_data"]
                frames = range(len(time_series_data["red"]))
                button_distribution_figure = {
                    "data": [
                        go.Scatter(x=frames, y=time_series_data["red"], mode="lines", name="Red"),
                        go.Scatter(x=frames, y=time_series_data["green"], mode="lines", name="Green"),
                        go.Scatter(x=frames, y=time_series_data["uncertain"], mode="lines", name="Uncertain"),
                    ],
                    "layout": {"title": f"Button Press Distribution for {selected_distribution}"},
                }

    return session_table_data, trial_scores_figure, button_distribution_figure


if __name__ == "__main__":
    app.run_server(debug=True)
