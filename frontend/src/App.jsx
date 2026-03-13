import React, { useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { Upload, FileText, AlertCircle, CheckCircle2, Languages, Activity, Loader2, Stethoscope, Search, Volume2, VolumeX } from 'lucide-react';
import { extractText } from './ocr-engine/services/hybridService.js';
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

import { API_BASE_URL } from './lib/config';

const Logo = () => (
    <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--primary)',
        border: '4px solid black',
        padding: '0.8rem',
        boxShadow: '4px 4px 0px black',
        marginBottom: '1rem'
    }}>
        <Stethoscope size={48} strokeWidth={3} />
    </div>
);

function App() {
    return (
        <Routes>
            <Route path="/" element={<HubPage />} />
            <Route path="/analyzer" element={<AnalyzerPage />} />
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
