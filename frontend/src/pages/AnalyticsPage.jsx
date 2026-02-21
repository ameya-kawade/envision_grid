import React, { useState, useEffect } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';
import { TrendingUp, AlertCircle, Briefcase, Activity, RefreshCw, Map } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getAnalyticsSummary } from '@/lib/api';

const RISK_COLORS = {
    'Low (<0.4)': '#22c55e',
    'Medium (0.4-0.6)': '#eab308',
    'High (0.6-0.8)': '#f97316',
    'Critical (>0.8)': '#ef4444',
};
const PIE_COLORS = ['#22c55e', '#eab308', '#f97316', '#ef4444'];
const BAR_COLOR = '#6366f1';

function StatCard({ icon: Icon, label, value, sub, color = 'text-primary' }) {
    return (
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex items-start gap-4">
            <div className={`p-2 rounded-lg bg-muted ${color}`}>
                <Icon className="w-5 h-5" />
            </div>
            <div>
                <p className="text-muted-foreground text-sm">{label}</p>
                <p className="text-2xl font-bold">{value}</p>
                {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
            </div>
        </div>
    );
}

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-card border border-border rounded-lg p-3 text-sm shadow-lg">
                <p className="font-semibold mb-1">{label}</p>
                {payload.map((p, i) => (
                    <p key={i} style={{ color: p.color || p.fill }}>
                        {p.name}: <span className="font-bold">{p.value}</span>
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

export function AnalyticsPage() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await getAnalyticsSummary();
            setData(result);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    if (loading) return (
        <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="ml-3 text-muted-foreground">Loading analytics...</span>
        </div>
    );

    if (error) return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-lg p-4">⚠️ {error}</div>
        </div>
    );

    const { totals, risk_by_grid, violations_by_type, risk_distribution, alerts_by_day, risk_type_breakdown } = data || {};

    return (
        <div className="p-8 max-w-7xl mx-auto h-full overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
                    <p className="text-muted-foreground mt-1">Aggregate trends and insights from MongoDB.</p>
                </div>
                <Button onClick={fetchData} variant="outline" className="gap-2">
                    <RefreshCw className="w-4 h-4" /> Refresh
                </Button>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                <StatCard icon={Map} label="Grids Monitored" value={totals?.grids_monitored ?? 0} />
                <StatCard icon={TrendingUp} label="Total Violations" value={totals?.total_violations ?? 0} />
                <StatCard icon={Activity} label="Total Complaints" value={totals?.total_complaints ?? 0} />
                <StatCard icon={AlertCircle} label="Total Alerts" value={totals?.total_alerts ?? 0} color="text-orange-500" />
                <StatCard icon={AlertCircle} label="Active Alerts" value={totals?.active_alerts ?? 0} color="text-destructive" sub="Unresolved" />
                <StatCard icon={Briefcase} label="Open Cases" value={totals?.open_cases ?? 0} color="text-blue-500" />
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* 1. Top Risk Locations */}
                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                    <h2 className="text-base font-semibold mb-4">Top 10 Risk Locations</h2>
                    {risk_by_grid?.length > 0 ? (
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={risk_by_grid} layout="vertical" margin={{ left: 90 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                                <XAxis type="number" domain={[0, 1]} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
                                <YAxis type="category" dataKey="grid_id" tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} width={88} />
                                <Tooltip content={<CustomTooltip />} formatter={(v) => [`${(v * 100).toFixed(1)}%`, 'Risk Score']} />
                                <Bar dataKey="risk_score" name="Risk Score" fill={BAR_COLOR} radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <p className="text-muted-foreground text-sm text-center py-10">No prediction data yet. Run a prediction first.</p>}
                </div>

                {/* 2. Risk Distribution Pie */}
                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                    <h2 className="text-base font-semibold mb-4">Risk Level Distribution</h2>
                    {risk_distribution?.some(d => d.value > 0) ? (
                        <ResponsiveContainer width="100%" height={280}>
                            <PieChart>
                                <Pie
                                    data={risk_distribution}
                                    dataKey="value"
                                    nameKey="name"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={3}
                                    label={({ name, value }) => value > 0 ? `${value}` : ''}
                                >
                                    {risk_distribution.map((entry, index) => (
                                        <Cell key={index} fill={RISK_COLORS[entry.name] || PIE_COLORS[index % PIE_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{ fontSize: '12px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : <p className="text-muted-foreground text-sm text-center py-10">No prediction data yet.</p>}
                </div>

                {/* 3. Violations by Type */}
                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                    <h2 className="text-base font-semibold mb-4">Violations by Type</h2>
                    {violations_by_type?.length > 0 ? (
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={violations_by_type} margin={{ bottom: 30 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                <XAxis dataKey="type" tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} angle={-30} textAnchor="end" />
                                <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="count" name="Count" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <p className="text-muted-foreground text-sm text-center py-10">No violation data yet.</p>}
                </div>

                {/* 4. Alerts per Day */}
                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                    <h2 className="text-base font-semibold mb-4">Alerts — Last 7 Days</h2>
                    {alerts_by_day?.length > 0 ? (
                        <ResponsiveContainer width="100%" height={280}>
                            <LineChart data={alerts_by_day}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                <XAxis dataKey="date" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
                                <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} allowDecimals={false} />
                                <Tooltip content={<CustomTooltip />} />
                                <Line type="monotone" dataKey="alerts" name="Alerts" stroke="#f97316" strokeWidth={2} dot={{ fill: '#f97316', strokeWidth: 2 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground text-sm">
                            <AlertCircle className="w-8 h-8 mb-2 opacity-40" />
                            No alert data for the last 7 days.
                        </div>
                    )}
                </div>

                {/* 5. Risk Type Breakdown */}
                {risk_type_breakdown?.length > 0 && (
                    <div className="bg-card border border-border rounded-xl p-6 shadow-sm lg:col-span-2">
                        <h2 className="text-base font-semibold mb-4">Predictions by Risk Type</h2>
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={risk_type_breakdown}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                <XAxis dataKey="type" tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} />
                                <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} allowDecimals={false} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="count" name="Grids" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        </div>
    );
}
