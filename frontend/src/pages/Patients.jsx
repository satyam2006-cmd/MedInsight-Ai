import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { UserPlus, Loader2, Phone, User, Activity, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { API_BASE_URL } from '../lib/config';
import { useNavigate } from 'react-router-dom';


export default function PatientsPage() {
    const navigate = useNavigate();
    const [patientId, setPatientId] = useState('');
    const [patientName, setPatientName] = useState('');
    const [patientNumber, setPatientNumber] = useState('');
    const [language, setLanguage] = useState('English');
    const [report, setReport] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    // Maintain a list of added patients
    const [patientsList, setPatientsList] = useState([]);

    const handleSubmit = async (e) => {
        e.preventDefault();
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
            setLanguage('English');
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
        <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
            <button
                onClick={() => window.location.href = '/'}
                className="neo-btn"
                style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', color: 'black', padding: '0.5rem 1rem' }}
            >
                ← Back to Hub
            </button>
            <h2 style={{ fontSize: '2.5rem', marginBottom: '2rem' }}>Patient Records</h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(350px, 1fr) 2fr', gap: '2rem', alignItems: 'start' }}>
                {/* Left Side: Form */}
                <form onSubmit={handleSubmit} className="neo-card" style={{ padding: '2rem', background: '#f9f9f9', border: '2px solid black' }}>
                    <h3 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.5rem' }}>Add New Patient</h3>
                    <div style={{ marginBottom: '1rem' }}>
                        <label htmlFor="patientId" style={{ display: 'block', fontWeight: '700', marginBottom: '0.5rem' }}>Patient ID</label>
                        <input
                            id="patientId"
                            type="text"
                            value={patientId}
                            onChange={(e) => setPatientId(e.target.value)}
                            required
                            className="neo-input"
                            style={{ width: '100%', padding: '0.6rem', border: '2px solid black', background: 'white' }}
                        />
                    </div>
                    <div style={{ marginBottom: '1rem' }}>
                        <label htmlFor="patientName" style={{ display: 'block', fontWeight: '700', marginBottom: '0.5rem' }}>Patient Name</label>
                        <input
                            id="patientName"
                            type="text"
                            value={patientName}
                            onChange={(e) => setPatientName(e.target.value)}
                            required
                            className="neo-input"
                            style={{ width: '100%', padding: '0.6rem', border: '2px solid black', background: 'white' }}
                        />
                    </div>
                    <div style={{ marginBottom: '1rem' }}>
                        <label htmlFor="patientNumber" style={{ display: 'block', fontWeight: '700', marginBottom: '0.5rem' }}>Contact Number</label>
                        <input
                            id="patientNumber"
                            type="tel"
                            value={patientNumber}
                            onChange={(e) => setPatientNumber(e.target.value)}
                            required
                            className="neo-input"
                            style={{ width: '100%', padding: '0.6rem', border: '2px solid black', background: 'white' }}
                        />
                    </div>
                    <div style={{ marginBottom: '1rem' }}>
                        <label htmlFor="language" style={{ display: 'block', fontWeight: '700', marginBottom: '0.5rem' }}>Report Target Language</label>
                        <input
                            id="language"
                            type="text"
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                            required
                            placeholder="e.g. Hindi, Spanish..."
                            className="neo-input"
                            style={{ width: '100%', padding: '0.6rem', border: '2px solid black', background: 'white' }}
                        />
                    </div>
                    <div style={{ marginBottom: '1.5rem' }}>
                        <label htmlFor="report" style={{ display: 'block', fontWeight: '700', marginBottom: '0.5rem' }}>Report Document</label>
                        <input
                            id="report"
                            type="file"
                            accept=".jpg,.jpeg,.pdf,.docx"
                            onChange={(e) => setReport(e.target.files[0])}
                            required
                            className="neo-input"
                            style={{ width: '100%', padding: '0.6rem', border: '2px solid black', background: 'white' }}
                        />
                    </div>
                    <button type="submit" disabled={isLoading} className="neo-btn" style={{ background: 'var(--primary)', color: 'white', padding: '0.8rem 1.2rem', width: '100%', fontSize: '1.1rem', opacity: isLoading ? 0.7 : 1 }}>
                        {isLoading ? 'Analyzing Document...' : 'Save Patient'}
                    </button>
                </form>

                {/* Right Side: Table */}
                <div className="neo-card" style={{ padding: '2rem', background: 'white', border: '2px solid black' }}>
                    <h3 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        Recent Entries
                        <span style={{ fontSize: '1rem', background: 'var(--accent)', color: 'white', padding: '0.2rem 0.6rem', borderRadius: '12px' }}>
                            {patientsList.length} Total
                        </span>
                    </h3>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ background: '#f0f0f0', borderBottom: '2px solid black' }}>
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
                                        <tr key={index} style={{ borderBottom: '1px solid #ccc' }}>
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
                                                    style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.7rem', background: '#5227FF', color: 'white', border: '2px solid black', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
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
        </div>
    );
}
