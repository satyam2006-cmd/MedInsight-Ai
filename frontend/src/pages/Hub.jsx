import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import GlobalSidebar from '../components/GlobalSidebar';
import { ArrowRight, HeartPulse, FileScan, Users } from 'lucide-react';

const moduleCards = [
    {
        id: 'vitals',
        title: 'VITALS DECK',
        subtitle: 'Contactless monitoring and live session capture.',
        detail: 'Launch camera pipeline and monitor heart, respiration, and SpO2 flow in one panel.',
        route: '/vitals',
        tone: 'linear-gradient(135deg, #375361 0%, #2f4551 100%)', // accurately matched slate/teal
        metric: 'LIVE SIGNALS',
        image: '/assets/heart3d.png',
        icon: HeartPulse
    },
    {
        id: 'analyzer',
        title: 'REPORT FORGE',
        subtitle: 'OCR extraction and AI interpretation workspace.',
        detail: 'Process uploaded documents, generate structured findings, and use target-language output.',
        route: '/analyzer',
        tone: 'linear-gradient(135deg, #be4f33 0%, #a23a20 100%)', // accurately matched rust orange
        metric: 'INSIGHT ENGINE',
        image: '/assets/liver3d.png',
        icon: FileScan
    },
    {
        id: 'patients',
        title: 'PATIENT REGISTRY',
        subtitle: 'Onboard records and connect reports to care context.',
        detail: 'Create patient entries, attach report files, and jump directly to vitals from each row.',
        route: '/patients',
        tone: 'linear-gradient(135deg, #d39a31 0%, #bb821d 100%)', // accurately matched mustard gold
        metric: 'CARE INDEX',
        image: '/assets/cells3d.png',
        icon: Users
    }
];

const Hub = () => {
    const navigate = useNavigate();
    const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 768px)').matches);

    useEffect(() => {
        const media = window.matchMedia('(max-width: 768px)');
        const onChange = (event) => setIsMobile(event.matches);
        media.addEventListener('change', onChange);
        return () => media.removeEventListener('change', onChange);
    }, []);

    return (
        <div className="app-shell">
            <GlobalSidebar />

            <main className="app-main app-main-lg">
                {isMobile ? (
                    <div className="page-container mobile-hub-stack">
                        <header className="hero-unboxed mobile-hub-header">
                            <div className="mobile-hub-kicker">Clinical Workspace</div>
                            <h2>Care Hub</h2>
                            <p>Choose a module to start monitoring, analyzing, or managing patients in one tap.</p>
                        </header>

                        <section className="mobile-hub-cards">
                            {moduleCards.map((card) => {
                                const Icon = card.icon;

                                return (
                                    <button
                                        key={card.id}
                                        type="button"
                                        className="mobile-hub-card brutal-border"
                                        style={{ background: card.tone }}
                                        onClick={() => navigate(card.route)}
                                    >
                                        <div className="mobile-hub-card-top">
                                            <div className="mobile-hub-chip">{card.metric}</div>
                                            <Icon size={18} />
                                        </div>
                                        <h3>{card.title}</h3>
                                        <p>{card.subtitle}</p>
                                        <div className="mobile-hub-cta">
                                            Open <ArrowRight size={14} />
                                        </div>
                                    </button>
                                );
                            })}
                        </section>
                    </div>
                ) : (
                <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
                    
                    {/* Header Section */}
                    <header className="staggered-enter hero-unboxed" style={{ marginBottom: '1.25rem' }}>
                        <div style={{ 
                            fontSize: '0.85rem', 
                            fontWeight: 700, 
                            color: 'var(--primary)', 
                            textTransform: 'uppercase', 
                            letterSpacing: '1.5px',
                            marginBottom: '1rem' 
                        }}>
                            Clinical Workspace
                        </div>
                        <h2 style={{ 
                            fontSize: 'clamp(2.2rem, 8vw, 4.8rem)', 
                            fontWeight: 400, 
                            color: '#1e293b', 
                            letterSpacing: '-3px', 
                            lineHeight: 1,
                            marginBottom: '1.5rem'
                        }}>
                            Fluid communication <br /> between <span style={{ color: 'var(--primary)', fontWeight: 600 }}>patients</span> and <span style={{ color: '#0ea5e9', fontWeight: 600 }}>care teams</span>
                        </h2>
                        <p style={{ 
                            fontSize: 'clamp(1rem, 3.5vw, 1.3rem)', 
                            color: '#64748b', 
                            maxWidth: '750px', 
                            lineHeight: 1.6,
                            marginBottom: '1.5rem'
                        }}>
                            From real-time vitals ingestion to deep AI analysis. Our unboxed interface
                            removes barriers, placing patient data at the center of your clinical workflow.
                        </p>
                    </header>

                    {/* Module Cards Grid */}
                    <div className="hub-modules-grid" style={{ gap: '2.5rem' }}>
                        {moduleCards.map((card) => (
                            <article
                                key={card.id}
                                className="brutal-border"
                                style={{
                                    background: card.tone,
                                    color: '#fff',
                                    borderRadius: '16px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    overflow: 'hidden',
                                    position: 'relative',
                                    transition: 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                    cursor: 'pointer'
                                }}
                                onClick={() => navigate(card.route)}
                            >
                                {/* Top Half - Two Columns */}
                                <div className="hub-module-top">
                                    
                                    {/* Left Content Area */}
                                    <div style={{ padding: 'clamp(1rem, 4vw, 2.5rem) clamp(1rem, 3vw, 2rem) 1rem clamp(1rem, 4vw, 2.5rem)', display: 'flex', flexDirection: 'column' }}>
                                        <div style={{ 
                                            display: 'inline-block', 
                                            padding: '0.4rem 0.8rem', 
                                            border: '2px solid #000', 
                                            background: '#fff',
                                            color: '#000',
                                            borderRadius: '4px', 
                                            fontSize: '0.7rem', 
                                            fontWeight: 800, 
                                            letterSpacing: '0.5px',
                                            alignSelf: 'flex-start',
                                            marginBottom: '1rem',
                                            boxShadow: '2px 2px 0px #000'
                                        }}>
                                            {card.metric}
                                        </div>
                                        <h3 style={{ fontSize: 'clamp(1.15rem, 4vw, 1.8rem)', fontWeight: 900, marginBottom: '0.5rem', letterSpacing: '-0.5px' }}>
                                            {card.title}
                                        </h3>
                                        <p style={{ fontSize: '0.9rem', fontWeight: 700, color: 'rgba(255,255,255,0.95)', marginBottom: '1rem', lineHeight: 1.4 }}>
                                            {card.subtitle}
                                        </p>
                                        <p style={{ fontSize: 'clamp(0.8rem, 2.8vw, 0.9rem)', color: 'rgba(255,255,255,0.8)', lineHeight: 1.5 }}>
                                            {card.detail}
                                        </p>
                                    </div>

                                    {/* Right Image Area */}
                                    <div style={{ 
                                        position: 'relative', 
                                        background: 'rgba(255,255,255,0.1)', 
                                        borderLeft: '4px solid #000',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        overflow: 'hidden'
                                    }}>
                                        <img 
                                            src={card.image} 
                                            alt={card.title} 
                                            style={{ 
                                                width: '100%', 
                                                height: 'auto', 
                                                objectFit: 'contain',
                                                filter: 'drop-shadow(0 10px 10px rgba(0,0,0,0.4))',
                                                transform: 'scale(1.05)',
                                                position: 'relative',
                                                zIndex: 1
                                            }} 
                                        />
                                    </div>
                                </div>

                                {/* Bottom Action Strip */}
                                <div style={{ padding: '0 clamp(1rem, 4vw, 2.5rem) clamp(1rem, 4vw, 2.5rem)', marginTop: 'auto' }}>
                                    <div
                                        style={{
                                            background: '#000',
                                            color: '#fff',
                                            fontWeight: 800,
                                            fontSize: '0.8rem',
                                            padding: '0.8rem 1.5rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            textTransform: 'uppercase',
                                            letterSpacing: '1px',
                                            width: 'fit-content',
                                            border: '2px solid #fff',
                                            boxShadow: '4px 4px 0px #fff'
                                        }}
                                    >
                                        OPEN MODULE <ArrowRight size={16} />
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>

                </div>
                )}
            </main>
        </div>
    );
};

export default Hub;
