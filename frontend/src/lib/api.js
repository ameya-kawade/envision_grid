/**
 * ENVISIONGRID — API Client
 * Centralized functions for all backend endpoints.
 */

const handleResponse = async (res) => {
    if (!res.ok) {
        const text = await res.text().catch(() => 'Unknown error');
        throw new Error(`API ${res.status}: ${text}`);
    }
    return res.json();
};

// ── Health ───────────────────────────────────────────────────────────
export const getHealth = () =>
    fetch('/health').then(handleResponse);

// ── Ingestion ────────────────────────────────────────────────────────
export const ingestViolationsCSV = (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return fetch('/ingest/violations', { method: 'POST', body: fd }).then(handleResponse);
};

export const ingestComplaintsCSV = (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return fetch('/ingest/complaints', { method: 'POST', body: fd }).then(handleResponse);
};

export const ingestSensorsCSV = (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return fetch('/ingest/sensors', { method: 'POST', body: fd }).then(handleResponse);
};

export const ingestViolationEvent = (event) =>
    fetch('/ingest/violation-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
    }).then(handleResponse);

export const ingestSensorEvent = (reading) =>
    fetch('/ingest/sensor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reading),
    }).then(handleResponse);

// ── Grid ─────────────────────────────────────────────────────────────
export const getGridPreview = (lat, lon) =>
    fetch(`/grid/preview?lat=${lat}&lon=${lon}`).then(handleResponse);

// ── Predictions ──────────────────────────────────────────────────────
export const runPrediction = (params = {}) =>
    fetch('/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            risk_type: params.risk_type || 'all',
            horizon_hours: params.horizon_hours || 72,
            threshold: params.threshold || 0.6,
            use_sensors: params.use_sensors !== false,
        }),
    }).then(handleResponse);

export const getPredictions = ({ risk_type, horizon, limit } = {}) => {
    const p = new URLSearchParams();
    if (risk_type) p.set('risk_type', risk_type);
    if (horizon) p.set('horizon', horizon);
    if (limit) p.set('limit', limit);
    return fetch(`/predictions?${p}`).then(handleResponse);
};

// ── Alerts ───────────────────────────────────────────────────────────
export const getAlerts = () =>
    fetch('/alerts').then(handleResponse);

export const createAlertFromPrediction = (data) =>
    fetch('/alerts/from-prediction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    }).then(handleResponse);

// ── Cases ────────────────────────────────────────────────────────────
export const getCases = () =>
    fetch('/cases').then(handleResponse);

export const createCase = (data) =>
    fetch('/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    }).then(handleResponse);

export const updateCase = (caseId, data) =>
    fetch(`/cases/${caseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    }).then(handleResponse);

// ── Analytics ────────────────────────────────────────────────────────
export const getHotspots = (limit = 15, useSensors = true) =>
    fetch(`/hotspots?limit=${limit}&use_sensors=${useSensors}`).then(handleResponse);

export const getCoverage = () =>
    fetch('/coverage').then(handleResponse);

// ── Map Data (deck.gl) ──────────────────────────────────────────────
export const getMapData = (risk_type, limit = 500) => {
    const p = new URLSearchParams();
    if (risk_type && risk_type !== 'all') p.set('risk_type', risk_type);
    if (limit) p.set('limit', limit);
    return fetch(`/map-data?${p}`).then(handleResponse);
};

// ── Analytics ────────────────────────────────────────────────────────
export const getAnalyticsSummary = () =>
    fetch('/analytics/summary').then(handleResponse);

// ── Playbook ─────────────────────────────────────────────────────────
export const generatePlaybook = (data) =>
    fetch('/report/playbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    }).then(handleResponse);


// ── Simulation ──────────────────────────────────────────────────────
export const runSimulation = (params) =>
    fetch('/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    }).then(handleResponse);
