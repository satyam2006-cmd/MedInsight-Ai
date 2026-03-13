import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Activity,
    ArrowRight,
    Command,
    FileText,
    HeartPulse,
    ShieldCheck,
    UserRound,
    Users
} from 'lucide-react';

const moduleCards = [
    {
        id: 'vitals',
        title: 'Vitals Deck',
        subtitle: 'Contactless monitoring and live session capture.',
        detail: 'Launch camera pipeline and monitor heart, respiration, and SpO2 flow in one panel.',
        route: '/vitals',
        tone: 'linear-gradient(145deg, #2f5d62 0%, #365159 45%, #20343a 100%)',
        icon: HeartPulse,
        metric: 'Live Signals'
    },
    {
        id: 'analyzer',
        title: 'Report Forge',
        subtitle: 'OCR extraction and AI interpretation workspace.',
        detail: 'Process uploaded documents, generate structured findings, and use target-language output.',
        route: '/analyzer',
        tone: 'linear-gradient(145deg, #c84d2f 0%, #9c3922 45%, #682f21 100%)',
        icon: FileText,
        metric: 'Insight Engine'
    },
    {
        id: 'patients',
        title: 'Patient Registry',
        subtitle: 'Onboard records and connect reports to care context.',
        detail: 'Create patient entries, attach report files, and jump directly to vitals from each row.',
        route: '/patients',
        tone: 'linear-gradient(145deg, #de9f34 0%, #b37f2b 52%, #7f571c 100%)',
        icon: Users,
        metric: 'Care Index'
    }
];

const quickActions = [
    { label: 'Hospital Dashboard', route: '/dash', icon: Activity },
    { label: 'Patient Reports', route: '/reports', icon: ShieldCheck },
    { label: 'Hospital Profile', route: '/profile', icon: UserRound },
    { label: 'Sign-In Console', route: '/signins', icon: Command }
];

const Hub = () => {
    const navigate = useNavigate();

    return (
        <div className="v2-shell" role="main" aria-label="MedInsight mission control">
            <aside className="v2-side staggered-enter" aria-label="Primary navigation and status" style={{ display: 'grid', gap: '1.25rem' }}>
                <div>
                    <div className="kicker" style={{ color: '#d1e4de' }}>Healthcare Ops Mesh</div>
                    <h1 style={{ marginTop: '0.8rem', fontSize: '2.05rem', color: '#f6f4e9' }}>MedInsight Control Room</h1>
                    <p style={{ color: '#d2d7cf', marginTop: '0.8rem' }}>
                        A mission dashboard for hospital teams running document intelligence and real-time vitals in parallel.
                    </p>
                </div>

                <div className="neo-card" style={{ background: 'rgba(241, 246, 241, 0.09)', borderColor: '#d6ebe1', color: '#f6f4e9' }}>
                    <div className="kicker" style={{ color: '#d1e4de' }}>Session Pulse</div>
                    <div style={{ display: 'grid', gap: '0.7rem', marginTop: '0.8rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                            <span>Signal Node</span>
                            <span style={{ color: '#98f5bf' }}>Online</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                            <span>AI Queue</span>
                            <span>Ready</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                            <span>Registry</span>
                            <span>Synced</span>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'grid', gap: '0.6rem' }}>
                    {quickActions.map((action) => {
                        const Icon = action.icon;
                        return (
                            <button
                                key={action.label}
                                type="button"
                                onClick={() => navigate(action.route)}
                                className="neo-btn"
                                style={{
                                    width: '100%',
                                    justifyContent: 'space-between',
                                    background: 'rgba(232, 239, 233, 0.14)',
                                    borderColor: '#c8e3d7',
                                    color: '#f8f4ea'
                                }}
                            >
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Icon size={15} /> {action.label}
                                </span>
                                <ArrowRight size={16} />
                            </button>
                        );
                    })}
                </div>
            </aside>

            <section className="v2-main">
                <header className="neo-card staggered-enter" style={{ display: 'grid', gap: '1.1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '1rem', flexWrap: 'wrap' }}>
                        <div>
                            <div className="kicker">Command Palette</div>
                            <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 3rem)', marginTop: '0.4rem' }}>Orchestrate Patient Intelligence</h2>
                            <p style={{ maxWidth: 620, marginTop: '0.8rem' }}>
                                Route from ingestion to analysis and bedside action. Every module remains available, now grouped by clinical workflow rather than scattered navigation.
                            </p>
                        </div>
                        <button type="button" className="neo-btn" onClick={() => navigate('/dash')}>
                            Enter Secure Workspace <ArrowRight size={18} />
                        </button>
                    </div>

                    <div
                        className="neo-card"
                        style={{
                            background: 'var(--bg-panel)',
                            borderStyle: 'dashed',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.8rem',
                            flexWrap: 'wrap'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', fontWeight: 700 }}>
                            <Command size={16} />
                            <span>Power Shortcut</span>
                        </div>
                        <div style={{ color: 'var(--text-muted)' }}>Use semantic module jumps from one command bar.</div>
                        <div className="badge">Ctrl + K</div>
                    </div>
                </header>

                <div className="staggered-enter" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.2rem' }}>
                    {moduleCards.map((card) => {
                        const Icon = card.icon;
                        return (
                            <article
                                key={card.id}
                                className="neo-card"
                                style={{
                                    background: card.tone,
                                    color: '#f8f3ea',
                                    display: 'grid',
                                    gap: '1rem',
                                    minHeight: 250,
                                    borderColor: 'rgba(235, 229, 210, 0.8)'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span className="badge" style={{ background: 'rgba(255,255,255,0.12)', color: '#f8f3ea', borderColor: 'rgba(255,255,255,0.5)' }}>
                                        {card.metric}
                                    </span>
                                    <Icon size={26} />
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '1.55rem', marginBottom: '0.5rem' }}>{card.title}</h3>
                                    <p style={{ color: 'rgba(246, 241, 230, 0.95)', fontWeight: 600 }}>{card.subtitle}</p>
                                    <p style={{ marginTop: '0.7rem', color: 'rgba(246, 241, 230, 0.88)' }}>{card.detail}</p>
                                </div>
                                <div>
                                    <button
                                        type="button"
                                        className="neo-btn"
                                        onClick={() => navigate(card.route)}
                                        style={{ background: '#f8f4e9', color: '#1b242a', borderColor: '#f8f4e9', width: '100%' }}
                                    >
                                        Open {card.title} <ArrowRight size={16} />
                                    </button>
                                </div>
                            </article>
                        );
                    })}
                </div>

                <section className="neo-card staggered-enter" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem', alignItems: 'center' }}>
                    <div>
                        <div className="kicker">Workflow Path</div>
                        <h3 style={{ marginTop: '0.45rem', fontSize: '1.3rem' }}>Capture | Analyze | Share | Follow-up</h3>
                        <p style={{ marginTop: '0.55rem' }}>
                            Module architecture now follows clinical sequence: acquire vitals, process records, register patients, then distribute translated summaries.
                        </p>
                    </div>
                    <button type="button" className="neo-btn" onClick={() => navigate('/reports')}>
                        Open Reports Layer <ArrowRight size={16} />
                    </button>
                </section>
            </section>
        </div>
    );
};

export default Hub;
