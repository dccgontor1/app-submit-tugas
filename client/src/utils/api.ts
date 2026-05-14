// Use environment variable if available, otherwise fallback to current hostname
// In Tauri, window.location.hostname is typically 'localhost' or 'tauri.localhost'
export const API_BASE_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:5000`;
