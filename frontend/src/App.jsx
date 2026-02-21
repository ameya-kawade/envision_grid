import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from '@/layouts/MainLayout';

import { CommandCenter } from '@/pages/CommandCenter';
import { AlertsCenter } from '@/pages/AlertsCenter';
import { PolicySimulation } from '@/pages/PolicySimulation';
import { CasesPage } from '@/pages/CasesPage';
import { CoveragePage } from '@/pages/CoveragePage';
import { PredictionsPage } from '@/pages/PredictionsPage';
import { DataIngestion } from '@/pages/DataIngestion';
import { HotspotsPage } from '@/pages/HotspotsPage';
import { AnalyticsPage } from '@/pages/AnalyticsPage';

// Placeholder for analytics
const Analytics = () => (
  <div className="p-8 max-w-7xl mx-auto">
    <h1 className="text-3xl font-bold tracking-tight">Leadership Analytics</h1>
    <p className="text-muted-foreground mt-2">Coming soon — aggregate trends and executive dashboards.</p>
  </div>
);

function App() {
  return (
    <Router>
      <MainLayout>
        <Routes>
          <Route path="/" element={<CommandCenter />} />
          <Route path="/predictions" element={<PredictionsPage />} />
          <Route path="/alerts" element={<AlertsCenter />} />
          <Route path="/hotspots" element={<HotspotsPage />} />
          <Route path="/cases" element={<CasesPage />} />
          <Route path="/coverage" element={<CoveragePage />} />
          <Route path="/policy" element={<PolicySimulation />} />
          <Route path="/ingest" element={<DataIngestion />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </MainLayout>
    </Router>
  );
}

export default App;
