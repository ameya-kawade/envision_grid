import React, { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import DeckGL from '@deck.gl/react';
import { ScatterplotLayer } from '@deck.gl/layers';
import { Map } from 'react-map-gl/maplibre';
import { useStore } from '@/store/useStore';
import { getMapData } from '@/lib/api';

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

// Horizon label → horizon_hours for backend filter
const HORIZON_HOURS = { '24h': 24, '72h': 72, '7d': 168 };
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Severity → color mapping for deck.gl
const getRiskColor = (score) => {
    if (score >= 0.8) return [220, 38, 38, 230]; // red
    if (score >= 0.6) return [249, 115, 22, 210]; // orange
    if (score >= 0.4) return [234, 179, 8, 190];  // yellow
    if (score >= 0.2) return [34, 197, 94, 170];  // green
    return [100, 116, 139, 130];                   // slate
};

const getRiskRadius = (score) => Math.max(400, score * 2800);

const INITIAL_VIEW = {
    longitude: 78.9,
    latitude: 22.5,
    zoom: 4.8,
    pitch: 0,
    bearing: 0,
};

export function DeckGLMap({ simulatedPoint = null }) {
    const { setActiveZone, horizon, horizonCache, setHorizonCache } = useStore();
    const [mapPoints, setMapPoints] = useState([]);
    const [loading, setLoading] = useState(true);
    const [zoneCount, setZoneCount] = useState(0);
    const fetchingRef = useRef(false);

    const fetchMapData = useCallback(async (h, force = false) => {
        if (fetchingRef.current && !force) return;
        fetchingRef.current = true;
        setLoading(true);

        const horizonHours = HORIZON_HOURS[h] ?? null;
        const cacheEntry = horizonCache[h];

        // Use cached data if still fresh (< 5 min) and not forced
        if (!force && cacheEntry && cacheEntry.data && Date.now() - cacheEntry.fetchedAt < CACHE_TTL) {
            setMapPoints(cacheEntry.data);
            setZoneCount(cacheEntry.data.length);
            setLoading(false);
            fetchingRef.current = false;
            return;
        }

        try {
            const points = await getMapData(null, 500, horizonHours);
            const arr = Array.isArray(points) ? points : [];
            setMapPoints(arr);
            setZoneCount(arr.length);
            setHorizonCache(h, arr);
        } catch (err) {
            console.error('Map data fetch failed:', err);
            setMapPoints([]);
            setZoneCount(0);
        } finally {
            setLoading(false);
            fetchingRef.current = false;
        }
    }, [horizonCache, setHorizonCache]);

    // Re-fetch whenever horizon changes OR cache is invalidated
    useEffect(() => {
        const cacheEntry = horizonCache[horizon];
        const isStale = !cacheEntry || !cacheEntry.data || Date.now() - cacheEntry.fetchedAt >= CACHE_TTL;
        fetchMapData(horizon, isStale);
    }, [horizon, horizonCache]);  // eslint-disable-line react-hooks/exhaustive-deps

    const layers = useMemo(() => {
        const result = [];

        if (mapPoints.length > 0) {
            result.push(new ScatterplotLayer({
                id: 'risk-scatter',
                data: mapPoints,
                pickable: true,
                getPosition: d => [d.lon, d.lat],
                getRadius: d => getRiskRadius(d.risk_score),
                getFillColor: d => getRiskColor(d.risk_score),
                radiusMinPixels: 6,
                radiusMaxPixels: 50,
                opacity: 0.85,
                updateTriggers: {
                    getFillColor: mapPoints,
                    getRadius: mapPoints,
                },
                onClick: ({ object }) => {
                    if (object) {
                        setActiveZone({
                            hex: object.grid_id,
                            risk: object.risk_score,
                            risk_type: object.risk_type,
                            confidence: object.confidence,
                            lat: object.lat,
                            lon: object.lon,
                            driver: object.risk_type,
                        });
                    }
                },
            }));
        }

        // Overlay simulated point if provided (from Risk Simulation page)
        if (simulatedPoint) {
            result.push(new ScatterplotLayer({
                id: 'sim-point',
                data: [simulatedPoint],
                pickable: false,
                getPosition: d => [d.lon, d.lat],
                getRadius: () => 1200,
                getFillColor: () => [139, 92, 246, 220], // purple for simulated
                radiusMinPixels: 10,
                radiusMaxPixels: 60,
                stroked: true,
                lineWidthMinPixels: 2,
                getLineColor: () => [255, 255, 255, 180],
            }));
        }

        return result;
    }, [mapPoints, setActiveZone, simulatedPoint]);

    const getTooltip = useCallback(({ object }) => {
        if (!object || object.risk_score === undefined) return null;
        const scoreColor = object.risk_score >= 0.7 ? '#ef4444' : object.risk_score >= 0.4 ? '#f59e0b' : '#22c55e';
        return {
            html: `
                <div style="padding: 10px; font-size: 12px; color: white; background: rgba(15,23,42,0.95); border-radius: 8px; min-width: 160px; border: 1px solid rgba(255,255,255,0.1);">
                    <div style="font-weight: bold; margin-bottom: 4px;">📍 ${object.grid_id || 'Zone'}</div>
                    <div>Risk Score: <b style="color: ${scoreColor}">${(object.risk_score * 100).toFixed(0)}%</b></div>
                    <div>Type: <b>${object.risk_type || 'all'}</b></div>
                    <div>Confidence: ${((object.confidence || 0) * 100).toFixed(0)}%</div>
                    <div style="margin-top:4px; font-size:10px; color: #94a3b8;">Lat ${object.lat?.toFixed(4)}, Lon ${object.lon?.toFixed(4)}</div>
                </div>
            `
        };
    }, []);

    return (
        <div className="relative w-full h-full bg-black/90">
            {/* Legend */}
            <div className="absolute bottom-6 left-4 z-20 bg-card/90 backdrop-blur border border-border rounded-lg p-3 shadow-lg">
                <div className="text-xs font-semibold mb-2 text-foreground">Pollution Severity</div>
                <div className="space-y-1.5">
                    {[
                        { color: 'bg-red-500', label: 'Critical (≥80%)' },
                        { color: 'bg-orange-500', label: 'High (60-80%)' },
                        { color: 'bg-yellow-500', label: 'Moderate (40-60%)' },
                        { color: 'bg-green-500', label: 'Low (20-40%)' },
                        { color: 'bg-slate-400', label: 'Minimal (<20%)' },
                    ].map(({ color, label }) => (
                        <div key={label} className="flex items-center gap-2">
                            <span className={`w-3 h-3 rounded-full ${color}`}></span>
                            <span className="text-xs text-muted-foreground">{label}</span>
                        </div>
                    ))}
                </div>
                <div className="mt-2 pt-2 border-t border-border text-xs text-muted-foreground">
                    {zoneCount} zones · {horizon}
                </div>
            </div>

            {loading && (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40">
                    <div className="bg-card border border-border rounded-lg px-6 py-4 shadow-xl flex items-center gap-3">
                        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-sm font-medium">Loading {horizon} predictions...</span>
                    </div>
                </div>
            )}

            <DeckGL
                initialViewState={INITIAL_VIEW}
                controller={true}
                layers={layers}
                getTooltip={getTooltip}
                style={{ position: 'relative', width: '100%', height: '100%' }}
            >
                <Map mapStyle={MAP_STYLE} reuseMaps />
            </DeckGL>
        </div>
    );
}
