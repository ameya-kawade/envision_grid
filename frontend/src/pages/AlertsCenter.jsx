import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Clock, RefreshCw, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getAlerts } from '@/lib/api';

export function AlertsCenter() {
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchAlerts = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getAlerts();
            setAlerts(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAlerts(); }, []);

    const getSeverityBadge = (score) => {
        if (score >= 0.8) return { label: 'Critical', cls: 'bg-destructive/10 text-destructive' };
        if (score >= 0.6) return { label: 'High', cls: 'bg-orange-500/10 text-orange-500' };
        if (score >= 0.4) return { label: 'Moderate', cls: 'bg-yellow-500/10 text-yellow-500' };
        return { label: 'Low', cls: 'bg-green-500/10 text-green-500' };
    };

    return (
        <div className="p-8 max-w-7xl mx-auto h-full overflow-y-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Alerts Center</h1>
                    <p className="text-muted-foreground mt-1">Live alerts from the risk prediction engine.</p>
                </div>
                <Button onClick={fetchAlerts} variant="outline" className="gap-2">
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {error && (
                <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-lg p-4 mb-6 text-sm">
                    ⚠️ {error}
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <span className="ml-3 text-muted-foreground">Loading alerts...</span>
                </div>
            ) : alerts.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground">
                    <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-40" />
                    <p className="text-lg font-medium">No alerts found</p>
                    <p className="text-sm mt-1">Run a prediction first to generate alerts.</p>
                </div>
            ) : (
                <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted text-muted-foreground uppercase text-xs font-semibold">
                            <tr>
                                <th className="px-6 py-3">Severity</th>
                                <th className="px-6 py-3">Grid / Zone</th>
                                <th className="px-6 py-3">Risk Type</th>
                                <th className="px-6 py-3">Score</th>
                                <th className="px-6 py-3">Drivers</th>
                                <th className="px-6 py-3">Status</th>
                                <th className="px-6 py-3">Created</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {alerts.map((alert) => {
                                const sev = getSeverityBadge(alert.risk_score);
                                return (
                                    <tr key={alert.id} className="hover:bg-muted/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${sev.cls}`}>
                                                {sev.label}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-xs flex items-center gap-1.5">
                                            <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                                            {alert.grid_id}
                                        </td>
                                        <td className="px-6 py-4 capitalize">{alert.risk_type || 'all'}</td>
                                        <td className="px-6 py-4">
                                            <span className="font-bold">{(alert.risk_score * 100).toFixed(0)}%</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-1">
                                                {(alert.drivers || []).slice(0, 3).map((d, i) => (
                                                    <span key={i} className="bg-muted px-2 py-0.5 rounded text-xs">
                                                        {d}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="flex items-center gap-1.5">
                                                {alert.resolved
                                                    ? <><CheckCircle className="w-4 h-4 text-green-500" /> Resolved</>
                                                    : <><AlertCircle className="w-4 h-4 text-primary" /> Active</>
                                                }
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground text-xs flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {alert.created_at ? new Date(alert.created_at).toLocaleString() : '-'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    <div className="px-6 py-3 bg-muted/30 text-xs text-muted-foreground border-t border-border">
                        Showing {alerts.length} alerts
                    </div>
                </div>
            )}
        </div>
    );
}
