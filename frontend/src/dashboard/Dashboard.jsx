import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Activity,
    ArrowRight,
    Bell,
    FileText,
    HeartPulse,
    LayoutPanelLeft,
    ShieldPlus,
    UserRound,
    Users
} from 'lucide-react';

const statTiles = [
    {
        label: 'Patient Capacity',
        value: '1,248',
        hint: 'Tracked in registry',
        icon: Users,
        tone: 'rgba(47, 93, 98, 0.12)'
    },
    {
        label: 'AI Reports',
        value: '342',
        hint: 'Ready for review',
        icon: FileText,
        tone: 'rgba(200, 77, 47, 0.12)'
    },
    {
        label: 'System Status',
        value: 'Healthy',
        hint: 'Inference and data nodes synced',
        icon: Activity,
        tone: 'rgba(20, 122, 85, 0.14)'
    }
];

const workspaceActions = [
    {
        title: 'Vitals Monitoring Session',
        description: 'Open the live capture lab and launch contactless patient checkups.',
        route: '/vitals',
        icon: HeartPulse
    },
    {
        title: 'Patient Intake + Upload',
        description: 'Register a patient with report documents and language preference.',
        route: '/patients',
        icon: ShieldPlus
    },
    {
        title: 'Report Distribution',
        description: 'Access all generated analyses and share summaries with patients.',
        route: '/reports',
        icon: Bell
    }
];

const Dashboard = () => {
    const navigate = useNavigate();

    return (
        <div className="v2-shell" role="main" aria-label="Hospital secure workspace">
            <aside className="v2-side staggered-enter" style={{ display: 'grid', gap: '1.25rem' }}>
                <div>
                    <div className="kicker" style={{ color: '#d1e4de' }}>Secure Mode</div>
                    <h1 style={{ color: '#f8f3ea', marginTop: '0.8rem', fontSize: '1.9rem' }}>Hospital Workspace</h1>
                    <p style={{ marginTop: '0.7rem', color: '#d6ded3' }}>
                        One place to navigate critical modules and keep diagnostics, records, and reporting aligned.
                    </p>
                </div>

                <div className="neo-card" style={{ background: 'rgba(240, 244, 236, 0.08)', borderColor: '#d5e8e0' }}>
                    <div className="kicker" style={{ color: '#d6e5df' }}>Quick Links</div>
                    <div style={{ display: 'grid', gap: '0.55rem', marginTop: '0.8rem' }}>
                        <button type="button" className="neo-btn" onClick={() => navigate('/')} style={{ width: '100%', justifyContent: 'space-between', background: 'rgba(235,241,236,0.13)', borderColor: '#cde0d6', color: '#f8f3ea' }}>
                            Mission Control <ArrowRight size={15} />
                        </button>
                        <button type="button" className="neo-btn" onClick={() => navigate('/analyzer')} style={{ width: '100%', justifyContent: 'space-between', background: 'rgba(235,241,236,0.13)', borderColor: '#cde0d6', color: '#f8f3ea' }}>
                            Report Forge <ArrowRight size={15} />
                        </button>
                        <button type="button" className="neo-btn" onClick={() => navigate('/profile')} style={{ width: '100%', justifyContent: 'space-between', background: 'rgba(235,241,236,0.13)', borderColor: '#cde0d6', color: '#f8f3ea' }}>
                            Hospital Profile <ArrowRight size={15} />
                        </button>
                    </div>
                </div>

                <div className="neo-card" style={{ background: 'rgba(240, 244, 236, 0.08)', borderColor: '#d5e8e0' }}>
                    <div className="kicker" style={{ color: '#d6e5df' }}>Command</div>
                    <div style={{ marginTop: '0.8rem', display: 'grid', gap: '0.4rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f8f3ea', fontWeight: 700 }}>
                            <span>View</span>
                            <span>Operations</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f8f3ea', fontWeight: 700 }}>
                            <span>Mode</span>
                            <span>Real-time</span>
                        </div>
                    </div>
                </div>
            </aside>

            <section className="v2-main">
                <header className="neo-card staggered-enter" style={{ display: 'grid', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                        <div>
                            <div className="kicker">Control Center</div>
                            <h2 style={{ marginTop: '0.5rem', fontSize: 'clamp(1.8rem, 4vw, 2.9rem)' }}>Clinical Operations Radar</h2>
                            <p style={{ maxWidth: 680, marginTop: '0.7rem' }}>
                                Reorganized for flow-first decision making: intake, vitals acquisition, AI interpretation, and patient communication are now exposed as deliberate paths.
                            </p>
                        </div>
                        <button type="button" className="neo-btn" onClick={() => navigate('/reports')}>
                            Review Reports <ArrowRight size={16} />
                        </button>
                    </div>
                </header>

                <section className="staggered-enter" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                    {statTiles.map((tile) => {
                        const Icon = tile.icon;
                        return (
                            <article key={tile.label} className="neo-card" style={{ background: tile.tone, display: 'grid', gap: '0.65rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span className="kicker">{tile.label}</span>
                                    <Icon size={20} />
                                </div>
                                <h3 style={{ fontSize: '1.8rem', margin: 0 }}>{tile.value}</h3>
                                <p>{tile.hint}</p>
                            </article>
                        );
                    })}
                </section>

                <section className="staggered-enter" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                    <article className="neo-card" style={{ display: 'grid', gap: '0.9rem' }}>
                        <div className="kicker">
                            <LayoutPanelLeft size={14} /> Priority Workstreams
                        </div>
                        {workspaceActions.map((action) => {
                            const Icon = action.icon;
                            return (
                                <button
                                    key={action.title}
                                    type="button"
                                    className="neo-card"
                                    onClick={() => navigate(action.route)}
                                    style={{
                                        textAlign: 'left',
                                        display: 'grid',
                                        gap: '0.4rem',
                                        cursor: 'pointer',
                                        padding: '1.1rem',
                                        background: 'var(--bg-elevated)'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <h3 style={{ fontSize: '1rem', margin: 0 }}>{action.title}</h3>
                                        <Icon size={18} />
                                    </div>
                                    <p>{action.description}</p>
                                </button>
                            );
                        })}
                    </article>

                    <article className="neo-card" style={{ background: 'linear-gradient(150deg, #f4ece2, #ecf2e7)', display: 'grid', gap: '0.9rem' }}>
                        <div className="kicker">Recommended Sequence</div>
                        <h3 style={{ fontSize: '1.2rem', margin: 0 }}>Start with Profile Integrity</h3>
                        <p>Keep hospital identity and language settings current to improve share accuracy and patient-facing clarity.</p>
                        <button type="button" className="neo-btn" onClick={() => navigate('/profile')}>
                            Open Profile <UserRound size={15} />
                        </button>
                        <button type="button" className="neo-btn" onClick={() => navigate('/vitals')} style={{ background: 'var(--secondary)' }}>
                            Launch Vitals Session <HeartPulse size={15} />
                        </button>
                    </article>
                </section>
            </section>
        </div>
    );
};

export default Dashboard;
