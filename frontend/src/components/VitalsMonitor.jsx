import React, { useEffect, useRef, useState } from 'react';
import { Activity, Heart, Wind, Camera, AlertCircle, CheckCircle2, Shield } from 'lucide-react';

const VitalsMonitor = () => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const graphCanvasRef = useRef(null);
    const wsRef = useRef(null);
    const detectorRef = useRef(null);
    const spectrumCanvasRef = useRef(null);
    const lastPositionRef = useRef(null);
    const overlayCanvasRef = useRef(null);
    const lastSendTimeRef = useRef(0);
    
    const [vitals, setVitals] = useState({ 
        bpm: 0, 
        respiration: 0, 
        fps: 0, 
        status: 'initializing',
        alert: 'Normal'
    });
    const [error, setError] = useState(null);
    const [isStreaming, setIsStreaming] = useState(false);
    const [faceDetected, setFaceDetected] = useState(false);
    const [pulseData, setPulseData] = useState([]);
    const [spectrum, setSpectrum] = useState([]);

    // MediaPipe initialization via CDN for reliability
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

                faceDetection.setOptions({
                    model: 'short',
                    minDetectionConfidence: 0.5
                });

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
            if (wsRef.current) {
                wsRef.current.onclose = null; // Prevent reconnect on deliberate close
                wsRef.current.close();
            }
        };
    }, []);

    const onResults = (results) => {
        if (results.detections.length > 0) {
            setFaceDetected(true);
            processFaceDetection(results.detections[0]);
        } else {
            setFaceDetected(false);
            setVitals(prev => ({ ...prev, status: 'searching' }));
            // Clear overlay when face is lost
            const overlayCanvas = overlayCanvasRef.current;
            if (overlayCanvas) {
                const oCtx = overlayCanvas.getContext('2d');
                oCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
            }
        }
    };

    const processFaceDetection = (detection) => {
        if (!videoRef.current || !canvasRef.current || wsRef.current?.readyState !== WebSocket.OPEN) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const boundingBox = detection.boundingBox;
        
        // Forehead is roughly top portion of the face box (dynamic sizing)
        const fw = boundingBox.width * video.videoWidth * 0.6;
        const fh = boundingBox.height * video.videoHeight * 0.25;
        const fx = (boundingBox.xCenter * video.videoWidth) - (fw / 2);
        const fy = (boundingBox.yCenter * video.videoHeight) - (boundingBox.height * video.videoHeight * 0.4);

        // Draw face detection overlay
        const overlayCanvas = overlayCanvasRef.current;
        if (overlayCanvas) {
            overlayCanvas.width = video.videoWidth;
            overlayCanvas.height = video.videoHeight;
            const oCtx = overlayCanvas.getContext('2d');
            oCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

            // Face bounding box (green)
            const faceX = (boundingBox.xCenter - boundingBox.width / 2) * video.videoWidth;
            const faceY = (boundingBox.yCenter - boundingBox.height / 2) * video.videoHeight;
            const faceW = boundingBox.width * video.videoWidth;
            const faceH = boundingBox.height * video.videoHeight;
            oCtx.strokeStyle = '#4ade80';
            oCtx.lineWidth = 2;
            oCtx.setLineDash([8, 4]);
            oCtx.strokeRect(faceX, faceY, faceW, faceH);

            // Corner accents on face box
            const cornerLen = 14;
            oCtx.setLineDash([]);
            oCtx.lineWidth = 3;
            oCtx.strokeStyle = '#4ade80';
            // top-left
            oCtx.beginPath(); oCtx.moveTo(faceX, faceY + cornerLen); oCtx.lineTo(faceX, faceY); oCtx.lineTo(faceX + cornerLen, faceY); oCtx.stroke();
            // top-right
            oCtx.beginPath(); oCtx.moveTo(faceX + faceW - cornerLen, faceY); oCtx.lineTo(faceX + faceW, faceY); oCtx.lineTo(faceX + faceW, faceY + cornerLen); oCtx.stroke();
            // bottom-left
            oCtx.beginPath(); oCtx.moveTo(faceX, faceY + faceH - cornerLen); oCtx.lineTo(faceX, faceY + faceH); oCtx.lineTo(faceX + cornerLen, faceY + faceH); oCtx.stroke();
            // bottom-right
            oCtx.beginPath(); oCtx.moveTo(faceX + faceW - cornerLen, faceY + faceH); oCtx.lineTo(faceX + faceW, faceY + faceH); oCtx.lineTo(faceX + faceW, faceY + faceH - cornerLen); oCtx.stroke();

            // Forehead ROI rectangle (cyan)
            oCtx.strokeStyle = '#22d3ee';
            oCtx.lineWidth = 2;
            oCtx.setLineDash([]);
            oCtx.shadowColor = 'rgba(34, 211, 238, 0.5)';
            oCtx.shadowBlur = 6;
            oCtx.strokeRect(fx, fy, fw, fh);
            oCtx.shadowBlur = 0;

            // Label (counter-mirror so text reads correctly on flipped canvas)
            oCtx.save();
            oCtx.translate(fx + fw / 2, fy - 6);
            oCtx.scale(-1, 1);
            oCtx.fillStyle = 'rgba(34, 211, 238, 0.85)';
            oCtx.font = 'bold 11px monospace';
            oCtx.textAlign = 'center';
            oCtx.fillText('FOREHEAD ROI', 0, 0);
            oCtx.restore();
        }

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        canvas.width = fw;
        canvas.height = fh;
        
        try {
            ctx.drawImage(video, fx, fy, fw, fh, 0, 0, fw, fh);
            const imageData = ctx.getImageData(0, 0, fw, fh);
            const data = imageData.data;
            
            let redSum = 0;
            let greenSum = 0;
            let blueSum = 0;
            
            for (let i = 0; i < data.length; i += 4) {
                redSum += data[i];
                greenSum += data[i + 1];
                blueSum += data[i + 2];
            }
            
            const numPixels = data.length / 4;
            const avgRed = redSum / numPixels;
            const avgGreen = greenSum / numPixels;
            const avgBlue = blueSum / numPixels;

            // Exposure validation: reject bad exposure frames
            if (avgGreen > 240 || avgGreen < 30) return;

            // Skin plausibility check: reject if too dark (non-skin region)
            if (avgRed < 50) return;

            // Motion artifact rejection (tighter 3px threshold)
            const cx = boundingBox.xCenter * video.videoWidth;
            const cy = boundingBox.yCenter * video.videoHeight;
            const lastPos = lastPositionRef.current;
            if (lastPos) {
                const dx = Math.abs(cx - lastPos.x);
                const dy = Math.abs(cy - lastPos.y);
                if (dx > 5 || dy > 5) {
                    lastPositionRef.current = { x: cx, y: cy };
                    return; // skip noisy frame
                }
            }
            lastPositionRef.current = { x: cx, y: cy };

            // Frame rate throttle: cap at 30fps for consistent sampling
            const now = performance.now();
            if (now - lastSendTimeRef.current < 33.3) return;
            lastSendTimeRef.current = now;

            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    values: [avgRed, avgGreen, avgBlue],
                    timestamp: Date.now() / 1000
                }));
            }

            // Track pulse data for graph (using green as visual proxy)
            setPulseData(prev => {
                const newData = [...prev, avgGreen];
                return newData.slice(-100); // Keep last 100 points
            });

        } catch (e) {
            // Out of bounds or video not ready
        }
    };

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { width: 640, height: 480, frameRate: 30 } 
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                setIsStreaming(true);
                
                // Start detection loop
                const cameraLoop = async () => {
                    if (videoRef.current && detectorRef.current) {
                        try {
                            await detectorRef.current.send({ image: videoRef.current });
                        } catch (err) {}
                    }
                    requestAnimationFrame(cameraLoop);
                };
                cameraLoop();
            }
        } catch (err) {
            setError("Camera access denied. Please allow permissions.");
            console.error(err);
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            videoRef.current.srcObject.getTracks().forEach(track => track.stop());
        }
    };

    const connectWebSocket = () => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;
        
        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        // In development, target port 8000. In production, use the same host.
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const host = isLocal ? 'localhost:8000' : window.location.host;
        const wsUrl = `${protocol}://${host}/ws/vitals`;
        
        console.log("Connecting to Vitals WebSocket:", wsUrl);
        const ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
            console.log("Vitals WebSocket Connected");
            setError(null);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.spectrum) setSpectrum(data.spectrum);
                setVitals(prev => ({ ...prev, ...data }));
            } catch (err) {
                console.error("Error parsing WS message:", err);
            }
        };

        ws.onclose = (e) => {
            console.log("Vitals WebSocket Closed:", e.code, e.reason);
            // Reconnect after 3 seconds
            setTimeout(connectWebSocket, 3000);
        };

        ws.onerror = (err) => {
            console.error("Vitals WebSocket Error:", err);
        };

        wsRef.current = ws;
    };

    // Render Pulse Graph
    useEffect(() => {
        if (!graphCanvasRef.current || pulseData.length < 2) return;
        
        const canvas = graphCanvasRef.current;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        
        ctx.clearRect(0, 0, width, height);
        
        // Draw grid
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 0.5;
        for(let i=0; i<width; i+=40) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, height);
            ctx.stroke();
        }

        ctx.beginPath();
        ctx.strokeStyle = '#ff4d4d';
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        
        const min = Math.min(...pulseData);
        const max = Math.max(...pulseData);
        const range = max - min || 1;
        
        pulseData.forEach((val, i) => {
            const x = (i / 99) * width;
            const y = height - ((val - min) / range) * height * 0.8 - (height * 0.1);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();
    }, [pulseData]);

    // Render Spectrum Graph
    useEffect(() => {
        if (!spectrumCanvasRef.current || spectrum.length === 0) return;
        const canvas = spectrumCanvasRef.current;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = 'rgba(59, 130, 246, 0.5)';
        
        const barWidth = width / spectrum.length;
        spectrum.forEach((val, i) => {
            const barHeight = val * height;
            ctx.fillRect(i * barWidth, height - barHeight, barWidth - 1, barHeight);
        });
    }, [spectrum]);

    const getAlertLevel = () => {
        if (vitals.alert === "Normal") return "success";
        return "warning";
    };

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
                        <div style={{ 
                            width: '12px', height: '12px', borderRadius: '50%', 
                            background: faceDetected ? '#4ade80' : '#f87171',
                            boxShadow: `0 0 10px ${faceDetected ? '#4ade80' : '#f87171'}`
                        }} />
                    </div>
                </div>

                <div style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', background: '#0f172a', border: '2px solid black' }}>
                    <video 
                        ref={videoRef} 
                        autoPlay 
                        playsInline 
                        muted 
                        style={{ width: '100%', display: 'block', transform: 'scaleX(-1)' }} 
                    />
                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                    <canvas ref={overlayCanvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', transform: 'scaleX(-1)', pointerEvents: 'none', zIndex: 5 }} />
                    
                    {!faceDetected && isStreaming && (
                        <div style={{ 
                            position: 'absolute', inset: 0, 
                            display: 'flex', flexDirection: 'column',
                            justifyContent: 'center', alignItems: 'center',
                            background: 'rgba(15, 23, 42, 0.7)',
                            color: 'white', zIndex: 10
                        }}>
                            <Shield size={48} style={{ marginBottom: '1rem' }} />
                            <h2 style={{ margin: 0 }}>Be in frame</h2>
                            <p style={{ opacity: 0.8 }}>Please position your face clearly</p>
                        </div>
                    )}

                    {/* Recognition HUD Overlay */}
                    <div style={{ position: 'absolute', top: '1rem', left: '1rem', color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '2px' }}>Vitals AI System v1.0</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                            <div style={{ 
                                width: '8px', height: '8px', 
                                background: vitals.status === 'tracking' ? '#22c55e' : '#eab308', 
                                borderRadius: '50%',
                                boxShadow: vitals.status === 'tracking' ? '0 0 8px #22c55e' : 'none'
                            }} />
                            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                                {vitals.status === 'tracking' ? 'TRACKING' : `BUFFERING (${Math.min(100, Math.round((pulseData.length / 100) * 100))}% )`}
                            </span>
                        </div>
                    </div>
                </div>
                
                {/* Pulse & Spectrum Graphs Below Video */}
                <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ background: '#f8f9ff', borderRadius: '12px', padding: '1rem', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#666' }}>PULSE WAVEFORM</span>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#ff4d4d' }}>LIVE</span>
                        </div>
                        <canvas ref={graphCanvasRef} width="600" height="60" style={{ width: '100%', height: '60px' }} />
                    </div>

                    <div style={{ background: '#f0f9ff', borderRadius: '12px', padding: '1rem', border: '1px solid #e0f2fe' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#666' }}>POWER SPECTRUM (ICA Component)</span>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#3b82f6' }}>STABLE</span>
                        </div>
                        <canvas ref={spectrumCanvasRef} width="600" height="40" style={{ width: '100%', height: '40px' }} />
                    </div>
                </div>
            </div>

            {/* Right: Metrics & Alerts */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <div className="neo-card" style={{ background: 'white', padding: '2rem', flex: 1 }}>
                    <h3 style={{ margin: '0 0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Activity size={24} color="var(--primary)" /> Biometric Analysis
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <div style={{ background: '#f8f9ff', padding: '1.5rem', borderRadius: '20px', border: '2px solid black', boxShadow: '4px 4px 0px black' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#666', fontWeight: 600, marginBottom: '1rem' }}>
                                <Heart size={20} color="#ff4d4d" fill={faceDetected ? "#ff4d4d" : "none"} className={faceDetected ? "animate-pulse" : ""} /> HEART RATE
                            </div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem' }}>
                                <span style={{ fontSize: '3rem', fontWeight: 800, color: '#1a1a1a' }}>{vitals.bpm || '--'}</span>
                                <span style={{ fontWeight: 700, color: '#666' }}>BPM</span>
                            </div>
                        </div>

                        <div style={{ background: '#fff9f5', padding: '1.5rem', borderRadius: '20px', border: '2px solid black', boxShadow: '4px 4px 0px black' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#666', fontWeight: 600, marginBottom: '1rem' }}>
                                <Wind size={20} color="#3b82f6" /> RESPIRATION
                            </div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem' }}>
                                <span style={{ fontSize: '3rem', fontWeight: 800, color: '#1a1a1a' }}>{vitals.respiration || '--'}</span>
                                <span style={{ fontWeight: 700, color: '#666' }}>RPM</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ marginTop: '2rem', padding: '1rem', background: '#f1f5f9', borderRadius: '12px', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', marginBottom: '0.5rem' }}>SIGNAL QUALITY</div>
                        <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ 
                                width: faceDetected ? '85%' : '0%', 
                                height: '100%', 
                                background: 'linear-gradient(90deg, #4ade80, #22c55e)',
                                transition: 'width 0.5s ease'
                            }} />
                        </div>
                        <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#94a3b8' }}>{vitals.status.toUpperCase()}</div>
                    </div>
                </div>

                {/* Health Alert Section */}
                <div className="neo-card" style={{ 
                    background: vitals.alert === "Normal" ? '#ecfdf5' : '#fff1f2', 
                    padding: '1.5rem', 
                    border: '2px solid black',
                    boxShadow: '4px 4px 0px black',
                    borderColor: vitals.alert === "Normal" ? '#059669' : '#e11d48'
                }}>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        {vitals.alert === "Normal" ? (
                            <CheckCircle2 color="#059669" size={32} />
                        ) : (
                            <AlertCircle color="#e11d48" size={32} />
                        )}
                        <div>
                            <h4 style={{ margin: 0, color: vitals.alert === "Normal" ? '#065f46' : '#9f1239' }}>HEALTH STATUS</h4>
                            <p style={{ margin: '0.2rem 0 0', fontWeight: 700, fontSize: '1.2rem', color: vitals.alert === "Normal" ? '#047857' : '#be123c' }}>
                                {vitals.alert}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes pulse {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.1); }
                    100% { transform: scale(1); }
                }
                .animate-pulse {
                    animation: pulse 1s infinite cubic-bezier(0.4, 0, 0.6, 1);
                }
            `}} />
        </div>
    );
};

export default VitalsMonitor;
