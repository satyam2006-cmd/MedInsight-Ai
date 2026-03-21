import React, { useState, useEffect } from 'react';
import { Upload, Languages, Loader2, Search, Brain, History, AlertCircle, FileText, CheckCircle, Activity, Download, FileSearch, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { extractText } from '../ocr-engine/services/hybridService.js';
import { API_BASE_URL } from '../lib/config';
import { supabase } from '../lib/supabaseClient';
import GlobalSidebar from '../components/GlobalSidebar';


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

    const speak = (text, langCode) => {
        if (speaking) {
            window.speechSynthesis.cancel();
            setSpeaking(false);
            return;
        }

        if (!text) return;

        const utterance = new SpeechSynthesisUtterance(text);
        
        // Voice selection logic
        const voices = window.speechSynthesis.getVoices();
        // Try to find a voice that matches the langCode (e.g., 'hi-IN')
        // Prioritize "Google" or "Natural" voices if available
        let bestVoice = voices.find(v => v.lang === langCode && (v.name.includes('Google') || v.name.includes('Natural')));
        if (!bestVoice) bestVoice = voices.find(v => v.lang.startsWith(langCode.split('-')[0]));
        if (!bestVoice) bestVoice = voices.find(v => v.default);

        if (bestVoice) {
            utterance.voice = bestVoice;
        }
        
        utterance.lang = langCode;
        utterance.rate = 0.95; // Slightly slower for clinical clarity
        utterance.pitch = 1.0;

        utterance.onstart = () => setSpeaking(true);
        utterance.onend = () => setSpeaking(false);
        utterance.onerror = () => setSpeaking(false);

        window.speechSynthesis.speak(utterance);
    };

    useEffect(() => {
        return () => {
            window.speechSynthesis.cancel();
        };
    }, []);

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

                <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
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
                            <FileSearch size={32} />
                        </div>
                        <div>
                            <h1 className="page-hero-title" style={{ fontWeight: 400, letterSpacing: '-2px', color: '#1e293b', margin: 0 }}>
                                Document <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Analyzer</span>
                            </h1>
                            <p style={{ fontSize: 'clamp(0.95rem, 3.2vw, 1.2rem)', color: '#64748b', marginTop: '0.2rem' }}>
                                AI-Powered Medical Report Translation & Simplification
                            </p>
                        </div>
                    </div>
                </header>

                <div className="module-content" style={{ display: 'grid', gap: '1.25rem' }}>
                    <section className="staggered-enter" style={{ position: 'relative' }}>
                        <div className="analyzer-step-grid" style={{ gap: '1.25rem' }}>
                            {/* Left Side: Upload */}
                            <div className="neo-card brutal-border" style={{ background: 'white' }}>
                                <h3 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', color: '#1e293b', fontWeight: 500 }}>1. Provide Document</h3>
                                <div style={{
                                    border: '2px dashed rgba(0,0,0,0.1)',
                                    borderRadius: '24px',
                                    padding: 'clamp(1rem, 3.5vw, 2.2rem) clamp(0.9rem, 3vw, 1.5rem)',
                                    background: 'rgba(255,255,255,0.5)',
                                    textAlign: 'center',
                                    transition: 'all 0.3s ease'
                                }}>
                                    <input
                                        type="file"
                                        accept=".jpg,.jpeg,.png,.pdf"
                                        onChange={handleFileChange}
                                        id="file-upload"
                                        style={{ display: 'none' }}
                                    />
                                    <label htmlFor="file-upload" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Upload size={28} color="var(--primary)" />
                                        </div>
                                        <span style={{ fontWeight: 600, color: '#334155', fontSize: '1.1rem' }}>
                                            {file ? file.name : 'Click to upload medical document'}
                                        </span>
                                        <span style={{ fontSize: '0.9rem', color: '#64748b' }}>Supports JPG, PNG, PDF</span>
                                    </label>
                                </div>
                            </div>

                            {/* Right Side: Language & Analyze */}
                            <div className="neo-card brutal-border" style={{ background: 'white' }}>
                                <h3 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', color: '#1e293b', fontWeight: 500 }}>2. Analysis Target</h3>
                                <div style={{ display: 'grid', gap: '1.5rem' }}>
                                    <div>
                                        <label style={{ fontSize: '0.95rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.75rem' }}>
                                            Translate medical summary to:
                                        </label>
                                        <input
                                            type="text"
                                            value={targetLanguage}
                                            onChange={(e) => setTargetLanguage(e.target.value)}
                                            placeholder="e.g. Hindi, Spanish, Telugu"
                                            style={{ 
                                                width: '100%', 
                                                padding: '1.1rem 1.5rem', 
                                                borderRadius: '16px', 
                                                border: '1px solid #e2e8f0',
                                                fontSize: '1.1rem',
                                                outline: 'none',
                                                background: 'white',
                                                boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                                            }}
                                        />
                                    </div>
                                    <button
                                        className="neo-btn"
                                        onClick={handleAnalyze}
                                        disabled={!file || loading || extracting}
                                        style={{ 
                                            width: '100%', 
                                            padding: '1.3rem', 
                                            borderRadius: '18px',
                                            background: '#1e293b', 
                                            color: 'white',
                                            fontSize: '1.15rem',
                                            textTransform: 'none',
                                            fontWeight: 600,
                                            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'
                                        }}
                                    >
                                        {loading ? <Loader2 className="animate-spin" /> : 'Execute Analysis'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* 3. Results Section */}
                    {rawText && (
                        <div className="neo-card brutal-border staggered-enter" style={{ background: '#f8fafc', padding: '1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1rem' }}>
                                <FileSearch size={20} color="#64748b" />
                                <h4 style={{ margin: 0, textTransform: 'uppercase', fontSize: '0.9rem', color: '#64748b', letterSpacing: '1px' }}>Extracted Clinical Data</h4>
                            </div>
                            <div style={{ 
                                maxHeight: '200px', 
                                overflowY: 'auto', 
                                padding: '1rem', 
                                background: 'white', 
                                borderRadius: '12px', 
                                border: '1px solid #e2e8f0',
                                fontSize: '0.9rem',
                                color: '#334155',
                                fontFamily: 'monospace',
                                whiteSpace: 'pre-wrap'
                            }}>
                                {rawText}
                            </div>
                        </div>
                    )}

                    {result && (
                        <div className="staggered-enter" style={{ display: 'grid', gap: '2rem' }}>
                            {/* Summary Cards */}
                            <div className="analyzer-summary-grid">
                                {/* English Summary */}
                                <div className="neo-card brutal-border" style={{ background: 'white', borderLeft: '6px solid #1e293b' }}>
                                    <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <FileText size={20} /> English Summary
                                    </h3>
                                    <p style={{ fontSize: '1.1rem', lineHeight: '1.6', color: '#334155' }}>{result.summary}</p>
                                </div>

                                {/* Translated Summary */}
                                <div className="neo-card brutal-border" style={{ background: 'white', borderLeft: '6px solid var(--primary)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                        <h3 style={{ fontSize: '1.2rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <Languages size={20} color="var(--primary)" /> {result.target_language} Summary
                                        </h3>
                                        <button 
                                            onClick={() => speak(result.hindi_translation, ISO_LANGS[result.target_language.toLowerCase()] || 'en-US')}
                                            style={{
                                                background: speaking ? 'var(--primary)' : '#f1f5f9',
                                                color: speaking ? 'white' : '#1e293b',
                                                border: 'none',
                                                padding: '0.5rem 1rem',
                                                borderRadius: '50px',
                                                fontSize: '0.8rem',
                                                fontWeight: 700,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.5rem',
                                                transition: 'all 0.2s ease'
                                            }}
                                        >
                                            <Activity size={14} />
                                            {speaking ? 'Stop Audio' : 'Play Audio Summary'}
                                        </button>
                                    </div>
                                    <p style={{ fontSize: '1.3rem', lineHeight: '1.6', color: '#1e293b', fontWeight: 500 }}>
                                        {result.hindi_translation}
                                    </p>
                                </div>
                            </div>

                            {/* Risk Section */}
                            <div className="neo-card brutal-border" style={{ background: result.risk_level === 'High' ? '#fef2f2' : result.risk_level === 'Medium' ? '#fffbeb' : '#f0fdf4', borderLeft: '8px solid', borderColor: result.risk_level === 'High' ? '#ef4444' : result.risk_level === 'Medium' ? '#f59e0b' : '#10b981' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <AlertCircle size={32} color={result.risk_level === 'High' ? '#ef4444' : result.risk_level === 'Medium' ? '#f59e0b' : '#10b981'} />
                                    <div>
                                        <h4 style={{ margin: 0, fontSize: '1.5rem', color: '#1e293b' }}>Protocol: {result.risk_level} Attention Required</h4>
                                        <p style={{ margin: 0, color: '#64748b' }}>Clinical recommendation based on document severity assessment.</p>
                                    </div>
                                </div>
                            </div>

                            {/* Findings Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                                <div className="neo-card brutal-border panel-soft" style={{ background: 'white' }}>
                                    <h4 style={{ color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                        <CheckCircle size={18} color="#10b981" /> Key Medical Findings
                                    </h4>
                                    <ul style={{ padding: 0, margin: 0, listStyle: 'none' }}>
                                        {result.key_findings.map((f, i) => (
                                            <li key={i} style={{ padding: '0.75rem 0', borderBottom: i < result.key_findings.length - 1 ? '1px solid #f1f5f9' : 'none', color: '#334155', fontWeight: 500 }}>
                                                • {f}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="neo-card brutal-border panel-soft" style={{ background: 'white' }}>
                                    <h4 style={{ color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                        <Brain size={18} color="#f59e0b" /> Potential Health Concerns
                                    </h4>
                                    <ul style={{ padding: 0, margin: 0, listStyle: 'none' }}>
                                        {result.potential_concerns.map((c, i) => (
                                            <li key={i} style={{ padding: '0.75rem 0', borderBottom: i < result.potential_concerns.length - 1 ? '1px solid #f1f5f9' : 'none', color: '#334155', fontWeight: 500 }}>
                                                • {c}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                </div>
            </main>
        </div>
    );
};

export default AnalyzerPage;
