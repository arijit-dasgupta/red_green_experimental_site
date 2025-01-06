import { useEffect } from "react";

const useSessionTimeout = (navigate, currentPage) => {
    useEffect(() => {
        if (["finish", "welcome", "timeout"].includes(currentPage)) return; // Skip timeout checks on specified pages

        const sessionId = sessionStorage.getItem("sessionId");
        const timeoutPeriod = parseInt(sessionStorage.getItem("timeoutPeriod"), 10);
        const checkTimeoutInterval = parseInt(sessionStorage.getItem("checkTimeoutInterval"), 10);
        const startTimeUtc = sessionStorage.getItem("startTimeUtc"); // Get UTC start time
        const clientOffset = new Date().getTimezoneOffset() * 60 * 1000; // Timezone offset in ms

        if (!sessionId || !timeoutPeriod || !checkTimeoutInterval || !startTimeUtc) return;

        const clientStartTime = new Date(new Date(startTimeUtc).getTime() - clientOffset); // Convert UTC to client time
        sessionStorage.setItem("clientStartTime", clientStartTime.toString()); // Store client-local start time

        const checkTimeout = async () => {
            try {
                const response = await fetch("/check_timeout", {
                    method: "POST",
                    headers: { "Content-Type": "application/json",
                        'ngrok-skip-browser-warning': 'true',
                        'User-Agent': 'React-Experiment-App', // Custom User-Agent header
                     },
                    body: JSON.stringify({ session_id: sessionId }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    if (errorData.error === "timeout") {
                        // Convert current UTC time to client-local time
                        const currentTime = new Date(new Date(errorData.current_time_utc).getTime() - clientOffset);
                        sessionStorage.setItem("clientEndTime", currentTime.toString()); // Store client-local end time
                        navigate("timeout"); // Navigate to the timeout page
                    }
                }
            } catch (error) {
                console.error("Error checking timeout:", error);
            }
        };

        // Run timeout checks periodically
        const intervalId = setInterval(checkTimeout, checkTimeoutInterval * 1000);

        return () => clearInterval(intervalId); // Cleanup interval on unmount
    }, [navigate, currentPage]);
};

export default useSessionTimeout;