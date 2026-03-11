import React from 'react';
import StaggeredMenu from '../components/StaggeredMenu';
import { Activity, Users, Settings, Bell, FileText, ArrowLeft } from 'lucide-react';

const Dashboard = ({ onBack }) => {
    const menuItems = [
        { label: 'Overview', link: '/dash', ariaLabel: 'Go to Overview', hoverColor: 'yellow' },
        { label: 'Patients', link: '/patients', ariaLabel: 'Go to Patients', hoverColor: 'red' },
        { label: 'Reports', link: '/reports', ariaLabel: 'Go to Reports', hoverColor: '#4d96ff' },
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
                menuButtonColor="#333"
                openMenuButtonColor="#000"
                changeMenuColorOnOpen={true}
                isFixed={true}
                colors={['#B19EEF', '#5227FF']}
            />

            {/* Dashboard Main Content */}
            <div style={{ padding: '3rem 2rem', maxWidth: '1200px', margin: '0 auto', zIndex: 1, position: 'relative' }}>
                {onBack && (
                    <button
                        onClick={onBack}
                        className="neo-btn"
                        style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', color: 'black', padding: '0.5rem 1rem' }}
                    >
                        <ArrowLeft size={18} /> Back to Home
                    </button>
                )}
                <header style={{ marginBottom: '2rem' }}>
                    <h1 style={{ fontSize: '2.5rem', margin: '0', color: '#1a1a1a', letterSpacing: '-1px' }}>Hospital Dashboard</h1>
                    <p style={{ color: '#666', marginTop: '0.5rem', fontSize: '1.1rem' }}>Welcome back. Here is your daily overview.</p>
                </header>

                {/* Stats Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
                    <div className="neo-card" style={{ background: 'white', borderLeft: '8px solid var(--primary)', padding: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <p style={{ color: '#666', margin: 0, fontWeight: 600 }}>Total Patients</p>
                                <h2 style={{ fontSize: '2rem', margin: '0.5rem 0 0', color: '#000' }}>1,248</h2>
                            </div>
                            <Users size={32} color="var(--primary)" />
                        </div>
                    </div>

                    <div className="neo-card" style={{ background: 'white', borderLeft: '8px solid var(--secondary)', padding: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <p style={{ color: '#666', margin: 0, fontWeight: 600 }}>Active Reports</p>
                                <h2 style={{ fontSize: '2rem', margin: '0.5rem 0 0', color: '#000' }}>342</h2>
                            </div>
                            <FileText size={32} color="var(--secondary)" />
                        </div>
                    </div>

                    <div className="neo-card" style={{ background: 'white', borderLeft: '8px solid var(--accent)', padding: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <p style={{ color: '#666', margin: 0, fontWeight: 600 }}>System Status</p>
                                <h2 style={{ fontSize: '2rem', margin: '0.5rem 0 0', color: '#000' }}>Healthy</h2>
                            </div>
                            <Activity size={32} color="var(--accent)" />
                        </div>
                    </div>
                </div>

                {/* Recent Activity Section */}
                <div className="neo-card" style={{ background: 'white', padding: '2rem' }}>
                    <h3 style={{ margin: '0 0 1.5rem', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Bell size={24} /> Recent Activities
                    </h3>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        <li style={{ padding: '1rem 0', borderBottom: '2px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: 600 }}>Patient John Doe's blood report analyzed</span>
                            <span style={{ color: '#666' }}>2 mins ago</span>
                        </li>
                        <li style={{ padding: '1rem 0', borderBottom: '2px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: 600 }}>New appointment booked for Dr. Smith</span>
                            <span style={{ color: '#666' }}>1 hour ago</span>
                        </li>
                        <li style={{ padding: '1rem 0', display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: 600 }}>System backup completed successfully</span>
                            <span style={{ color: '#666' }}>4 hours ago</span>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
