import React, { useState, useEffect } from 'react';
import { TrendingUp, MapPin, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getHotspots } from '@/lib/api';

export function HotspotsPage() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [limit, setLimit] = useState(15);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await getHotspots(limit, true);
            setData(Array.isArray(res) ? res : []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [limit]);

    const maxScore = Math.max(...data.map(d => d.risk_score || 0), 0.01);

    return (
        <div className="p-8 max-w-6xl mx-auto h-full overflow-y-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Risk Hotspots</h1>
                    <p className="text-muted-foreground mt-1">Top risk zones ranked by risk score.</p>
                </div>
                <div className="flex gap-3 items-center">
                    <select
                        value={limit}
                        onChange={(e) => setLimit(Number(e.target.value))}
                        className="bg-muted border border-border rounded-md px-3 py-2 text-sm"
                    >
                        <option value={10}>Top 10</option>
                        <option value={15}>Top 15</option>
                        <option value={25}>Top 25</option>
                        <option value={50}>Top 50</option>
                    </select>
                    <Button onClick={fetchData} variant="outline" className="gap-2">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <span className="ml-3 text-muted-foreground">Loading hotspots...</span>
                </div>
            ) : data.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground">
                    <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-40" />
                    <p className="text-lg font-medium">No hotspots found</p>
                    <p className="text-sm mt-1">Seed some data and run a prediction first.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {data.map((spot, i) => {
                        const score = spot.risk_score || 0;
                        const pct = (score / maxScore) * 100;
                        const color = score >= 0.8 ? 'bg-red-500' : score >= 0.6 ? 'bg-orange-500' : score >= 0.4 ? 'bg-yellow-500' : 'bg-green-500';
                        const textColor = score >= 0.8 ? 'text-red-500' : score >= 0.6 ? 'text-orange-500' : score >= 0.4 ? 'text-yellow-500' : 'text-green-500';

                        return (
                            <div key={spot.grid_id} className="bg-card border border-border rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <span className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-foreground">
                                            #{i + 1}
                                        </span>
                                        <div>
                                            <span className="font-mono text-sm flex items-center gap-1.5">
                                                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                                                {spot.grid_id}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {spot.violation_count_7d || 0} violations in 7d
                                                {spot.sensor_validated && ' · Sensor ✓'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className={`text-2xl font-black ${textColor}`}>
                                            {(score * 100).toFixed(0)}%
                                        </span>
                                        <div className="text-xs text-muted-foreground">
                                            Confidence: {((spot.confidence || 0) * 100).toFixed(0)}%
                                        </div>
                                    </div>
                                </div>
                                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                                    <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }}></div>
                                </div>
                                {spot.drivers && spot.drivers.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-1.5">
                                        {spot.drivers.slice(0, 4).map((d, j) => (
                                            <span key={j} className="bg-muted px-2 py-0.5 rounded text-xs">{d}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
