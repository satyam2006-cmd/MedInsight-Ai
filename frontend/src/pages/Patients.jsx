import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { UserPlus, Loader2, Phone, User, Activity, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { API_BASE_URL } from '../lib/config';
import { useNavigate } from 'react-router-dom';


export default function PatientsPage() {
    const navigate = useNavigate();
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
        <div className="v2-shell" role="main" aria-label="Patient registry workspace">
            <aside className="v2-side staggered-enter" style={{ display: 'grid', gap: '1rem' }}>
                <div>
                    <div className="kicker" style={{ color: '#d1e4de' }}>Module</div>
                    <h2 style={{ color: '#f8f3ea', marginTop: '0.7rem', fontSize: '1.7rem' }}>Patient Registry</h2>
                    <p style={{ color: '#d6ded3', marginTop: '0.55rem' }}>
                        Add records, attach reports, and route patients directly to contactless vitals.
                    </p>
                </div>
                <button type="button" className="neo-btn" onClick={() => navigate('/')} style={{ width: '100%', justifyContent: 'space-between', background: 'rgba(235,241,236,0.13)', borderColor: '#cde0d6', color: '#f8f3ea' }}>
                    Back to Mission Control
                </button>
                <button type="button" className="neo-btn" onClick={() => navigate('/analyzer')} style={{ width: '100%', justifyContent: 'space-between', background: 'rgba(235,241,236,0.13)', borderColor: '#cde0d6', color: '#f8f3ea' }}>
                    Open Report Forge
                </button>
                <button type="button" className="neo-btn" onClick={() => navigate('/reports')} style={{ width: '100%', justifyContent: 'space-between', background: 'rgba(235,241,236,0.13)', borderColor: '#cde0d6', color: '#f8f3ea' }}>
                    Open Reports Layer
                </button>
            </aside>

            <section className="v2-main">
                <header className="neo-card staggered-enter">
                    <h1 style={{ fontSize: '2.2rem', marginBottom: '0.6rem' }}>Patient Records</h1>
                    <p>Register patients, add target language, and upload clinical documents for AI processing.</p>
                </header>

                <div className="module-content" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', display: 'grid', alignItems: 'start' }}>
                {/* Left Side: Form */}
                <form onSubmit={handleSubmit} className="neo-card panel-soft" style={{ padding: '2rem' }}>
                    <h3 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.5rem' }}>Add New Patient</h3>
                    <div style={{ marginBottom: '1rem' }}>
                        <label htmlFor="patientId" className="field-label">Patient ID</label>
                        <input
                            id="patientId"
                            type="text"
                            value={patientId}
                            onChange={(e) => setPatientId(e.target.value)}
                            required
                            className="input-v2"
                        />
                    </div>
                    <div style={{ marginBottom: '1rem' }}>
                        <label htmlFor="patientName" className="field-label">Patient Name</label>
                        <input
                            id="patientName"
                            type="text"
                            value={patientName}
                            onChange={(e) => setPatientName(e.target.value)}
                            required
                            className="input-v2"
                        />
                    </div>
                    <div style={{ marginBottom: '1rem' }}>
                        <label htmlFor="patientNumber" className="field-label">Contact Number</label>
                        <input
                            id="patientNumber"
                            type="tel"
                            value={patientNumber}
                            onChange={(e) => setPatientNumber(e.target.value)}
                            required
                            className="input-v2"
                        />
                    </div>
                    <div style={{ marginBottom: '1rem' }}>
                        <label htmlFor="language" className="field-label">Report Target Language</label>
                        <input
                            id="language"
                            type="text"
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                            required
                            placeholder="Profile default or type language (e.g. Hindi, Spanish)"
                            className="input-v2"
                        />
                    </div>
                    <div style={{ marginBottom: '1.5rem' }}>
                        <label htmlFor="report" className="field-label">Report Document</label>
                        <input
                            id="report"
                            type="file"
                            accept=".jpg,.jpeg,.pdf,.docx"
                            onChange={(e) => setReport(e.target.files[0])}
                            required
                            className="input-v2"
                        />
                    </div>
                    <button type="submit" disabled={isLoading} className="neo-btn" style={{ background: 'var(--primary)', color: 'white', padding: '0.8rem 1.2rem', width: '100%', fontSize: '1.1rem', opacity: isLoading ? 0.7 : 1 }}>
                        {isLoading ? 'Analyzing Document...' : 'Save Patient'}
                    </button>
                </form>

                {/* Right Side: Table */}
                <div className="neo-card panel-soft" style={{ padding: '2rem', background: 'white' }}>
                    <h3 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        Recent Entries
                        <span style={{ fontSize: '1rem', background: 'var(--accent)', color: 'white', padding: '0.2rem 0.6rem', borderRadius: '12px' }}>
                            {patientsList.length} Total
                        </span>
                    </h3>

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
                </div>
                </div>
            </section>
        </div>
    );
}
