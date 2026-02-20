import React from 'react';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';

export function MainLayout({ children }) {
    return (
        <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
            <Sidebar />
            <div className="flex flex-col flex-1 h-full overflow-hidden">
                <Topbar />
                <main className="flex-1 relative overflow-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}
