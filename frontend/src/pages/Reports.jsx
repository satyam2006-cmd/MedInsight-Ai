import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { FileText, Loader2, AlertCircle, RefreshCw, Volume2, MessageSquare, Trash2 } from 'lucide-react';
import { API_BASE_URL } from '../lib/config';
import { openWhatsApp, generateShareMessage } from '../lib/whatsapp';

export default function ReportsPage() {
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedPatientId, setExpandedPatientId] = useState(null);

    useEffect(() => {
        const fetchPatientsAndReports = async () => {
            try {
                // Get JWT token
                const { data: { session }, error: authError } = await supabase.auth.getSession();
                if (authError || !session) {
                    setError('Authentication error. Please log in as a hospital.');
                    setLoading(false);
                    return;
                }

                // Using centralized API URL
                const apiUrl = API_BASE_URL;

                // Fetch from our backend GET /patients
                const response = await fetch(`${apiUrl}/patients`, {
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`
                    }
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch patient records from backend');
                }

                const data = await response.json();
                // Data comes back as list of patients with their nested 'reports' array
                setPatients(data);

            } catch (err) {
                console.error("Error fetching patient reports:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchPatientsAndReports();
    }, []);

    const renderAiAnalysis = (analysis) => {
        if (!analysis) return <p>No AI analysis available.</p>;

        // Attempting to pretty-print or read properties
        // The AI output is usually JSON or text.
        try {
            const parsed = typeof analysis === 'string' ? JSON.parse(analysis) : analysis;
            return (
                <div style={{ background: '#f5f5f5', padding: '1.5rem', border: '1px solid #ccc', borderRadius: '8px', marginTop: '1rem' }}>
                    <h5 style={{ marginTop: 0, marginBottom: '0.5rem', color: 'var(--primary)', fontSize: '1.2rem' }}>
                        Risk Level: {parsed.risk_level || 'Unknown'}
                    </h5>

                    {parsed.summary && (
                        <div style={{ marginBottom: '1rem' }}>
                            <strong style={{ display: 'block', marginBottom: '0.3rem' }}>Summary:</strong>
                            <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{parsed.summary}</p>
                        </div>
                    )}

                    {parsed.translation && (
                        <div style={{ marginBottom: '1rem' }}>
                            <strong style={{ display: 'block', marginBottom: '0.3rem' }}>Target Language Translation:</strong>
                            <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontStyle: 'italic' }}>{parsed.translation}</p>
                        </div>
                    )}

                    {!parsed.summary && !parsed.translation && (
                        <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.9rem', margin: 0 }}>
                            {JSON.stringify(parsed, null, 2)}
                        </pre>
                    )}
                </div>
            );
        } catch (e) {
            // Fallback for plain text
            return <p style={{ whiteSpace: 'pre-wrap', background: '#f0f0f0', padding: '1rem' }}>{String(analysis)}</p>;
        }
    };

    const speak = (text, lang = 'en-US') => {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = lang;
            window.speechSynthesis.speak(utterance);
        } else {
            alert('Text-to-speech not supported in this browser.');
        }
    };

    const handleShareWhatsApp = (patient, report) => {
        const patientName = patient.patient_name || 'Patient';
        const patientNumber = patient.patient_number;
        const targetLanguage = report.analysis?.target_language || 'English';

        if (!patientNumber) {
            alert("No phone number found for this patient.");
            return;
        }

        const shareUrl = `${window.location.origin}/share/${report.id}`;
        const message = generateShareMessage(patientName, targetLanguage, shareUrl);
        openWhatsApp(patientNumber, message);
    };

    const handleDeleteReport = async (reportId) => {
        if (!window.confirm('Are you sure you want to delete this specific report? This cannot be undone.')) return;

        try {
            const { error } = await supabase.from('reports').delete().eq('id', reportId);
            if (error) throw error;

            // Update local state
            setPatients(prev => prev.map(p => ({
                ...p,
                reports: (p.reports || []).filter(r => r.id !== reportId)
            })));

            alert('Report deleted successfully.');
        } catch (err) {
            console.error('Error deleting report:', err);
            alert('Failed to delete report.');
        }
    };

    const handleDeletePatient = async (patientId) => {
        if (!window.confirm('Are you sure you want to delete this patient and ALL their reports?')) return;

        try {
            const { error } = await supabase.from('patients').delete().eq('id', patientId);
            if (error) throw error;

            setPatients(prev => prev.filter(p => p.id !== patientId));
            alert('Patient record deleted.');
        } catch (err) {
            console.error('Error deleting patient:', err);
            alert('Failed to delete patient.');
        }
    };

    return (
        <div className="container" style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem' }}>
            <button
                onClick={() => window.history.back()}
                className="neo-btn"
                style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', color: 'black', padding: '0.5rem 1rem' }}
            >
                ← Back to Dashboard
            </button>

            <h2 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>Patient AI Reports</h2>

            {loading && <p style={{ fontSize: '1.2rem', color: '#666' }}>Loading patient records...</p>}

            {error && (
                <div className="neo-card" style={{ background: '#fee', borderLeft: '8px solid red', padding: '1rem', marginBottom: '2rem' }}>
                    <p style={{ margin: 0, color: 'red', fontWeight: 'bold' }}>Error: {error}</p>
                </div>
            )}

            {!loading && !error && patients.length === 0 && (
                <div className="neo-card" style={{ padding: '3rem', textAlign: 'center', background: 'white' }}>
                    <h3 style={{ margin: 0, color: '#666' }}>No patient records found.</h3>
                    <p style={{ color: '#999' }}>Go to the Patients page to add records and generate AI summaries.</p>
                </div>
            )}

            {!loading && patients.map((patient) => (
                <div key={patient.id} className="neo-card" style={{ padding: '1.5rem', marginBottom: '1.5rem', background: 'white', border: '2px solid black' }}>

                    {/* Header Row */}
                    <div
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                        onClick={() => setExpandedPatientId(expandedPatientId === patient.id ? null : patient.id)}
                    >
                        <div>
                            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem' }}>{patient.patient_name}</h3>
                            <p style={{ margin: 0, color: '#666' }}>ID: {patient.patient_custom_id || patient.patient_number} | Visited: {new Date(patient.created_at).toLocaleDateString()}</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeletePatient(patient.id);
                                }}
                                className="neo-btn"
                                style={{ padding: '0.4rem', background: '#ffebee', color: '#c62828', border: '1px solid #c62828' }}
                                title="Delete Patient"
                            >
                                <Trash2 size={18} />
                            </button>
                            <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                                {expandedPatientId === patient.id ? '−' : '+'}
                            </span>
                        </div>
                    </div>

                    {/* Expaned Details (Reports) */}
                    {expandedPatientId === patient.id && (
                        <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '2px solid #eee' }}>
                            {patient.reports && patient.reports.length > 0 ? (
                                patient.reports.map((report) => {
                                    const analysis = typeof report.analysis === 'string'
                                        ? JSON.parse(report.analysis)
                                        : report.analysis;

                                    return (
                                        <div key={report.id} style={{ marginBottom: '2rem' }}>
                                            <h4 style={{ margin: '0 0 1rem 0' }}>Report from {new Date(report.created_at).toLocaleDateString()}</h4>

                                            {/* Status / Risk Pill and Buttons */}
                                            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem', marginBottom: '1rem' }}>
                                                <span style={{
                                                    display: 'inline-block', padding: '0.4rem 0.8rem', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 'bold',
                                                    background: report.risk_level === 'High' ? '#ffebee' : report.risk_level === 'Medium' ? '#fff3e0' : '#e8f5e9',
                                                    color: report.risk_level === 'High' ? '#c62828' : report.risk_level === 'Medium' ? '#ef6c00' : '#2e7d32',
                                                    border: '1px solid currentColor'
                                                }}>
                                                    AI Status: {report.status} | Risk Level: {report.risk_level || 'Unknown'}
                                                </span>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <button
                                                        onClick={() => handleShareWhatsApp(patient, report)}
                                                        className="neo-btn"
                                                        style={{
                                                            padding: '0.4rem 0.8rem',
                                                            fontSize: '0.8rem',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '0.4rem',
                                                            background: '#25D366',
                                                            color: 'white'
                                                        }}
                                                    >
                                                        <MessageSquare size={16} /> Share to Patient
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteReport(report.id)}
                                                        className="neo-btn"
                                                        style={{
                                                            padding: '0.4rem 0.8rem',
                                                            fontSize: '0.8rem',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '0.4rem',
                                                            background: '#f8d7da',
                                                            color: '#721c24',
                                                            border: '1px solid #f5c6cb'
                                                        }}
                                                    >
                                                        <Trash2 size={16} /> Delete
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Hospital Dashboard View: English Only */}
                                            <div style={{ background: '#f5f5f5', padding: '1.5rem', border: '2px solid black', borderRadius: '4px' }}>
                                                <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, whiteSpace: 'pre-wrap', color: 'black' }}>
                                                    {analysis?.summary || "No summary available."}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <p style={{ fontStyle: 'italic', color: '#666' }}>No reports processed for this patient yet.</p>
                            )}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
