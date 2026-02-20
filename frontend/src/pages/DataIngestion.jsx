import React, { useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ingestViolationsCSV, ingestComplaintsCSV, ingestSensorsCSV } from '@/lib/api';

const DATASETS = [
    {
        key: 'violations',
        label: 'Violations',
        description: 'Upload violation records CSV (violation_id, type, lat, lon, timestamp, etc.)',
        upload: ingestViolationsCSV,
        icon: '🚨',
    },
    {
        key: 'complaints',
        label: 'Complaints',
        description: 'Upload citizen complaints CSV (complaint_id, type, lat, lon, timestamp, etc.)',
        upload: ingestComplaintsCSV,
        icon: '📢',
    },
    {
        key: 'sensors',
        label: 'Sensor Readings',
        description: 'Upload IoT sensor data CSV (sensor_id, lat, lon, aqi, noise_db, etc.)',
        upload: ingestSensorsCSV,
        icon: '📡',
    },
];

export function DataIngestion() {
    const [results, setResults] = useState({});
    const [uploading, setUploading] = useState({});

    const handleUpload = async (dataset) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv';
        input.onchange = async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;

            setUploading(prev => ({ ...prev, [dataset.key]: true }));
            setResults(prev => ({ ...prev, [dataset.key]: null }));

            try {
                const result = await dataset.upload(file);
                setResults(prev => ({ ...prev, [dataset.key]: { success: true, data: result } }));
            } catch (err) {
                setResults(prev => ({ ...prev, [dataset.key]: { success: false, error: err.message } }));
            } finally {
                setUploading(prev => ({ ...prev, [dataset.key]: false }));
            }
        };
        input.click();
    };

    return (
        <div className="p-8 max-w-5xl mx-auto h-full overflow-y-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight">Data Ingestion</h1>
                <p className="text-muted-foreground mt-1">Upload CSV datasets to populate the ENVISIONGRID backend.</p>
            </div>

            <div className="grid gap-6">
                {DATASETS.map((ds) => {
                    const result = results[ds.key];
                    const isUploading = uploading[ds.key];

                    return (
                        <div key={ds.key} className="bg-card border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between">
                                <div className="flex items-start gap-4">
                                    <div className="text-3xl">{ds.icon}</div>
                                    <div>
                                        <h3 className="text-lg font-semibold">{ds.label}</h3>
                                        <p className="text-sm text-muted-foreground mt-1">{ds.description}</p>
                                    </div>
                                </div>
                                <Button
                                    onClick={() => handleUpload(ds)}
                                    disabled={isUploading}
                                    variant="outline"
                                    className="gap-2 min-w-[140px]"
                                >
                                    {isUploading ? (
                                        <><RefreshCw className="w-4 h-4 animate-spin" /> Uploading...</>
                                    ) : (
                                        <><Upload className="w-4 h-4" /> Upload CSV</>
                                    )}
                                </Button>
                            </div>

                            {result && (
                                <div className={`mt-4 p-4 rounded-lg border text-sm ${result.success
                                        ? 'bg-green-500/5 border-green-500/20 text-green-400'
                                        : 'bg-destructive/5 border-destructive/20 text-destructive'
                                    }`}>
                                    <div className="flex items-center gap-2 font-medium mb-1">
                                        {result.success
                                            ? <><CheckCircle className="w-4 h-4" /> Upload Successful</>
                                            : <><AlertCircle className="w-4 h-4" /> Upload Failed</>
                                        }
                                    </div>
                                    {result.success ? (
                                        <div className="text-xs text-muted-foreground">
                                            Inserted: <strong>{result.data?.inserted ?? '—'}</strong>{' '}
                                            | Skipped: <strong>{result.data?.skipped ?? '—'}</strong>{' '}
                                            | Total: <strong>{result.data?.total ?? '—'}</strong>
                                        </div>
                                    ) : (
                                        <div className="text-xs">{result.error}</div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="mt-8 bg-muted/30 border border-border rounded-lg p-5 text-sm text-muted-foreground">
                <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4" /> CSV Format Guide
                </h4>
                <ul className="list-disc list-inside space-y-1 text-xs">
                    <li><strong>Violations:</strong> violation_id, violation_type, lat, lon, timestamp, description</li>
                    <li><strong>Complaints:</strong> complaint_id, complaint_type, lat, lon, timestamp, description</li>
                    <li><strong>Sensors:</strong> sensor_id, lat, lon, timestamp, aqi, noise_db, water_ph</li>
                </ul>
            </div>
        </div>
    );
}
