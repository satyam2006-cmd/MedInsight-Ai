import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Dashboard from './dashboard/Dashboard';
import PatientsPage from './pages/Patients';
import ReportsPage from './pages/Reports';
import SharedReport from './pages/SharedReport';
import ProfilePage from './pages/Profile';
import VitalsPage from './pages/Vitals';
import HubPage from './pages/Hub';
import AnalyzerPage from './pages/Analyzer';
import CloudWatchForm from './components/CloudWatchForm';
import ProtectedRoute from './components/ProtectedRoute';
import { hasSupabaseEnv } from './lib/supabaseClient';

function App() {
    if (!hasSupabaseEnv) {
        return (
            <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1.5rem' }}>
                <section className="neo-card brutal-border" style={{ maxWidth: '680px', width: '100%', background: 'white' }}>
                    <h2 style={{ marginBottom: '0.8rem' }}>Frontend Environment Not Configured</h2>
                    <p style={{ marginBottom: '1rem' }}>
                        Create <strong>frontend/.env</strong> and add Supabase public keys so authentication and dashboard routes can load.
                    </p>
                    <div className="panel-soft" style={{ padding: '1rem', background: '#f8fafc', borderRadius: '10px' }}>
                        <p style={{ margin: 0, fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: '#1e293b' }}>
                            VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co{`\n`}
                            VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
                        </p>
                    </div>
                </section>
            </main>
        );
    }

    return (
        <Routes>
            <Route path="/" element={<HubPage />} />
            <Route path="/analyzer" element={<ProtectedRoute><AnalyzerPage /></ProtectedRoute>} />
            <Route path="/signins" element={<CloudWatchForm />} />
            <Route path="/dash" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/patients" element={<ProtectedRoute><PatientsPage /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/vitals" element={<ProtectedRoute><VitalsPage /></ProtectedRoute>} />
            <Route path="/share/:reportId" element={<SharedReport />} />
        </Routes>
    );
}



export default App;
