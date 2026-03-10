import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Stethoscope, Volume2, VolumeX, Loader2, AlertCircle, FileText, Activity } from 'lucide-react';
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

                // Fetch patient data linked to report
                const { data: patientData, error: patientError } = await supabase
                    .from('patients')
                    .select('patient_name')
                    .eq('id', reportData.patient_id)
                    .single();

                if (!patientError) {
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

        if (audioLoading || !text) return;

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
                    setSpeaking(false);
                }
            };

            const handleTimeUpdate = () => {
                const duration = newAudio.duration;
                if (duration && !isNaN(duration)) {
                    const progress = newAudio.currentTime / duration;
                    const words = text.trim().split(/\s+/);
                    const foundIndex = Math.floor(progress * words.length);
                    setHighlightIndex(foundIndex);
                }
            };

            newAudio.addEventListener('timeupdate', handleTimeUpdate);

            newAudio.onended = () => {
                setSpeaking(false);
                setAudio(null);
                setHighlightIndex(-1);
            };

            setAudio(newAudio);
        } catch (err) {
            setAudioLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="container" style={{ textAlign: 'center', padding: '100px 20px' }}>
                <Loader2 size={48} className="animate-spin" style={{ margin: '0 auto' }} />
                <p style={{ marginTop: '1rem', fontWeight: 700 }}>Loading your medical summary...</p>
            </div>
        );
    }

    if (error || !report) {
        return (
            <div className="container" style={{ maxWidth: '600px', margin: '100px auto', textAlign: 'center' }}>
                <div className="neo-card secondary-bg" style={{ color: 'white' }}>
                    <AlertCircle size={48} style={{ margin: '0 auto 1rem' }} />
                    <h2>Report Access Error</h2>
                    <p>We couldn't load this report. The link may have expired or is incorrect.</p>
                </div>
            </div>
        );
    }

    const analysis = report.analysis;
    const targetLang = analysis.target_language || 'English';

    return (
        <div className="container" style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
            <header style={{ textAlign: 'center', marginBottom: '3rem' }}>
                <Logo />
                <h1 style={{ fontSize: '2.5rem', marginTop: '1rem' }}>MEDINSIGHT <span style={{ color: 'var(--secondary)' }}>AI</span></h1>
                <p className="badge accent-bg">Patient Health Portal</p>
            </header>

            <main>
                <section className="neo-card" style={{ marginBottom: '2rem', borderLeft: '10px solid var(--primary)' }}>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 0 }}>
                        <FileText size={32} /> Report for {patient?.patient_name || 'Patient'}
                    </h2>
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                        <span className="badge" style={{ background: '#f0f0f0' }}>Type: Medical Summary</span>
                        <span className="badge" style={{
                            background: report.risk_level === 'High' ? 'var(--secondary)' :
                                report.risk_level === 'Medium' ? 'var(--primary)' : 'var(--accent)',
                            color: report.risk_level === 'High' ? 'white' : 'black'
                        }}>
                            Risk: {report.risk_level || 'Normal'}
                        </span>
                    </div>

                    <div style={{ background: 'white', border: '3px solid black', padding: '1.5rem', marginBottom: '2rem' }}>
                        <h3 style={{ marginTop: 0 }}>Clinical Summary</h3>
                        <p style={{ fontSize: '1.2rem', lineHeight: '1.6' }}>{analysis.summary}</p>
                    </div>

                    {analysis.translation && (
                        <div style={{ background: 'var(--primary)', color: 'white', border: '3px solid black', padding: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h3 style={{ margin: 0 }}>Translation: {targetLang}</h3>
                                <button
                                    onClick={() => speak(analysis.translation, targetLang)}
                                    className="neo-btn"
                                    disabled={audioLoading}
                                    style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', color: 'black' }}
                                >
                                    {audioLoading ? <Loader2 size={18} className="animate-spin" /> : speaking ? <VolumeX size={18} /> : <Volume2 size={18} />}
                                    {speaking ? 'Stop Audio' : 'Play Audio'}
                                </button>
                            </div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 500, lineHeight: '1.8' }}>
                                {analysis.translation.trim().split(/\s+/).map((word, i) => (
                                    <span
                                        key={i}
                                        style={{
                                            display: 'inline-block',
                                            marginRight: '0.4rem',
                                            padding: '0 2px',
                                            background: highlightIndex === i ? 'rgba(255,255,255,0.3)' : 'transparent',
                                            color: 'white'
                                        }}
                                    >
                                        {word}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </section>

                <div className="neo-card" style={{ textAlign: 'center', background: '#e0e0e0' }}>
                    <p style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: '#666' }}>
                        Disclaimer: Not a medical diagnosis. Consult a doctor for professional advice.
                    </p>
                </div>
            </main>

            <footer style={{ marginTop: '4rem', textAlign: 'center', color: '#999', fontSize: '0.9rem' }}>
                <p>&copy; {new Date().getFullYear()} MedInsight AI. Clinical-grade document intelligence.</p>
            </footer>

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .animate-spin { animation: spin 1s linear infinite; }
            `}} />
        </div>
    );
}
