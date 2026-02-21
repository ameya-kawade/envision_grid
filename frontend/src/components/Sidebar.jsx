import React from 'react';
import { NavLink } from 'react-router-dom';
import {
    Map,
    AlertTriangle,
    Briefcase,
    Sliders,
    Brain,
    BarChart3,
    ShieldCheck,
    Upload,
    Radar,
    Flame,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
    { icon: Map, label: 'Command Center', path: '/' },
    { icon: Brain, label: 'Predictions', path: '/predictions' },
    { icon: AlertTriangle, label: 'Alerts Center', path: '/alerts' },
    { icon: Flame, label: 'Risk Hotspots', path: '/hotspots' },
    { icon: Briefcase, label: 'Case Management', path: '/cases' },
    { icon: Radar, label: 'Coverage Analysis', path: '/coverage' },
    { icon: Sliders, label: 'Risk Simulation', path: '/policy' },
    { icon: Upload, label: 'Data Ingestion', path: '/ingest' },
    { icon: BarChart3, label: 'Analytics', path: '/analytics' },
];

export function Sidebar() {
    return (
        <aside className="w-64 h-full bg-card border-r border-border flex flex-col z-20">
            <div className="p-6 flex items-center gap-2 border-b border-border">
                <ShieldCheck className="w-8 h-8 text-primary" />
                <div>
                    <h1 className="font-bold text-lg tracking-tight">ENVISIONGRID</h1>
                    <p className="text-xs text-muted-foreground">Risk Intelligence v2.0</p>
                </div>
            </div>

            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                <div className="text-xs font-semibold text-muted-foreground mb-4 uppercase tracking-wider px-2">
                    Operational Layers
                </div>
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-200 group",
                                isActive
                                    ? "bg-primary/10 text-primary font-medium"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )
                        }
                    >
                        <item.icon className="w-5 h-5" />
                        <span>{item.label}</span>
                    </NavLink>
                ))}
            </nav>

            <div className="p-4 border-t border-border">
                <div className="bg-muted/50 rounded-lg p-3 text-xs">
                    <div className="font-medium mb-1">System Status</div>
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Backend</span>
                        <span className="text-green-500 font-bold">LIVE</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                        <span className="text-muted-foreground">API Proxy</span>
                        <span className="text-foreground">:8000</span>
                    </div>
                </div>
            </div>
        </aside>
    );
}
