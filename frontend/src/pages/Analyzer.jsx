import React, { useState, useEffect } from 'react';
import { Upload, Search, Languages, Loader2, AlertCircle, FileText, Volume2, VolumeX, Activity, Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import StaggeredMenu from '../components/StaggeredMenu';
import { extractText } from '../ocr-engine/services/hybridService.js';
import { API_BASE_URL } from '../lib/config';
import { supabase } from '../lib/supabaseClient';

const AnalyzerPage = () => {
    const navigate = useNavigate();
    const [file, setFile] = useState(null);
    const [targetLanguage, setTargetLanguage] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [rawText, setRawText] = useState('');
    const [extracting, setExtracting] = useState(false);
    const [speaking, setSpeaking] = useState(false);
    const [audio, setAudio] = useState(null);
    const [audioLoading, setAudioLoading] = useState(false);
    const [highlightIndex, setHighlightIndex] = useState(-1);
    const [cameraVitals, setCameraVitals] = useState(null);

    useEffect(() => {
        const loadPreferredLanguage = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                const preferred = user?.user_metadata?.preferred_language || user?.user_metadata?.language || '';
                if (preferred) setTargetLanguage(preferred);
            } catch (_) {
                // Keep manual input available when profile metadata cannot be loaded.
            }
        };
        loadPreferredLanguage();
    }, []);

    const ISO_LANGS = {
        'hindi': 'hi-IN', 'english': 'en-US', 'spanish': 'es-ES', 'french': 'fr-FR',
        'german': 'de-DE', 'bengali': 'bn-IN', 'tamil': 'ta-IN', 'telugu': 'te-IN',
        'marathi': 'mr-IN', 'kannada': 'kn-IN', 'gujarati': 'gu-IN', 'punjabi': 'pa-IN',
        'malayalam': 'ml-IN', 'chinese': 'zh-CN', 'japanese': 'ja-JP', 'korean': 'ko-KR',
        'russian': 'ru-RU', 'arabic': 'ar-SA', 'portuguese': 'pt-PT', 'italian': 'it-IT'
    };

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

            const handleTimeUpdate = () => {
                const duration = newAudio.duration;
                if (duration && duration !== Infinity && !isNaN(duration)) {
                    const progress = newAudio.currentTime / duration;
                    const words = text.trim().split(/\s+/);
                    const totalChars = text.trim().length;
                    const targetChar = progress * totalChars;

                    let currentChars = 0;
                    let foundIndex = -1;

                    for (let i = 0; i < words.length; i++) {
                        const wordLength = words[i].length;
                        if (targetChar >= currentChars && targetChar <= (currentChars + wordLength + 1)) {
                            foundIndex = i;
                            break;
                        }
                        currentChars += wordLength + 1;
                    }

                    if (foundIndex !== -1) {
                        setHighlightIndex(foundIndex);
                    }
                }
            };

            newAudio.addEventListener('timeupdate', handleTimeUpdate);

            newAudio.onended = () => {
                setSpeaking(false);
                setAudio(null);
                setHighlightIndex(-1);
                newAudio.removeEventListener('timeupdate', handleTimeUpdate);
            };

            newAudio.onerror = (e) => {
                console.error('Audio Playback Error:', e);
                setSpeaking(false);
                setAudioLoading(false);
                setAudio(null);
                setHighlightIndex(-1);
                newAudio.removeEventListener('timeupdate', handleTimeUpdate);
            };

            setAudio(newAudio);
        } catch (err) {
            console.error('TTS Error:', err);
            setSpeaking(false);
            setAudioLoading(false);
        }
    };

    useEffect(() => {
        return () => {
            if (audio) audio.pause();
        };
    }, [audio]);

    const handleFileChange = async (e) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            setError(null);
            setResult(null);
            setRawText('');
            setExtracting(true);
            try {
                const text = await extractText(selectedFile, (progress) => {
                    console.log(`Extraction progress: ${progress}%`);
                });
                setRawText(text);
            } catch (err) {
                console.error('Local extraction error:', err);
            } finally {
                setExtracting(false);
            }
        }
    };

    const handleAnalyze = async () => {
        if (!file) return;
        if (!targetLanguage.trim()) {
            setError('Set target language or configure preferred language in profile.');
            return;
        }

        setLoading(true);
        setResult(null);
        setError(null);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('extracted_text', rawText || '');
        formData.append('target_language', targetLanguage);

        try {
            const response = await fetch(`${API_BASE_URL}/analyze-report`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to analyze document');
            }

            const data = await response.json();
            setResult(data);
            // Fetch active camera vitals session to compare with document vitals
            try {
                const vRes = await fetch(`${API_BASE_URL}/api/vitals/session`);
                if (vRes.ok) {
                    const vData = await vRes.json();
                    if (vData && vData.avg_hr > 0) setCameraVitals(vData);
                }
            } catch (_) { /* no active session, that is fine */ }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const menuItems = [
        { label: 'Hub', link: '/', ariaLabel: 'Go to Hub', hoverColor: '#a855f7' },
        { label: 'Vitals', link: '/vitals', ariaLabel: 'Go to Vitals', hoverColor: '#ef4444' },
        { label: 'Patients', link: '/patients', ariaLabel: 'Go to Patients', hoverColor: '#eab308' },
        { label: 'Dashboard', link: '/dash', ariaLabel: 'Go to Dashboard', hoverColor: '#3b82f6' }
    ];

    return (
        <div style={{ position: 'fixed', inset: 0, background: '#ffffff', fontFamily: 'inherit', overflowY: 'auto' }}>
            <StaggeredMenu
                position="right"
                items={menuItems}
                socialItems={[]}
                logoUrl=""
                accentColor="#5227FF"
                menuButtonColor="#fff"
                openMenuButtonColor="#000"
                changeMenuColorOnOpen={true}
                isFixed={true}
                colors={['#f472b6', '#db2777']}
            />
            
            <div className="container" style={{ maxWidth: '900px', margin: '0 auto', padding: '3rem 1rem' }}>
                <header style={{ marginBottom: '3rem', textAlign: 'center' }}>
                    <h1 style={{ fontSize: '3.5rem', letterSpacing: '-2px', marginTop: '0.5rem', color: '#1a1a1a' }}>
                        Document <span style={{ color: 'var(--accent)' }}>Analyzer</span>
                    </h1>
                    <p className="badge" style={{ background: '#f8fafc', color: '#475569', border: '2px solid black' }}>
                        AI-Powered Medical Report Translation & Simplification
                    </p>
                </header>

                <main>
                    <section className="neo-card vibrant-bg" style={{ marginBottom: '2rem' }}>
                        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Upload size={32} /> Upload & Analyze
                        </h2>
                        <p style={{ marginBottom: '1.5rem', fontWeight: 600 }}>
                            Upload your medical document and select your preferred language for analysis.
                        </p>

                        <div style={{
                            border: '3px dashed black',
                            padding: '2rem',
                            background: 'white',
                            marginBottom: '1.5rem',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '1rem'
                        }}>
                            <input
                                type="file"
                                accept=".jpg,.jpeg,.png,.pdf"
                                onChange={handleFileChange}
                                id="file-upload"
                                style={{ display: 'none' }}
                            />
                            <label htmlFor="file-upload" className="neo-btn" style={{ background: 'var(--accent)', color: 'white', cursor: 'pointer' }}>
                                {file ? 'Change File' : 'Select Report'}
                            </label>
                            {file && <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{file.name}</span>}
                        </div>

                        {(extracting || rawText) && (
                            <section className="neo-card" style={{ marginBottom: '2rem', borderLeft: '10px solid var(--accent)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 0 }}>
                                        <Search size={32} /> {extracting ? 'Extracting Text...' : 'Extracted Text Preview'}
                                    </h2>
                                    {!extracting && rawText && (
                                        <button
                                            className="neo-btn"
                                            onClick={() => navigator.clipboard.writeText(rawText)}
                                            style={{ padding: '0.4rem 1rem', fontSize: '0.9rem' }}
                                        >
                                            Copy Text
                                        </button>
                                    )}
                                </div>
                                {extracting ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem' }}>
                                        <Loader2 className="animate-spin" />
                                        <span style={{ fontWeight: 600 }}>Reading your document locally...</span>
                                    </div>
                                ) : (
                                    <div style={{
                                        background: '#f0f0f0',
                                        border: '3px solid black',
                                        padding: '1rem',
                                        maxHeight: '300px',
                                        overflowY: 'auto',
                                        fontFamily: 'monospace',
                                        fontSize: '1rem',
                                        color: '#1a1a1a',
                                        whiteSpace: 'pre-wrap',
                                        boxShadow: 'inset 4px 4px 0px rgba(0,0,0,0.1)'
                                    }}>
                                        {rawText || 'No clear text could be extracted.'}
                                    </div>
                                )}
                            </section>
                        )}

                        {!result && (
                            <section className="neo-card secondary-bg" style={{ marginBottom: '2rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                                    <Languages size={40} color="white" />
                                    <h2 style={{ color: 'white', marginBottom: 0 }}>Select Translation</h2>
                                </div>

                                <div style={{ marginBottom: '1.5rem' }}>
                                    <label style={{ display: 'block', color: 'white', fontWeight: 700, marginBottom: '0.5rem' }}>
                                        Translate medical summary to:
                                    </label>
                                    <input
                                        type="text"
                                        value={targetLanguage}
                                        onChange={(e) => setTargetLanguage(e.target.value)}
                                        placeholder="Enter language (e.g. Hindi, Spanish, Telugu)"
                                        className="neo-input"
                                        style={{ width: '100%', padding: '1rem', border: '3px solid black', borderRadius: 0, fontSize: '1.1rem', fontWeight: 700, background: 'white' }}
                                    />
                                </div>

                                <button
                                    className="neo-btn"
                                    onClick={handleAnalyze}
                                    disabled={!file || loading || extracting}
                                    style={{ width: '100%', justifyContent: 'center', fontSize: '1.2rem', background: 'black', color: 'white' }}
                                >
                                    {loading ? <Loader2 className="animate-spin" /> : 'Analyze Now'}
                                </button>
                            </section>
                        )}
                    </section>

                    {error && (
                        <div className="neo-card secondary-bg" style={{ marginBottom: '2rem', color: 'white' }}>
                            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><AlertCircle size={32} /> Analysis Failed</h2>
                            <p style={{ fontWeight: 700 }}>{error}</p>
                        </div>
                    )}

                    {result && (
                        <div className="neo-card" style={{ marginBottom: '2rem', borderLeft: '10px solid #5227FF', padding: '1.5rem' }}>
                            {/* Header row */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                                <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0, fontSize: '1.4rem' }}>
                                    <Activity size={26} color="#5227FF" />
                                    Camera &amp; Document Cross-Check
                                </h2>
                                {cameraVitals && (
                                    <span style={{ fontSize: '0.75rem', background: '#f0fdf4', color: '#16a34a', padding: '0.3rem 0.8rem', border: '1px solid #bbf7d0', borderRadius: '20px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                        <span style={{ width: 7, height: 7, background: '#22c55e', borderRadius: '50%', display: 'inline-block' }} /> Session loaded
                                    </span>
                                )}
                            </div>

                            {cameraVitals ? (
                                <>
                                    <p style={{ fontSize: '0.88rem', color: '#555', marginBottom: '1.2rem', marginTop: 0 }}>
                                        Comparing your most recent camera session against vitals found in the document.
                                    </p>

                                    {/* Camera vitals tiles */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.9rem', marginBottom: '1.2rem' }}>
                                        {[
                                            { label: 'HEART RATE', value: cameraVitals.avg_hr, unit: 'BPM', bg: '#f0f9ff', border: '#bae6fd', labelColor: '#0369a1', valColor: '#0c4a6e' },
                                            { label: 'SpO₂', value: cameraVitals.avg_spo2, unit: '%', bg: '#f0fdf4', border: '#bbf7d0', labelColor: '#15803d', valColor: '#14532d' },
                                            { label: 'RESP RATE', value: cameraVitals.avg_rr, unit: 'br/min', bg: '#fff7ed', border: '#fed7aa', labelColor: '#c2410c', valColor: '#7c2d12' },
                                        ].map(({ label, value, unit, bg, border, labelColor, valColor }) => (
                                            <div key={label} style={{ background: bg, border: `2px solid ${border}`, borderRadius: '12px', padding: '1rem', textAlign: 'center' }}>
                                                <div style={{ fontSize: '0.65rem', fontWeight: 800, color: labelColor, marginBottom: '0.35rem', letterSpacing: '0.5px' }}>{label}</div>
                                                <div style={{ fontSize: '2rem', fontWeight: 900, color: valColor, lineHeight: 1 }}>{value || '--'}</div>
                                                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.3rem' }}>{unit}</div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Document vital signs found */}
                                    {result.medical_entities?.vital_signs?.length > 0 ? (
                                        <div style={{ background: '#f8faff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.9rem' }}>
                                            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#475569', marginBottom: '0.5rem', letterSpacing: '0.4px' }}>VITALS FOUND IN DOCUMENT</div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                                {result.medical_entities.vital_signs.map((vs, i) => (
                                                    <span key={i} style={{ background: '#e0e7ff', color: '#3730a3', padding: '0.25rem 0.65rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600 }}>{vs}</span>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '0.8rem', fontSize: '0.83rem', color: '#92400e' }}>
                                            ⚠️ No explicit vital sign values were extracted from this document, but the camera session data above is available for clinical reference.
                                        </div>
                                    )}
                                </>
                            ) : (
                                /* No camera session — CTA */
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '1.5rem 1rem', background: '#f8faff', borderRadius: '10px', border: '1px dashed #c7d2fe' }}>
                                    <Heart size={36} color="#a5b4fc" style={{ marginBottom: '0.75rem' }} />
                                    <div style={{ fontWeight: 800, fontSize: '1rem', color: '#3730a3', marginBottom: '0.3rem' }}>No active camera session found</div>
                                    <p style={{ fontSize: '0.85rem', color: '#64748b', maxWidth: '380px', marginBottom: '1.2rem' }}>
                                        Run a real-time rPPG vitals scan and come back to see how camera-measured HR, SpO₂ and RR compare against the values in this document.
                                    </p>
                                    <a href="/vitals" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.4rem', background: '#5227FF', color: 'white', border: '2px solid black', fontWeight: 800, fontSize: '0.9rem', textDecoration: 'none', boxShadow: '3px 3px 0px black' }}>
                                        <Activity size={16} /> Open Camera Vitals
                                    </a>
                                </div>
                            )}
                        </div>
                    )}

                    {result && (
                        <div style={{ display: 'grid', gap: '2rem' }}>
                            <div className="neo-card" style={{ borderLeft: '10px solid', borderColor: result.risk_level === 'High' ? 'var(--secondary)' : result.risk_level === 'Medium' ? 'var(--primary)' : 'var(--accent)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 0 }}><FileText size={32} /> Summary</h2>
                                    <div className="badge" style={{ background: result.risk_level === 'High' ? 'var(--secondary)' : result.risk_level === 'Medium' ? 'var(--primary)' : 'var(--accent)', color: result.risk_level === 'High' ? 'white' : 'black', border: '2px solid black' }}>
                                        Risk: {result.risk_level}
                                    </div>
                                </div>
                                <p style={{ fontSize: '1.2rem', fontWeight: 500 }}>{result.summary}</p>
                            </div>

                            <div className="neo-card" style={{ borderLeft: '10px solid var(--black)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 0 }}><Languages size={32} /> {targetLanguage} Translation</h2>
                                    <button
                                        onClick={() => speak(result.hindi_translation, targetLanguage)}
                                        className="neo-btn"
                                        disabled={audioLoading}
                                        style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.9rem' }}
                                    >
                                        {audioLoading ? <Loader2 size={18} className="animate-spin" /> : speaking ? <VolumeX size={18} /> : <Volume2 size={18} />}
                                        {audioLoading ? '...Loading' : speaking ? 'Stop' : 'Listen'}
                                    </button>
                                </div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 500, lineHeight: '1.8' }}>
                                    {result.hindi_translation.trim().split(/\s+/).map((word, i) => (
                                        <span key={i} className={highlightIndex === i ? 'word-highlight' : ''} style={{ display: 'inline-block', marginRight: '0.4rem', padding: '0 2px', transition: 'background-color 0.1s ease' }}>
                                            {word}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default AnalyzerPage;
