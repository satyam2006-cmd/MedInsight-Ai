/**
 * Centralized Configuration for the MedInsight AI Frontend.
 * This file handles resolving environment variables and ensures consistency across the app.
 */

const rawApiUrl = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : '');

if (!rawApiUrl) {
    throw new Error('Missing VITE_API_URL. Set it in your frontend environment file.');
}

// Remove trailing slash to avoid double slashes in fetch calls (e.g. /api//patients)
export const API_BASE_URL = rawApiUrl.endsWith('/') ? rawApiUrl.slice(0, -1) : rawApiUrl;

// Diagnostics for deployment troubleshooting
if (import.meta.env.PROD) {
    console.log('[Config] Production Mode Detected');
    console.log(`[Config] Backend API URL: ${API_BASE_URL}`);

    if (API_BASE_URL.includes('localhost') || API_BASE_URL.includes('127.0.0.1')) {
        console.warn('⚠️ WARNING: The application is in production but pointing to a local backend URL!');
    }
} else {
    console.log(`[Config] Development Mode: Using API at ${API_BASE_URL}`);
}

export default {
    API_BASE_URL
};
