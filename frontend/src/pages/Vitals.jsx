import React from 'react';
import { ArrowLeft, Activity, UserCheck, LayoutGrid } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import VitalsMonitor from '../components/VitalsMonitor';
import GlobalSidebar from '../components/GlobalSidebar';

const VitalsPage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const patientIdFromUrl = searchParams.get('patient') || '';

    return (
        <div className="app-shell">
            <GlobalSidebar />

            <main className="app-main">
                <button
                    onClick={() => navigate('/')}
                    className="staggered-enter app-back-btn"
                >
                    <ArrowLeft size={16} />
                    BACK TO HUB
                </button>
            <div style={{ maxWidth: '1400px', margin: '0 auto', zIndex: 1, position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                    {patientIdFromUrl && (
                        <button
                            onClick={() => navigate('/patients')}
                            className="staggered-enter"
                            style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '0.6rem', 
                                padding: '0.6rem 1.4rem', 
                                background: '#eef2ff', 
                                border: '1.5px solid #5227FF', 
                                color: '#3730a3', 
                                fontWeight: 700, 
                                cursor: 'pointer', 
                                fontSize: '0.8rem',
                                borderRadius: '99px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                            }}
                        >
                            <ArrowLeft size={16} /> BACK TO PATIENTS
                        </button>
                    )}
                </div>

                {patientIdFromUrl && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap', marginBottom: '1rem', padding: '0.9rem 1rem', background: 'linear-gradient(135deg, #eef2ff 0%, #f0fdf4 100%)', border: '2px solid #5227FF', boxShadow: '3px 3px 0px #5227FF', borderRadius: '8px' }}>
                        <div style={{ background: '#5227FF', padding: '0.6rem', borderRadius: '8px', flexShrink: 0 }}>
                            <UserCheck size={22} color="white" />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#5227FF', letterSpacing: '0.8px', textTransform: 'uppercase' }}>Linked Patient Session</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#1a1a1a', marginTop: '0.1rem' }}>Patient ID: <span style={{ color: '#5227FF' }}>{patientIdFromUrl}</span></div>
                            <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '0.1rem' }}>This vitals session will be saved against the patient record above. Click <strong>Save Session</strong> when done.</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.74rem', color: '#059669', fontWeight: 700, background: '#f0fdf4', padding: '0.35rem 0.65rem', border: '1px solid #bbf7d0', borderRadius: '20px' }}>
                            <span style={{ width: 8, height: 8, background: '#22c55e', borderRadius: '50%', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
                            Active
                        </div>
                    </div>
                )}

                <header className="staggered-enter hero-unboxed" style={{ marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                        <div style={{ 
                            background: 'var(--primary)', 
                            padding: '1rem', 
                            border: '1px solid rgba(32, 42, 48, 0.35)', 
                            borderRadius: '12px'
                        }}>
                            <Activity size={40} color="white" strokeWidth={3} />
                        </div>
                        <div>
                            <h1 style={{ fontSize: 'clamp(2rem, 6vw, 3rem)', margin: '0', color: '#1a1a1a', letterSpacing: '-2px' }}>Vitals AI <span style={{ color: 'var(--secondary)' }}>Remote</span></h1>
                            <p style={{ color: '#666', marginTop: '0.2rem', fontSize: 'clamp(0.95rem, 3.2vw, 1.2rem)', fontWeight: 500 }}>Advanced contactless physiological monitoring system.</p>
                        </div>
                    </div>
                </header>

                <div className="module-content" style={{ width: '100%', display: 'grid', gap: '2rem' }}>
                    <div className="neo-card brutal-border" style={{ background: 'white', padding: 'clamp(1rem, 3.5vw, 1.6rem)' }}>
                        <VitalsMonitor initialPatientId={patientIdFromUrl} />
                    </div>
                    
                    <section className="neo-card brutal-border panel-soft" style={{ marginTop: '2rem', background: '#f8f9ff', padding: '1.5rem', borderLeft: '6px solid var(--primary)' }}>
                        <h4 style={{ margin: '0 0 1rem' }}>How it works</h4>
                        <p style={{ margin: 0, color: '#444', lineHeight: '1.6' }}>
                            Our AI-powered system uses <strong>Remote Photoplethysmography (rPPG)</strong> to detect micro-changes 
                            in skin color caused by blood flow. By analyzing these signals from your forehead region, 
                            we can estimate your heart rate and respiration rate without any physical contact.
                        </p>
                        <ul style={{ marginTop: '1rem', color: '#444', fontSize: '0.9rem' }}>
                            <li>Ensure your face is well-lit and clearly visible.</li>
                            <li>Try to keep your head still within the alignment guide.</li>
                            <li>Allow a few seconds for the system to calibrate and collect signal data.</li>
                        </ul>
                    </section>
                </div>
            </div>
            </main>
        </div>
    );
};

export default VitalsPage;
