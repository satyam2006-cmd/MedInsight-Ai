import React, { useState, useEffect } from 'react';
import { User, Mail, Building, Phone, Calendar, ArrowLeft, Shield, LogOut, Edit2, Save, X, Loader2, AlertTriangle, LayoutGrid } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import GlobalSidebar from '../components/GlobalSidebar';

const ProfilePage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const isIncomplete = searchParams.get('incomplete') === 'true';

    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    const [userData, setUserData] = useState({
        name: "",
        email: "",
        username: "",
        age: "",
        countryCode: "+91",
        phone: "",
        joinedDate: "",
        role: "Hospital Administrator",
        status: "Verified"
    });

    const [editForm, setEditForm] = useState({
        name: "",
        username: "",
        email: "",
        age: "",
        countryCode: "+91",
        phone: ""
    });

    useEffect(() => {
        fetchUser();
    }, []);

    const fetchUser = async () => {
        try {
            setLoading(true);
            const { data: { user }, error } = await supabase.auth.getUser();

            if (error) throw error;
            if (user) {
                const profile = {
                    name: user.user_metadata?.hospital_name || "Hospital Name",
                    email: user.email,
                    username: user.user_metadata?.admin_username || "admin",
                    age: user.user_metadata?.age ? String(user.user_metadata.age) : "",
                    countryCode: user.user_metadata?.country_code || "+91",
                    phone: user.user_metadata?.phone || "",
                    joinedDate: new Date(user.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    }),
                    role: "Hospital Administrator",
                    status: "Verified"
                };
                setUserData(profile);
                setEditForm({
                    name: profile.name,
                    username: profile.username,
                    email: profile.email,
                    age: profile.age,
                    countryCode: profile.countryCode,
                    phone: profile.phone
                });

                // Automatically enter edit mode if details are missing
                if (!profile.name || !profile.username || !profile.phone) {
                    setIsEditing(true);
                }
            }
        } catch (error) {
            console.error('Error fetching user:', error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            navigate('/');
        } catch (error) {
            console.error('Error logging out:', error.message);
        }
    };

    const handleSave = async () => {
        try {
            setUpdating(true);
            const updatePayload = {
                data: {
                    hospital_name: editForm.name,
                    admin_username: editForm.username,
                    age: editForm.age ? Number(editForm.age) : null,
                    country_code: editForm.countryCode,
                    phone: editForm.phone
                }
            };

            // Only update email if it changed
            if (editForm.email !== userData.email) {
                updatePayload.email = editForm.email;
            }

            const { error } = await supabase.auth.updateUser(updatePayload);

            if (error) throw error;

            if (updatePayload.email) {
                alert('Confirmation email sent to ' + editForm.email + '. Please verify to complete the change.');
            }

            setUserData(prev => ({
                ...prev,
                name: editForm.name,
                username: editForm.username,
                email: editForm.email,
                age: editForm.age,
                countryCode: editForm.countryCode,
                phone: editForm.phone
            }));
            setIsEditing(false);

            // Redirect to dashboard if we were forced here and it's now complete
            if (isIncomplete && editForm.name && editForm.username && editForm.phone) {
                navigate('/dash');
            }
        } catch (error) {
            console.error('Error updating user:', error.message);
            alert('Failed to update profile: ' + error.message);
        } finally {
            setUpdating(false);
        }
    };

    if (loading) {
        return (
            <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f9fa', zIndex: 30 }}>
                <div style={{ textAlign: 'center' }}>
                    <Loader2 size={48} className="animate-spin" color="var(--primary, #5227FF)" />
                    <p style={{ marginTop: '1rem', fontWeight: 700 }}>Loading Profile...</p>
                </div>
            </div>
        );
    }

    const isDataMissing = !userData.name || userData.name === "Hospital Name" || !userData.username || !userData.phone;

    return (
        <div style={{ display: 'flex', minHeight: '100vh', width: '100%' }}>
            <GlobalSidebar />

            <main style={{ flex: 1, marginLeft: '80px', padding: '4rem 5rem', position: 'relative' }}>
                <button
                    onClick={() => navigate('/')}
                    className="staggered-enter"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem',
                        padding: '0.6rem 1.4rem',
                        background: '#fff',
                        color: '#1e293b',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        marginBottom: '2rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        borderRadius: '99px',
                        border: '1.5px solid #1e293b',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                        transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.background = '#f8fafc';
                        e.currentTarget.style.transform = 'translateX(-2px)';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.background = '#fff';
                        e.currentTarget.style.transform = 'translateX(0)';
                    }}
                >
                    <ArrowLeft size={16} />
                    BACK TO HUB
                </button>
                <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>

                <header className="staggered-enter hero-unboxed" style={{ marginBottom: '4rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1rem' }}>
                        <div style={{ 
                            width: '64px', 
                            height: '64px', 
                            background: 'rgba(52, 39, 255, 0.1)', 
                            borderRadius: '16px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            color: 'var(--primary)'
                        }}>
                            <User size={32} />
                        </div>
                        <div>
                            <h1 style={{ fontSize: '3.8rem', fontWeight: 400, letterSpacing: '-2px', color: '#1e293b', margin: 0 }}>
                                Organization <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Profile</span>
                            </h1>
                            <p style={{ fontSize: '1.2rem', color: '#64748b', marginTop: '0.2rem' }}>
                                Manage your hospital branding and administrative credentials.
                            </p>
                        </div>
                    </div>
                </header>

                {isIncomplete && isDataMissing && (
                    <div className="panel-soft" style={{
                        background: '#fff3cd',
                        padding: '1.5rem',
                        marginBottom: '2rem',
                        borderRadius: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem'
                    }}>
                        <AlertTriangle size={36} color="#856404" />
                        <div>
                            <h3 style={{ margin: 0, color: '#856404', fontWeight: 800 }}>Action Required: Complete Your Profile</h3>
                            <p style={{ margin: '0.2rem 0 0', fontWeight: 600 }}>Please provide your hospital name and contact details to enable report branding and access the dashboard.</p>
                        </div>
                    </div>
                )}

                <div className="staggered-enter neo-card brutal-border" style={{ background: 'white', padding: '4rem', position: 'relative' }}>


                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', alignItems: 'center', marginBottom: '3rem' }}>
                        <div style={{
                            width: '120px',
                            height: '120px',
                            background: '#e9ecef',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid rgba(32, 42, 48, 0.25)',
                            borderRadius: '12px'
                        }}>
                            <Building size={64} color="#555" />
                        </div>
                        <div style={{ flex: 1 }}>
                            {isEditing ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <label style={{ fontWeight: 800, fontSize: '0.8rem', textTransform: 'uppercase' }}>Hospital Name</label>
                                    <input
                                        value={editForm.name}
                                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                        className="input-v2"
                                        style={{ fontSize: '1.5rem', padding: '0.5rem', fontWeight: 700, width: '100%' }}
                                    />
                                </div>
                            ) : (
                                <h1 style={{ fontSize: '2.5rem', margin: 0, letterSpacing: '-1px' }}>{userData.name}</h1>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', color: '#666' }}>
                                <Shield size={16} color="var(--primary, #5227FF)" />
                                <span style={{ fontWeight: 700 }}>{userData.status} {userData.role}</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div className="icon-chip">
                                    <Mail size={20} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#666', fontWeight: 700, textTransform: 'uppercase' }}>Email Address</p>
                                    {isEditing ? (
                                        <input
                                            type="email"
                                            value={editForm.email}
                                            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                            className="input-v2"
                                            style={{ fontSize: '1.1rem', fontWeight: 600, width: '100%', marginTop: '0.2rem' }}
                                        />
                                    ) : (
                                        <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{userData.email}</p>
                                    )}
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div className="icon-chip">
                                    <User size={20} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#666', fontWeight: 700, textTransform: 'uppercase' }}>Admin Username</p>
                                    {isEditing ? (
                                        <input
                                            value={editForm.username}
                                            onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                                            className="input-v2"
                                            style={{ fontSize: '1.1rem', fontWeight: 600, width: '100%', marginTop: '0.2rem' }}
                                        />
                                    ) : (
                                        <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{userData.username}</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div className="icon-chip">
                                    <Phone size={20} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#666', fontWeight: 700, textTransform: 'uppercase' }}>Phone Number</p>
                                    {isEditing ? (
                                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem' }}>
                                            <input
                                                value={editForm.countryCode}
                                                onChange={(e) => setEditForm({ ...editForm, countryCode: e.target.value })}
                                                placeholder="+91"
                                                className="input-v2"
                                                style={{ fontSize: '1.1rem', fontWeight: 600, width: '70px' }}
                                            />
                                            <input
                                                value={editForm.phone}
                                                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                                                placeholder="00000 00000"
                                                className="input-v2"
                                                style={{ fontSize: '1.1rem', fontWeight: 600, flex: 1 }}
                                            />
                                        </div>
                                    ) : (
                                        <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{userData.countryCode} {userData.phone || "Not provided"}</p>
                                    )}
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div className="icon-chip">
                                    <Calendar size={20} />
                                </div>
                                <div>
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#666', fontWeight: 700, textTransform: 'uppercase' }}>Member Since</p>
                                    <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{userData.joinedDate}</p>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div className="icon-chip">
                                    <User size={20} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#666', fontWeight: 700, textTransform: 'uppercase' }}>Age</p>
                                    {isEditing ? (
                                        <input
                                            type="number"
                                            min="13"
                                            max="100"
                                            value={editForm.age}
                                            onChange={(e) => setEditForm({ ...editForm, age: e.target.value })}
                                            className="input-v2"
                                            style={{ fontSize: '1.1rem', fontWeight: 600, width: '120px', marginTop: '0.2rem' }}
                                        />
                                    ) : (
                                        <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{userData.age || "Not set"}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{ marginTop: '4rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', borderTop: '2px solid #eee', paddingTop: '2rem' }}>
                        {isEditing ? (
                            <>
                                <button
                                    className="neo-btn"
                                    onClick={handleSave}
                                    disabled={updating}
                                    style={{ background: 'var(--primary, #5227FF)', color: 'black', flex: 1, justifyContent: 'center' }}
                                >
                                    {updating ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                    {updating ? "Saving..." : "Save Changes"}
                                </button>
                                <button
                                    className="neo-btn"
                                    onClick={() => {
                                        setIsEditing(false);
                                        setEditForm({
                                            name: userData.name,
                                            username: userData.username,
                                            email: userData.email,
                                            age: userData.age,
                                            countryCode: userData.countryCode,
                                            phone: userData.phone,
                                        });
                                    }}
                                    disabled={updating}
                                    style={{ background: '#eee', color: 'black', padding: '0.8rem 1.5rem' }}
                                >
                                    <X size={18} /> Cancel
                                </button>
                            </>
                        ) : (
                            <button
                                className="neo-btn"
                                onClick={() => setIsEditing(true)}
                                style={{ background: 'black', color: 'white', flex: 1, justifyContent: 'center' }}
                            >
                                <Edit2 size={18} /> Edit Profile
                            </button>
                        )}

                        {!isEditing && (
                            <button
                                className="neo-btn"
                                onClick={handleLogout}
                                style={{ background: '#ff4d4d', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.8rem 1.5rem' }}
                            >
                                <LogOut size={18} /> Logout
                            </button>
                        )}
                    </div>
                </div>
                </div>
            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .animate-spin {
                    animation: spin 1s linear infinite;
                }
            `}} />
            </main>
        </div>
    );
};

export default ProfilePage;
