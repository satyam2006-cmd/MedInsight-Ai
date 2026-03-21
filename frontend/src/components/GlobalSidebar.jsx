import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Activity,
    HeartPulse,
    FileScan,
    Users,
    Home,
    LayoutDashboard,
    ClipboardList,
    Building2,
    ChevronsUpDown,
    Plus
} from 'lucide-react';
import StaggeredMenu from './StaggeredMenu';

const sidebarConfig = [
    { id: 'vitals', icon: HeartPulse, label: 'Live Vitals', route: '/vitals', hasDot: true, dotColor: '#ef4444' },
    { id: 'analyzer', icon: FileScan, label: 'Report Forge', route: '/analyzer' },
    { id: 'patients', icon: Users, label: 'Patient Registry', route: '/patients' },
    { id: 'dash', icon: LayoutDashboard, label: 'Hospital Dash', route: '/dash' },
    { id: 'reports', icon: ClipboardList, label: 'Saved Reports', route: '/reports' }
];

const mobileNavConfig = [
    { id: 'home', icon: Home, label: 'Hub', route: '/' },
    { id: 'vitals', icon: HeartPulse, label: 'Vitals', route: '/vitals' },
    { id: 'analyzer', icon: FileScan, label: 'Analyzer', route: '/analyzer' },
    { id: 'patients', icon: Users, label: 'Patients', route: '/patients' },
    { id: 'dash', icon: LayoutDashboard, label: 'Dash', route: '/dash' },
    { id: 'reports', icon: ClipboardList, label: 'Reports', route: '/reports' },
    { id: 'profile', icon: Building2, label: 'Profile', route: '/profile' }
];

const GlobalSidebar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [isHovered, setIsHovered] = useState(false);

    const staggeredMenuItems = sidebarConfig.map(item => ({
        label: item.label,
        link: item.route,
        icon: item.icon
    }));

    return (
        <div 
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{ position: 'relative', zIndex: 2001 }}
        >
            <div className="desktop-staggered-menu">
                <StaggeredMenu 
                    position="left" 
                    triggerHover={isHovered} 
                    items={staggeredMenuItems}
                    displaySocials={false}
                    isFixed={true}
                    colors={['#1c2128', '#2d333b']}
                    accentColor="#ffffff"
                />
            </div>

            {/* Dark Sidebar - Icon Only, Triggers Staggered Menu */}
            <aside className="dark-hover-sidebar">
                {/* Logo Area */}
                <div className="sidebar-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
                    <div style={{ 
                        width: '40px', 
                        height: '40px', 
                        borderRadius: '50%', 
                        background: '#2d333b', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        flexShrink: 0
                    }}>
                        <Plus size={24} color="#ffffff" strokeWidth={3}/>
                    </div>
                </div>

                {/* Switcher Button */}
                <div className="sidebar-switcher">
                    <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '12px',
                        background: '#22272e',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        cursor: 'pointer'
                    }}>
                        <ChevronsUpDown size={16} color="#768390" />
                    </div>
                </div>

                {/* Main Navigation */}
                <div style={{ flex: 1, width: '100%', marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {sidebarConfig.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.route || (location.pathname === '/' && item.route === '/hub');
                        
                        return (
                            <div 
                                key={item.id}
                                className={`sidebar-item ${isActive ? 'active' : ''}`}
                                onClick={() => item.route !== '#' && navigate(item.route)}
                            >
                                <div className="sidebar-icon">
                                    <Icon size={22} strokeWidth={isActive ? 2.5 : 2} color={isActive ? '#ffffff' : '#768390'} />
                                    {item.hasDot && (
                                        <div style={{
                                            position: 'absolute',
                                            top: '-2px',
                                            right: '-2px',
                                            width: '8px',
                                            height: '8px',
                                            borderRadius: '50%',
                                            backgroundColor: item.dotColor,
                                            border: '2px solid #1c2128'
                                        }} />
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Settings Bottom */}
                <div className="sidebar-item" onClick={() => navigate('/profile')} style={{ marginTop: 'auto', marginBottom: '1rem' }}>
                    <div className="sidebar-icon">
                        <Building2 size={22} color="#768390" />
                    </div>
                </div>
            </aside>

            <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
                {mobileNavConfig.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.route;

                    return (
                        <button
                            key={item.id}
                            type="button"
                            className={`mobile-nav-item ${isActive ? 'active' : ''}`}
                            onClick={() => navigate(item.route)}
                        >
                            <Icon size={18} strokeWidth={isActive ? 2.4 : 2} />
                            <span>{item.label}</span>
                        </button>
                    );
                })}
            </nav>

            {/* Global Sidebar CSS */}
            <style dangerouslySetInnerHTML={{__html: `
                .dark-hover-sidebar {
                    position: fixed;
                    top: 0;
                    left: 0;
                    height: 100vh;
                    width: 80px;
                    background: #1c2128; /* Github dark mode style slate */
                    color: #adbac7;
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    z-index: 3000;
                    border-right: 1px solid #444c56;
                    overflow: hidden;
                    box-shadow: 2px 0 10px rgba(0,0,0,0.2);
                }

                .sidebar-logo {
                    display: flex;
                    align-items: center;
                    padding: 1.5rem 20px;
                    width: 100%;
                    white-space: nowrap;
                }

                .sidebar-switcher {
                    display: flex;
                    padding: 0 20px;
                    width: 100%;
                }

                .sidebar-item {
                    display: flex;
                    align-items: center;
                    width: 100%;
                    padding: 0.8rem 20px;
                    cursor: pointer;
                    transition: background 0.2s;
                    white-space: nowrap;
                }

                .sidebar-item:hover, .sidebar-item.active {
                    background: rgba(144, 157, 171, 0.12);
                }

                .sidebar-icon {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    width: 40px;
                    height: 40px;
                    position: relative;
                    flex-shrink: 0;
                }

                /* Active state styling */
                .sidebar-item.active .sidebar-icon {
                    background: rgba(255, 255, 255, 0.08); /* slight highlight for active icon */
                    border-radius: 8px;
                }

                @media (max-width: 1024px) {
                    .desktop-staggered-menu {
                        display: none;
                    }

                    .dark-hover-sidebar {
                        display: none;
                    }
                }
            `}} />
        </div>
    );
};

export default GlobalSidebar;
