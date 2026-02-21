import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
    MapPin, Sliders, Play, RefreshCw, TrendingDown, TrendingUp,
    Activity, AlertCircle, CheckCircle2, Info, BarChart2, Zap, Wind,
    Droplets, Volume2, Trash2
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

const RISK_TYPES = [
    { value: 'all', label: 'All Types', Icon: Activity },
    { value: 'air_quality', label: 'Air Quality', Icon: Wind },
    { value: 'water', label: 'Water', Icon: Droplets },
    { value: 'noise', label: 'Noise', Icon: Volume2 },
    { value: 'waste', label: 'Waste', Icon: Trash2 },
];

// Default parameter values
const DEFAULT_PARAMS = {
    violationCount: 5,
    complaintCount: 20,
    sensorAqi: 120,
    recencyScore: 5,
    industrialProximity: 2,
    populationDensity: 50,
    waterBodyProximity: 3,
    noiseLevel: 65,
};

function Slider({ label, value, min, max, step = 1, unit = '', onChange, description, icon: Icon }) {
    const pct = ((value - min) / (max - min)) * 100;
    const color = pct > 70 ? '#ef4444' : pct > 40 ? '#f59e0b' : '#22c55e';
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground flex items-center gap-1.5">
                    {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground" />}
                    {label}
                </span>
                <span className="font-bold tabular-nums" style={{ color }}>{value}{unit}</span>
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

function RiskGauge({ score, label }) {
    const pct = score * 100;
    const color = score >= 0.7 ? '#ef4444' : score >= 0.4 ? '#f59e0b' : '#22c55e';
    const textColor = score >= 0.7 ? 'text-destructive' : score >= 0.4 ? 'text-yellow-500' : 'text-green-500';
    return (
        <div className="space-y-1">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
            <div className={`text-3xl font-black ${textColor}`}>
                {pct.toFixed(1)}<span className="text-sm font-normal text-muted-foreground ml-1">%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
            </div>
        </div>
    );
}

export function RiskSimulation() {
    // Location
    const [lat, setLat] = useState(19.08);
    const [lon, setLon] = useState(72.88);
    const [gridId, setGridId] = useState('');
    const [resolving, setResolving] = useState(false);

    // Prediction Settings
    const [horizon, setHorizon] = useState('72h');
    const [riskType, setRiskType] = useState('all');

    // Environmental Parameters
    const [params, setParams] = useState(DEFAULT_PARAMS);

    // Result
    const [result, setResult] = useState(null);
    const [running, setRunning] = useState(false);
    const [error, setError] = useState('');
    const [autoRunPending, setAutoRunPending] = useState(false);

    // Debounce timer for auto-run
    const debounceRef = useRef(null);
    const hasRunOnce = useRef(false);

    const horizonHours = HORIZONS.find(h => h.label === horizon)?.hours ?? 72;

    const setParam = useCallback((key, value) => {
        setParams(prev => ({ ...prev, [key]: value }));
    }, []);

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

    const runPrediction = useCallback(async () => {
        setRunning(true);
        setError('');
        try {
            const res = await predictSingle({
                lat,
                lon,
                horizon_hours: horizonHours,
                risk_type: riskType,
                use_sensors: true,
                overrides: {
                    violation_count_7d: params.violationCount,
                    complaint_count_7d: params.complaintCount,
                    sensor_aqi: params.sensorAqi,
                    recency_decay_score: params.recencyScore,
                    // Extra parameters mapped to feature keys
                    industrial_proximity_km: params.industrialProximity,
                    population_density_norm: params.populationDensity / 100,
                    water_body_proximity_km: params.waterBodyProximity,
                    noise_level_db: params.noiseLevel,
                },
            });
            setResult(res);
            if (!gridId) setGridId(res.grid_id);
            hasRunOnce.current = true;
            setAutoRunPending(false);
        } catch (e) {
            setError(e.message || 'Prediction failed. Is the backend running?');
        } finally {
            setRunning(false);
        }
    }, [lat, lon, horizonHours, riskType, params, gridId]);

    // Auto-run with debounce whenever parameters, horizon, or risk type change
    useEffect(() => {
        if (!hasRunOnce.current) return; // only auto-run after first manual run
        setAutoRunPending(true);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            runPrediction();
        }, 800);
        return () => clearTimeout(debounceRef.current);
    }, [params, horizon, riskType]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleReset = useCallback(() => {
        setParams(DEFAULT_PARAMS);
        setResult(null);
        setError('');
        hasRunOnce.current = false;
        setAutoRunPending(false);
    }, []);

    // Map layers
    const mapPoint = result
        ? [{ lat: result.lat, lon: result.lon, origScore: result.original_risk_score, simScore: result.simulated_risk_score }]
        : [{ lat, lon, origScore: 0, simScore: 0 }];

    const layers = [
        // Original risk point (hollow ring)
        result && new ScatterplotLayer({
            id: 'orig-location',
            data: [{ lat: result.lat, lon: result.lon, score: result.original_risk_score }],
            getPosition: d => [d.lon, d.lat],
            getRadius: () => 1000,
            getFillColor: () => [0, 0, 0, 0],
            stroked: true,
            lineWidthMinPixels: 2,
            getLineColor: d => d.score > 0.7 ? [220, 38, 38, 180] : d.score > 0.4 ? [249, 115, 22, 180] : [34, 197, 94, 180],
            radiusMinPixels: 14,
            radiusMaxPixels: 70,
        }),
        // Simulated risk point (filled)
        new ScatterplotLayer({
            id: 'sim-location',
            data: mapPoint,
            getPosition: d => [d.lon, d.lat],
            getRadius: () => 700,
            getFillColor: d => d.simScore > 0.7
                ? [220, 38, 38, 200]
                : d.simScore > 0.4
                    ? [249, 115, 22, 200]
                    : [34, 197, 94, 200],
            radiusMinPixels: 10,
            radiusMaxPixels: 55,
            stroked: true,
            lineWidthMinPixels: 2,
            getLineColor: () => [255, 255, 255, 200],
        }),
    ].filter(Boolean);

    const viewState = {
        latitude: lat,
        longitude: lon,
        zoom: 11,
        pitch: 0,
        bearing: 0,
    };

    const origPct = result ? (result.original_risk_score * 100).toFixed(1) : '--';
    const simPct = result ? (result.simulated_risk_score * 100).toFixed(1) : '--';

    return (
        <div className="flex h-full overflow-hidden">
            {/* ─── Left Panel ─────────────────────────────────────────────── */}
            <div className="w-[380px] flex-none flex flex-col h-full border-r border-border bg-card overflow-y-auto">
                {/* Header */}
                <div className="p-5 border-b border-border">
                    <div className="flex items-center gap-2 mb-1">
                        <Sliders className="w-5 h-5 text-primary" />
                        <h1 className="text-lg font-bold tracking-tight">Risk Simulation</h1>
                        {autoRunPending && (
                            <span className="ml-auto flex items-center gap-1 text-xs text-primary animate-pulse">
                                <RefreshCw className="w-3 h-3 animate-spin" /> Computing…
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Adjust environmental parameters to predict future risk for any grid location.
                        Changes auto-recompute after you stop adjusting.
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
                                onChange={e => { setLat(Number(e.target.value)); setGridId(''); setResult(null); hasRunOnce.current = false; }}
                                className="w-full bg-muted border border-border rounded-md px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Longitude</label>
                            <input
                                type="number"
                                step="0.01"
                                value={lon}
                                onChange={e => { setLon(Number(e.target.value)); setGridId(''); setResult(null); hasRunOnce.current = false; }}
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
                        <label className="text-xs text-muted-foreground mb-1 block">Time Horizon</label>
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
                        <div className="grid grid-cols-2 gap-1.5">
                            {RISK_TYPES.map(({ value, label, Icon }) => (
                                <button
                                    key={value}
                                    onClick={() => setRiskType(value)}
                                    className={cn(
                                        'flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md border transition-all',
                                        riskType === value
                                            ? 'bg-primary text-primary-foreground border-primary'
                                            : 'bg-muted/40 text-muted-foreground border-border hover:bg-muted'
                                    )}
                                >
                                    <Icon className="w-3 h-3" />
                                    {label}
                                </button>
                            ))}
                        </div>
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
                            Reset All
                        </button>
                    </div>

                    <Slider
                        label="Violation Activity (7d)"
                        value={params.violationCount}
                        min={0} max={50}
                        onChange={v => setParam('violationCount', v)}
                        description="Industrial violations in past 7 days"
                    />
                    <Slider
                        label="Complaint Volume (7d)"
                        value={params.complaintCount}
                        min={0} max={200}
                        onChange={v => setParam('complaintCount', v)}
                        description="Citizen complaints received in past 7 days"
                    />
                    <Slider
                        label="Air Quality Index (AQI)"
                        value={params.sensorAqi}
                        min={0} max={500} step={5}
                        unit=" AQI"
                        onChange={v => setParam('sensorAqi', v)}
                        description="0 = Good · 300+ = Hazardous"
                    />
                    <Slider
                        label="Recency Score"
                        value={params.recencyScore}
                        min={0} max={10} step={0.5}
                        onChange={v => setParam('recencyScore', v)}
                        description="Weight of recent vs historical events (0–10)"
                    />
                    <Slider
                        label="Industrial Proximity"
                        value={params.industrialProximity}
                        min={0} max={20} step={0.5}
                        unit=" km"
                        onChange={v => setParam('industrialProximity', v)}
                        description="Distance to nearest industrial zone"
                    />
                    <Slider
                        label="Population Density"
                        value={params.populationDensity}
                        min={0} max={100} step={1}
                        unit="%"
                        onChange={v => setParam('populationDensity', v)}
                        description="Relative population density (0 = sparse, 100 = dense)"
                    />
                    <Slider
                        label="Water Body Proximity"
                        value={params.waterBodyProximity}
                        min={0} max={20} step={0.5}
                        unit=" km"
                        onChange={v => setParam('waterBodyProximity', v)}
                        description="Distance to nearest water body"
                    />
                    <Slider
                        label="Noise Level"
                        value={params.noiseLevel}
                        min={30} max={120} step={1}
                        unit=" dB"
                        onChange={v => setParam('noiseLevel', v)}
                        description="Average ambient noise level in decibels"
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
                        onClick={() => { hasRunOnce.current = true; runPrediction(); }}
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
                        Parameters auto-recompute after adjustment · {horizon} horizon
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

                    {/* Coordinate + grid overlay */}
                    <div className="absolute top-3 left-3 z-10 bg-card/90 backdrop-blur border border-border rounded-lg px-3 py-2 text-xs font-mono">
                        📍 {lat.toFixed(4)}, {lon.toFixed(4)}
                        {gridId && <span className="ml-2 text-muted-foreground">· {gridId.slice(0, 10)}…</span>}
                    </div>

                    {/* Map legend */}
                    <div className="absolute bottom-3 left-3 z-10 bg-card/90 backdrop-blur border border-border rounded-lg px-3 py-2 text-xs space-y-1">
                        <div className="font-semibold mb-1 text-foreground">Map Legend</div>
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-green-500 border-2 border-green-300" />
                            <span className="text-muted-foreground">Simulated (filled)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-transparent border-2 border-red-500" />
                            <span className="text-muted-foreground">Original (ring)</span>
                        </div>
                    </div>

                    {/* Auto-run indicator */}
                    {autoRunPending && (
                        <div className="absolute top-3 right-3 z-10 bg-primary/90 text-primary-foreground text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            Recomputing risk…
                        </div>
                    )}
                </div>

                {/* Results Panel */}
                {result && (
                    <div className="flex-none border-t border-border bg-card p-5 animate-in slide-in-from-bottom duration-300">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-bold text-base flex items-center gap-2">
                                <Zap className="w-4 h-4 text-primary" />
                                Risk Prediction Results
                                <span className="text-xs font-normal text-muted-foreground ml-1">
                                    Grid {result.grid_id?.slice(0, 12)}… · {horizon}
                                </span>
                            </h2>
                            <button
                                onClick={() => { setResult(null); hasRunOnce.current = false; }}
                                className="text-xs text-muted-foreground hover:text-foreground"
                            >dismiss</button>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                            {/* Original */}
                            <div className="bg-muted/50 rounded-xl p-4 border border-border">
                                <RiskGauge score={result.original_risk_score} label="Original Risk" />
                                <div className="text-xs text-muted-foreground mt-2">
                                    Cascade: <span className="font-semibold">{(result.original_cascade_score * 100).toFixed(1)}%</span>
                                </div>
                            </div>

                            {/* Simulated */}
                            <div className="bg-primary/5 rounded-xl p-4 border border-primary/20 relative">
                                <div className="absolute top-2 right-2">
                                    <DeltaBadge delta={result.delta} />
                                </div>
                                <RiskGauge score={result.simulated_risk_score} label="Simulated Risk" />
                                <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                                    Cascade: <span className="font-semibold">{(result.simulated_cascade_score * 100).toFixed(1)}%</span>
                                    <span className="ml-1"><DeltaBadge delta={result.cascade_delta} /></span>
                                </div>
                            </div>
                        </div>

                        {/* Drivers comparison */}
                        {result.simulated_drivers && result.simulated_drivers.length > 0 && (
                            <div>
                                <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Top Risk Drivers</div>
                                <div className="flex flex-wrap gap-2">
                                    {result.simulated_drivers.slice(0, 6).map((d, i) => (
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
                        Set parameters and click <strong className="text-foreground mx-1">Run Risk Prediction</strong> to see before/after comparison. Future adjustments auto-recompute.
                    </div>
                )}
            </div>
        </div>
    );
}
