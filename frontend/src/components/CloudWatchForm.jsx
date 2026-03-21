import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function CloudWatchForm() {
    const navigate = useNavigate();
    const [isLogin, setIsLogin] = useState(false);
    const [accountType, setAccountType] = useState("hospital");
    const [hospitalName, setHospitalName] = useState("");
    const [email, setEmail] = useState("");
    const [username, setUsername] = useState("");
    const [age, setAge] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [authError, setAuthError] = useState("");

    const [isTyping, setIsTyping] = useState(false);
    const [cursor, setCursor] = useState({ x: 0, y: 0 });
    const [eyePos, setEyePos] = useState({ x: 0, y: 0 });
    const [blink, setBlink] = useState(false);

    useEffect(() => {
        const handleMouse = (e) => setCursor({ x: e.clientX, y: e.clientY });
        window.addEventListener("mousemove", handleMouse);
        return () => window.removeEventListener("mousemove", handleMouse);
    }, []);

    useEffect(() => {
        const offsetX = ((cursor.x / window.innerWidth) - 0.5) * 40; // bigger range
        const offsetY = ((cursor.y / window.innerHeight) - 0.5) * 20;
        setEyePos({ x: offsetX, y: offsetY });
    }, [cursor]);

    // Blinking every 3 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            setBlink(true);
            setTimeout(() => setBlink(false), 200);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    const handleAuth = async () => {
        if (!email || !password) {
            setAuthError("Email and Password are required.");
            return;
        }
        if (!isLogin && !username) {
            setAuthError("Username is required.");
            return;
        }
        if (!isLogin && accountType === "hospital" && !hospitalName) {
            setAuthError("Hospital name is required for hospital registration.");
            return;
        }
        setIsLoading(true);
        setAuthError("");

        let error;

        if (isLogin) {
            const response = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            error = response.error;
        } else {
            const profileName = accountType === "hospital" ? hospitalName : username;
            const response = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        account_type: accountType,
                        hospital_name: accountType === "hospital" ? hospitalName : "",
                        full_name: accountType === "user" ? profileName : "",
                        admin_username: username,
                        age: age ? Number(age) : null,
                    }
                }
            });
            error = response.error;

            // If email confirmations are enabled in Supabase, we won't get a session immediately.
            // Since you've now disabled it, this block will be skipped and you'll be redirected instantly.
            if (!error && !response.data.session) {
                setAuthError("Account created! Please verify your email if confirmation is enabled, otherwise you can now log in.");
                setIsLoading(false);
                return;
            }
        }

        setIsLoading(false);

        if (error) {
            setAuthError(error.message);
        } else {
            navigate('/dash');
        }
    };

    return (
        <div className="cw-auth-shell" style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ffffff', padding: '2rem', overflowY: 'auto', zIndex: 30 }}>

            <button
                onClick={() => navigate('/')}
                className="neo-btn cw-back-btn"
                style={{ position: 'absolute', top: '2rem', left: '2rem', padding: '0.5rem 1rem', background: 'white', color: 'black' }}
            >
                &larr; Back to Home
            </button>

            <div className="neo-card cw-auth-card" style={{ maxWidth: '980px', width: '100%', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '2rem', background: 'white', position: 'relative' }}>

                {/* Cartoon Face (Left Side) */}
                <div className="cw-art-pane" style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem' }}>
                    <div style={{ position: 'relative', width: '100%', maxWidth: '350px', aspectRatio: '564/349' }}>
                        <img
                            src="https://pub-940ccf6255b54fa799a9b01050e6c227.r2.dev/cloud.jpg"
                            alt="cartoon"
                            style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '1rem' }}
                        />

                        {["left", "right"].map((side, idx) => (
                            <div
                                key={side}
                                style={{
                                    position: 'absolute',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'flex-end',
                                    overflow: 'hidden',
                                    top: '37.5%', // responsive positioning (60/160)
                                    left: idx === 0 ? '28.5%' : '53.5%', // responsive positioning (80/280 and 150/280)
                                    width: '10%', // responsive width (28/280)
                                    height: isTyping ? '4px' : blink ? '6px' : '25%', // responsive height (40/160)
                                    borderRadius: isTyping || blink ? "2px" : "50% / 60%",
                                    backgroundColor: isTyping ? "black" : "white",
                                    transition: "all 0.15s ease",
                                }}
                            >
                                {!isTyping && (
                                    <div
                                        style={{
                                            backgroundColor: 'black',
                                            width: '57%', // responsive width (16/28)
                                            aspectRatio: '1/1',
                                            borderRadius: "50%",
                                            marginBottom: '14%', // responsive pupil placement (4/28)
                                            transform: `translate(${eyePos.x}px, ${eyePos.y}px)`,
                                            transition: "all 0.1s ease",
                                        }}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Form (Right Side) */}
                <div className="cw-form-pane" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                    <h2 style={{ textAlign: 'center', fontSize: 'clamp(1.3rem, 4.8vw, 1.8rem)', margin: 0 }}>
                        {isLogin ? "Login" : (accountType === "hospital" ? "Register Hospital" : "Register User")}
                    </h2>

                    {authError && (
                        <div style={{ color: 'red', fontWeight: 700, fontSize: '0.9rem', textAlign: 'center' }}>
                            {authError}
                        </div>
                    )}

                    {!isLogin && (
                        <>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label style={{ fontWeight: 700, fontSize: '0.9rem' }}>Account Type</label>
                                <div style={{ display: 'flex', gap: '0.6rem' }}>
                                    <button
                                        type="button"
                                        className="neo-btn"
                                        onClick={() => setAccountType("hospital")}
                                        style={{
                                            flex: 1,
                                            justifyContent: 'center',
                                            background: accountType === "hospital" ? 'var(--primary)' : 'white',
                                            color: 'black'
                                        }}
                                    >
                                        Hospital
                                    </button>
                                    <button
                                        type="button"
                                        className="neo-btn"
                                        onClick={() => setAccountType("user")}
                                        style={{
                                            flex: 1,
                                            justifyContent: 'center',
                                            background: accountType === "user" ? 'var(--primary)' : 'white',
                                            color: 'black'
                                        }}
                                    >
                                        User
                                    </button>
                                </div>
                            </div>

                            {accountType === "hospital" && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label style={{ fontWeight: 700, fontSize: '0.9rem' }}>Hospital Name</label>
                                <input
                                    className="neo-input"
                                    value={hospitalName}
                                    onChange={(e) => setHospitalName(e.target.value)}
                                    placeholder="e.g. City General Hospital"
                                    style={{ width: '100%', padding: '0.8rem', border: '3px solid black', fontWeight: 600 }}
                                />
                            </div>
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label style={{ fontWeight: 700, fontSize: '0.9rem' }}>{accountType === "hospital" ? "Admin Username" : "Username"}</label>
                                <input
                                    className="neo-input"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Username"
                                    style={{ width: '100%', padding: '0.8rem', border: '3px solid black', fontWeight: 600 }}
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label style={{ fontWeight: 700, fontSize: '0.9rem' }}>Age (for vitals verification)</label>
                                <input
                                    type="number"
                                    min="13"
                                    max="100"
                                    value={age}
                                    onChange={(e) => setAge(e.target.value)}
                                    placeholder="e.g. 24"
                                    style={{ width: '100%', padding: '0.8rem', border: '3px solid black', fontWeight: 600 }}
                                />
                            </div>
                        </>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontWeight: 700, fontSize: '0.9rem' }}>Email Address</label>
                        <input
                            type="email"
                            className="neo-input"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="admin@hospital.com"
                            style={{ width: '100%', padding: '0.8rem', border: '3px solid black', fontWeight: 600 }}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontWeight: 700, fontSize: '0.9rem' }}>Secure Password</label>
                        <input
                            type="password"
                            className="neo-input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            onFocus={() => setIsTyping(true)}
                            onBlur={() => setIsTyping(false)}
                            style={{ width: '100%', padding: '0.8rem', border: '3px solid black', fontWeight: 600 }}
                        />
                    </div>

                    <button
                        onClick={handleAuth}
                        disabled={isLoading}
                        className="neo-btn"
                        style={{ width: '100%', marginTop: '0.5rem', justifyContent: 'center', fontSize: '1.1rem', padding: '1rem', background: 'var(--primary)' }}
                    >
                        {isLoading ? "Processing..." : (isLogin ? "Login Now" : "Create Account")}
                    </button>

                    <p style={{ textAlign: 'center', margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>
                        {isLogin ? "Don't have an account?" : "Already registered?"}{" "}
                        <button
                            type="button"
                            onClick={() => { setIsLogin(!isLogin); setAuthError(""); }}
                            style={{ background: 'none', border: 'none', color: 'var(--primary)', textDecoration: 'underline', cursor: 'pointer', padding: 0, fontWeight: 700 }}
                        >
                            {isLogin ? "Sign Up" : "Log In"}
                        </button>
                    </p>
                </div>

            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                .cw-auth-card {
                    padding: clamp(1rem, 3.8vw, 2rem);
                }

                @media (max-width: 960px) {
                    .cw-auth-shell {
                        align-items: flex-start;
                        padding: 1rem;
                    }

                    .cw-back-btn {
                        position: static !important;
                        width: 100%;
                        margin-bottom: 0.8rem;
                        justify-content: center;
                    }

                    .cw-auth-card {
                        margin-top: 0;
                        flex-direction: column;
                        gap: 1rem;
                    }

                    .cw-art-pane {
                        width: 100%;
                        padding: 0.2rem;
                    }

                    .cw-art-pane > div {
                        max-width: 250px !important;
                    }

                    .cw-form-pane {
                        width: 100%;
                    }
                }

                @media (max-width: 520px) {
                    .cw-auth-shell {
                        padding: 0.7rem;
                    }

                    .cw-auth-card {
                        border-width: 2px !important;
                        box-shadow: 3px 3px 0px var(--black) !important;
                    }

                    .cw-form-pane input,
                    .cw-form-pane .neo-input {
                        font-size: 16px;
                    }
                }
            ` }} />
        </div>
    );
}
