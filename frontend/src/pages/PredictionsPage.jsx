import React, { useState, useEffect } from 'react';
import { Brain, RefreshCw, MapPin, Zap, Play, Clock, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getPredictions, runPrediction } from '@/lib/api';

export function PredictionsPage() {
    const [predictions, setPredictions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [running, setRunning] = useState(false);
    const [runResult, setRunResult] = useState(null);
    const [riskType, setRiskType] = useState('all');
    const [threshold, setThreshold] = useState(0.6);

    const fetchPredictions = async () => {
        setLoading(true);
        try {
            const data = await getPredictions({ risk_type: riskType === 'all' ? undefined : riskType, limit: 100 });
            setPredictions(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchPredictions(); }, [riskType]);

    const handleRunPrediction = async () => {
        setRunning(true);
        setRunResult(null);
        try {
            const result = await runPrediction({ risk_type: riskType, threshold });
            setRunResult(result);
            fetchPredictions();
        } catch (e) {
            setRunResult({ error: e.message });
        } finally {
            setRunning(false);
        }
    };

    const getRiskBadge = (score) => {
        if (score >= 0.8) return 'bg-destructive/10 text-destructive';
        if (score >= 0.6) return 'bg-orange-500/10 text-orange-500';
        if (score >= 0.4) return 'bg-yellow-500/10 text-yellow-500';
        return 'bg-green-500/10 text-green-500';
    };

    return (
        <div className="p-8 max-w-7xl mx-auto h-full overflow-y-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Predictions Engine</h1>
                    <p className="text-muted-foreground mt-1">AI-powered risk predictions across all grid zones.</p>
                </div>
                <Button onClick={fetchPredictions} variant="outline" className="gap-2">
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </Button>
            </div>

            {/* Run Prediction Panel */}
            <div className="bg-gradient-to-r from-primary/5 to-transparent border border-primary/20 rounded-lg p-6 mb-6">
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                    <Brain className="w-5 h-5 text-primary" /> Run New Prediction
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="text-sm font-medium mb-1 block">Risk Type</label>
                        <select
                            value={riskType}
                            onChange={(e) => setRiskType(e.target.value)}
                            className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm"
                        >
                            <option value="all">All Types</option>
                            <option value="air">Air Quality</option>
                            <option value="water">Water Quality</option>
                            <option value="noise">Noise</option>
                            <option value="waste">Waste/Dumping</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-sm font-medium mb-1 block">Threshold</label>
                        <input
                            type="range"
                            min="0.1"
                            max="0.95"
                            step="0.05"
                            value={threshold}
                            onChange={(e) => setThreshold(parseFloat(e.target.value))}
                            className="w-full accent-primary"
                        />
                        <span className="text-xs text-muted-foreground">{(threshold * 100).toFixed(0)}%</span>
                    </div>
                    <div></div>
                    <Button onClick={handleRunPrediction} disabled={running} className="gap-2">
                        {running ? (
                            <><div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div> Running...</>
                        ) : (
                            <><Play className="w-4 h-4 fill-current" /> Run Prediction</>
                        )}
                    </Button>
                </div>
                {runResult && (
                    <div className="mt-4 p-3 bg-muted rounded-md text-sm">
                        {runResult.error ? (
                            <span className="text-destructive">❌ {runResult.error}</span>
                        ) : (
                            <span className="text-green-500">
                                ✅ Prediction complete — {runResult.total_grids_scored || 0} grids scored,{' '}
                                {runResult.alerts_generated || 0} alerts generated
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Predictions Table */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <span className="ml-3 text-muted-foreground">Loading predictions...</span>
                </div>
            ) : predictions.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground">
                    <Zap className="w-12 h-12 mx-auto mb-4 opacity-40" />
                    <p className="text-lg font-medium">No predictions yet</p>
                    <p className="text-sm mt-1">Run a prediction to see results.</p>
                </div>
            ) : (
                <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted text-muted-foreground uppercase text-xs font-semibold">
                            <tr>
                                <th className="px-5 py-3">Grid Zone</th>
                                <th className="px-5 py-3">Risk Score</th>
                                <th className="px-5 py-3">Risk Type</th>
                                <th className="px-5 py-3">Confidence</th>
                                <th className="px-5 py-3">Top Drivers</th>
                                <th className="px-5 py-3">Run Time</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {predictions.map((p, i) => (
                                <tr key={i} className="hover:bg-muted/50 transition-colors">
                                    <td className="px-5 py-3 font-mono text-xs flex items-center gap-1.5">
                                        <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                                        {p.grid_id}
                                    </td>
                                    <td className="px-5 py-3">
                                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${getRiskBadge(p.risk_score)}`}>
                                            {(p.risk_score * 100).toFixed(0)}%
                                        </span>
                                    </td>
                                    <td className="px-5 py-3 capitalize">{p.risk_type || 'all'}</td>
                                    <td className="px-5 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                                <div className="h-full bg-primary rounded-full" style={{ width: `${(p.confidence || 0) * 100}%` }}></div>
                                            </div>
                                            <span className="text-xs">{((p.confidence || 0) * 100).toFixed(0)}%</span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3">
                                        <div className="flex flex-wrap gap-1">
                                            {(p.top_drivers || []).slice(0, 3).map((d, j) => (
                                                <span key={j} className="bg-muted px-1.5 py-0.5 rounded text-xs">{d}</span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-5 py-3 text-xs text-muted-foreground flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {p.run_timestamp ? new Date(p.run_timestamp).toLocaleString() : '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="px-5 py-3 bg-muted/30 text-xs text-muted-foreground border-t border-border">
                        Showing {predictions.length} predictions
                    </div>
                </div>
            )}
        </div>
    );
}
