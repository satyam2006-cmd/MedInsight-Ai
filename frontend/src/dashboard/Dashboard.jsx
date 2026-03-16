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
import GlobalSidebar from '../components/GlobalSidebar';

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
        <div style={{ display: 'flex', minHeight: '100vh', width: '100%' }}>
            <GlobalSidebar />

            <main style={{ flex: 1, marginLeft: '80px', padding: '3rem', position: 'relative' }}>
                <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'grid', gap: '2rem' }}>
                <header className="neo-card staggered-enter" style={{ display: 'grid', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <div className="kicker" style={{ fontSize: '0.8rem', letterSpacing: '1px' }}>Control Center</div>
                            <h2 style={{ 
                                marginTop: '0.5rem', 
                                fontSize: 'clamp(2.2rem, 4vw, 3.2rem)',
                                fontFamily: 'var(--font-display)',
                                fontWeight: 400,
                                letterSpacing: '-1px'
                            }}>
                                Clinical <span style={{ color: '#0ea5e9', fontWeight: 600 }}>Operations</span> Radar
                            </h2>
                            <p style={{ marginTop: '0.8rem', fontSize: '1.05rem', color: '#555', maxWidth: '600px' }}>
                                Reorganized for flow-first decision making: intake, AI interpretation, and patient communication are now exposed as deliberate paths.
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
                    </article>
                </section>
                </div>
            </main>
        </div>
    );
};

export default Dashboard;
