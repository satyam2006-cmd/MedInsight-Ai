import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { FileText, Loader2, Volume2, VolumeX, Stethoscope, AlertCircle, Languages } from 'lucide-react';
import { API_BASE_URL } from '../lib/config';

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

export default function SharedReport() {
    const { reportId } = useParams();
    const [report, setReport] = useState(null);
    const [patient, setPatient] = useState(null);
    const [hospital, setHospital] = useState(null); // Hospital branding metadata
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [speaking, setSpeaking] = useState(false);
    const [audio, setAudio] = useState(null);
    const [audioLoading, setAudioLoading] = useState(false);
    const [highlightIndex, setHighlightIndex] = useState(-1);
    const [translateLang, setTranslateLang] = useState('');
    const [translating, setTranslating] = useState(false);
    const [translatedText, setTranslatedText] = useState('');

    const translateReport = async (summaryText, targetLang) => {
        if (!summaryText || !targetLang) return;
        if (targetLang.toLowerCase() === 'english') {
            setTranslatedText(summaryText);
            return;
        }
        try {
            setTranslating(true);
            const res = await fetch(`${API_BASE_URL}/translate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ text: summaryText, target_language: targetLang })
            });

            if (res.ok) {
                const data = await res.json();
                setTranslatedText(data.translated_text || data.translation || summaryText);
            }
        } catch (err) {
            console.error('Translation error:', err);
        } finally {
            setTranslating(false);
        }
    };

    useEffect(() => {
        const fetchReport = async () => {
            try {
                // Fetch report data (public access enabled via UUID)
                const { data: reportData, error: reportError } = await supabase
                    .from('reports')
                    .select('*')
                    .eq('id', reportId)
                    .single();

                if (reportError) throw reportError;
                if (!reportData) throw new Error('Report not found');

                setReport(reportData);

                const analysis = typeof reportData.analysis === 'string'
                    ? JSON.parse(reportData.analysis)
                    : (reportData.analysis || {});

                const initialLang = analysis.target_language || 'Hindi';
                setTranslateLang(initialLang);

                const existingTranslation = analysis.hindi_translation || analysis.summary_translated || analysis.translation || '';
                if (existingTranslation && existingTranslation !== analysis.summary) {
                    setTranslatedText(existingTranslation);
                } else if (initialLang.toLowerCase() !== 'english' && analysis.summary) {
                    // Auto translate on load by default
                    translateReport(analysis.summary, initialLang);
                }

                // Fetch patient data linked to report, including hospital_id
                const { data: patientData, error: patientError } = await supabase
                    .from('patients')
                    .select('patient_name, hospital_id')
                    .eq('id', reportData.patient_id)
                    .single();

                if (!patientError && patientData) {
                    setPatient(patientData);
                }

            } catch (err) {
                console.error('Error fetching shared report:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchReport();
    }, [reportId]);

    const speak = async (text, lang) => {
        if (speaking && audio) {
            audio.pause();
            setSpeaking(false);
            setHighlightIndex(-1);
            return;
        }

        if (audioLoading) return;
        if (!text) return;

        try {
            setAudioLoading(true);
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
                    const currentTime = newAudio.currentTime;
                    const progress = currentTime / duration;
                    const words = text.trim().split(/\s+/);
                    const foundIndex = Math.floor(progress * words.length);
                    setHighlightIndex(foundIndex);
                }
            });

            newAudio.onended = () => {
                setSpeaking(false);
                setAudio(null);
                setHighlightIndex(-1);
            };

            newAudio.onerror = () => {
                setSpeaking(false);
                setAudioLoading(false);
                setAudio(null);
                setHighlightIndex(-1);
            };

            setAudio(newAudio);
        } catch (err) {
            console.error('TTS Error:', err);
            setSpeaking(false);
            setAudioLoading(false);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '1rem' }}>
                <Loader2 size={48} className="animate-spin" color="var(--primary)" />
                <p style={{ fontWeight: 700, fontSize: '1.2rem' }}>Loading Medical Report...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ padding: '4rem', textAlign: 'center' }}>
                <AlertCircle size={64} color="var(--secondary)" style={{ marginBottom: '1.5rem' }} />
                <h2 style={{ fontSize: '2rem' }}>Access Error</h2>
                <p style={{ fontSize: '1.2rem', color: '#666' }}>{error}</p>
                <button className="neo-btn" onClick={() => window.location.reload()} style={{ marginTop: '2rem' }}>
                    Retry Access
                </button>
            </div>
        );
    }

    const analysis = typeof report.analysis === 'string'
        ? JSON.parse(report.analysis)
        : (report.analysis || {});

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

    const hInfo = analysis.hospital_details || hospital; // Fallback to fetched profile

    // For older reports, if the translation is different from the summary, it's likely the target language
    const targetLang = analysis.target_language ||
        (analysis.hindi_translation && analysis.hindi_translation !== analysis.summary ? 'Analyzed' : 'English');

    return (
        <div className="container shared-report-shell" style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
            <header style={{ textAlign: 'center', marginBottom: '3rem' }}>
                <Logo />
                <h1 style={{ fontSize: 'clamp(1.6rem, 8vw, 2.5rem)', marginTop: '1rem' }}>MEDINSIGHT <span style={{ color: 'var(--secondary)' }}>AI</span></h1>

                {hInfo?.hospital_name && (
                    <div style={{ paddingBottom: '0.5rem', marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                        <p style={{ margin: 0, fontWeight: 800, fontSize: '0.9rem', color: 'var(--primary, #5227FF)', textTransform: 'uppercase' }}>
                            FROM {hInfo.hospital_name}
                        </p>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, opacity: 0.6 }}>WITH MEDINSIGHT AI</span>
                    </div>
                )}

                <p className="badge accent-bg">Patient Health Portal</p>
            </header>

            <main>
                <section className="neo-card" style={{ marginBottom: '2rem', borderLeft: '10px solid var(--primary)' }}>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 0 }}>
                        <FileText size={32} /> Report for {patient?.patient_name || 'Patient'}
                    </h2>
                    <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                        <span className="badge" style={{ background: '#f0f0f0' }}>Type: Medical Summary</span>
                        <span className="badge" style={{
                            background: report.risk_level === 'High' ? 'var(--secondary)' :
                                report.risk_level === 'Medium' ? 'var(--primary)' : 'var(--accent)',
                            color: report.risk_level === 'High' ? 'white' : 'black'
                        }}>
                            Risk: {report.risk_level || 'Normal'}
                        </span>
                    </div>

                    <div style={{ background: 'white', border: '3px solid black', padding: 'clamp(0.9rem, 4vw, 1.5rem)', marginBottom: '2rem' }}>
                        {/* Translation & Playback Toolbar */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingBottom: '1rem', borderBottom: '1px dashed #ccc', marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Languages size={16} color="var(--primary)" />
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Translate & Listen</span>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                <input
                                    type="text"
                                    value={translateLang}
                                    onChange={(e) => setTranslateLang(e.target.value)}
                                    placeholder="Hindi, Telugu, Spanish..."
                                    style={{
                                        flex: '1 1 160px', minWidth: '120px',
                                        padding: '0.5rem 0.7rem',
                                        border: '2px solid #111827',
                                        borderRadius: '4px',
                                        fontSize: '0.8rem',
                                        fontWeight: 600,
                                        boxShadow: '2px 2px 0px #111827'
                                    }}
                                />
                                <button
                                    onClick={() => translateReport(analysis.summary, translateLang)}
                                    disabled={translating}
                                    className="neo-btn"
                                    style={{
                                        padding: '0.5rem 0.8rem',
                                        background: '#1e293b',
                                        color: 'white',
                                        border: '2px solid #111827',
                                        borderRadius: '4px',
                                        fontSize: '0.78rem',
                                        fontWeight: 700,
                                        display: 'flex', alignItems: 'center', gap: '0.35rem',
                                        boxShadow: '2px 2px 0px #111827',
                                        cursor: translating ? 'wait' : 'pointer'
                                    }}
                                >
                                    {translating ? <Loader2 size={14} className="animate-spin" /> : <Languages size={14} />}
                                    {translating ? 'Translating...' : 'Translate'}
                                </button>
                                <button
                                    onClick={() => speak(translatedText || analysis.summary, translateLang || 'English')}
                                    className="neo-btn"
                                    disabled={audioLoading}
                                    style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--primary)', color: 'white' }}
                                >
                                    {audioLoading ? <Loader2 size={18} className="animate-spin" /> : speaking ? <VolumeX size={18} /> : <Volume2 size={18} />}
                                    {speaking ? 'Stop Audio' : 'Play Audio'}
                                </button>
                            </div>
                        </div>

                        {/* Render Translated Text with Highlighting */}
                        <div>
                            <h3 style={{ marginTop: 0, textTransform: 'uppercase', letterSpacing: '1px', fontSize: 'clamp(0.95rem, 3.2vw, 1rem)', color: 'var(--primary)', marginBottom: '0.5rem' }}>
                                {translatedText ? `${translateLang || 'Translated'} Summary` : 'Clinical Summary'}
                            </h3>
                            <div style={{ fontSize: 'clamp(0.95rem, 3.8vw, 1.3rem)', fontWeight: 600, lineHeight: '1.75' }}>
                                {(translatedText || safeString(analysis.summary, "")).trim().split(/\s+/).map((word, i) => (
                                    <span
                                        key={i}
                                        style={{
                                            display: 'inline-block',
                                            marginRight: '0.4rem',
                                            padding: '0 2px',
                                            background: (speaking && highlightIndex === i) ? 'var(--accent)' : 'transparent',
                                            color: 'black',
                                            borderRadius: '2px'
                                        }}
                                    >
                                        {word}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                <div className="neo-card" style={{ textAlign: 'center', background: '#e0e0e0' }}>
                    <p style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: '#666' }}>
                        Disclaimer: Not a medical diagnosis. Consult a doctor for professional advice.
                    </p>
                </div>
            </main>

            <footer style={{ marginTop: '2rem', textAlign: 'center', color: '#666', fontSize: '0.9rem', borderTop: '2px solid #eee', paddingTop: '1.25rem' }}>
                {hInfo && (
                    <div style={{ marginBottom: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', color: 'black' }}>
                        <div>
                            <p style={{ margin: 0, fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase', color: '#999' }}>Verified By</p>
                            <p style={{ margin: 0, fontWeight: 700 }}>{safeString(hInfo.admin_name || hInfo.admin_username)}</p>
                        </div>
                        <div>
                            <p style={{ margin: 0, fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase', color: '#999' }}>Contact Email</p>
                            <p style={{ margin: 0, fontWeight: 700 }}>{safeString(hInfo.email)}</p>
                        </div>
                        <div>
                            <p style={{ margin: 0, fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase', color: '#999' }}>Contact Number</p>
                            <p style={{ margin: 0, fontWeight: 700 }}>{safeString(hInfo.phone, 'N/A')}</p>
                        </div>
                    </div>
                )}
                <p>&copy; {new Date().getFullYear()} MedInsight AI. Clinical-grade document intelligence.</p>
            </footer>

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .animate-spin { animation: spin 1s linear infinite; }

                @media (max-width: 640px) {
                    .shared-report-shell {
                        padding: 0.9rem !important;
                    }

                    .shared-report-shell .neo-card {
                        border-width: 2px !important;
                        box-shadow: 3px 3px 0px var(--black) !important;
                        padding: 0.9rem !important;
                    }

                    .shared-report-shell .badge {
                        font-size: 0.68rem;
                    }
                }
            `}} />
        </div>
    );
}
