import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Clock, RefreshCw, MapPin, Briefcase, BookOpen, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getAlerts, createCase, generatePlaybook } from '@/lib/api';

// ── Playbook Modal ────────────────────────────────────────────────────
function PlaybookModal({ alert, onClose }) {
    const [loading, setLoading] = useState(true);
    const [playbook, setPlaybook] = useState('');
    const [error, setError] = useState(null);

    useEffect(() => {
        generatePlaybook({
            grid_id: alert.grid_id,
            risk_score: alert.risk_score,
            confidence: alert.confidence || 0.7,
            drivers: alert.drivers || [],
        })
            .then(data => setPlaybook(data.playbook || ''))
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    const formatPlaybook = (text) =>
        text.split('\n').map((line, i) => {
            if (line.startsWith('1.') || line.startsWith('2.') || line.startsWith('3.') ||
                line.startsWith('4.') || line.startsWith('5.') || line.startsWith('6.')) {
                return <p key={i} className="font-semibold text-primary mt-4 mb-1">{line}</p>;
            }
            if (line.startsWith('**') && line.endsWith('**')) {
                return <p key={i} className="font-semibold text-foreground mt-4 mb-1">{line.replace(/\*\*/g, '')}</p>;
            }
            if (line.startsWith('- ') || line.startsWith('• ')) {
                return <li key={i} className="ml-4 text-sm text-muted-foreground">{line.slice(2)}</li>;
            }
            if (line.trim() === '') return <br key={i} />;
            return <p key={i} className="text-sm text-foreground/90">{line}</p>;
        });

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
                {/* Header */}
                <div className="flex items-start justify-between p-6 border-b border-border">
                    <div>
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <BookOpen className="w-5 h-5 text-primary" />
                            AI Remediation Playbook
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Grid: <code className="font-mono bg-muted px-1 rounded">{alert.grid_id}</code>
                            &nbsp;·&nbsp;Risk: <span className="font-semibold text-destructive">{(alert.risk_score * 100).toFixed(0)}%</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading && (
                        <div className="flex items-center justify-center py-12 gap-3 text-muted-foreground">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Generating AI playbook via OpenRouter…
                        </div>
                    )}
                    {error && (
                        <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-lg p-4 text-sm">
                            ⚠️ {error}
                        </div>
                    )}
                    {!loading && !error && playbook && (
                        <div className="prose prose-sm max-w-none">
                            <ul className="list-none space-y-1">
                                {formatPlaybook(playbook)}
                            </ul>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-border flex justify-end">
                    <Button variant="outline" onClick={onClose}>Close</Button>
                </div>
            </div>
        </div>
    );
}

// ── Add to Case Modal ─────────────────────────────────────────────────
function AddToCaseModal({ alert, onClose, onSuccess }) {
    const [assignedTo, setAssignedTo] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async () => {
        setLoading(true);
        setError(null);
        try {
            await createCase({ alert_id: alert.id, assigned_to: assignedTo, notes });
            onSuccess();
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md">
                <div className="flex items-start justify-between p-6 border-b border-border">
                    <div>
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <Briefcase className="w-5 h-5 text-primary" />
                            Add Alert to Case
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Grid: <code className="font-mono bg-muted px-1 rounded">{alert.grid_id}</code>
                        </p>
                    </div>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div>
                        <label className="text-sm font-medium mb-1.5 block">Assign To</label>
                        <input
                            type="text"
                            placeholder="Inspector / team name…"
                            value={assignedTo}
                            onChange={(e) => setAssignedTo(e.target.value)}
                            className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium mb-1.5 block">Notes <span className="text-muted-foreground">(optional)</span></label>
                        <textarea
                            rows={3}
                            placeholder="Investigation notes, priority, context…"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                    </div>
                    {error && <p className="text-destructive text-sm">⚠️ {error}</p>}
                </div>

                <div className="p-4 border-t border-border flex justify-end gap-2">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={loading} className="gap-2">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Briefcase className="w-4 h-4" />}
                        {loading ? 'Creating…' : 'Create Case'}
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ── Main AlertsCenter ─────────────────────────────────────────────────
export function AlertsCenter() {
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [playbookAlert, setPlaybookAlert] = useState(null);
    const [caseAlert, setCaseAlert] = useState(null);

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
                                <th className="px-4 py-3">Severity</th>
                                <th className="px-4 py-3">Grid / Zone</th>
                                <th className="px-4 py-3">Risk Type</th>
                                <th className="px-4 py-3">Score</th>
                                <th className="px-4 py-3">Drivers</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Created</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {alerts.map((alert) => {
                                const sev = getSeverityBadge(alert.risk_score);
                                return (
                                    <tr key={alert.id} className="hover:bg-muted/50 transition-colors">
                                        <td className="px-4 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${sev.cls}`}>
                                                {sev.label}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 font-mono text-xs">
                                            <span className="flex items-center gap-1.5">
                                                <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                                {alert.grid_id}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 capitalize">{alert.risk_type || 'all'}</td>
                                        <td className="px-4 py-4">
                                            <span className="font-bold">{(alert.risk_score * 100).toFixed(0)}%</span>
                                        </td>
                                        <td className="px-4 py-4 max-w-[220px]">
                                            <div className="flex flex-wrap gap-1">
                                                {(alert.drivers || []).slice(0, 2).map((d, i) => (
                                                    <span key={i} className="bg-muted px-2 py-0.5 rounded text-xs line-clamp-1">
                                                        {d.length > 40 ? d.slice(0, 40) + '…' : d}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className="flex items-center gap-1.5">
                                                {alert.resolved
                                                    ? <><CheckCircle className="w-4 h-4 text-green-500" /> Resolved</>
                                                    : <><AlertCircle className="w-4 h-4 text-primary" /> Active</>
                                                }
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-muted-foreground text-xs">
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {alert.created_at ? new Date(alert.created_at).toLocaleString() : '-'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex items-center justify-end gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="gap-1.5 text-xs h-8"
                                                    onClick={() => setCaseAlert(alert)}
                                                >
                                                    <Briefcase className="w-3.5 h-3.5" />
                                                    Add to Case
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    className="gap-1.5 text-xs h-8"
                                                    onClick={() => setPlaybookAlert(alert)}
                                                >
                                                    <BookOpen className="w-3.5 h-3.5" />
                                                    Playbook
                                                </Button>
                                            </div>
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

            {/* Modals */}
            {playbookAlert && (
                <PlaybookModal
                    alert={playbookAlert}
                    onClose={() => setPlaybookAlert(null)}
                />
            )}
            {caseAlert && (
                <AddToCaseModal
                    alert={caseAlert}
                    onClose={() => setCaseAlert(null)}
                    onSuccess={fetchAlerts}
                />
            )}
        </div>
    );
}
