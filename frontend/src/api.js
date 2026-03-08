/**
 * Base path for API requests (e.g. /march2026v0 on Heroku; empty for local).
 */
export const getApiBase = () => process.env.REACT_APP_BASE_PATH || '';
