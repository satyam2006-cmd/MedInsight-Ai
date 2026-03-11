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
                const { data: { user }, error } = await supabase.auth.getUser();
                if (error) throw error;
                setUser(user);
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
    const isProfileIncomplete = !metadata.hospital_name || !metadata.admin_username || !metadata.phone;

    // Allow access to Profile page regardless, but check completion for others
    const isProfilePage = location.pathname === '/profile';

    if (isProfileIncomplete && !isProfilePage) {
        return <Navigate to="/profile?incomplete=true" replace />;
    }

    return children;
};

export default ProtectedRoute;
