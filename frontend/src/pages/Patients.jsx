import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { UserPlus, Loader2, Phone, User, Activity, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { API_BASE_URL } from '../lib/config';
import { useNavigate } from 'react-router-dom';
import GlobalSidebar from '../components/GlobalSidebar';


export default function PatientsPage() {
    const navigate = useNavigate();
    const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 768px)').matches);
    const [patientId, setPatientId] = useState('');
    const [patientName, setPatientName] = useState('');
    const [patientNumber, setPatientNumber] = useState('');
    const [language, setLanguage] = useState('');
    const [preferredLanguage, setPreferredLanguage] = useState('');
    const [report, setReport] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    // Maintain a list of added patients
    const [patientsList, setPatientsList] = useState([]);

    useEffect(() => {
        const loadPreferredLanguage = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                const preferred = user?.user_metadata?.preferred_language || user?.user_metadata?.language || '';
                setPreferredLanguage(preferred);
                if (preferred) setLanguage(preferred);
            } catch (_) {
                // Manual entry remains available.
            }
        };
        loadPreferredLanguage();
    }, []);

    useEffect(() => {
        const media = window.matchMedia('(max-width: 768px)');
        const onChange = (event) => setIsMobile(event.matches);
        media.addEventListener('change', onChange);
        return () => media.removeEventListener('change', onChange);
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!language.trim()) {
            alert('Set a report language or configure preferred language in profile.');
            return;
        }
        setIsLoading(true);

        try {
            // Get currently logged in hospital's JWT token
            const { data: { session }, error: authError } = await supabase.auth.getSession();
            if (authError || !session) {
                alert('You must be logged in as a hospital to add patients.');
                setIsLoading(false);
                return;
            }

            const formData = new FormData();
            formData.append('patient_id', patientId);
            formData.append('patient_name', patientName);
            formData.append('patient_number', patientNumber);
            formData.append('language', language);
            formData.append('report_file', report);

            // API URL assumes backend runs on port 8000
            // Using centralized API URL
            const apiUrl = API_BASE_URL;

            const response = await fetch(`${apiUrl}/patients`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: formData
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || 'Failed to analyze patient report');
            }

            const result = await response.json();

            // Add new patient to the local list (or re-fetch from backend)
            const newPatient = {
                id: patientId, // Use the user's input ID
                name: result.patient.patient_name || patientName,
                number: result.patient.patient_number || patientNumber,
                reportName: report.name,
                dateAdded: new Date().toLocaleDateString(),
                status: 'Analyzed',
                reports: [{ id: result.report_summary?.id }]
            };

            setPatientsList([...patientsList, newPatient]);
            alert('Patient record and AI report saved efficiently!');

            // Reset fields
            setPatientId('');
            setPatientName('');
            setPatientNumber('');
            setLanguage(preferredLanguage || '');
            setReport(null);
            document.getElementById('report').value = '';

        } catch (error) {
            console.error("Error submitting patient data:", error);
            alert(`Error: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };


    return (
        <div className="app-shell">
            <GlobalSidebar />

            <main className="app-main app-main-lg mobile-page-shell">
                <button
                    onClick={() => navigate('/')}
                    className="staggered-enter app-back-btn"
                >
                    <ArrowLeft size={16} />
                    BACK TO HUB
                </button>
                <div className="page-container">
                <header className="staggered-enter hero-unboxed" style={{ marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                        <div style={{ 
                            width: '64px', 
                            height: '64px', 
                            background: 'rgba(200, 77, 47, 0.1)', 
                            borderRadius: '16px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            color: 'var(--primary)'
                        }}>
                            <UserPlus size={32} />
                        </div>
                        <div>
                            <h1 className="page-hero-title" style={{ fontWeight: 400, letterSpacing: '-2px', color: '#1e293b', margin: 0 }}>
                                Patient <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Registry</span>
                            </h1>
                            <p style={{ fontSize: 'clamp(0.95rem, 3.2vw, 1.2rem)', color: '#64748b', marginTop: '0.2rem' }}>
                                Register patients and process clinical documentation seamlessly.
                            </p>
                        </div>
                    </div>
                </header>

                <div className="module-content patients-grid" style={{ gap: '1.25rem' }}>
                {/* Left Side: Form */}
                <form onSubmit={handleSubmit} className="staggered-enter" style={{ display: 'grid', gap: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: '#1e293b', fontWeight: 500 }}>Register New Patient</h3>
                    <div className="neo-card brutal-border" style={{ padding: 'clamp(1rem, 3vw, 2rem)', display: 'grid', gap: '1rem' }}>
                        <div style={{ display: 'grid', gap: '0.5rem' }}>
                            <label htmlFor="patientId" style={{ fontSize: '0.9rem', fontWeight: 600, color: '#64748b' }}>Patient ID</label>
                            <input
                                id="patientId"
                                type="text"
                                value={patientId}
                                onChange={(e) => setPatientId(e.target.value)}
                                required
                                className="input-v2"
                                style={{ padding: '0.9rem 1.2rem', borderRadius: '12px' }}
                            />
                        </div>
                        <div style={{ display: 'grid', gap: '0.5rem' }}>
                            <label htmlFor="patientName" style={{ fontSize: '0.9rem', fontWeight: 600, color: '#64748b' }}>Full Name</label>
                            <input
                                id="patientName"
                                type="text"
                                value={patientName}
                                onChange={(e) => setPatientName(e.target.value)}
                                required
                                className="input-v2"
                                style={{ padding: '0.9rem 1.2rem', borderRadius: '12px' }}
                            />
                        </div>
                        <div style={{ display: 'grid', gap: '0.5rem' }}>
                            <label htmlFor="patientNumber" style={{ fontSize: '0.9rem', fontWeight: 600, color: '#64748b' }}>Contact Number</label>
                            <input
                                id="patientNumber"
                                type="tel"
                                value={patientNumber}
                                onChange={(e) => setPatientNumber(e.target.value)}
                                required
                                className="input-v2"
                                style={{ padding: '0.9rem 1.2rem', borderRadius: '12px' }}
                            />
                        </div>
                        <div style={{ display: 'grid', gap: '0.5rem' }}>
                            <label htmlFor="language" style={{ fontSize: '0.9rem', fontWeight: 600, color: '#64748b' }}>Preferred Report Language</label>
                            <input
                                id="language"
                                type="text"
                                value={language}
                                onChange={(e) => setLanguage(e.target.value)}
                                required
                                placeholder="Hindi, Telugu, Spanish..."
                                className="input-v2"
                                style={{ padding: '0.9rem 1.2rem', borderRadius: '12px' }}
                            />
                        </div>
                        <div style={{ display: 'grid', gap: '0.5rem' }}>
                            <label htmlFor="report" style={{ fontSize: '0.9rem', fontWeight: 600, color: '#64748b' }}>Initial Clinical Document</label>
                            <input
                                id="report"
                                type="file"
                                accept=".jpg,.jpeg,.pdf,.docx"
                                onChange={(e) => setReport(e.target.files[0])}
                                required
                                className="input-v2"
                                style={{ padding: '0.9rem 1.2rem', borderRadius: '12px' }}
                            />
                        </div>
                        <button type="submit" disabled={isLoading} className="neo-btn" style={{ 
                            background: '#1e293b', 
                            color: 'white', 
                            padding: '1.2rem', 
                            width: '100%', 
                            fontSize: '1.1rem', 
                            borderRadius: '16px',
                            marginTop: '1rem',
                            textTransform: 'none'
                        }}>
                            {isLoading ? <Loader2 className="animate-spin" /> : 'Register & Analyze'}
                        </button>
                    </div>
                </form>

                {/* Right Side: Table */}
                <div className="neo-card brutal-border panel-soft patients-entries-panel" style={{ padding: 'clamp(1rem, 3vw, 1.6rem)', background: 'white' }}>
                    <h3 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        Recent Entries
                        <span style={{ fontSize: '1rem', background: 'var(--accent)', color: 'white', padding: '0.2rem 0.6rem', borderRadius: '12px' }}>
                            {patientsList.length} Total
                        </span>
                    </h3>

                    {isMobile ? (
                        <div className="patients-mobile-list">
                            {patientsList.length === 0 ? (
                                <div className="patients-mobile-empty">No patients added yet. Fill out the form to add an entry.</div>
                            ) : (
                                patientsList.map((patient, index) => (
                                    <article key={index} className="patients-mobile-card brutal-border">
                                        <div className="patients-mobile-card-top">
                                            <div>
                                                <div className="patients-mobile-label">Patient ID</div>
                                                <h4>{patient.id}</h4>
                                            </div>
                                            <span className="badge accent-bg">{patient.reports?.length || 0} Reports</span>
                                        </div>
                                        <p><strong>Name:</strong> {patient.name}</p>
                                        <p><strong>Contact:</strong> {patient.number}</p>
                                        <p><strong>Document:</strong> {patient.reportName}</p>
                                        <p><strong>Date:</strong> {patient.dateAdded}</p>
                                        <button
                                            onClick={() => navigate(`/vitals?patient=${encodeURIComponent(patient.id)}`)}
                                            className="neo-btn"
                                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.55rem 0.7rem', background: 'var(--secondary)', color: 'white', fontWeight: 700, fontSize: '0.78rem', width: '100%' }}
                                        >
                                            <Activity size={13} /> Take Vitals
                                        </button>
                                    </article>
                                ))
                            )}
                        </div>
                    ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="table-v2">
                            <thead>
                                <tr>
                                    <th style={{ padding: '1rem', fontWeight: 800 }}>ID</th>
                                    <th style={{ padding: '1rem', fontWeight: 800 }}>Name</th>
                                    <th style={{ padding: '1rem', fontWeight: 800 }}>Contact</th>
                                    <th style={{ padding: '1rem', fontWeight: 800 }}>Document</th>
                                    <th style={{ padding: '1rem', fontWeight: 800 }}>Date</th>
                                    <th style={{ padding: '1rem', fontWeight: 800 }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {patientsList.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: '#666', fontStyle: 'italic' }}>
                                            No patients added yet. Fill out the form to add an entry.
                                        </td>
                                    </tr>
                                ) : (
                                    patientsList.map((patient, index) => (
                                        <tr key={index}>
                                            <td style={{ padding: '1rem', fontWeight: 600 }}>{patient.id}</td>
                                            <td style={{ padding: '1rem' }}>{patient.name}</td>
                                            <td style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                                <span>{patient.number}</span>
                                                <span className="badge accent-bg" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                    <CheckCircle2 size={12} /> {patient.reports?.length || 0} Reports
                                                </span>
                                            </td>
                                            <td style={{ padding: '1rem', color: 'var(--primary)', fontWeight: 600 }}>
                                                {patient.reportName}
                                            </td>
                                            <td style={{ padding: '1rem', color: '#666' }}>{patient.dateAdded}</td>
                                            <td style={{ padding: '1rem' }}>
                                                <button
                                                    onClick={() => navigate(`/vitals?patient=${encodeURIComponent(patient.id)}`)}
                                                    className="neo-btn"
                                                    style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.7rem', background: 'var(--secondary)', color: 'white', fontWeight: 700, fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                                                >
                                                    <Activity size={13} /> Take Vitals
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    )}
                </div>
                </div>
                </div>
            </main>
        </div>
    );
}
