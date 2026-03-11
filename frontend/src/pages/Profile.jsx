import React, { useState, useEffect } from 'react';
import { User, Mail, Building, Phone, Calendar, ArrowLeft, Shield, LogOut, Edit2, Save, X, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const ProfilePage = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    const [userData, setUserData] = useState({
        name: "",
        email: "",
        username: "",
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
                    countryCode: profile.countryCode,
                    phone: profile.phone
                });
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
                countryCode: editForm.countryCode,
                phone: editForm.phone
            }));
            setIsEditing(false);
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

    return (
        <div style={{ position: 'fixed', inset: 0, background: '#f8f9fa', padding: '2rem', overflowY: 'auto', zIndex: 30 }}>
            <div style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '3rem' }}>
                <button
                    onClick={() => navigate('/dash')}
                    className="neo-btn"
                    style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', color: 'black', padding: '0.6rem 1.2rem' }}
                >
                    <ArrowLeft size={18} /> Back to Dashboard
                </button>

                <div className="neo-card" style={{ background: 'white', padding: '3rem', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '8px', background: 'var(--primary, #5227FF)' }}></div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', alignItems: 'center', marginBottom: '3rem' }}>
                        <div style={{
                            width: '120px',
                            height: '120px',
                            background: '#e9ecef',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '4px solid black',
                            boxShadow: '6px 6px 0px black'
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
                                        style={{
                                            fontSize: '1.5rem',
                                            padding: '0.5rem',
                                            border: '3px solid black',
                                            fontWeight: 700,
                                            width: '100%'
                                        }}
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
                                <div style={{ padding: '0.8rem', background: '#f0f0f0', border: '2px solid black' }}>
                                    <Mail size={20} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#666', fontWeight: 700, textTransform: 'uppercase' }}>Email Address</p>
                                    {isEditing ? (
                                        <input
                                            type="email"
                                            value={editForm.email}
                                            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                            style={{
                                                fontSize: '1.1rem',
                                                padding: '0.3rem 0.5rem',
                                                border: '2px solid black',
                                                fontWeight: 600,
                                                width: '100%',
                                                marginTop: '0.2rem'
                                            }}
                                        />
                                    ) : (
                                        <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{userData.email}</p>
                                    )}
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{ padding: '0.8rem', background: '#f0f0f0', border: '2px solid black' }}>
                                    <User size={20} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#666', fontWeight: 700, textTransform: 'uppercase' }}>Admin Username</p>
                                    {isEditing ? (
                                        <input
                                            value={editForm.username}
                                            onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                                            style={{
                                                fontSize: '1.1rem',
                                                padding: '0.3rem 0.5rem',
                                                border: '2px solid black',
                                                fontWeight: 600,
                                                width: '100%',
                                                marginTop: '0.2rem'
                                            }}
                                        />
                                    ) : (
                                        <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{userData.username}</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{ padding: '0.8rem', background: '#f0f0f0', border: '2px solid black' }}>
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
                                                style={{
                                                    fontSize: '1.1rem',
                                                    padding: '0.3rem 0.5rem',
                                                    border: '2px solid black',
                                                    fontWeight: 600,
                                                    width: '70px',
                                                }}
                                            />
                                            <input
                                                value={editForm.phone}
                                                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                                                placeholder="00000 00000"
                                                style={{
                                                    fontSize: '1.1rem',
                                                    padding: '0.3rem 0.5rem',
                                                    border: '2px solid black',
                                                    fontWeight: 600,
                                                    flex: 1,
                                                }}
                                            />
                                        </div>
                                    ) : (
                                        <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{userData.countryCode} {userData.phone || "Not provided"}</p>
                                    )}
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{ padding: '0.8rem', background: '#f0f0f0', border: '2px solid black' }}>
                                    <Calendar size={20} />
                                </div>
                                <div>
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#666', fontWeight: 700, textTransform: 'uppercase' }}>Member Since</p>
                                    <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{userData.joinedDate}</p>
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
                                        setEditForm({ name: userData.name, username: userData.username });
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
        </div>
    );
};

export default ProfilePage;
