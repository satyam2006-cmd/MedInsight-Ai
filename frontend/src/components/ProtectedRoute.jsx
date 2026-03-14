import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Loader2 } from 'lucide-react';

const ProtectedRoute = ({ children }) => {
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const location = useLocation();

    useEffect(() => {
        const checkUser = async () => {
            try {
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();
                if (sessionError) throw sessionError;

                // Use persisted session as the source of truth during page reload.
                setUser(session?.user ?? null);

                if (session?.access_token) {
                    const { data: { user: freshUser }, error: userError } = await supabase.auth.getUser();
                    if (!userError && freshUser) {
                        setUser(freshUser);
                    }
                }
            } catch (err) {
                console.error("Auth check failed:", err);
                setUser(null);
            } finally {
                setLoading(false);
            }
        };

        checkUser();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Loader2 className="animate-spin" size={48} color="var(--primary)" />
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/signins" state={{ from: location }} replace />;
    }

    const metadata = user.user_metadata || {};
    const accountType = metadata.account_type === 'user' ? 'user' : 'hospital';
    const isHospitalProfileIncomplete = !metadata.hospital_name || !metadata.admin_username || !metadata.phone;
    const isUserProfileIncomplete = !metadata.admin_username;
    const isProfileIncomplete = accountType === 'hospital' ? isHospitalProfileIncomplete : isUserProfileIncomplete;

    // Allow access to Profile page regardless, but check completion for others
    const isProfilePage = location.pathname === '/profile';

    if (isProfileIncomplete && !isProfilePage) {
        return <Navigate to="/profile?incomplete=true" replace />;
    }

    return children;
};

export default ProtectedRoute;
