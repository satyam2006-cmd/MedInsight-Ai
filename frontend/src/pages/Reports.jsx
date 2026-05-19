import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Trash2, Share2, FileText, ChevronDown, ChevronUp, ExternalLink, Brain, LayoutGrid, ArrowLeft, MessageSquare, Volume2, VolumeX, Loader2, Languages } from 'lucide-react';
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
    const [shareModal, setShareModal] = useState({
        isOpen: false,
        patient: null,
        report: null,
        copied: false
    });

    // Translation + Audio playback states
    const [speaking, setSpeaking] = useState(false);
    const [audio, setAudio] = useState(null);
    const [audioLoading, setAudioLoading] = useState(false);
    const [highlightIndex, setHighlightIndex] = useState(-1);
    const [activeAudioReportId, setActiveAudioReportId] = useState(null);
    const [translateLang, setTranslateLang] = useState({});
    const [translating, setTranslating] = useState({});
    const [translatedTexts, setTranslatedTexts] = useState({});

    const openShareModal = (patient, report) => {
        setShareModal({
            isOpen: true,
            patient,
            report,
            copied: false
        });
    };

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

    /**
     * Safely converts any value to a renderable string.
     * Prevents React error #31 when analysis fields are objects instead of strings.
     * Flattens nested dictionaries if they contain text properties.
     */
    const safeString = (value, fallback = '') => {
        if (value === null || value === undefined) return fallback;
        if (typeof value === 'string') return value;
        if (typeof value === 'number' || typeof value === 'boolean') return String(value);
        if (typeof value === 'object') {
            // Retrieve nested text if available
            return value.summary || value.hindi_translation || value.text || value.summary_translated || JSON.stringify(value);
        }
        try { return JSON.stringify(value); } catch { return fallback; }
    };

    const renderAiAnalysis = (analysis) => {
        if (!analysis) return <p>No AI analysis available.</p>;

        // Attempting to pretty-print or read properties
        // The AI output is usually JSON or text.
        try {
            const parsed = typeof analysis === 'string' ? JSON.parse(analysis) : analysis;
            return (
                <div style={{ background: '#f5f5f5', padding: '1.5rem', border: '1px solid #ccc', borderRadius: '8px', marginTop: '1rem' }}>
                    <h5 style={{ marginTop: 0, marginBottom: '0.5rem', color: 'var(--primary)', fontSize: '1.2rem' }}>
                        Risk Level: {safeString(parsed.risk_level, 'Unknown')}
                    </h5>

                    {parsed.summary && (
                        <div style={{ marginBottom: '1rem' }}>
                            <strong style={{ display: 'block', marginBottom: '0.3rem' }}>Summary:</strong>
                            <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{safeString(parsed.summary)}</p>
                        </div>
                    )}

                    {(parsed.hindi_translation || parsed.summary_translated || parsed.translation) && (
                        <div style={{ marginBottom: '1rem' }}>
                            <strong style={{ display: 'block', marginBottom: '0.3rem' }}>Translation ({safeString(parsed.target_language, 'Target Language')}):</strong>
                            <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontStyle: 'italic' }}>{safeString(parsed.hindi_translation || parsed.summary_translated || parsed.translation)}</p>
                        </div>
                    )}

                    {parsed.vitals_snapshot && (
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed #ddd' }}>
                            <div style={{ fontSize: '0.8rem' }}><strong>HR:</strong> {safeString(parsed.vitals_snapshot.hr)} BPM</div>
                            <div style={{ fontSize: '0.8rem' }}><strong>SpO2:</strong> {safeString(parsed.vitals_snapshot.spo2)}%</div>
                            <div style={{ fontSize: '0.8rem' }}><strong>RR:</strong> {safeString(parsed.vitals_snapshot.rr)} RPM</div>
                            <div style={{ fontSize: '0.8rem' }}><strong>HRV:</strong> {safeString(parsed.vitals_snapshot.hrv)}ms</div>
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

    const speak = async (text, lang, reportId) => {
        // Toggle off if same report is already playing
        if (speaking && activeAudioReportId === reportId && audio) {
            audio.pause();
            setSpeaking(false);
            setHighlightIndex(-1);
            setActiveAudioReportId(null);
            return;
        }

        if (audioLoading) return;
        if (!text) return;

        try {
            setAudioLoading(true);
            setActiveAudioReportId(reportId);
            const url = `${API_BASE_URL}/tts?text=${encodeURIComponent(text)}&lang=${encodeURIComponent(lang)}`;
            const newAudio = new Audio(url);

            newAudio.oncanplaythrough = async () => {
                setAudioLoading(false);
                try {
                    await newAudio.play();
                    setSpeaking(true);
                } catch (playErr) {
                    console.error('Play error:', playErr);
                    setSpeaking(false);
                }
            };

            newAudio.addEventListener('timeupdate', () => {
                const duration = newAudio.duration;
                if (duration && duration !== Infinity && !isNaN(duration)) {
                    const progress = newAudio.currentTime / duration;
                    const words = text.trim().split(/\s+/);
                    setHighlightIndex(Math.floor(progress * words.length));
                }
            });

            newAudio.onended = () => {
                setSpeaking(false);
                setAudio(null);
                setHighlightIndex(-1);
                setActiveAudioReportId(null);
            };

            newAudio.onerror = () => {
                setSpeaking(false);
                setAudioLoading(false);
                setAudio(null);
                setHighlightIndex(-1);
                setActiveAudioReportId(null);
            };

            setAudio(newAudio);
        } catch (err) {
            console.error('TTS Error:', err);
            setSpeaking(false);
            setAudioLoading(false);
        }
    };

    const translateReport = async (reportId, summaryText, targetLang) => {
        if (!summaryText || !targetLang) return;
        if (targetLang.toLowerCase() === 'english') {
            setTranslatedTexts(prev => ({ ...prev, [reportId]: summaryText }));
            return;
        }
        try {
            setTranslating(prev => ({ ...prev, [reportId]: true }));
            const { data: { session } } = await supabase.auth.getSession();
            const headers = session?.access_token
                ? { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
                : { 'Content-Type': 'application/json' };

            const res = await fetch(`${API_BASE_URL}/translate`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ text: summaryText, target_language: targetLang })
            });

            if (res.ok) {
                const data = await res.json();
                setTranslatedTexts(prev => ({ ...prev, [reportId]: data.translated_text || data.translation || summaryText }));
            } else {
                alert('Translation failed. Please try again.');
            }
        } catch (err) {
            console.error('Translation error:', err);
            alert('Translation service unavailable.');
        } finally {
            setTranslating(prev => ({ ...prev, [reportId]: false }));
        }
    };

    const handleShareWhatsApp = (patient, report) => {
        const patientName = patient.patient_name || 'Patient';
        const patientNumber = patient.patient_number;
        // Safely extract target_language even if analysis is a string or object
        let analysisObj = report.analysis;
        if (typeof analysisObj === 'string') {
            try { analysisObj = JSON.parse(analysisObj); } catch { analysisObj = {}; }
        }
        const targetLanguage = safeString(analysisObj?.target_language, 'English');

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

            <main className="app-main app-main-lg mobile-page-shell reports-mobile-shell">
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
                <div key={patient.id} className="staggered-enter neo-card brutal-border reports-patient-card" style={{ marginBottom: '1rem', background: 'white' }}>
                    <div
                        className="reports-patient-header"
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
                            <div style={{ display: 'flex', gap: '1.5rem', color: '#64748b', fontSize: '0.95rem', flexWrap: 'wrap' }}>
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
                        <div className="reports-expanded-body" style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '2px solid #eee' }}>
                            {patient.reports && patient.reports.length > 0 ? (
                                patient.reports.map((report) => {
                                    let analysis = {};
                                    try {
                                        analysis = typeof report.analysis === 'string'
                                            ? JSON.parse(report.analysis)
                                            : (report.analysis || {});
                                    } catch (e) {
                                        console.warn('Failed to parse report analysis:', e);
                                        analysis = {};
                                    }

                                    return (
                                        <div key={report.id} className="reports-report-card" style={{ marginBottom: '2rem' }}>
                                            <h4 style={{ margin: '0 0 1rem 0' }}>Report from {new Date(report.created_at).toLocaleDateString()}</h4>

                                            {/* Status / Risk Pill and Buttons */}
                                            <div className="reports-report-toolbar" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem', marginBottom: '1rem' }}>
                                                <span style={{
                                                    display: 'inline-block', padding: '0.4rem 0.8rem', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 'bold',
                                                    background: report.risk_level === 'High' ? '#ffebee' : report.risk_level === 'Medium' ? '#fff3e0' : '#e8f5e9',
                                                    color: report.risk_level === 'High' ? '#c62828' : report.risk_level === 'Medium' ? '#ef6c00' : '#2e7d32',
                                                    border: '1px solid currentColor'
                                                }}>
                                                    AI Status: {safeString(report.status)} | Risk Level: {safeString(report.risk_level, 'Unknown')}
                                                </span>
                                                <div className="reports-action-row" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                    <button
                                                        onClick={() => openShareModal(patient, report)}
                                                        className="neo-btn reports-action-primary"
                                                        style={{
                                                            padding: '0.4rem 0.8rem',
                                                            fontSize: '0.8rem',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '0.4rem',
                                                            background: 'var(--primary)',
                                                            color: 'white',
                                                            border: '2px solid black',
                                                            borderRadius: '4px',
                                                            boxShadow: '2px 2px 0px black'
                                                        }}
                                                    >
                                                        <Share2 size={16} /> Share to Patient
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteReport(report.id)}
                                                        className="neo-btn reports-action-danger"
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

                                            {/* Hospital Dashboard View */}
                                            <div className="panel-soft" style={{ background: '#f5f5f5', padding: '1.5rem', borderRadius: '10px' }}>
                                                {/* Hospital Header */}
                                                <div style={{ borderBottom: '1px solid #ddd', paddingBottom: '0.5rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                                                    {(() => {
                                                        const hospitalName = safeString(analysis?.hospital_details?.hospital_name || hospitalInfo?.hospital_name);
                                                        return (
                                                    <p style={{ margin: 0, fontWeight: 800, fontSize: '0.8rem', color: 'var(--primary, #5227FF)', textTransform: 'uppercase' }}>
                                                        FROM {hospitalName || 'HOSPITAL PROFILE NOT SET'}
                                                    </p>
                                                        );
                                                    })()}
                                                    <span style={{ fontSize: '0.7rem', fontWeight: 700, opacity: 0.6 }}>WITH MEDINSIGHT AI</span>
                                                </div>

                                                {/* English Summary */}
                                                <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, whiteSpace: 'pre-wrap', color: 'black' }}>
                                                    {safeString(analysis?.summary, "No summary available.")}
                                                </p>



                                                {/* Hospital Footer for Liability */}
                                                <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #ddd', display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.75rem', fontWeight: 600, color: '#666' }}>
                                                    <div>ADMIN: {safeString(analysis?.hospital_details?.admin_name || hospitalInfo?.admin_name, 'Not set in profile')}</div>
                                                    <div>EMAIL: {safeString(analysis?.hospital_details?.email || hospitalInfo?.email, 'Not set in profile')}</div>
                                                    <div>PHONE: {safeString(analysis?.hospital_details?.phone || hospitalInfo?.phone, 'Not set in profile')}</div>
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

            {shareModal.isOpen && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 9999,
                    background: 'rgba(0,0,0,0.55)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1rem'
                }}>
                    <div className="neo-card" style={{
                        background: '#ffffff',
                        border: '3px solid #111827',
                        boxShadow: '8px 8px 0px #111827',
                        borderRadius: '4px',
                        padding: '2rem',
                        width: '100%',
                        maxWidth: '480px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1.25rem'
                    }}>
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '0.3rem' }}>
                                    Patient Portal
                                </div>
                                <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, color: '#111827', letterSpacing: '-0.5px' }}>
                                    Share Patient Report
                                </h3>
                            </div>
                            <button onClick={() => setShareModal(prev => ({ ...prev, isOpen: false }))} style={{
                                background: 'none', border: '2px solid #111827', borderRadius: '4px',
                                width: '44px', height: '44px', cursor: 'pointer', fontWeight: 900,
                                fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '2px 2px 0px #111827', flexShrink: 0
                            }}>✕</button>
                        </div>

                        {/* Patient info */}
                        <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.9rem', color: '#1e293b' }}>
                            <div><span style={{ fontWeight: 600, color: '#64748b' }}>Patient Name:</span> {shareModal.patient?.patient_name}</div>
                            <div><span style={{ fontWeight: 600, color: '#64748b' }}>Phone Number:</span> {shareModal.patient?.patient_number || 'N/A'}</div>
                            <div><span style={{ fontWeight: 600, color: '#64748b' }}>Date Generated:</span> {shareModal.report ? new Date(shareModal.report.created_at).toLocaleDateString() : ''}</div>
                        </div>

                        {/* Copy Link Field */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Patient Access URL</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    readOnly
                                    value={`${window.location.origin}/share/${shareModal.report?.id}`}
                                    style={{
                                        flex: 1,
                                        padding: '0.7rem 0.9rem',
                                        border: '2px solid #111827',
                                        borderRadius: '4px',
                                        fontSize: '0.85rem',
                                        fontWeight: 600,
                                        background: '#f1f5f9',
                                        color: '#334155',
                                        outline: 'none'
                                    }}
                                />
                                <button
                                    onClick={() => {
                                        const url = `${window.location.origin}/share/${shareModal.report?.id}`;
                                        navigator.clipboard.writeText(url);
                                        setShareModal(prev => ({ ...prev, copied: true }));
                                        setTimeout(() => {
                                            setShareModal(prev => ({ ...prev, copied: false }));
                                        }, 2000);
                                    }}
                                    className="neo-btn"
                                    style={{
                                        background: shareModal.copied ? '#22c55e' : 'var(--accent)',
                                        color: shareModal.copied ? 'white' : 'black',
                                        padding: '0.7rem 1rem',
                                        fontWeight: 700,
                                        border: '2px solid #111827',
                                        borderRadius: '4px',
                                        boxShadow: '2px 2px 0px #111827',
                                        cursor: 'pointer',
                                        transition: 'all 0.1s'
                                    }}
                                >
                                    {shareModal.copied ? 'Copied!' : 'Copy'}
                                </button>
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                            <a
                                href={`${window.location.origin}/share/${shareModal.report?.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="neo-btn"
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                    background: 'var(--primary)', color: 'white', border: '2px solid #111827', borderRadius: '4px',
                                    padding: '0.8rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem',
                                    boxShadow: '3px 3px 0px #111827',
                                    textDecoration: 'none'
                                }}
                            >
                                <ExternalLink size={16} /> Open Patient Report Portal
                            </a>
                            
                            {(() => {
                                if (!shareModal.patient || !shareModal.report) return null;
                                const patientName = shareModal.patient.patient_name || 'Patient';
                                const patientNumber = shareModal.patient.patient_number || '';
                                
                                let analysisObj = shareModal.report.analysis;
                                if (typeof analysisObj === 'string') {
                                    try { analysisObj = JSON.parse(analysisObj); } catch { analysisObj = {}; }
                                }
                                const targetLanguage = safeString(analysisObj?.target_language, 'English');
                                const shareUrl = `${window.location.origin}/share/${shareModal.report.id}`;
                                const message = generateShareMessage(patientName, targetLanguage, shareUrl);
                                
                                const cleanNumber = patientNumber.replace(/\D/g, '');
                                const whatsappUrl = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
                                return (
                                    <a
                                        href={whatsappUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="neo-btn"
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                            background: '#25D366', color: 'white', border: '2px solid #111827', borderRadius: '4px',
                                            padding: '0.8rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem',
                                            boxShadow: '3px 3px 0px #111827',
                                            textDecoration: 'none'
                                        }}
                                    >
                                        <MessageSquare size={16} strokeWidth={2.5} /> Send WhatsApp Notification
                                    </a>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
