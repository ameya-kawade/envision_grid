import React, { useState } from 'react';
import { DeckGLMap } from '@/components/MapModule/DeckGLMap';
import { Button } from '@/components/ui/button';
import { Play, Save, RefreshCw } from 'lucide-react';
import { runSimulation } from '@/lib/api';

export function PolicySimulation() {
    const [intensity, setIntensity] = useState(50);
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState(null);
    const [horizon, setHorizon] = useState('30d');
    const [targetGrid, setTargetGrid] = useState('');
    const [violationTypes, setViolationTypes] = useState({
        'illegal_dumping': true,
        'industrial_emission': true,
        'noise': true,
        'water_pollution': true,
    });

    const handleRun = async () => {
        if (!targetGrid.trim()) {
            setResult({ error: 'Enter a grid ID (e.g. 19.08_72.88) to simulate on' });
            return;
        }
        setRunning(true);
        setResult(null);
        try {
            const selectedTypes = Object.entries(violationTypes)
                .filter(([, v]) => v)
                .map(([k]) => k);

            const factor = 1.0 - (parseInt(intensity) / 100.0);

            // Build adjustments per selected violation type
            const adjustments = selectedTypes.map(vt => ({
                grid_id: targetGrid.trim(),
                violation_type: vt,
                factor: parseFloat(factor.toFixed(2)),
                window_days: horizon === '7d' ? 7 : horizon === '90d' ? 90 : 30,
            }));

            const horizonHours = horizon === '7d' ? 168 : horizon === '90d' ? 2160 : 720;

            const res = await runSimulation({
                risk_type: 'all',
                horizon_hours: horizonHours,
                adjustments,
            });
            setResult(res);
        } catch (e) {
            setResult({ error: e.message });
        } finally {
            setRunning(false);
        }
    };

    const LABELS = {
        illegal_dumping: 'Illegal Dumping',
        industrial_emission: 'Industrial Emissions',
        noise: 'Noise',
        water_pollution: 'Water Pollution',
    };

    return (
        <div className="flex h-full w-full">
            {/* Controls Sidebar */}
            <div className="w-80 bg-card border-r border-border p-6 flex flex-col h-full z-10 shadow-xl overflow-y-auto">
                <h2 className="text-xl font-bold mb-1">Policy Simulation</h2>
                <p className="text-xs text-muted-foreground mb-6">Test interventions before deploying resources.</p>

                <div className="space-y-6 flex-1">
                    {/* Grid ID input */}
                    <div>
                        <label className="text-sm font-medium mb-2 block">Target Grid ID</label>
                        <input
                            type="text"
                            placeholder="e.g. 19.08_72.88"
                            value={targetGrid}
                            onChange={(e) => setTargetGrid(e.target.value)}
                            className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm font-mono"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Enter a grid ID from the predictions or hotspots page.</p>
                    </div>

                    <div>
                        <label className="text-sm font-medium mb-2 block">Inspection Intensity</label>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={intensity}
                            onChange={(e) => setIntensity(e.target.value)}
                            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                            <span>No Change</span>
                            <span>{intensity}% Reduction</span>
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-medium mb-2 block">Targeted Violation Types</label>
                        <div className="space-y-3 bg-muted/30 p-3 rounded-md border border-border">
                            {Object.keys(violationTypes).map(type => (
                                <label key={type} className="flex items-center gap-2 text-sm cursor-pointer select-none hover:text-foreground/80">
                                    <input
                                        type="checkbox"
                                        checked={violationTypes[type]}
                                        onChange={() => setViolationTypes(prev => ({ ...prev, [type]: !prev[type] }))}
                                        className="rounded border-input text-primary focus:ring-primary accent-primary w-4 h-4"
                                    />
                                    {LABELS[type]}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-medium mb-2 block">Simulation Horizon</label>
                        <div className="grid grid-cols-3 gap-2">
                            {['7d', '30d', '90d'].map((h) => (
                                <button
                                    key={h}
                                    onClick={() => setHorizon(h)}
                                    className={`px-3 py-1.5 text-xs border border-border rounded-md hover:bg-muted transition-colors ${horizon === h ? 'bg-primary text-primary-foreground' : ''
                                        }`}
                                >
                                    {h}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-primary/5 border border-primary/20 rounded-md p-4 space-y-3">
                        <div className="text-xs font-semibold text-primary uppercase tracking-wider">Projected Impact</div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Violation Reduction</span>
                            <span className="font-bold text-green-500">-{intensity}%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                            <div className="bg-green-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${intensity}%` }}></div>
                        </div>
                    </div>

                    {result && (
                        <div className={`p-3 rounded-md text-sm ${result.error ? 'bg-destructive/10 text-destructive' : 'bg-green-500/10 text-green-400'}`}>
                            {result.error ? (
                                `❌ ${result.error}`
                            ) : (
                                <div className="space-y-2">
                                    <div>✅ Simulation complete</div>
                                    {result.results && result.results.map((r, i) => (
                                        <div key={i} className="text-xs bg-card/50 p-2 rounded border border-border">
                                            <div className="font-mono">{r.grid_id}</div>
                                            <div>Original: <b>{(r.original_risk * 100).toFixed(1)}%</b> → Simulated: <b>{(r.simulated_risk * 100).toFixed(1)}%</b></div>
                                            <div className={r.delta < 0 ? 'text-green-400' : 'text-red-400'}>
                                                Delta: {(r.delta * 100).toFixed(1)}%
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="pt-6 border-t border-border space-y-3 mt-4">
                    <Button onClick={handleRun} disabled={running} className="w-full gap-2 font-semibold">
                        {running
                            ? <><RefreshCw className="w-4 h-4 animate-spin" /> Running...</>
                            : <><Play className="w-4 h-4 fill-current" /> Run Simulation</>
                        }
                    </Button>
                    <Button variant="outline" className="w-full gap-2 text-muted-foreground hover:text-foreground">
                        <Save className="w-4 h-4" /> Save Scenario
                    </Button>
                </div>
            </div>

            {/* Map View */}
            <div className="flex-1 relative bg-black">
                <div className="absolute top-4 right-4 z-10 bg-card/90 backdrop-blur border border-border rounded-md p-2 flex items-center gap-3 shadow-lg">
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        <span className="text-xs font-medium">Risk Reduced</span>
                    </div>
                    <div className="h-4 w-[1px] bg-border"></div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-destructive"></span>
                        <span className="text-xs font-medium">Persistent Risk</span>
                    </div>
                </div>
                <DeckGLMap />
            </div>
        </div>
    );
}
