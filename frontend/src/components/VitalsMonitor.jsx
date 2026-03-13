import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Activity, Heart, Wind, Droplets, Camera, AlertCircle, CheckCircle2, Shield, Download, TrendingUp, BarChart3, Loader2, RefreshCw, Smartphone, Monitor } from 'lucide-react';

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

    const [videoDevices, setVideoDevices] = useState([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState('');
    const [isPhoneCamera, setIsPhoneCamera] = useState(false);

    const [vitals, setVitals] = useState({
        bpm: 0, respiration: 0, fps: 0, status: 'initializing', alert: 'Normal',
        signal_quality: 0, motion_status: 'GOOD', hrv: 0, spo2: 0,
        calibration_pct: 0, hr_min: 0, hr_max: 0, session_time: 0, ai_summary: '',
    });
    const [error, setError] = useState(null);
    const [isStreaming, setIsStreaming] = useState(false);
    const [faceDetected, setFaceDetected] = useState(false);
    const [waveform, setWaveform] = useState([]);
    const [peaks, setPeaks] = useState([]);
    const [hrTrend, setHrTrend] = useState([]);
    const [spectrum, setSpectrum] = useState([]);

    // Detect if a device label looks like a phone camera
    const PHONE_KEYWORDS = ['droidcam', 'iriun', 'epoccam', 'ivcam', 'camo', 'phone', 'android', 'iphone', 'mobile'];
    const isPhoneDevice = (label) => {
        const lower = (label || '').toLowerCase();
        return PHONE_KEYWORDS.some(kw => lower.includes(kw));
    };

    // Enumerate available video devices
    const enumerateDevices = useCallback(async () => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const vDevices = devices.filter(d => d.kind === 'videoinput');
            setVideoDevices(vDevices);
            // If no device is selected yet, pick the first one
            if (vDevices.length > 0 && !selectedDeviceId) {
                setSelectedDeviceId(vDevices[0].deviceId);
                setIsPhoneCamera(isPhoneDevice(vDevices[0].label));
            }
        } catch (err) {
            console.error('[Vitals] Device enumeration error:', err);
        }
    }, [selectedDeviceId]);

    // MediaPipe initialization
    useEffect(() => {
        let active = true;
        const loadMediaPipe = async () => {
            if (!active) return;
            
            // Load both Scripts
            const loadScript = (src) => new Promise((res) => {
                const s = document.createElement('script');
                s.src = src; s.async = true; s.onload = res;
                document.head.appendChild(s);
            });

            await Promise.all([
                loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js"),
                loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js")
            ]);

            if (!active) return;
            const faceMesh = new window.FaceMesh({
                locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
            });
            faceMesh.setOptions({
                maxNumFaces: 1,
                refineLandmarks: true,
                minDetectionConfidence: 0.6,
                minTrackingConfidence: 0.6
            });
            faceMesh.onResults(onResults);
            detectorRef.current = faceMesh;
            startCamera();
        };
        loadMediaPipe();
        enumerateDevices();
        connectWebSocket();

        // Listen for device connect/disconnect
        const handleDeviceChange = () => enumerateDevices();
        navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);

        return () => {
            active = false;
            stopCamera();
            navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
            if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); }
        };
    }, []);

    const onResults = (results) => {
        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            setFaceDetected(true);
            processFaceMesh(results.multiFaceLandmarks[0]);
        } else {
            setFaceDetected(false);
            setVitals(prev => ({ ...prev, status: 'searching' }));
            const oc = overlayCanvasRef.current;
            if (oc) { const ctx = oc.getContext('2d'); ctx.clearRect(0, 0, oc.width, oc.height); }
        }
    };

    const processFaceMesh = (landmarks) => {
        if (!videoRef.current || !canvasRef.current || wsRef.current?.readyState !== WebSocket.OPEN) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const oc = overlayCanvasRef.current;

        // ROI Point: Landmark 151 (Forehead Center)
        const p151 = landmarks[151];
        const p10 = landmarks[10];
        const p67 = landmarks[67];
        const p297 = landmarks[297];

        const videoW = video.videoWidth;
        const videoH = video.videoHeight;

        // ROI Math: Pinpoint accuracy using landmarks
        const fx_center = p151.x * videoW;
        const fy_center = p151.y * videoH;
        
        // Width based on forehead width landmarks (67 to 297)
        const fw = Math.abs(p297.x - p67.x) * videoW * 0.7;
        const fh = Math.abs(p151.y - p10.y) * videoH * 1.2;
        
        const fx = fx_center - (fw / 2);
        const fy = fy_center - (fh / 0.85); // Shift up slightly from 151

        // Face square math using landmarks
        const top = landmarks[10].y * videoH;
        const bottom = landmarks[152].y * videoH;
        const left = landmarks[234].x * videoW;
        const right = landmarks[454].x * videoW;
        const faceW = right - left;
        const faceH = bottom - top;

        // Draw HUD on overlay canvas (Wireframe removed as requested)
        if (oc) {
            oc.width = videoW; oc.height = videoH;
            const o = oc.getContext('2d');
            o.clearRect(0, 0, oc.width, oc.height);

            // Draw Face Boundary Square
            o.strokeStyle = 'rgba(74, 222, 128, 0.5)'; o.lineWidth = 2; o.setLineDash([8, 4]);
            o.strokeRect(left, top, faceW, faceH);
            o.setLineDash([]); // Reset
            
            // Highlight Forehead ROI (Keep for visual feedback)
            o.strokeStyle = '#22d3ee'; o.lineWidth = 2;
            o.shadowColor = 'rgba(34,211,238,0.5)'; o.shadowBlur = 10;
            o.strokeRect(fx, fy, fw, fh); o.shadowBlur = 0;
            
            o.save(); o.translate(fx + fw/2, fy - 10); o.scale(-1, 1);
            o.fillStyle = '#22d3ee'; o.font = 'bold 10px Inter, monospace'; o.textAlign = 'center';
            o.fillText('PRECISION ROI FIXED', 0, 0); o.restore();
        }

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        canvas.width = Math.max(1, fw);
        canvas.height = Math.max(1, fh);

        try {
            ctx.drawImage(video, fx, fy, fw, fh, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            let rS = 0, gS = 0, bS = 0;
            for (let i = 0; i < data.length; i += 4) {
                rS += data[i]; gS += data[i + 1]; bS += data[i + 2];
            }
            const count = data.length / 4;
            if (count < 10) return;
            
            const aR = rS / count;
            const aG = gS / count;
            const aB = bS / count;

            // Stability check
            const lp = lastPositionRef.current;
            if (lp) {
                const dist = Math.sqrt((fx_center - lp.x)**2 + (fy_center - lp.y)**2);
                if (dist > 15) { // Landmark tracking is more stable, can allow slightly more wiggle
                    lastPositionRef.current = { x: fx_center, y: fy_center };
                    return;
                }
            }
            lastPositionRef.current = { x: fx_center, y: fy_center };

            const now = performance.now();
            if (now - lastSendTimeRef.current < 32) return;
            lastSendTimeRef.current = now;

            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    values: [aR, aG, aB],
                    timestamp: Date.now() / 1000
                }));
            }
        } catch (e) {
            console.error("ROI Processing Error:", e);
        }
    };

    const startCamera = async (deviceId = null) => {
        // Stop any existing stream first
        stopCamera();
        
        const targetDevice = deviceId || selectedDeviceId;
        const useHighRes = targetDevice ? isPhoneDevice(
            videoDevices.find(d => d.deviceId === targetDevice)?.label || ''
        ) : false;

        const constraints = {
            video: {
                width: useHighRes ? { ideal: 1280 } : 640,
                height: useHighRes ? { ideal: 720 } : 480,
                frameRate: { ideal: 30 },
                ...(targetDevice ? { deviceId: { exact: targetDevice } } : {})
            }
        };

        try {
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                setIsStreaming(true);
                
                // Re-enumerate to get labels (labels only available after permission grant)
                enumerateDevices();

                const loop = async () => {
                    if (videoRef.current && detectorRef.current) {
                        try { await detectorRef.current.send({ image: videoRef.current }); } catch (e) {}
                    }
                    requestAnimationFrame(loop);
                };
                loop();
            }
        } catch (err) {
            // Fallback: try without exact device constraint
            if (targetDevice) {
                console.warn('[Vitals] Exact device failed, trying fallback...');
                try {
                    const fallback = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, frameRate: 30 } });
                    if (videoRef.current) {
                        videoRef.current.srcObject = fallback;
                        setIsStreaming(true);
                        enumerateDevices();
                        const loop = async () => {
                            if (videoRef.current && detectorRef.current) {
                                try { await detectorRef.current.send({ image: videoRef.current }); } catch (e) {}
                            }
                            requestAnimationFrame(loop);
                        };
                        loop();
                    }
                } catch (e2) {
                    setError("Camera access denied. Please allow permissions.");
                }
            } else {
                setError("Camera access denied. Please allow permissions.");
            }
        }
    };

    // Restart camera when user selects a different device
    const handleDeviceSelect = (deviceId) => {
        setSelectedDeviceId(deviceId);
        const device = videoDevices.find(d => d.deviceId === deviceId);
        setIsPhoneCamera(isPhoneDevice(device?.label || ''));
        startCamera(deviceId);
    };

    const stopCamera = () => {
        if (videoRef.current?.srcObject) videoRef.current.srcObject.getTracks().forEach(t => t.stop());
    };

    const connectWebSocket = () => {
        // If already connecting or open, don't start another one
        if (wsRef.current && wsRef.current.readyState < 2) return;
        
        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const hostname = window.location.hostname;
        const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
        const port = '8000';
        
        // Use 127.0.0.1 consistently if local to avoid localhost resolution issues
        const host = isLocal ? `127.0.0.1:${port}` : window.location.host;
        
        console.log(`[Vitals] Connecting to ${protocol}://${host}/ws/vitals`);
        const ws = new WebSocket(`${protocol}://${host}/ws/vitals`);
        
        ws.onopen = () => { 
            console.log("[Vitals] WebSocket Connected");
            setError(null); 
        };
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
        ws.onclose = (e) => { 
            if (e.code !== 1000) {
                console.log("[Vitals] WebSocket Closed, reconnecting...");
                setTimeout(connectWebSocket, 3000); 
            }
        };
        ws.onerror = (e) => {
            console.error("[Vitals] WebSocket Error:", e);
        };
        wsRef.current = ws;
    };

    const fetchAISummary = async () => {
        try {
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const base = isLocal ? 'http://localhost:8000' : '';
            const res = await fetch(`${base}/api/vitals/session`);
            if (res.ok) {
                const data = await res.json();
                if (data.ai_summary) {
                    setVitals(prev => ({ ...prev, ai_summary: data.ai_summary }));
                }
            }
        } catch (e) {
            console.error("Error fetching AI summary:", e);
        }
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


    const getQualityColor = (q) => q > 60 ? '#059669' : q > 30 ? '#d97706' : '#dc2626';

    const isCalibrating = vitals.calibration_pct < 100 && vitals.bpm === 0;

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: '2rem' }}>
            {/* Left: Video Feed */}
            <div className="neo-card" style={{ background: 'white', padding: '1.5rem', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
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

                {/* Camera Source Selector */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    marginBottom: '1rem', padding: '0.6rem 0.8rem',
                    background: isPhoneCamera ? '#f0fdf4' : '#f8fafc',
                    borderRadius: '10px', border: `1.5px solid ${isPhoneCamera ? '#86efac' : '#e2e8f0'}`,
                    transition: 'all 0.3s ease'
                }}>
                    {isPhoneCamera
                        ? <Smartphone size={16} color="#16a34a" strokeWidth={2.5} />
                        : <Monitor size={16} color="#64748b" strokeWidth={2.5} />
                    }
                    <select
                        id="camera-select"
                        value={selectedDeviceId}
                        onChange={(e) => handleDeviceSelect(e.target.value)}
                        style={{
                            flex: 1, border: 'none', background: 'transparent',
                            fontSize: '0.82rem', fontWeight: 600, color: '#1e293b',
                            cursor: 'pointer', outline: 'none',
                            fontFamily: 'inherit'
                        }}
                    >
                        {videoDevices.length === 0 && (
                            <option value="">Scanning for cameras...</option>
                        )}
                        {videoDevices.map((device, i) => (
                            <option key={device.deviceId} value={device.deviceId}>
                                {device.label || `Camera ${i + 1}`}
                                {isPhoneDevice(device.label) ? ' 📱' : ''}
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={enumerateDevices}
                        title="Refresh camera list"
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: '28px', height: '28px', borderRadius: '8px',
                            border: '1.5px solid #e2e8f0', background: 'white',
                            cursor: 'pointer', transition: 'all 0.2s'
                        }}
                    >
                        <RefreshCw size={13} color="#64748b" />
                    </button>
                    {isPhoneCamera && (
                        <span style={{
                            fontSize: '0.65rem', fontWeight: 700, color: '#16a34a',
                            background: '#dcfce7', padding: '2px 8px',
                            borderRadius: '6px', whiteSpace: 'nowrap', letterSpacing: '0.5px'
                        }}>HD</span>
                    )}
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

                    {faceDetected && isStreaming && vitals.motion_status === 'POOR' && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: 'rgba(225,29,72,0.85)', color: 'white', zIndex: 10, backdropFilter: 'blur(2px)' }}>
                            <AlertCircle size={56} className="animate-pulse" style={{ marginBottom: '1rem' }} />
                            <h2 style={{ margin: '0 0 0.5rem', fontWeight: 800, letterSpacing: '1px' }}>MOTION DETECTED</h2>
                            <p style={{ opacity: 0.9, fontSize: '1.1rem', fontWeight: 600 }}>Please remain still.</p>
                            <p style={{ opacity: 0.7, fontSize: '0.85rem', marginTop: '1rem' }}>Vital calculation paused</p>
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
                    {/* Pulse Graph - Only render if waveform exists */}
                    {waveform.length > 0 && (
                        <div style={{ background: '#f8f9ff', borderRadius: '12px', padding: '1rem', border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#666' }}>PULSE WAVEFORM</span>
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#ff4d4d' }}>● LIVE</span>
                            </div>
                            <canvas ref={graphCanvasRef} width="600" height="60" style={{ width: '100%', height: '60px' }} />
                        </div>
                    )}

                    {/* Spectrum Graph - Only render if spectrum exists */}
                    {spectrum.length > 0 && (
                        <div style={{ background: '#f0f9ff', borderRadius: '12px', padding: '1rem', border: '1px solid #e0f2fe' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#666' }}>POWER SPECTRUM (ICA + POS)</span>
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#3b82f6' }}>STABLE</span>
                            </div>
                            <canvas ref={spectrumCanvasRef} width="600" height="40" style={{ width: '100%', height: '40px' }} />
                        </div>
                    )}

                    {/* HR Trend Chart - Only render if trend has enough points */}
                    {hrTrend.length > 2 && (
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
                    )}
                </div>
            </div>

            {/* Right: Metrics & Alerts */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                {/* Health Alert Section */}
                {vitals.bpm > 0 ? (
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
                ) : (
                    <div className="neo-card" style={{ background: '#f8fafc', padding: '1.5rem', border: '2px dashed #cbd5e1', textAlign: 'center', color: '#94a3b8', borderRadius: '12px' }}>
                        <Shield size={28} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', letterSpacing: '1px' }}>SYSTEM STANDBY</div>
                    </div>
                )}

                {/* Main Vitals */}
                <div className="neo-card" style={{ background: 'white', padding: '2rem', flex: 1 }}>
                    <h3 style={{ margin: '0 0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Activity size={24} color="var(--primary)" /> Biometric Analysis
                    </h3>

                    {vitals.bpm > 0 ? (
                        <>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                                {/* Heart Rate */}
                                <div style={{ background: '#f8f9ff', padding: '1rem', borderRadius: '16px', border: '2px solid black', boxShadow: '3px 3px 0px black' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#666', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.75rem' }}>
                                        <Heart size={16} color="#ff4d4d" fill={faceDetected ? "#ff4d4d" : "none"} className={faceDetected ? "animate-pulse" : ""} /> HEART RATE
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.2rem' }}>
                                        <span style={{ fontSize: '2rem', fontWeight: 800, color: '#1a1a1a' }}>{vitals.bpm || '--'}</span>
                                        <span style={{ fontWeight: 700, color: '#666', fontSize: '0.7rem' }}>BPM</span>
                                    </div>
                                    <div style={{ fontSize: '0.6rem', color: '#999', marginTop: '0.2rem' }}>
                                        Min {vitals.hr_min || '--'} / Max {vitals.hr_max || '--'}
                                    </div>
                                </div>

                                {/* Respiration */}
                                <div style={{ background: '#fff9f5', padding: '1rem', borderRadius: '16px', border: '2px solid black', boxShadow: '3px 3px 0px black' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#666', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.75rem' }}>
                                        <Wind size={16} color="#3b82f6" /> RESPIRATION
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.2rem' }}>
                                        <span style={{ fontSize: '2rem', fontWeight: 800, color: '#1a1a1a' }}>{vitals.respiration || '--'}</span>
                                        <span style={{ fontWeight: 700, color: '#666', fontSize: '0.7rem' }}>RPM</span>
                                    </div>
                                </div>

                                {/* SpO2 */}
                                <div style={{ background: '#f0fdf4', padding: '1rem', borderRadius: '16px', border: '2px solid black', boxShadow: '3px 3px 0px black' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#666', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                                        <Droplets size={16} color="#0ea5e9" /> SpO₂ (EST.)
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.2rem' }}>
                                        <span style={{ fontSize: '2rem', fontWeight: 800, color: '#1a1a1a' }}>{vitals.spo2 || '--'}</span>
                                        <span style={{ fontWeight: 700, color: '#666', fontSize: '0.7rem' }}>%</span>
                                    </div>
                                </div>
                            </div>



                            {/* Signal Quality */}
                            <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.5px' }}>SIGNAL QUALITY</span>
                                        <span style={{ fontSize: '0.7rem', fontWeight: 600, color: vitals.motion_status === 'GOOD' ? '#059669' : (vitals.motion_status === 'MODERATE' ? '#d97706' : '#dc2626') }}>
                                            {vitals.motion_status}
                                        </span>
                                    </div>
                                    <span style={{ fontSize: '1.2rem', fontWeight: 800, color: getQualityColor(vitals.signal_quality) }}>
                                        {Math.round(vitals.signal_quality)}%
                                    </span>
                                </div>
                                <div style={{ height: '10px', background: '#e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                                    <div style={{
                                        width: `${vitals.signal_quality}%`, height: '100%',
                                        background: vitals.motion_status === 'POOR' 
                                            ? 'linear-gradient(90deg, #ef4444, #dc2626)' 
                                            : vitals.motion_status === 'MODERATE'
                                                ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                                                : `linear-gradient(90deg, #34d399, #059669)`,
                                        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), background 0.3s'
                                    }} />
                                </div>
                            </div>
                        </>
                    ) : (
                        <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                            <Activity size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                            <h4 style={{ margin: '0 0 0.5rem', color: '#64748b' }}>Acquiring Signal...</h4>
                            <p style={{ margin: 0, fontSize: '0.85rem' }}>Please keep your face positioned clearly in the frame.</p>
                            {isCalibrating && (
                                <div style={{ marginTop: '1.5rem', color: '#3b82f6', fontWeight: 600 }}>
                                    Calibrating ({Math.round(vitals.calibration_pct)}%)
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* AI Health Summary Panel */}
                <div className="neo-card" style={{ 
                    background: '#f1f5f9', 
                    borderRadius: '16px', 
                    padding: '1.5rem', 
                    border: '2px solid black', 
                    boxShadow: '4px 4px 0px black',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '1.1rem' }}>
                            <Activity size={22} color="var(--primary)" /> AI HEALTH REPORT
                        </h3>
                        <button 
                            onClick={fetchAISummary}
                            disabled={vitals.bpm === 0}
                            style={{ 
                                padding: '0.4rem 0.8rem', 
                                background: vitals.bpm === 0 ? '#cbd5e1' : 'black', 
                                color: 'white', 
                                border: '2px solid black',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: vitals.bpm === 0 ? 'not-allowed' : 'pointer',
                                boxShadow: vitals.bpm === 0 ? 'none' : '2px 2px 0px black'
                            }}
                        >
                            GENERATE SUMMARY
                        </button>
                    </div>
                    
                    <div style={{ 
                        background: 'white', 
                        padding: '1.25rem', 
                        borderRadius: '12px', 
                        border: '1px solid #e2e8f0',
                        minHeight: '120px',
                        maxHeight: '300px',
                        overflowY: 'auto',
                        fontSize: '0.95rem',
                        lineHeight: '1.6',
                        color: '#1e293b'
                    }}>
                        {vitals.ai_summary ? (
                            <div className="ai-content">
                                {vitals.ai_summary.split('\n').map((line, i) => {
                                    if (line.startsWith('##')) {
                                        return <h4 key={i} style={{ margin: '1rem 0 0.5rem', color: 'var(--primary)', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>{line.replace('##', '').trim()}</h4>;
                                    }
                                    if (line.startsWith('Recommendation:')) {
                                        return <div key={i} style={{ marginTop: '1rem', padding: '0.8rem', background: '#f0fdf4', borderLeft: '4px solid #22c55e', fontWeight: 600 }}>{line}</div>;
                                    }
                                    return <p key={i} style={{ margin: '0 0 0.8rem' }}>{line}</p>;
                                })}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.5, gap: '0.5rem' }}>
                                <Loader2 size={24} className="animate-spin" />
                                <p style={{ fontSize: '0.85rem', fontWeight: 500 }}>Vitals required to generate AI insights.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Download Report Button - Bottom */}
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
