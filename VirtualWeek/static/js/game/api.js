/**
 * Virtual Week API Utilities
 * HTTP API communication helpers
 */

const API_BASE_URL = '/api';

/**
 * Make API call with error handling
 */
async function apiCall(endpoint, method = 'GET', body = null) {
    try {
        const options = { 
            method, 
            headers: { 'Content-Type': 'application/json' } 
        };
        if (body) options.body = JSON.stringify(body);
        const res = await fetch(`${API_BASE_URL}${endpoint}`, options);
        return await res.json();
    } catch (e) {
        console.error(`API Error (${endpoint}):`, e);
        return null;
    }
}

/**
 * Check session status
 */
async function checkSessionStatus() {
    return apiCall('/client/check');
}

/**
 * Get map configuration
 */
async function getMapConfig(mapId) {
    return apiCall(`/map/${mapId}`);
}

/**
 * Initialize log file
 */
async function initLogFile(participantId, sessionId = '1') {
    return apiCall('/log/init', 'POST', { participant_id: participantId, session_id: sessionId });
}

/**
 * Log event to file
 */
async function logEvent(logFile, eventType, details, metadata = {}, clientTimestamp = null, clientTimeMs = null) {
    return apiCall('/log', 'POST', {
        log_file: logFile,
        client_timestamp: clientTimestamp || new Date().toISOString(),
        client_time_ms: clientTimeMs || performance.now(),
        event_type: eventType,
        details,
        metadata
    });
}

// Export
window.ApiUtils = {
    apiCall,
    checkSessionStatus,
    getMapConfig,
    initLogFile,
    logEvent
};
