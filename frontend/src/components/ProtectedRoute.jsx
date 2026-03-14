import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Loader2 } from 'lucide-react';

const ProtectedRoute = ({ children }) => {
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const location = useLocation();

    useEffect(() => {
        let alive = true;

        const bootstrap = async () => {
            try {
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();
                if (sessionError) throw sessionError;
                if (!alive) return;
                setUser(session?.user ?? null);
            } catch (err) {
                console.error("Auth check failed:", err);
                if (!alive) return;
                setUser(null);
            } finally {
                if (alive) setLoading(false);
            }
        };

        bootstrap();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!alive) return;
            setUser(session?.user ?? null);
            setLoading(false);
        });

        // Safety net: never keep spinner forever on auth edge-cases.
        const fallbackTimer = setTimeout(() => {
            if (alive) setLoading(false);
        }, 2000);

        return () => {
            alive = false;
            clearTimeout(fallbackTimer);
            subscription.unsubscribe();
        };
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
