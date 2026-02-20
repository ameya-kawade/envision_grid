import React from 'react';
import { Bell, Search, User } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Topbar() {
    return (
        <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-6 z-10 w-full">
            <div className="flex items-center gap-4">
                {/* City Selector */}
                <div className="flex items-center gap-2 text-sm font-medium">
                    <span className="text-muted-foreground">City:</span>
                    <select className="bg-transparent border-none focus:ring-0 font-bold cursor-pointer">
                        <option>San Francisco, CA</option>
                        <option>New York, NY</option>
                        <option>Chicago, IL</option>
                    </select>
                </div>

                <div className="h-4 w-[1px] bg-border mx-2"></div>

                {/* Horizon Toggle */}
                <div className="flex bg-muted rounded-md p-1">
                    {['24h', '72h', '7d'].map((horizon) => (
                        <button
                            key={horizon}
                            className={`px-3 py-1 text-xs font-medium rounded-sm transition-all ${horizon === '24h'
                                    ? 'bg-background shadow-sm text-foreground'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            {horizon}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex items-center gap-3">
                <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search zones, alerts..."
                        className="pl-9 pr-4 py-1.5 text-sm bg-muted rounded-full w-64 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                </div>

                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="w-5 h-5 text-muted-foreground" />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full border-2 border-card"></span>
                </Button>

                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                    <User className="w-4 h-4 text-primary" />
                </div>
            </div>
        </header>
    );
}
