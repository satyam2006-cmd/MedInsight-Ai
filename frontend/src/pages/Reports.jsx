import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Trash2, Share2, FileText, ChevronDown, ChevronUp, ExternalLink, Brain, LayoutGrid, ArrowLeft, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../lib/config';
import { openWhatsApp, generateShareMessage } from '../lib/whatsapp';
import GlobalSidebar from '../components/GlobalSidebar';

export default function ReportsPage() {
    const navigate = useNavigate();
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedPatientId, setExpandedPatientId] = useState(null);
    const [hospitalInfo, setHospitalInfo] = useState(null);

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
                setPatients(data);

                // Fetch current user metadata for display safety
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    setHospitalInfo({
                        hospital_name: user.user_metadata?.hospital_name || '',
                        admin_name: user.user_metadata?.admin_username || '',
                        email: user.email,
                        phone: `${user.user_metadata?.country_code || ""} ${user.user_metadata?.phone || ""}`.trim()
                    });
                }

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

                    {(parsed.hindi_translation || parsed.summary_translated || parsed.translation) && (
                        <div style={{ marginBottom: '1rem' }}>
                            <strong style={{ display: 'block', marginBottom: '0.3rem' }}>Translation ({parsed.target_language || 'Target Language'}):</strong>
                            <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontStyle: 'italic' }}>{parsed.hindi_translation || parsed.summary_translated || parsed.translation}</p>
                        </div>
                    )}

                    {parsed.vitals_snapshot && (
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed #ddd' }}>
                            <div style={{ fontSize: '0.8rem' }}><strong>HR:</strong> {parsed.vitals_snapshot.hr} BPM</div>
                            <div style={{ fontSize: '0.8rem' }}><strong>SpO2:</strong> {parsed.vitals_snapshot.spo2}%</div>
                            <div style={{ fontSize: '0.8rem' }}><strong>RR:</strong> {parsed.vitals_snapshot.rr} RPM</div>
                            <div style={{ fontSize: '0.8rem' }}><strong>HRV:</strong> {parsed.vitals_snapshot.hrv}ms</div>
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
        <div className="app-shell">
            <GlobalSidebar />

            <main className="app-main app-main-lg">
                <button
                    onClick={() => navigate('/')}
                    className="staggered-enter app-back-btn"
                >
                    <ArrowLeft size={16} />
                    BACK TO HUB
                </button>
                <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', width: '100%' }}>
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
                            <FileText size={32} />
                        </div>
                        <div>
                            <h1 className="page-hero-title" style={{ fontWeight: 400, letterSpacing: '-2px', color: '#1e293b', margin: 0 }}>
                                Insight <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Feed</span>
                            </h1>
                            <p style={{ fontSize: 'clamp(0.95rem, 3.2vw, 1.2rem)', color: '#64748b', marginTop: '0.2rem' }}>
                                Longitudinal AI report history and clinical documentation.
                            </p>
                        </div>
                    </div>
                </header>

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
                <div key={patient.id} className="staggered-enter neo-card brutal-border" style={{ marginBottom: '1rem', background: 'white' }}>
                    <div
                        style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'end', 
                            cursor: 'pointer',
                            gap: '0.8rem',
                            flexWrap: 'wrap',
                            padding: '0.5rem 0',
                            borderBottom: '1px solid rgba(0,0,0,0.06)',
                            marginBottom: '1.5rem'
                        }}
                        onClick={() => setExpandedPatientId(expandedPatientId === patient.id ? null : patient.id)}
                    >
                        <div>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)', letterSpacing: '1px', textTransform: 'uppercase' }}>Patient Record</span>
                            <h3 style={{ margin: '0.2rem 0', fontSize: 'clamp(1.4rem, 5vw, 2.2rem)', color: '#1e293b', fontWeight: 500 }}>{patient.patient_name}</h3>
                            <div style={{ display: 'flex', gap: '1.5rem', color: '#64748b', fontSize: '0.95rem' }}>
                                <span>ID: <strong style={{color: '#1e293b'}}>{patient.patient_custom_id || patient.patient_number}</strong></span>
                                <span>Total Reports: <strong style={{color: '#1e293b'}}>{patient.reports?.length || 0}</strong></span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
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
                                            <div className="panel-soft" style={{ background: '#f5f5f5', padding: '1.5rem', borderRadius: '10px' }}>
                                                {/* Hospital Header for trusting branding */}
                                                <div style={{ borderBottom: '1px solid #ddd', paddingBottom: '0.5rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    {(() => {
                                                        const hospitalName = analysis?.hospital_details?.hospital_name || hospitalInfo?.hospital_name;
                                                        return (
                                                    <p style={{ margin: 0, fontWeight: 800, fontSize: '0.8rem', color: 'var(--primary, #5227FF)', textTransform: 'uppercase' }}>
                                                        FROM {hospitalName || 'HOSPITAL PROFILE NOT SET'}
                                                    </p>
                                                        );
                                                    })()}
                                                    <span style={{ fontSize: '0.7rem', fontWeight: 700, opacity: 0.6 }}>WITH MEDINSIGHT AI</span>
                                                </div>

                                                <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, whiteSpace: 'pre-wrap', color: 'black' }}>
                                                    {analysis?.summary || "No summary available."}
                                                </p>

                                                {/* Hospital Footer for Liability */}
                                                <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #ddd', display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.75rem', fontWeight: 600, color: '#666' }}>
                                                    <div>ADMIN: {analysis?.hospital_details?.admin_name || hospitalInfo?.admin_name || 'Not set in profile'}</div>
                                                    <div>EMAIL: {analysis?.hospital_details?.email || hospitalInfo?.email || 'Not set in profile'}</div>
                                                    <div>PHONE: {analysis?.hospital_details?.phone || hospitalInfo?.phone || 'Not set in profile'}</div>
                                                </div>
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
            </main>
        </div>
    );
}
