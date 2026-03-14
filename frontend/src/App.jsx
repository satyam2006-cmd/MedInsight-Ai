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

function App() {
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
