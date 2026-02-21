import React, { useState, useCallback } from 'react';
import { DeckGLMap } from '@/components/MapModule/DeckGLMap';
import { useStore } from '@/store/useStore';
import { TrendingUp, Activity, AlertCircle, Clock, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { triggerBulkPredict } from '@/lib/api';
import { cn } from '@/lib/utils';

const HORIZONS = [
    { label: '24h', hours: 24, title: 'Next 24h' },
    { label: '72h', hours: 72, title: 'Next 72h' },
    { label: '7d', hours: 168, title: 'Next 7 days' },
];

export function CommandCenter() {
    const { activeZone, setActiveZone, horizon, setHorizon, setHorizonCache } = useStore();
    const [refreshing, setRefreshing] = useState(false);
    const [lastRefreshed, setLastRefreshed] = useState(null);

    const handleHorizonChange = useCallback(async (h) => {
        if (h === horizon) return;
        setHorizon(h);
    }, [horizon, setHorizon]);

    const handleRefresh = useCallback(async () => {
        if (refreshing) return;
        setRefreshing(true);
        try {
            const hrs = HORIZONS.find(h => h.label === horizon)?.hours ?? 72;
            await triggerBulkPredict(hrs, 0.4);
            // Invalidate cache for this horizon so DeckGLMap re-fetches
            setHorizonCache(horizon, null);
            setTimeout(() => setHorizonCache(horizon, null), 50);
            setLastRefreshed(new Date());
        } catch (e) {
            console.error('Refresh failed:', e);
        } finally {
            setRefreshing(false);
        }
    }, [horizon, refreshing, setHorizonCache]);

    return (
        <div className="flex flex-col h-full w-full">
            {/* Horizon Tab Bar */}
            <div className="flex-none flex items-center gap-2 px-4 py-2 border-b border-border bg-card/80 backdrop-blur">
                <Clock className="w-4 h-4 text-muted-foreground mr-1" />
                <span className="text-xs text-muted-foreground mr-2 font-medium uppercase tracking-wide">Prediction Horizon</span>
                <div className="flex gap-1 flex-1">
                    {HORIZONS.map(({ label, title }) => (
                        <button
                            key={label}
                            onClick={() => handleHorizonChange(label)}
                            className={cn(
                                'px-4 py-1.5 text-sm font-semibold rounded-md transition-all duration-150',
                                horizon === label
                                    ? 'bg-primary text-primary-foreground shadow'
                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                            )}
                            title={title}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-all disabled:opacity-50"
                    title="Trigger fresh predictions from backend"
                >
                    <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
                    {refreshing ? 'Running...' : 'Refresh'}
                </button>
                {lastRefreshed && (
                    <div className="flex items-center gap-1 text-xs text-green-500">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{lastRefreshed.toLocaleTimeString()}</span>
                    </div>
                )}
            </div>

            {/* Map + detail panel */}
            <div className="flex-1 relative overflow-hidden">
                <div className="absolute inset-0 z-0">
                    <DeckGLMap />
                </div>

                {activeZone && (
                    <div className="w-[380px] h-full absolute right-0 top-0 bg-card border-l border-border p-6 shadow-2xl z-20 overflow-y-auto animate-in slide-in-from-right duration-300">

                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-2xl font-bold tracking-tight">Zone {activeZone.hex.slice(0, 6)}...</h2>
                                <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                                    Horizon: <span className="font-semibold text-foreground ml-1">{horizon}</span>
                                    <Activity className="w-3 h-3 text-green-500 animate-pulse ml-1" />
                                </div>
                            </div>
                            <button
                                onClick={() => setActiveZone(null)}
                                className="text-muted-foreground hover:text-foreground p-1 hover:bg-muted rounded-md transition-colors"
                            >
                                <span className="sr-only">Close</span>
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                            </button>
                        </div>

                        <div className="bg-gradient-to-br from-card to-muted rounded-xl p-5 mb-6 border border-border shadow-sm">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Risk Score</span>
                                <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-semibold border border-primary/20">
                                    {(activeZone.confidence * 100 || 0).toFixed(0)}% Confidence
                                </span>
                            </div>
                            <div className="flex items-baseline gap-3">
                                <span className={`text-5xl font-black ${activeZone.risk > 0.7 ? 'text-destructive' : activeZone.risk > 0.4 ? 'text-yellow-500' : 'text-green-500'}`}>
                                    {(activeZone.risk * 100).toFixed(0)}
                                </span>
                                <span className="text-muted-foreground font-medium">/ 100</span>
                            </div>
                            <div className="mt-3 w-full bg-muted/50 rounded-full h-2 overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${activeZone.risk > 0.7 ? 'bg-destructive' : activeZone.risk > 0.4 ? 'bg-yellow-500' : 'bg-green-500'}`}
                                    style={{ width: `${activeZone.risk * 100}%` }}
                                />
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">
                                Lat {activeZone.lat?.toFixed(4)}, Lon {activeZone.lon?.toFixed(4)}
                            </p>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-primary" />
                                    Top Risk Drivers
                                </h3>
                                <div className="space-y-3">
                                    <div className="relative">
                                        <div className="flex items-center justify-between text-sm mb-1">
                                            <span className="font-medium">{activeZone.driver || 'Unknown'} Intensity</span>
                                            <span className="font-bold text-destructive">Critical</span>
                                        </div>
                                        <div className="w-full bg-muted rounded-full h-2">
                                            <div className="bg-destructive h-2 rounded-full" style={{ width: `${Math.round(activeZone.risk * 100)}%` }}></div>
                                        </div>
                                    </div>
                                    <div className="relative">
                                        <div className="flex items-center justify-between text-sm mb-1">
                                            <span className="font-medium">Complaint Surge</span>
                                            <span className="font-bold text-orange-500">Moderate</span>
                                        </div>
                                        <div className="w-full bg-muted rounded-full h-2">
                                            <div className="bg-orange-500 h-2 rounded-full" style={{ width: '45%' }}></div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                    <Activity className="w-4 h-4 text-primary" />
                                    AI Analysis
                                </h3>
                                <div className="text-sm text-foreground/90 bg-primary/5 p-4 rounded-lg leading-relaxed border border-primary/10">
                                    <p className="mb-2">
                                        <span className="font-semibold text-primary">Summary:</span> Zone {activeZone.hex.slice(0, 6)} exhibits precursor signals consistent with unauthorized industrial discharge.
                                    </p>
                                    <ul className="list-disc list-inside space-y-1 text-muted-foreground text-xs">
                                        <li>{horizon} complaint volume: <span className="text-destructive font-medium">+240%</span></li>
                                        <li>Sensor drift: <span className="text-orange-500 font-medium">1.2σ</span> above baseline</li>
                                    </ul>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-border space-y-3">
                                <Button className="w-full gap-2 font-semibold" size="lg" variant="destructive">
                                    <AlertCircle className="w-4 h-4" />
                                    Dispatch Inspector
                                </Button>
                                <div className="grid grid-cols-2 gap-3">
                                    <Button variant="outline" className="w-full text-xs">Simulate Risk</Button>
                                    <Button variant="outline" className="w-full text-xs">View History</Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
