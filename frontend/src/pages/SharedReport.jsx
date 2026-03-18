import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { FileText, Loader2, Volume2, VolumeX, Stethoscope, AlertCircle } from 'lucide-react';
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                            <h3 style={{ marginTop: 0, textTransform: 'uppercase', letterSpacing: '1px', fontSize: 'clamp(0.95rem, 3.2vw, 1rem)' }}>
                                Clinical Summary ({targetLang})
                            </h3>
                            <button
                                onClick={() => speak(analysis.hindi_translation || analysis.summary_translated || analysis.summary, targetLang)}
                                className="neo-btn"
                                disabled={audioLoading}
                                style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--primary)', color: 'white' }}
                            >
                                {audioLoading ? <Loader2 size={18} className="animate-spin" /> : speaking ? <VolumeX size={18} /> : <Volume2 size={18} />}
                                {speaking ? 'Stop Audio' : 'Play Audio'}
                            </button>
                        </div>
                        <div style={{ fontSize: 'clamp(0.95rem, 3.8vw, 1.3rem)', fontWeight: 600, lineHeight: '1.75' }}>
                            {(analysis.hindi_translation || analysis.summary_translated || analysis.summary || "").trim().split(/\s+/).map((word, i) => (
                                <span
                                    key={i}
                                    style={{
                                        display: 'inline-block',
                                        marginRight: '0.4rem',
                                        padding: '0 2px',
                                        background: highlightIndex === i ? 'var(--accent)' : 'transparent',
                                        color: 'black'
                                    }}
                                >
                                    {word}
                                </span>
                            ))}
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
                            <p style={{ margin: 0, fontWeight: 700 }}>{hInfo.admin_name || hInfo.admin_username}</p>
                        </div>
                        <div>
                            <p style={{ margin: 0, fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase', color: '#999' }}>Contact Email</p>
                            <p style={{ margin: 0, fontWeight: 700 }}>{hInfo.email}</p>
                        </div>
                        <div>
                            <p style={{ margin: 0, fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase', color: '#999' }}>Contact Number</p>
                            <p style={{ margin: 0, fontWeight: 700 }}>{hInfo.phone || 'N/A'}</p>
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
