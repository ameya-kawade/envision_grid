import React, { useState, useEffect } from 'react';
import { Shield, RefreshCw, MapPin, Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getCoverage } from '@/lib/api';

export function CoveragePage() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('ALL');

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await getCoverage();
            setData(Array.isArray(res) ? res : []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const filtered = filter === 'ALL' ? data : data.filter(d => d.coverage_status === filter);

    const statusCounts = {
        ALL: data.length,
        SENSOR_COVERED: data.filter(d => d.coverage_status === 'SENSOR_COVERED').length,
        ADEQUATE: data.filter(d => d.coverage_status === 'ADEQUATE').length,
        LOW_DATA: data.filter(d => d.coverage_status === 'LOW_DATA').length,
        NO_DATA: data.filter(d => d.coverage_status === 'NO_DATA').length,
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'SENSOR_COVERED': return { cls: 'bg-green-500/10 text-green-500', icon: Wifi };
            case 'ADEQUATE': return { cls: 'bg-blue-500/10 text-blue-500', icon: Shield };
            case 'LOW_DATA': return { cls: 'bg-yellow-500/10 text-yellow-500', icon: AlertTriangle };
            case 'NO_DATA': return { cls: 'bg-muted text-muted-foreground', icon: WifiOff };
            default: return { cls: 'bg-muted text-muted-foreground', icon: Shield };
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto h-full overflow-y-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Coverage Analysis</h1>
                    <p className="text-muted-foreground mt-1">Data coverage and sensor deployment across all grid zones.</p>
                </div>
                <Button onClick={fetchData} variant="outline" className="gap-2">
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </Button>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 mb-6 flex-wrap">
                {Object.entries(statusCounts).map(([key, count]) => (
                    <button
                        key={key}
                        onClick={() => setFilter(key)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${filter === key
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted'
                            }`}
                    >
                        {key.replace('_', ' ')} ({count})
                    </button>
                ))}
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                {[
                    { label: 'Sensor Covered', value: statusCounts.SENSOR_COVERED, color: 'text-green-500', bg: 'bg-green-500/5 border-green-500/20' },
                    { label: 'Adequate', value: statusCounts.ADEQUATE, color: 'text-blue-500', bg: 'bg-blue-500/5 border-blue-500/20' },
                    { label: 'Low Data', value: statusCounts.LOW_DATA, color: 'text-yellow-500', bg: 'bg-yellow-500/5 border-yellow-500/20' },
                    { label: 'No Data', value: statusCounts.NO_DATA, color: 'text-muted-foreground', bg: 'bg-muted/50 border-border' },
                ].map(({ label, value, color, bg }) => (
                    <div key={label} className={`rounded-lg p-4 border ${bg}`}>
                        <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
                        <div className={`text-3xl font-bold mt-1 ${color}`}>{value}</div>
                    </div>
                ))}
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <span className="ml-3 text-muted-foreground">Loading coverage data...</span>
                </div>
            ) : (
                <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted text-muted-foreground uppercase text-xs font-semibold">
                            <tr>
                                <th className="px-5 py-3">Grid Zone</th>
                                <th className="px-5 py-3">Status</th>
                                <th className="px-5 py-3">Violations</th>
                                <th className="px-5 py-3">Complaints</th>
                                <th className="px-5 py-3">Sensor Readings</th>
                                <th className="px-5 py-3">Total Signals</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filtered.map((row) => {
                                const badge = getStatusBadge(row.coverage_status);
                                const Icon = badge.icon;
                                return (
                                    <tr key={row.grid_id} className="hover:bg-muted/50 transition-colors">
                                        <td className="px-5 py-3 font-mono text-xs flex items-center gap-1.5">
                                            <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                                            {row.grid_id}
                                        </td>
                                        <td className="px-5 py-3">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>
                                                <Icon className="w-3 h-3" />
                                                {row.coverage_status.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 text-center">{row.violations}</td>
                                        <td className="px-5 py-3 text-center">{row.complaints}</td>
                                        <td className="px-5 py-3 text-center">{row.sensor_readings}</td>
                                        <td className="px-5 py-3 text-center font-semibold">{row.total_signals}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    <div className="px-5 py-3 bg-muted/30 text-xs text-muted-foreground border-t border-border">
                        Showing {filtered.length} of {data.length} zones
                    </div>
                </div>
            )}
        </div>
    );
}
