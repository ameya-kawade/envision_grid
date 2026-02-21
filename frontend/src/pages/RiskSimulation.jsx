import React, { useState, useCallback, useRef } from 'react';
import {
    MapPin, Sliders, Play, RefreshCw, TrendingDown, TrendingUp,
    Activity, AlertCircle, CheckCircle2, Info, BarChart2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getGridPreview, predictSingle } from '@/lib/api';
import { cn } from '@/lib/utils';
import DeckGL from '@deck.gl/react';
import { ScatterplotLayer } from '@deck.gl/layers';
import { Map as MapGL } from 'react-map-gl/maplibre';

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const HORIZONS = [
    { label: '24h', hours: 24 },
    { label: '72h', hours: 72 },
    { label: '7d', hours: 168 },
];

const RISK_TYPES = ['all', 'air_quality', 'water', 'noise', 'waste', 'land'];

function Slider({ label, value, min, max, step = 1, unit = '', onChange, description }) {
    const pct = ((value - min) / (max - min)) * 100;
    const color = pct > 70 ? '#ef4444' : pct > 40 ? '#f59e0b' : '#22c55e';
    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">{label}</span>
                <span className="font-bold text-primary" style={{ color }}>{value}{unit}</span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={e => onChange(Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-primary bg-muted"
            />
            {description && (
                <p className="text-xs text-muted-foreground">{description}</p>
            )}
        </div>
    );
}

function DeltaBadge({ delta }) {
    const pct = (delta * 100).toFixed(1);
    if (Math.abs(delta) < 0.005) return <span className="text-xs font-semibold text-muted-foreground">No change</span>;
    return delta > 0
        ? <span className="flex items-center gap-1 text-xs font-bold text-destructive"><TrendingUp className="w-3.5 h-3.5" />+{pct}%</span>
        : <span className="flex items-center gap-1 text-xs font-bold text-green-500"><TrendingDown className="w-3.5 h-3.5" />{pct}%</span>;
}

export function RiskSimulation() {
    // Location
    const [lat, setLat] = useState(19.08);
    const [lon, setLon] = useState(72.88);
    const [gridId, setGridId] = useState('');
    const [resolving, setResolving] = useState(false);

    // Parameters
    const [horizon, setHorizon] = useState('72h');
    const [riskType, setRiskType] = useState('all');
    const [violationCount, setViolationCount] = useState(5);
    const [complaintCount, setComplaintCount] = useState(20);
    const [sensorAqi, setSensorAqi] = useState(120);
    const [recencyScore, setRecencyScore] = useState(5);

    // Result
    const [result, setResult] = useState(null);
    const [running, setRunning] = useState(false);
    const [error, setError] = useState('');

    const horizonHours = HORIZONS.find(h => h.label === horizon)?.hours ?? 72;

    const handleResolveGrid = useCallback(async () => {
        setResolving(true);
        setError('');
        try {
            const data = await getGridPreview(lat, lon);
            setGridId(data.grid_id || data.id || 'resolved');
        } catch (e) {
            setError('Could not resolve grid. Check lat/lon.');
        } finally {
            setResolving(false);
        }
    }, [lat, lon]);

    const handleRunSimulation = useCallback(async () => {
        setRunning(true);
        setError('');
        setResult(null);
        try {
            const res = await predictSingle({
                lat,
                lon,
                horizon_hours: horizonHours,
                risk_type: riskType,
                use_sensors: true,
                overrides: {
                    violation_count_7d: violationCount,
                    complaint_count_7d: complaintCount,
                    sensor_aqi: sensorAqi,
                    recency_decay_score: recencyScore,
                },
            });
            setResult(res);
            if (!gridId) setGridId(res.grid_id);
        } catch (e) {
            setError(e.message || 'Prediction failed. Is the backend running?');
        } finally {
            setRunning(false);
        }
    }, [lat, lon, horizonHours, riskType, violationCount, complaintCount, sensorAqi, recencyScore, gridId]);

    const handleReset = useCallback(() => {
        setResult(null);
        setError('');
        setViolationCount(5);
        setComplaintCount(20);
        setSensorAqi(120);
        setRecencyScore(5);
    }, []);

    // Map layers
    const mapPoint = result
        ? [{ lat: result.lat, lon: result.lon, score: result.simulated_risk_score }]
        : [{ lat, lon, score: 0 }];

    const layers = [
        new ScatterplotLayer({
            id: 'sim-location',
            data: mapPoint,
            getPosition: d => [d.lon, d.lat],
            getRadius: () => 800,
            getFillColor: d => d.score > 0.7
                ? [220, 38, 38, 200]
                : d.score > 0.4
                    ? [249, 115, 22, 200]
                    : [139, 92, 246, 200],
            radiusMinPixels: 12,
            radiusMaxPixels: 60,
            stroked: true,
            lineWidthMinPixels: 2,
            getLineColor: () => [255, 255, 255, 180],
        }),
    ];

    const viewState = {
        latitude: lat,
        longitude: lon,
        zoom: 11,
        pitch: 0,
        bearing: 0,
    };

    const originalPct = result ? (result.original_risk_score * 100).toFixed(1) : '--';
    const simPct = result ? (result.simulated_risk_score * 100).toFixed(1) : '--';
    const origCascade = result ? (result.original_cascade_score * 100).toFixed(1) : '--';
    const simCascade = result ? (result.simulated_cascade_score * 100).toFixed(1) : '--';

    const scoreColor = (s) => s >= 0.7 ? 'text-destructive' : s >= 0.4 ? 'text-yellow-500' : 'text-green-500';

    return (
        <div className="flex h-full overflow-hidden">
            {/* ─── Left Panel ─────────────────────────────────────────────── */}
            <div className="w-[400px] flex-none flex flex-col h-full border-r border-border bg-card overflow-y-auto">
                {/* Header */}
                <div className="p-5 border-b border-border">
                    <div className="flex items-center gap-2 mb-1">
                        <Sliders className="w-5 h-5 text-primary" />
                        <h1 className="text-lg font-bold tracking-tight">Risk Simulation</h1>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Adjust environmental parameters and predict future risk for any grid location.
                    </p>
                </div>

                {/* Location Picker */}
                <div className="p-5 border-b border-border space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                        <MapPin className="w-4 h-4 text-primary" />
                        Location
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Latitude</label>
                            <input
                                type="number"
                                step="0.01"
                                value={lat}
                                onChange={e => { setLat(Number(e.target.value)); setGridId(''); setResult(null); }}
                                className="w-full bg-muted border border-border rounded-md px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Longitude</label>
                            <input
                                type="number"
                                step="0.01"
                                value={lon}
                                onChange={e => { setLon(Number(e.target.value)); setGridId(''); setResult(null); }}
                                className="w-full bg-muted border border-border rounded-md px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                        </div>
                    </div>
                    <button
                        onClick={handleResolveGrid}
                        disabled={resolving}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-md border border-border bg-muted/50 hover:bg-muted transition-all disabled:opacity-50"
                    >
                        {resolving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
                        Resolve Grid Cell
                    </button>
                    {gridId && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                            Grid: <span className="font-mono font-semibold text-foreground">{gridId.slice(0, 16)}…</span>
                        </div>
                    )}
                </div>

                {/* Horizon & Risk Type */}
                <div className="p-5 border-b border-border space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                        <Activity className="w-4 h-4 text-primary" />
                        Prediction Settings
                    </div>
                    <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Horizon</label>
                        <div className="flex gap-1">
                            {HORIZONS.map(h => (
                                <button
                                    key={h.label}
                                    onClick={() => setHorizon(h.label)}
                                    className={cn(
                                        'flex-1 py-1.5 text-sm font-semibold rounded-md transition-all',
                                        horizon === h.label ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                    )}
                                >
                                    {h.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Risk Category</label>
                        <select
                            value={riskType}
                            onChange={e => setRiskType(e.target.value)}
                            className="w-full bg-muted border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                            {RISK_TYPES.map(t => <option key={t} value={t}>{t === 'all' ? 'All Types' : t.replace('_', ' ')}</option>)}
                        </select>
                    </div>
                </div>

                {/* Parameter Sliders */}
                <div className="p-5 border-b border-border space-y-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                            <BarChart2 className="w-4 h-4 text-primary" />
                            Environmental Parameters
                        </div>
                        <button
                            onClick={handleReset}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Reset
                        </button>
                    </div>

                    <Slider
                        label="Violation Activity (7d)"
                        value={violationCount}
                        min={0}
                        max={50}
                        onChange={setViolationCount}
                        description="Number of industrial violations in the past 7 days"
                    />
                    <Slider
                        label="Complaint Volume (7d)"
                        value={complaintCount}
                        min={0}
                        max={200}
                        onChange={setComplaintCount}
                        description="Citizen complaints received in the past 7 days"
                    />
                    <Slider
                        label="Air Quality Index (AQI)"
                        value={sensorAqi}
                        min={0}
                        max={500}
                        step={5}
                        unit=" AQI"
                        onChange={setSensorAqi}
                        description="Simulated AQI reading (0 = Good, 300+ = Hazardous)"
                    />
                    <Slider
                        label="Recency Score"
                        value={recencyScore}
                        min={0}
                        max={10}
                        step={0.5}
                        onChange={setRecencyScore}
                        description="Weight of recent vs historical events (0–10)"
                    />
                </div>

                {/* Run Button */}
                <div className="p-5 space-y-3">
                    {error && (
                        <div className="flex items-start gap-2 bg-destructive/10 text-destructive text-xs px-3 py-2 rounded-lg border border-destructive/20">
                            <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-none" />
                            {error}
                        </div>
                    )}
                    <Button
                        onClick={handleRunSimulation}
                        disabled={running}
                        className="w-full gap-2 font-bold text-sm"
                        size="lg"
                    >
                        {running
                            ? <><RefreshCw className="w-4 h-4 animate-spin" /> Running Prediction...</>
                            : <><Play className="w-4 h-4" /> Run Risk Prediction</>
                        }
                    </Button>
                    <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
                        <Info className="w-3 h-3" />
                        Computes original vs adjusted risk for {horizon} horizon
                    </p>
                </div>
            </div>

            {/* ─── Right Panel: Map + Results ──────────────────────────── */}
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Map */}
                <div className="flex-1 relative min-h-0">
                    <DeckGL
                        viewState={viewState}
                        controller={true}
                        layers={layers}
                        style={{ position: 'absolute', inset: 0 }}
                    >
                        <MapGL mapStyle={MAP_STYLE} reuseMaps />
                    </DeckGL>

                    {/* Coordinate overlay */}
                    <div className="absolute top-3 left-3 z-10 bg-card/90 backdrop-blur border border-border rounded-lg px-3 py-2 text-xs font-mono">
                        📍 {lat.toFixed(4)}, {lon.toFixed(4)}
                        {gridId && <span className="ml-2 text-muted-foreground">· {gridId.slice(0, 8)}…</span>}
                    </div>
                </div>

                {/* Results Panel */}
                {result && (
                    <div className="flex-none border-t border-border bg-card p-5 animate-in slide-in-from-bottom duration-300">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-bold text-base flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                                Simulation Results
                                <span className="text-xs font-normal text-muted-foreground ml-1">
                                    Grid {result.grid_id?.slice(0, 12)}… · {horizon}
                                </span>
                            </h2>
                            <button
                                onClick={() => setResult(null)}
                                className="text-xs text-muted-foreground hover:text-foreground"
                            >dismiss</button>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                            {/* Original */}
                            <div className="bg-muted/50 rounded-xl p-4 border border-border">
                                <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Original Risk</div>
                                <div className={`text-3xl font-black ${scoreColor(result.original_risk_score)}`}>
                                    {originalPct}<span className="text-sm font-normal text-muted-foreground ml-1">%</span>
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                    Cascade: <span className="font-semibold">{origCascade}%</span>
                                </div>
                            </div>

                            {/* Simulated */}
                            <div className="bg-primary/5 rounded-xl p-4 border border-primary/20 relative">
                                <div className="absolute top-2 right-2">
                                    <DeltaBadge delta={result.delta} />
                                </div>
                                <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Simulated Risk</div>
                                <div className={`text-3xl font-black ${scoreColor(result.simulated_risk_score)}`}>
                                    {simPct}<span className="text-sm font-normal text-muted-foreground ml-1">%</span>
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                    Cascade: <span className="font-semibold">{simCascade}%</span>
                                    <span className="ml-2">
                                        <DeltaBadge delta={result.cascade_delta} />
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Drivers comparison */}
                        {result.simulated_drivers && result.simulated_drivers.length > 0 && (
                            <div>
                                <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Top Simulated Drivers</div>
                                <div className="flex flex-wrap gap-2">
                                    {result.simulated_drivers.slice(0, 5).map((d, i) => (
                                        <span key={i} className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full font-medium border border-primary/20">
                                            {typeof d === 'string' ? d : JSON.stringify(d)}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Placeholder when no result */}
                {!result && (
                    <div className="flex-none border-t border-border bg-card/40 px-6 py-5 flex items-center gap-3 text-sm text-muted-foreground">
                        <Info className="w-4 h-4 flex-none" />
                        Set parameters on the left and click <strong className="text-foreground mx-1">Run Risk Prediction</strong> to see before/after comparison.
                    </div>
                )}
            </div>
        </div>
    );
}
