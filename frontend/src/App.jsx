import React, { useState } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle2, Languages, Activity, Loader2, Stethoscope, Search, Volume2, VolumeX } from 'lucide-react';
import { extractText } from '../../text-from-image/services/hybridService.js';

const API_BASE_URL = 'http://127.0.0.1:8000';

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

function App() {
    const [file, setFile] = useState(null);
    const [targetLanguage, setTargetLanguage] = useState('Hindi');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [rawText, setRawText] = useState('');
    const [extracting, setExtracting] = useState(false);
    const [speaking, setSpeaking] = useState(false);

    // Comprehensive language code mapping
    const ISO_LANGS = {
        'hindi': 'hi-IN', 'english': 'en-US', 'spanish': 'es-ES', 'french': 'fr-FR',
        'german': 'de-DE', 'bengali': 'bn-IN', 'tamil': 'ta-IN', 'telugu': 'te-IN',
        'marathi': 'mr-IN', 'kannada': 'kn-IN', 'gujarati': 'gu-IN', 'punjabi': 'pa-IN',
        'malayalam': 'ml-IN', 'chinese': 'zh-CN', 'japanese': 'ja-JP', 'korean': 'ko-KR',
        'russian': 'ru-RU', 'arabic': 'ar-SA', 'portuguese': 'pt-PT', 'italian': 'it-IT'
    };

    const getBestVoice = (langName) => {
        const voices = window.speechSynthesis.getVoices();
        const langLower = langName.toLowerCase();
        const code = ISO_LANGS[langLower] || langLower;
        const prefix = code.substring(0, 2);

        let voice = voices.find(v => v.lang.toLowerCase() === code.toLowerCase());
        if (!voice) voice = voices.find(v => v.lang.toLowerCase().startsWith(prefix));
        if (!voice) voice = voices.find(v => v.name.toLowerCase().includes(langLower));

        return voice;
    };

    const speak = (text, lang) => {
        window.speechSynthesis.cancel();

        if (speaking) {
            setSpeaking(false);
            return;
        }
        if (!text) return;

        try {
            const utterance = new SpeechSynthesisUtterance(text);
            const voice = getBestVoice(lang);

            if (voice) {
                console.log(`TTS: Using voice ${voice.name} for ${lang}`);
                utterance.voice = voice;
                utterance.lang = voice.lang;
            } else {
                console.log(`TTS: No specific voice found for ${lang}, using fallback lang code.`);
                utterance.lang = ISO_LANGS[lang.toLowerCase()] || 'en-US';
            }

            utterance.onstart = () => setSpeaking(true);
            utterance.onend = () => setSpeaking(false);
            utterance.onerror = (e) => {
                console.error('TTS Error Event:', e);
                setSpeaking(false);
            };

            window.speechSynthesis.speak(utterance);
        } catch (err) {
            console.error('TTS Error:', err);
            setSpeaking(false);
        }
    };

    React.useEffect(() => {
        const load = () => window.speechSynthesis.getVoices();
        load();
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
            window.speechSynthesis.onvoiceschanged = load;
        }
        return () => window.speechSynthesis.cancel();
    }, []);

    const handleFileChange = async (e) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            setError(null);
            setResult(null);
            setRawText('');

            // Perform local text extraction
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
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container" style={{ maxWidth: '900px', margin: '0 auto' }}>
            <header style={{ marginBottom: '3rem', textAlign: 'center' }}>
                <Logo />
                <h1 style={{ fontSize: '3.5rem', letterSpacing: '-2px', marginTop: '0.5rem' }}>MEDINSIGHT <span style={{ color: 'var(--secondary)' }}>AI</span></h1>
                <p className="badge accent-bg">Patient-Friendly Medical Analysis</p>
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
                                        onClick={() => {
                                            navigator.clipboard.writeText(rawText);
                                            alert('Text copied to clipboard!');
                                        }}
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
                            {!extracting && (
                                <p style={{ marginTop: '1rem', fontSize: '0.85rem', fontWeight: 600, color: '#666' }}>
                                    Verify the text above before clicking Analyze.
                                </p>
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
                                    style={{
                                        width: '100%',
                                        padding: '1rem',
                                        border: '3px solid black',
                                        borderRadius: 0,
                                        fontSize: '1.1rem',
                                        fontWeight: 700,
                                        background: 'white',
                                    }}
                                />
                            </div>

                            <button
                                className="neo-btn"
                                onClick={handleAnalyze}
                                disabled={!file || loading || extracting}
                                style={{ width: '100%', justifyContent: 'center', fontSize: '1.2rem' }}
                            >
                                {loading ? <Loader2 className="animate-spin" /> : 'Analyze Now'}
                            </button>
                        </section>
                    )}
                </section>

                {error && (
                    <div className="neo-card secondary-bg" style={{ marginBottom: '2rem', color: 'white' }}>
                        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <AlertCircle size={32} /> Analysis Failed
                        </h2>
                        <p style={{ fontWeight: 700 }}>{error}</p>
                    </div>
                )}

                {result && (
                    <div style={{ display: 'grid', gap: '2rem' }}>
                        <div className="neo-card" style={{
                            borderLeft: '10px solid',
                            borderColor: result.risk_level === 'High' ? 'var(--secondary)' :
                                result.risk_level === 'Medium' ? 'var(--primary)' : 'var(--accent)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 0 }}>
                                    <FileText size={32} /> Summary
                                </h2>
                                <div className="badge" style={{
                                    background: result.risk_level === 'High' ? 'var(--secondary)' :
                                        result.risk_level === 'Medium' ? 'var(--primary)' : 'var(--accent)',
                                    color: result.risk_level === 'High' ? 'white' : 'black',
                                    border: '2px solid black'
                                }}>
                                    Risk: {result.risk_level}
                                </div>
                            </div>
                            <p style={{ fontSize: '1.2rem', fontWeight: 500 }}>{result.summary}</p>
                        </div>

                        <div className="neo-card" style={{ borderLeft: '10px solid var(--black)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 0 }}>
                                    <Languages size={32} /> {targetLanguage} Translation
                                </h2>
                                <button
                                    onClick={() => speak(result.hindi_translation, targetLanguage)}
                                    className="neo-btn"
                                    style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.9rem' }}
                                >
                                    {speaking ? <VolumeX size={18} /> : <Volume2 size={18} />}
                                    {speaking ? 'Stop' : 'Listen'}
                                </button>
                            </div>
                            <p style={{ fontSize: '1.2rem', fontWeight: 500 }}>{result.hindi_translation}</p>
                        </div>

                        {result.key_findings && result.key_findings.length > 0 && (
                            <div className="neo-card vibrant-bg">
                                <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Activity size={32} /> Key Findings
                                </h2>
                                <ul style={{ listStyle: 'none', padding: 0 }}>
                                    {result.key_findings.map((finding, i) => (
                                        <li key={i} style={{
                                            background: 'white',
                                            border: '2px solid black',
                                            padding: '0.8rem',
                                            marginBottom: '0.5rem',
                                            fontWeight: 600,
                                            boxShadow: '2px 2px 0px black'
                                        }}>
                                            {finding}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="neo-card" style={{ textAlign: 'center', background: '#e0e0e0' }}>
                            <p style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>
                                Disclaimer: Not a medical diagnosis. Consult a doctor for professional advice.
                            </p>
                        </div>
                    </div>
                )}
            </main>

            <style dangerouslySetInnerHTML={{
                __html: `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}} />
        </div>
    );
}

export default App;
