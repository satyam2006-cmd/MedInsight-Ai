import React from 'react';
import StaggeredMenu from '../components/StaggeredMenu';
import { ArrowLeft, Activity, UserCheck, ChevronRight } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import VitalsMonitor from '../components/VitalsMonitor';

const VitalsPage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const patientIdFromUrl = searchParams.get('patient') || '';

    const menuItems = [
        { label: 'Hub', link: '/', ariaLabel: 'Go to Hub', hoverColor: '#a855f7' },
        { label: 'Overview', link: '/dash', ariaLabel: 'Go to Overview', hoverColor: 'yellow' },
        { label: 'Patients', link: '/patients', ariaLabel: 'Go to Patients', hoverColor: 'red' },
        { label: 'Reports', link: '/reports', ariaLabel: 'Go to Reports', hoverColor: '#4d96ff' },
        { label: 'Analyzer', link: '/analyzer', ariaLabel: 'Go to Analyzer', hoverColor: '#a855f7' },
        { label: 'Profile', link: '/profile', ariaLabel: 'Go to Profile', hoverColor: 'green' }
    ];

    const socialItems = [
        { label: 'Help', link: '#' },
        { label: 'Support', link: '#' },
        { label: 'Documentation', link: '#' }
    ];

    return (
        <div style={{ position: 'fixed', inset: 0, background: '#ffffff', fontFamily: 'inherit', overflowY: 'auto', zIndex: 30 }}>
            <StaggeredMenu
                position="right"
                items={menuItems}
                socialItems={socialItems}
                logoUrl=""
                accentColor="#5227FF"
                menuButtonColor="#fff"
                openMenuButtonColor="#000"
                changeMenuColorOnOpen={true}
                isFixed={true}
                colors={['#B19EEF', '#5227FF']}
            />

            <div style={{ padding: '3rem 2rem', maxWidth: '1400px', margin: '0 auto', zIndex: 1, position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => navigate('/')}
                        className="neo-btn"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', color: 'black', padding: '0.5rem 1rem' }}
                    >
                        <ArrowLeft size={18} /> Back to Hub
                    </button>
                    {patientIdFromUrl && (
                        <button
                            onClick={() => navigate('/patients')}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: '#eef2ff', border: '2px solid #5227FF', color: '#3730a3', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}
                        >
                            <ArrowLeft size={15} /> Back to Patients
                        </button>
                    )}
                </div>

                {patientIdFromUrl && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', padding: '1rem 1.5rem', background: 'linear-gradient(135deg, #eef2ff 0%, #f0fdf4 100%)', border: '2px solid #5227FF', boxShadow: '4px 4px 0px #5227FF', borderRadius: '4px' }}>
                        <div style={{ background: '#5227FF', padding: '0.6rem', borderRadius: '8px', flexShrink: 0 }}>
                            <UserCheck size={22} color="white" />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#5227FF', letterSpacing: '0.8px', textTransform: 'uppercase' }}>Linked Patient Session</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#1a1a1a', marginTop: '0.1rem' }}>Patient ID: <span style={{ color: '#5227FF' }}>{patientIdFromUrl}</span></div>
                            <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '0.1rem' }}>This vitals session will be saved against the patient record above. Click <strong>Save Session</strong> when done.</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', color: '#059669', fontWeight: 700, background: '#f0fdf4', padding: '0.4rem 0.8rem', border: '1px solid #bbf7d0', borderRadius: '20px' }}>
                            <span style={{ width: 8, height: 8, background: '#22c55e', borderRadius: '50%', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
                            Active
                        </div>
                    </div>
                )}

                <header style={{ marginBottom: '3rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
                        <div style={{ 
                            background: 'var(--primary)', 
                            padding: '1rem', 
                            border: '4px solid black', 
                            boxShadow: '6px 6px 0px black' 
                        }}>
                            <Activity size={40} color="white" strokeWidth={3} />
                        </div>
                        <div>
                            <h1 style={{ fontSize: '3rem', margin: '0', color: '#1a1a1a', letterSpacing: '-2px' }}>Vitals AI <span style={{ color: 'var(--secondary)' }}>Remote</span></h1>
                            <p style={{ color: '#666', marginTop: '0.2rem', fontSize: '1.2rem', fontWeight: 500 }}>Advanced contactless physiological monitoring system.</p>
                        </div>
                    </div>
                </header>

                <div style={{ width: '100%' }}>
                    <VitalsMonitor initialPatientId={patientIdFromUrl} />
                    
                    <section className="neo-card" style={{ marginTop: '2rem', background: '#f8f9ff', padding: '1.5rem', borderLeft: '10px solid var(--primary)' }}>
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
        </div>
    );
};

export default VitalsPage;
