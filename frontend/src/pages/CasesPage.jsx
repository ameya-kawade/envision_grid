import React, { useState, useEffect } from 'react';
import { Briefcase, Plus, RefreshCw, Clock, User, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getCases, createCase, updateCase, getAlerts } from '@/lib/api';

export function CasesPage() {
    const [cases, setCases] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [newCase, setNewCase] = useState({ alert_id: '', assigned_to: '', notes: '' });
    const [creating, setCreating] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [c, a] = await Promise.all([getCases(), getAlerts()]);
            setCases(Array.isArray(c) ? c : []);
            setAlerts(Array.isArray(a) ? a : []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleCreate = async () => {
        if (!newCase.alert_id) return;
        setCreating(true);
        try {
            await createCase(newCase);
            setShowCreate(false);
            setNewCase({ alert_id: '', assigned_to: '', notes: '' });
            fetchData();
        } catch (e) {
            alert('Failed to create case: ' + e.message);
        } finally {
            setCreating(false);
        }
    };

    const handleStatusUpdate = async (caseId, newStatus) => {
        try {
            await updateCase(caseId, { status: newStatus });
            fetchData();
        } catch (e) {
            console.error(e);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'OPEN': return 'bg-blue-500/10 text-blue-500';
            case 'IN_PROGRESS': return 'bg-yellow-500/10 text-yellow-500';
            case 'RESOLVED': return 'bg-green-500/10 text-green-500';
            case 'CLOSED': return 'bg-muted text-muted-foreground';
            default: return 'bg-muted text-muted-foreground';
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto h-full overflow-y-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Case Management</h1>
                    <p className="text-muted-foreground mt-1">Track and manage enforcement cases linked to alerts.</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={fetchData} variant="outline" className="gap-2">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                    </Button>
                    <Button onClick={() => setShowCreate(!showCreate)} className="gap-2">
                        <Plus className="w-4 h-4" /> New Case
                    </Button>
                </div>
            </div>

            {/* Create Case Form */}
            {showCreate && (
                <div className="bg-card border border-border rounded-lg p-6 mb-6 shadow-sm">
                    <h3 className="text-lg font-semibold mb-4">Create New Case</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="text-sm font-medium mb-1 block">Alert ID</label>
                            <select
                                value={newCase.alert_id}
                                onChange={(e) => setNewCase({ ...newCase, alert_id: e.target.value })}
                                className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm"
                            >
                                <option value="">Select an alert...</option>
                                {alerts.map((a) => (
                                    <option key={a.id} value={a.id}>
                                        {a.grid_id} — {(a.risk_score * 100).toFixed(0)}% risk
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1 block">Assigned To</label>
                            <input
                                type="text"
                                placeholder="Inspector name..."
                                value={newCase.assigned_to}
                                onChange={(e) => setNewCase({ ...newCase, assigned_to: e.target.value })}
                                className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1 block">Notes</label>
                            <input
                                type="text"
                                placeholder="Additional notes..."
                                value={newCase.notes}
                                onChange={(e) => setNewCase({ ...newCase, notes: e.target.value })}
                                className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm"
                            />
                        </div>
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                        <Button onClick={handleCreate} disabled={creating || !newCase.alert_id}>
                            {creating ? 'Creating...' : 'Create Case'}
                        </Button>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <span className="ml-3 text-muted-foreground">Loading cases...</span>
                </div>
            ) : cases.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground">
                    <Briefcase className="w-12 h-12 mx-auto mb-4 opacity-40" />
                    <p className="text-lg font-medium">No cases yet</p>
                    <p className="text-sm mt-1">Create a case from an existing alert.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {cases.map((c) => (
                        <div key={c.id} className="bg-card border border-border rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(c.status)}`}>
                                            {c.status}
                                        </span>
                                        <span className="text-xs font-mono text-muted-foreground">Case #{(c.id || '').slice(-6)}</span>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                            <FileText className="w-3.5 h-3.5" /> Alert: {(c.alert_id || '').slice(-8)}
                                        </span>
                                        {c.assigned_to && (
                                            <span className="flex items-center gap-1">
                                                <User className="w-3.5 h-3.5" /> {c.assigned_to}
                                            </span>
                                        )}
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3.5 h-3.5" /> {c.created_at ? new Date(c.created_at).toLocaleDateString() : '-'}
                                        </span>
                                    </div>
                                    {c.notes && <p className="text-sm mt-2 text-foreground/80">{c.notes}</p>}
                                </div>
                                <div className="flex gap-2">
                                    {c.status === 'OPEN' && (
                                        <Button size="sm" variant="outline" onClick={() => handleStatusUpdate(c.id, 'IN_PROGRESS')}>
                                            Start
                                        </Button>
                                    )}
                                    {c.status === 'IN_PROGRESS' && (
                                        <Button size="sm" variant="outline" onClick={() => handleStatusUpdate(c.id, 'RESOLVED')}>
                                            Resolve
                                        </Button>
                                    )}
                                    {c.status === 'RESOLVED' && (
                                        <Button size="sm" variant="outline" onClick={() => handleStatusUpdate(c.id, 'CLOSED')}>
                                            Close
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
