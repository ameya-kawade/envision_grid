import React from 'react';
import { DeckGLMap } from '@/components/MapModule/DeckGLMap';
import { useStore } from '@/store/useStore';
import { TrendingUp, Activity, AlertCircle, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CommandCenter() {
    const { activeZone, setActiveZone } = useStore();

    return (
        <div className="flex h-full w-full relative">
            <div className="flex-1 h-full relative z-0">
                <DeckGLMap />
            </div>

            {activeZone && (
                <div className="w-[380px] h-full absolute right-0 top-0 bg-card border-l border-border p-6 shadow-2xl z-20 overflow-y-auto animate-in slide-in-from-right duration-300">

                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h2 className="text-2xl font-bold tracking-tight">Zone {activeZone.hex.slice(0, 6)}...</h2>
                            <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                                Last updated 2 mins ago <Activity className="w-3 h-3 text-green-500 animate-pulse" />
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
                            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-semibold border border-primary/20">High Confidence</span>
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
                        <p className="mt-3 text-xs text-muted-foreground">
                            Projection: <span className="text-destructive font-semibold">Rising (+4%)</span> over next 24h
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
                                        <div className="bg-destructive h-2 rounded-full" style={{ width: '85%' }}></div>
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
                                    <span className="font-semibold text-primary">Summary:</span> Zone {activeZone.hex.slice(0, 6)} is exhibiting precursor signals consistent with unauthorized industrial discharge.
                                </p>
                                <ul className="list-disc list-inside space-y-1 text-muted-foreground text-xs">
                                    <li>72h complaint volume: <span className="text-destructive font-medium">+240%</span></li>
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
                                <Button variant="outline" className="w-full text-xs">Simulate Policy</Button>
                                <Button variant="outline" className="w-full text-xs">View History</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
