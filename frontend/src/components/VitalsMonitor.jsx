import React, { useEffect, useRef, useState } from 'react';
import { Activity, Heart, Wind, Camera, AlertCircle, CheckCircle2, Shield, Download, Zap, TrendingUp, BarChart3 } from 'lucide-react';

const VitalsMonitor = () => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const graphCanvasRef = useRef(null);
    const trendCanvasRef = useRef(null);
    const wsRef = useRef(null);
    const detectorRef = useRef(null);
    const spectrumCanvasRef = useRef(null);
    const overlayCanvasRef = useRef(null);
    const lastPositionRef = useRef(null);
    const lastSendTimeRef = useRef(0);

    const [vitals, setVitals] = useState({
        bpm: 0, respiration: 0, fps: 0, status: 'initializing', alert: 'Normal',
        signal_quality: 0, health_score: 0, ews: 0, hrv: 0,
        calibration_pct: 0, hr_min: 0, hr_max: 0, session_time: 0,
    });
    const [error, setError] = useState(null);
    const [isStreaming, setIsStreaming] = useState(false);
    const [faceDetected, setFaceDetected] = useState(false);
    const [waveform, setWaveform] = useState([]);
    const [peaks, setPeaks] = useState([]);
    const [hrTrend, setHrTrend] = useState([]);
    const [spectrum, setSpectrum] = useState([]);

    // MediaPipe initialization
    useEffect(() => {
        let active = true;
        const loadMediaPipe = async () => {
            if (!active) return;
            const script = document.createElement('script');
            script.src = "https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/face_detection.js";
            script.async = true;
            script.onload = async () => {
                if (!active) return;
                const faceDetection = new window.FaceDetection({
                    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`
                });
                faceDetection.setOptions({ model: 'short', minDetectionConfidence: 0.5 });
                faceDetection.onResults(onResults);
                detectorRef.current = faceDetection;
                startCamera();
            };
            document.head.appendChild(script);
        };
        loadMediaPipe();
        connectWebSocket();
        return () => {
            active = false;
            stopCamera();
            if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); }
        };
    }, []);

    const onResults = (results) => {
        if (results.detections.length > 0) {
            setFaceDetected(true);
            processFaceDetection(results.detections[0]);
        } else {
            setFaceDetected(false);
            setVitals(prev => ({ ...prev, status: 'searching' }));
            const oc = overlayCanvasRef.current;
            if (oc) { const ctx = oc.getContext('2d'); ctx.clearRect(0, 0, oc.width, oc.height); }
        }
    };

    const processFaceDetection = (detection) => {
        if (!videoRef.current || !canvasRef.current || wsRef.current?.readyState !== WebSocket.OPEN) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const bb = detection.boundingBox;

        const fw = bb.width * video.videoWidth * 0.6;
        const fh = bb.height * video.videoHeight * 0.25;
        const fx = (bb.xCenter * video.videoWidth) - (fw / 2);
        const fy = (bb.yCenter * video.videoHeight) - (bb.height * video.videoHeight * 0.4);

        // Draw face detection overlay
        const oc = overlayCanvasRef.current;
        if (oc) {
            oc.width = video.videoWidth; oc.height = video.videoHeight;
            const o = oc.getContext('2d');
            o.clearRect(0, 0, oc.width, oc.height);
            const fX = (bb.xCenter - bb.width / 2) * video.videoWidth;
            const fY = (bb.yCenter - bb.height / 2) * video.videoHeight;
            const fW = bb.width * video.videoWidth;
            const fH = bb.height * video.videoHeight;
            o.strokeStyle = '#4ade80'; o.lineWidth = 2; o.setLineDash([8, 4]);
            o.strokeRect(fX, fY, fW, fH);
            const cl = 14; o.setLineDash([]); o.lineWidth = 3; o.strokeStyle = '#4ade80';
            o.beginPath(); o.moveTo(fX, fY + cl); o.lineTo(fX, fY); o.lineTo(fX + cl, fY); o.stroke();
            o.beginPath(); o.moveTo(fX + fW - cl, fY); o.lineTo(fX + fW, fY); o.lineTo(fX + fW, fY + cl); o.stroke();
            o.beginPath(); o.moveTo(fX, fY + fH - cl); o.lineTo(fX, fY + fH); o.lineTo(fX + cl, fY + fH); o.stroke();
            o.beginPath(); o.moveTo(fX + fW - cl, fY + fH); o.lineTo(fX + fW, fY + fH); o.lineTo(fX + fW, fY + fH - cl); o.stroke();
            o.strokeStyle = '#22d3ee'; o.lineWidth = 2; o.setLineDash([]);
            o.shadowColor = 'rgba(34,211,238,0.5)'; o.shadowBlur = 6;
            o.strokeRect(fx, fy, fw, fh); o.shadowBlur = 0;
            o.save(); o.translate(fx + fw / 2, fy - 6); o.scale(-1, 1);
            o.fillStyle = 'rgba(34,211,238,0.85)'; o.font = 'bold 11px monospace'; o.textAlign = 'center';
            o.fillText('FOREHEAD ROI', 0, 0); o.restore();
        }

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        canvas.width = fw; canvas.height = fh;

        try {
            ctx.drawImage(video, fx, fy, fw, fh, 0, 0, fw, fh);
            const imageData = ctx.getImageData(0, 0, fw, fh);
            const data = imageData.data;
            let rS = 0, gS = 0, bS = 0;
            for (let i = 0; i < data.length; i += 4) { rS += data[i]; gS += data[i + 1]; bS += data[i + 2]; }
            const np = data.length / 4;
            const aR = rS / np, aG = gS / np, aB = bS / np;

            if (aG > 240 || aG < 30) return;
            if (aR < 50) return;

            const cx = bb.xCenter * video.videoWidth, cy = bb.yCenter * video.videoHeight;
            const lp = lastPositionRef.current;
            if (lp) { if (Math.abs(cx - lp.x) > 5 || Math.abs(cy - lp.y) > 5) { lastPositionRef.current = { x: cx, y: cy }; return; } }
            lastPositionRef.current = { x: cx, y: cy };

            const now = performance.now();
            if (now - lastSendTimeRef.current < 33.3) return;
            lastSendTimeRef.current = now;

            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ values: [aR, aG, aB], timestamp: Date.now() / 1000 }));
            }
        } catch (e) { /* ignore */ }
    };

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, frameRate: 30 } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                setIsStreaming(true);
                const loop = async () => {
                    if (videoRef.current && detectorRef.current) {
                        try { await detectorRef.current.send({ image: videoRef.current }); } catch (e) {}
                    }
                    requestAnimationFrame(loop);
                };
                loop();
            }
        } catch (err) { setError("Camera access denied. Please allow permissions."); }
    };

    const stopCamera = () => {
        if (videoRef.current?.srcObject) videoRef.current.srcObject.getTracks().forEach(t => t.stop());
    };

    const connectWebSocket = () => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;
        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const host = isLocal ? 'localhost:8000' : window.location.host;
        const ws = new WebSocket(`${protocol}://${host}/ws/vitals`);
        ws.onopen = () => { setError(null); };
        ws.onmessage = (event) => {
            try {
                const d = JSON.parse(event.data);
                setVitals(prev => ({ ...prev, ...d }));
                if (d.waveform) setWaveform(d.waveform);
                if (d.peaks) setPeaks(d.peaks);
                if (d.hr_trend) setHrTrend(d.hr_trend);
                if (d.spectrum) setSpectrum(d.spectrum);
            } catch (e) {}
        };
        ws.onclose = () => { setTimeout(connectWebSocket, 3000); };
        ws.onerror = () => {};
        wsRef.current = ws;
    };

    // Render Pulse Waveform
    useEffect(() => {
        if (!graphCanvasRef.current || waveform.length < 2) return;
        const canvas = graphCanvasRef.current;
        const ctx = canvas.getContext('2d');
        const w = canvas.width, h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        // Grid
        ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 0.5;
        for (let i = 0; i < w; i += 40) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke(); }

        const min = Math.min(...waveform), max = Math.max(...waveform), range = max - min || 1;

        ctx.beginPath();
        ctx.strokeStyle = '#ff4d4d'; ctx.lineWidth = 2; ctx.lineJoin = 'round';
        waveform.forEach((val, i) => {
            const x = (i / (waveform.length - 1)) * w;
            const y = h - ((val - min) / range) * h * 0.8 - (h * 0.1);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Peak markers
        if (peaks.length > 0) {
            const offset = waveform.length > 200 ? waveform.length - 200 : 0;
            peaks.forEach(pi => {
                const idx = pi - offset;
                if (idx >= 0 && idx < waveform.length) {
                    const x = (idx / (waveform.length - 1)) * w;
                    const y = h - ((waveform[idx] - min) / range) * h * 0.8 - (h * 0.1);
                    ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2);
                    ctx.fillStyle = '#3b82f6'; ctx.fill();
                }
            });
        }
    }, [waveform, peaks]);

    // Render Spectrum
    useEffect(() => {
        if (!spectrumCanvasRef.current || spectrum.length === 0) return;
        const canvas = spectrumCanvasRef.current;
        const ctx = canvas.getContext('2d');
        const w = canvas.width, h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(59, 130, 246, 0.5)';
        const bw = w / spectrum.length;
        spectrum.forEach((val, i) => {
            const bh = val * h;
            ctx.fillRect(i * bw, h - bh, bw - 1, bh);
        });
    }, [spectrum]);

    // Render HR Trend (dark card style)
    useEffect(() => {
        if (!trendCanvasRef.current || hrTrend.length < 2) return;
        const canvas = trendCanvasRef.current;
        const ctx = canvas.getContext('2d');
        const w = canvas.width, h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        // Dotted grid background
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        for (let gx = 0; gx < w; gx += 12) {
            for (let gy = 0; gy < h; gy += 12) {
                ctx.beginPath();
                ctx.arc(gx, gy, 0.8, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        const values = hrTrend.map(p => p[1]);
        const minV = Math.min(...values) - 3, maxV = Math.max(...values) + 3;
        const range = maxV - minV || 1;
        const pad = 10;

        // Smooth pink line
        ctx.beginPath();
        ctx.strokeStyle = '#ff6b8a';
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        values.forEach((v, i) => {
            const x = pad + (i / (values.length - 1)) * (w - pad * 2);
            const y = pad + (1 - (v - minV) / range) * (h - pad * 2);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Glow dot at the end
        const lastX = pad + ((values.length - 1) / (values.length - 1)) * (w - pad * 2);
        const lastY = pad + (1 - (values[values.length - 1] - minV) / range) * (h - pad * 2);
        // Outer glow
        ctx.beginPath(); ctx.arc(lastX, lastY, 8, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,107,138,0.25)'; ctx.fill();
        // Inner dot
        ctx.beginPath(); ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ff6b8a'; ctx.fill();
        ctx.beginPath(); ctx.arc(lastX, lastY, 2, 0, Math.PI * 2);
        ctx.fillStyle = '#fff'; ctx.fill();
    }, [hrTrend]);

    // Helpers
    const downloadReport = () => {
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const base = isLocal ? 'http://localhost:8000' : '';
        window.open(`${base}/api/vitals/report`, '_blank');
    };

    const formatTime = (sec) => {
        const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const getEWSLabel = (s) => s === 0 ? 'Low Risk' : s <= 4 ? 'Moderate' : 'High Risk';
    const getEWSColor = (s) => s === 0 ? '#059669' : s <= 4 ? '#d97706' : '#dc2626';
    const getQualityColor = (q) => q > 60 ? '#059669' : q > 30 ? '#d97706' : '#dc2626';

    const isCalibrating = vitals.calibration_pct < 100 && vitals.bpm === 0;

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: '2rem' }}>
            {/* Left: Video Feed */}
            <div className="neo-card" style={{ background: 'white', padding: '1.5rem', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Camera size={24} color="var(--primary)" /> Real-Time Feed
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ fontSize: '0.8rem', color: '#666' }}>{vitals.fps} FPS</span>
                        <span style={{ fontSize: '0.75rem', color: '#999' }}>⏱ {formatTime(vitals.session_time)}</span>
                        <div style={{
                            width: '12px', height: '12px', borderRadius: '50%',
                            background: faceDetected ? '#4ade80' : '#f87171',
                            boxShadow: `0 0 10px ${faceDetected ? '#4ade80' : '#f87171'}`
                        }} />
                    </div>
                </div>

                <div style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', background: '#0f172a', border: '2px solid black' }}>
                    <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', display: 'block', transform: 'scaleX(-1)' }} />
                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                    <canvas ref={overlayCanvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', transform: 'scaleX(-1)', pointerEvents: 'none', zIndex: 5 }} />

                    {!faceDetected && isStreaming && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: 'rgba(15,23,42,0.7)', color: 'white', zIndex: 10 }}>
                            <Shield size={48} style={{ marginBottom: '1rem' }} />
                            <h2 style={{ margin: 0 }}>Be in frame</h2>
                            <p style={{ opacity: 0.8 }}>Please position your face clearly</p>
                        </div>
                    )}

                    {/* HUD */}
                    <div style={{ position: 'absolute', top: '1rem', left: '1rem', color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '2px' }}>Vitals AI System v2.0</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                            <div style={{ width: '8px', height: '8px', background: vitals.status === 'tracking' ? '#22c55e' : '#eab308', borderRadius: '50%', boxShadow: vitals.status === 'tracking' ? '0 0 8px #22c55e' : 'none' }} />
                            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                                {vitals.status === 'tracking' ? 'TRACKING' : isCalibrating ? `CALIBRATING (${Math.round(vitals.calibration_pct)}%)` : 'BUFFERING'}
                            </span>
                        </div>
                    </div>

                    {/* Calibration bar */}
                    {isCalibrating && faceDetected && (
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '8px 16px', background: 'rgba(0,0,0,0.6)', zIndex: 6 }}>
                            <div style={{ height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 2, overflow: 'hidden' }}>
                                <div style={{ width: `${vitals.calibration_pct}%`, height: '100%', background: 'linear-gradient(90deg, #fbbf24, #4ade80)', transition: 'width 0.3s', borderRadius: 2 }} />
                            </div>
                        </div>
                    )}
                </div>

                {/* Pulse & Spectrum Graphs */}
                <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ background: '#f8f9ff', borderRadius: '12px', padding: '1rem', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#666' }}>PULSE WAVEFORM</span>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#ff4d4d' }}>● LIVE</span>
                        </div>
                        <canvas ref={graphCanvasRef} width="600" height="60" style={{ width: '100%', height: '60px' }} />
                    </div>

                    <div style={{ background: '#f0f9ff', borderRadius: '12px', padding: '1rem', border: '1px solid #e0f2fe' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#666' }}>POWER SPECTRUM (ICA + POS)</span>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#3b82f6' }}>STABLE</span>
                        </div>
                        <canvas ref={spectrumCanvasRef} width="600" height="40" style={{ width: '100%', height: '40px' }} />
                    </div>

                    {/* HR Trend Chart — neo card */}
                    <div className="neo-card" style={{ background: 'white', borderRadius: '16px', padding: '1.25rem', border: '2px solid black', boxShadow: '4px 4px 0px black' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                            <div>
                                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1a1a1a', marginBottom: '0.5rem' }}>Heart Rate</div>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                                    <span style={{ background: '#f8f9ff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '2px 10px', fontSize: '1.8rem', fontWeight: 800, color: '#ff6b8a' }}>{vitals.bpm || '--'}</span>
                                    <span style={{ fontSize: '0.85rem', color: '#666' }}>bpm</span>
                                </div>
                            </div>
                            <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#666' }}>
                                <div>Max: <strong>{vitals.hr_max || '--'}</strong> bpm</div>
                                <div>Min: <strong>{vitals.hr_min || '--'}</strong> bpm</div>
                            </div>
                        </div>
                        <div style={{ fontSize: '0.65rem', color: '#888', marginBottom: '6px' }}>Heart rate change (30s)</div>
                        <canvas ref={trendCanvasRef} width="700" height="90" style={{ width: '100%', height: '90px', borderRadius: '8px', background: '#fafafa', border: '1px solid #e2e8f0' }} />
                    </div>
                </div>
            </div>

            {/* Right: Metrics & Alerts */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                {/* Health Alert Section (Moved to top) */}
                <div className="neo-card" style={{
                    background: vitals.alert === "Normal" ? '#ecfdf5' : '#fff1f2',
                    padding: '1.5rem', border: '2px solid black', boxShadow: '4px 4px 0px black',
                    borderColor: vitals.alert === "Normal" ? '#059669' : '#e11d48'
                }}>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        {vitals.alert === "Normal" ? (
                            <CheckCircle2 color="#059669" size={32} />
                        ) : (
                            <AlertCircle color="#e11d48" size={32} className="animate-pulse" />
                        )}
                        <div style={{ flex: 1 }}>
                            <h4 style={{ margin: 0, color: vitals.alert === "Normal" ? '#065f46' : '#9f1239' }}>HEALTH STATUS</h4>
                            <p style={{ margin: '0.2rem 0 0', fontWeight: 700, fontSize: '1.1rem', color: vitals.alert === "Normal" ? '#047857' : '#be123c' }}>
                                {vitals.alert}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Main Vitals */}
                <div className="neo-card" style={{ background: 'white', padding: '2rem', flex: 1 }}>
                    <h3 style={{ margin: '0 0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Activity size={24} color="var(--primary)" /> Biometric Analysis
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        {/* Heart Rate */}
                        <div style={{ background: '#f8f9ff', padding: '1.5rem', borderRadius: '20px', border: '2px solid black', boxShadow: '4px 4px 0px black' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#666', fontWeight: 600, marginBottom: '1rem' }}>
                                <Heart size={20} color="#ff4d4d" fill={faceDetected ? "#ff4d4d" : "none"} className={faceDetected ? "animate-pulse" : ""} /> HEART RATE
                            </div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem' }}>
                                <span style={{ fontSize: '3rem', fontWeight: 800, color: '#1a1a1a' }}>{vitals.bpm || '--'}</span>
                                <span style={{ fontWeight: 700, color: '#666' }}>BPM</span>
                            </div>
                            <div style={{ fontSize: '0.7rem', color: '#999', marginTop: '0.3rem' }}>
                                Min {vitals.hr_min || '--'} / Max {vitals.hr_max || '--'}
                            </div>
                        </div>

                        {/* Respiration */}
                        <div style={{ background: '#fff9f5', padding: '1.5rem', borderRadius: '20px', border: '2px solid black', boxShadow: '4px 4px 0px black' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#666', fontWeight: 600, marginBottom: '1rem' }}>
                                <Wind size={20} color="#3b82f6" /> RESPIRATION
                            </div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem' }}>
                                <span style={{ fontSize: '3rem', fontWeight: 800, color: '#1a1a1a' }}>{vitals.respiration || '--'}</span>
                                <span style={{ fontWeight: 700, color: '#666' }}>RPM</span>
                            </div>
                        </div>

                        {/* Health Score */}
                        <div style={{ background: '#ecfdf5', padding: '1.5rem', borderRadius: '20px', border: '2px solid black', boxShadow: '4px 4px 0px black' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#666', fontWeight: 600, marginBottom: '1rem' }}>
                                <Zap size={20} color="#059669" /> HEALTH SCORE
                            </div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem' }}>
                                <span style={{ fontSize: '3rem', fontWeight: 800, color: '#059669' }}>{vitals.health_score || '--'}</span>
                                <span style={{ fontWeight: 700, color: '#666' }}>/100</span>
                            </div>
                        </div>

                        {/* EWS */}
                        <div style={{ background: vitals.ews === 0 ? '#ecfdf5' : vitals.ews <= 4 ? '#fffbeb' : '#fef2f2', padding: '1.5rem', borderRadius: '20px', border: '2px solid black', boxShadow: '4px 4px 0px black' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#666', fontWeight: 600, marginBottom: '1rem' }}>
                                <AlertCircle size={20} color={getEWSColor(vitals.ews)} /> EWS RISK
                            </div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem' }}>
                                <span style={{ fontSize: '3rem', fontWeight: 800, color: getEWSColor(vitals.ews) }}>{vitals.ews}</span>
                            </div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#666', marginTop: '0.3rem' }}>
                                {getEWSLabel(vitals.ews).toUpperCase()}
                            </div>
                        </div>
                    </div>

                    {/* Signal Quality */}
                    <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f1f5f9', borderRadius: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>SIGNAL QUALITY</span>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: getQualityColor(vitals.signal_quality) }}>
                                {Math.round(vitals.signal_quality)}%
                            </span>
                        </div>
                        <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{
                                width: `${vitals.signal_quality}%`, height: '100%',
                                background: `linear-gradient(90deg, ${getQualityColor(vitals.signal_quality)}, ${getQualityColor(vitals.signal_quality)}88)`,
                                transition: 'width 0.5s ease'
                            }} />
                        </div>
                        <div style={{ marginTop: '0.4rem', fontSize: '0.7rem', color: '#94a3b8' }}>
                            {vitals.status === 'tracking' ? 'TRACKING' : vitals.status?.toUpperCase()}
                        </div>
                    </div>
                </div>

                {/* Download Report Button - Bottom Right */}
                <button onClick={downloadReport} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                    background: '#1a1a1a', color: 'white', border: '2px solid black', borderRadius: '12px',
                    padding: '1rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem',
                    boxShadow: '4px 4px 0px black', transition: 'transform 0.1s', marginTop: 'auto'
                }}>
                    <Download size={18} /> Download Session PDF Report
                </button>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }
                .animate-pulse { animation: pulse 1s infinite cubic-bezier(0.4, 0, 0.6, 1); }
            `}} />
        </div>
    );
};

export default VitalsMonitor;
