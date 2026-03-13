import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, FileText, Activity, Users, ArrowRight } from 'lucide-react';
import StaggeredMenu from '../components/StaggeredMenu';

const Hub = () => {
    const navigate = useNavigate();

    const menuItems = [
        { label: 'Analyzer', link: '/analyzer', ariaLabel: 'Go to Analyzer', hoverColor: '#a855f7' },
        { label: 'Vitals', link: '/vitals', ariaLabel: 'Go to Vitals', hoverColor: '#ef4444' },
        { label: 'Patients', link: '/patients', ariaLabel: 'Go to Patients', hoverColor: '#eab308' },
        { label: 'Hospital Dash', link: '/dash', ariaLabel: 'Go to Admin Dashboard', hoverColor: '#3b82f6' },
        { label: 'Profile', link: '/profile', ariaLabel: 'Go to Profile', hoverColor: 'green' }
    ];

    return (
        <div style={{ position: 'fixed', inset: 0, background: '#ffffff', fontFamily: 'inherit', overflowY: 'auto', zIndex: 10 }}>
            <StaggeredMenu
                position="right"
                items={menuItems}
                socialItems={[]}
                logoUrl=""
                accentColor="#1a1a1a"
                menuButtonColor="#000"
                openMenuButtonColor="#fff"
                changeMenuColorOnOpen={true}
                isFixed={true}
                colors={['#d8b4e2', '#1a1a1a']}
            />
            
            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '4rem 2rem' }}>
                <header style={{ marginBottom: '4rem', textAlign: 'center' }}>
                    <h1 style={{ fontSize: '4rem', margin: '0 0 1rem', letterSpacing: '-2px', color: '#1a1a1a' }}>
                        MEDINSIGHT <span style={{ color: 'var(--primary)' }}>HUB</span>
                    </h1>
                    <p style={{ fontSize: '1.2rem', color: '#4b5563', maxWidth: '600px', margin: '0 auto', fontWeight: 500 }}>
                        Select a core module to launch the specialized AI interface.
                    </p>
                </header>

                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', 
                    gap: '2rem',
                    marginBottom: '4rem'
                }}>
                    
                    {/* Vitals AI Card */}
                    <div 
                        className="neo-card"
                        onClick={() => navigate('/vitals')}
                        style={{
                            background: '#fef2f2', 
                            padding: '3rem 2rem', 
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            textAlign: 'center',
                            border: '4px solid black',
                            boxShadow: '8px 8px 0px black',
                            transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translate(-4px, -4px)';
                            e.currentTarget.style.boxShadow = '12px 12px 0px black';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translate(0, 0)';
                            e.currentTarget.style.boxShadow = '8px 8px 0px black';
                        }}
                    >
                        <div style={{ 
                            background: '#ef4444', 
                            padding: '1.5rem', 
                            borderRadius: '50%', 
                            border: '3px solid black',
                            marginBottom: '1.5rem',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center'
                        }}>
                            <Heart size={48} color="white" fill="white" className="animate-pulse" />
                        </div>
                        <h2 style={{ fontSize: '2.5rem', margin: '0 0 1rem', color: '#1a1a1a' }}>Vitals Tracker</h2>
                        <p style={{ fontSize: '1.1rem', color: '#4b5563', margin: '0 0 2rem', fontWeight: 500 }}>
                            Real-time rPPG contactless physiological monitoring for instant cardiovascular assessment.
                        </p>
                        <button className="neo-btn" style={{ background: '#1a1a1a', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem', width: '100%', justifyContent: 'center' }}>
                            Launch AI Camera <ArrowRight size={20} />
                        </button>
                    </div>

                    {/* Document Analyzer Card */}
                    <div 
                        className="neo-card"
                        onClick={() => navigate('/analyzer')}
                        style={{
                            background: '#f0fdf4', 
                            padding: '3rem 2rem', 
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            textAlign: 'center',
                            border: '4px solid black',
                            boxShadow: '8px 8px 0px black',
                            transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translate(-4px, -4px)';
                            e.currentTarget.style.boxShadow = '12px 12px 0px black';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translate(0, 0)';
                            e.currentTarget.style.boxShadow = '8px 8px 0px black';
                        }}
                    >
                        <div style={{ 
                            background: '#22c55e', 
                            padding: '1.5rem', 
                            borderRadius: '50%', 
                            border: '3px solid black',
                            marginBottom: '1.5rem',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center'
                        }}>
                            <FileText size={48} color="white" />
                        </div>
                        <h2 style={{ fontSize: '2.5rem', margin: '0 0 1rem', color: '#1a1a1a' }}>Document Eng.</h2>
                        <p style={{ fontSize: '1.1rem', color: '#4b5563', margin: '0 0 2rem', fontWeight: 500 }}>
                            Upload legacy reports for immediate OCR extraction, AI risk analysis, and translation.
                        </p>
                        <button className="neo-btn" style={{ background: '#1a1a1a', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem', width: '100%', justifyContent: 'center' }}>
                            Open Analyzer <ArrowRight size={20} />
                        </button>
                    </div>

                </div>

                {/* System Mini Stat Footer */}
                <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <div className="neo-card" onClick={() => navigate('/dash')} style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'white', padding: '1rem 2rem', cursor: 'pointer', border: '3px solid black' }}>
                        <Activity color="var(--primary)" size={32} />
                        <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>System Status</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1a1a1a' }}>All Nodes Operational</div>
                        </div>
                    </div>

                    <div className="neo-card" onClick={() => navigate('/patients')} style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#eff6ff', padding: '1rem 2rem', cursor: 'pointer', border: '3px solid black' }}>
                        <Users color="#3b82f6" size={32} />
                        <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Currently Active</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1a1a1a' }}>24 Registered Patients</div>
                        </div>
                    </div>
                </div>

            </div>
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes pulse {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.1); }
                    100% { transform: scale(1); }
                }
                .animate-pulse {
                    animation: pulse 1s infinite cubic-bezier(0.4, 0, 0.6, 1);
                }
            `}} />
        </div>
    );
};

export default Hub;
