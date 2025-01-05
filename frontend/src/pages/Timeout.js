const TimeoutPage = () => {
    const timeoutPeriod = parseInt(sessionStorage.getItem("timeoutPeriod"), 10) || 0;
    const clientStartTime = new Date(sessionStorage.getItem("clientStartTime"));
    const clientEndTime = new Date(sessionStorage.getItem("clientEndTime"));

    // Format timeout period into hours, minutes, and seconds
    const hours = Math.floor(timeoutPeriod / 3600);
    const minutes = Math.floor((timeoutPeriod % 3600) / 60);
    const seconds = timeoutPeriod % 60;

    const timeString = [
        hours > 0 ? `${hours} hour${hours > 1 ? "s" : ""}` : null,
        minutes > 0 ? `${minutes} minute${minutes > 1 ? "s" : ""}` : null,
        seconds > 0 ? `${seconds} second${seconds > 1 ? "s" : ""}` : null,
    ]
        .filter(Boolean)
        .join(", ");

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                height: "100vh",
                textAlign: "center",
                backgroundColor: "#f8d7da",
                color: "#842029",
                padding: "20px",
            }}
        >
            <h1>Session Timeout</h1>
            <p>
                We are sorry! Your session has expired. As mentioned on the welcome page, there is a maximum timeout period of {timeString}.
            </p>
            <p>
                You started your experiment at:{" "}
                <strong>{clientStartTime.toLocaleString()}</strong>.
            </p>
            <p>
                The current time is: <strong>{clientEndTime.toLocaleString()}</strong>.
            </p>
            <p>Please reach out to us on Prolific if you think this is a mistake.</p>
        </div>
    );
};

export default TimeoutPage;