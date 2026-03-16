import React, { useEffect, useRef, useState } from 'react';
import { Activity, Heart, Wind, Droplets, Camera, AlertCircle, CheckCircle2, Shield, Download, TrendingUp, BarChart3, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { API_BASE_URL } from '../lib/config';

const VitalsMonitor = ({ initialPatientId = '' }) => {
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
    const patchHistoryRef = useRef({ forehead: null, leftCheek: null, rightCheek: null });
    const roiBoxesRef = useRef(null);
    const detectionLoopActiveRef = useRef(false);
    const lastWsMessageAtRef = useRef(Date.now());
    const reconnectTimerRef = useRef(null);
    const cameraRestartingRef = useRef(false);
    const intentionalCameraStopRef = useRef(false);

    const [vitals, setVitals] = useState({
        bpm: 0, respiration: 0, fps: 0, status: 'initializing', alert: 'Normal',
        signal_quality: 0, motion_status: 'GOOD', hrv: 0, spo2: 0,
        calibration_pct: 0, hr_min: 0, hr_max: 0, session_time: 0, 
        ai_summary: '', ai_summary_translated: '', ai_risk_level: '',
        confidence: 0, hr_uncertainty: 0, rr_uncertainty: 0, spo2_uncertainty: 0,
        quality_reason: 'Warm-up',
        session_id: '',
    });
    const [error, setError] = useState(null);
    const [isStreaming, setIsStreaming] = useState(false);
    const [faceDetected, setFaceDetected] = useState(false);
    const [waveform, setWaveform] = useState([]);
    const [peaks, setPeaks] = useState([]);
    const [hrTrend, setHrTrend] = useState([]);
    const [spectrum, setSpectrum] = useState([]);
    const [savedSessionId, setSavedSessionId] = useState('');
    const [referenceInput, setReferenceInput] = useState('');
    const [referenceId, setReferenceId] = useState('');
    const [compareResult, setCompareResult] = useState(null);
    const [compareMessage, setCompareMessage] = useState('');
    const [compareLoading, setCompareLoading] = useState(false);
    const [cameraDevices, setCameraDevices] = useState([]);
    const [selectedCameraId, setSelectedCameraId] = useState('');
    const [cameraSwitching, setCameraSwitching] = useState(false);
    const [isPhoneCamera, setIsPhoneCamera] = useState(false);
    const [patientInputId, setPatientInputId] = useState(initialPatientId);
    const [userAge, setUserAge] = useState(null);
    const [trendDays, setTrendDays] = useState(7);
    const [trendAnalysis, setTrendAnalysis] = useState(null);
    const [trendLoading, setTrendLoading] = useState(false);
    const [trendPatientId, setTrendPatientId] = useState('');

    // Patient info modal
    const [showPatientModal, setShowPatientModal] = useState(false);
    const [pendingAction, setPendingAction] = useState(null); // 'summary' | 'pdf'
    const [patientForm, setPatientForm] = useState({ patientId: '', name: '', contact: '', language: 'English' });
    const [patientFormError, setPatientFormError] = useState('');

    const getApiBase = () => {
        return API_BASE_URL;
    };

    const PHONE_KEYWORDS = ['droidcam', 'iriun', 'epoccam', 'ivcam', 'camo', 'phone', 'android', 'iphone', 'continuity'];
    const isPhoneDevice = (label) => {
        const lower = (label || '').toLowerCase();
        return PHONE_KEYWORDS.some((h) => lower.includes(h));
    };

    const pickPreferredCamera = (devices) => {
        if (!devices?.length) return '';
        const preferred = devices.find((d) => isPhoneDevice(d.label));
        return preferred?.deviceId || devices[0].deviceId;
    };

    const loadVideoDevices = async () => {
        try {
            const all = await navigator.mediaDevices.enumerateDevices();
            const videos = all.filter((d) => d.kind === 'videoinput');
            setCameraDevices(videos);
            if (videos.length > 0) {
                const preferred = pickPreferredCamera(videos);
                const selectedStillExists = selectedCameraId && videos.some((d) => d.deviceId === selectedCameraId);
                const nextId = selectedStillExists ? selectedCameraId : preferred;
                setSelectedCameraId(nextId);
                const active = videos.find((d) => d.deviceId === nextId);
                setIsPhoneCamera(isPhoneDevice(active?.label || ''));
            }
            return videos;
        } catch (e) {
            console.error('Could not enumerate cameras', e);
            return [];
        }
    };

    useEffect(() => {
        const loadUserAge = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                const rawAge = user?.user_metadata?.age;
                const parsed = Number(rawAge);
                if (Number.isFinite(parsed) && parsed >= 13 && parsed <= 100) {
                    setUserAge(parsed);
                } else {
                    setUserAge(null);
                }
            } catch (e) {
                setUserAge(null);
            }
        };
        loadUserAge();
    }, []);

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

            // Request camera access once so device labels (DroidCam/Iriun) are available.
            let videos = [];
            try {
                const perm = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                perm.getTracks().forEach((t) => t.stop());
            } catch (e) {
                // Continue; explicit camera start below will surface actionable errors.
            }

            videos = await loadVideoDevices();
            const preferred = pickPreferredCamera(videos);
            await startCamera(preferred || null);
        };
        loadMediaPipe();
        loadVideoDevices();
        connectWebSocket();
        const handleDeviceChange = () => loadVideoDevices();
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
            roiBoxesRef.current = null;
            const oc = overlayCanvasRef.current;
            if (oc) { const ctx = oc.getContext('2d'); ctx.clearRect(0, 0, oc.width, oc.height); }
        }
    };

    const smoothRect = (previous, next, alpha = 0.35) => {
        if (!previous) return { ...next };
        return {
            x: previous.x + (next.x - previous.x) * alpha,
            y: previous.y + (next.y - previous.y) * alpha,
            w: previous.w + (next.w - previous.w) * alpha,
            h: previous.h + (next.h - previous.h) * alpha,
        };
    };

    const processFaceMesh = (landmarks) => {
        if (!videoRef.current || !canvasRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const oc = overlayCanvasRef.current;

        // Core landmarks for adaptive multi-patch ROI fusion
        const p1 = landmarks[1];
        const p205 = landmarks[205];
        const p425 = landmarks[425];

        const videoW = video.videoWidth;
        const videoH = video.videoHeight;

        // Dynamic face bounds. Use min/max so ROIs still track correctly across mirrored/front camera orientations.
        const top = Math.min(landmarks[10].y * videoH, landmarks[151].y * videoH);
        const bottom = landmarks[152].y * videoH;
        const sideA = landmarks[234].x * videoW;
        const sideB = landmarks[454].x * videoW;
        const left = Math.min(sideA, sideB);
        const right = Math.max(sideA, sideB);
        const faceW = right - left;
        const faceH = bottom - top;

        if (faceW < 20 || faceH < 20) return;

        const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

        // Forehead ROI from live landmarks and face bounds.
        const rawForehead = {
            x: left + faceW * 0.3,
            y: top + faceH * 0.07,
            w: faceW * 0.4,
            h: faceH * 0.16,
        };

        // Cheek ROIs anchored to inner-cheek landmarks and constrained away from ears.
        const cheekW = faceW * 0.2;
        const cheekH = faceH * 0.18;
        const noseX = p1.x * videoW;
        const rawCheekY = ((p205.y + p425.y) * 0.5) * videoH;
        const cheekCenterY = clamp(rawCheekY, top + faceH * 0.45, top + faceH * 0.68);
        const leftCheekCenterX = clamp(p205.x * videoW, left + faceW * 0.24, noseX - faceW * 0.12);
        const rightCheekCenterX = clamp(p425.x * videoW, noseX + faceW * 0.12, right - faceW * 0.24);
        const rawLeftCheek = {
            x: leftCheekCenterX - cheekW / 2,
            y: cheekCenterY - cheekH / 2,
            w: cheekW,
            h: cheekH,
        };
        const rawRightCheek = {
            x: rightCheekCenterX - cheekW / 2,
            y: cheekCenterY - cheekH / 2,
            w: cheekW,
            h: cheekH,
        };

        // Smooth but keep dynamic so ROI boxes clearly move with the face.
        const previousRois = roiBoxesRef.current || {};
        const foreheadRoi = smoothRect(previousRois.forehead, rawForehead, 0.35);
        const leftCheekRoi = smoothRect(previousRois.leftCheek, rawLeftCheek, 0.35);
        const rightCheekRoi = smoothRect(previousRois.rightCheek, rawRightCheek, 0.35);
        roiBoxesRef.current = {
            forehead: foreheadRoi,
            leftCheek: leftCheekRoi,
            rightCheek: rightCheekRoi,
        };

        const fx = foreheadRoi.x;
        const fy = foreheadRoi.y;
        const fw = foreheadRoi.w;
        const fh = foreheadRoi.h;
        const lx = leftCheekRoi.x;
        const ly = leftCheekRoi.y;
        const rx = rightCheekRoi.x;
        const ry = rightCheekRoi.y;
        const fx_center = fx + fw / 2;
        const fy_center = fy + fh / 2;

        // Draw HUD on overlay canvas (Wireframe removed as requested)
        if (oc) {
            oc.width = videoW; oc.height = videoH;
            const o = oc.getContext('2d');
            o.clearRect(0, 0, oc.width, oc.height);

            // Draw Face Boundary Square
            o.strokeStyle = 'rgba(74, 222, 128, 0.5)'; o.lineWidth = 2; o.setLineDash([8, 4]);
            o.strokeRect(left, top, faceW, faceH);
            o.setLineDash([]); // Reset
            
            // Draw adaptive multi-patch ROIs (forehead + cheeks)

            o.strokeStyle = '#22d3ee'; o.lineWidth = 2;
            o.shadowColor = 'rgba(34,211,238,0.5)'; o.shadowBlur = 10;
            o.strokeRect(fx, fy, fw, fh);
            o.strokeStyle = 'rgba(59,130,246,0.85)';
            o.strokeRect(lx, ly, cheekW, cheekH);
            o.strokeRect(rx, ry, cheekW, cheekH);
            o.shadowBlur = 0;
            
            o.save(); o.translate(fx + fw/2, fy - 10); o.scale(-1, 1);
            o.fillStyle = '#22d3ee'; o.font = 'bold 10px Inter, monospace'; o.textAlign = 'center';
            o.fillText('ADAPTIVE MULTI-PATCH ROI', 0, 0); o.restore();
        }

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        canvas.width = Math.max(1, Math.round(fw));
        canvas.height = Math.max(1, Math.round(fh));

        try {
            const samplePatch = (name, x, y, w, h) => {
                const sx = Math.max(0, x);
                const sy = Math.max(0, y);
                const sw = Math.max(1, Math.min(videoW - sx, w));
                const sh = Math.max(1, Math.min(videoH - sy, h));
                if (sw < 2 || sh < 2) return null;

                canvas.width = sw;
                canvas.height = sh;
                ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                if (data.length < 40) return null;

                let rS = 0, gS = 0, bS = 0, gSq = 0;
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i], g = data[i + 1], b = data[i + 2];
                    rS += r;
                    gS += g;
                    bS += b;
                    gSq += g * g;
                }
                const count = data.length / 4;
                const aR = rS / count;
                const aG = gS / count;
                const aB = bS / count;
                const gVar = Math.max(0, (gSq / count) - (aG * aG));
                const gStd = Math.sqrt(gVar);

                const chromaBalance = 1.0 - Math.min(1.0, Math.abs(aR - aG) / 90.0);
                const noisePenalty = 1.0 / (1.0 + gStd / 25.0);
                const prev = patchHistoryRef.current[name];
                const temporalDelta = prev ? Math.abs(aG - prev) : 0;
                const temporalStability = 1.0 / (1.0 + temporalDelta / 12.0);
                patchHistoryRef.current[name] = aG;
                const weight = Math.max(0.05, chromaBalance * noisePenalty * temporalStability);

                return { aR, aG, aB, weight };
            };

            const patches = [
                samplePatch('forehead', fx, fy, fw, fh),
                samplePatch('leftCheek', lx, ly, cheekW, cheekH),
                samplePatch('rightCheek', rx, ry, cheekW, cheekH),
            ].filter(Boolean);

            if (!patches.length) return;
            const totalWeight = patches.reduce((acc, p) => acc + p.weight, 0);
            if (totalWeight <= 0) return;

            const aR = patches.reduce((acc, p) => acc + p.aR * p.weight, 0) / totalWeight;
            const aG = patches.reduce((acc, p) => acc + p.aG * p.weight, 0) / totalWeight;
            const aB = patches.reduce((acc, p) => acc + p.aB * p.weight, 0) / totalWeight;

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

    const waitForVideoReady = async (videoEl) => {
        if (!videoEl) return;
        if (videoEl.readyState >= 2 && videoEl.videoWidth > 0 && videoEl.videoHeight > 0) return;
        await new Promise((resolve) => {
            const done = () => {
                videoEl.removeEventListener('loadedmetadata', done);
                videoEl.removeEventListener('canplay', done);
                resolve();
            };
            videoEl.addEventListener('loadedmetadata', done, { once: true });
            videoEl.addEventListener('canplay', done, { once: true });
            setTimeout(done, 1200);
        });
    };

    const runDetectionLoop = () => {
        detectionLoopActiveRef.current = true;
        const tick = async () => {
            if (!detectionLoopActiveRef.current) return;
            if (videoRef.current && detectorRef.current) {
                try { await detectorRef.current.send({ image: videoRef.current }); } catch (e) {}
            }
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    };

    const getCameraConstraintCandidates = (targetDevice) => {
        if (targetDevice) {
            return [
                { deviceId: { exact: targetDevice }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30, max: 30 } },
                { deviceId: { exact: targetDevice }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } },
            ];
        }
        return [
            { facingMode: { ideal: 'user' }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } },
            { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } },
            { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } },
            true,
        ];
    };

    const openCameraStream = async (targetDevice) => {
        const candidates = getCameraConstraintCandidates(targetDevice);
        let lastErr = null;
        for (const videoConstraint of candidates) {
            try {
                return await navigator.mediaDevices.getUserMedia({ video: videoConstraint, audio: false });
            } catch (err) {
                lastErr = err;
            }
        }
        throw lastErr || new Error('Unable to open camera stream');
    };

    const startCamera = async (deviceId = null) => {
        const targetDevice = deviceId || selectedCameraId;
        try {
            stopCamera();
            const stream = await openCameraStream(targetDevice);
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                try { await videoRef.current.play(); } catch (e) {}
                await waitForVideoReady(videoRef.current);
                setIsStreaming(true);
                await loadVideoDevices();

                const activeTrack = stream.getVideoTracks()[0];
                const activeSettings = activeTrack?.getSettings();
                if (activeSettings?.deviceId) {
                    setSelectedCameraId(activeSettings.deviceId);
                    setIsPhoneCamera(isPhoneDevice(activeTrack?.label || ''));
                }

                // Auto-recover camera if OS/driver drops the track mid-session.
                stream.getVideoTracks().forEach((track) => {
                    track.onended = () => {
                        if (intentionalCameraStopRef.current) return;
                        if (cameraRestartingRef.current) return;
                        cameraRestartingRef.current = true;
                        setTimeout(async () => {
                            try {
                                await startCamera(selectedCameraId || null);
                            } finally {
                                cameraRestartingRef.current = false;
                            }
                        }, 500);
                    };
                });
                runDetectionLoop();
            }
        } catch (err) {
            console.error('Camera start failed', err);
            setError('Camera unavailable. Close other apps using camera, then select camera again (Laptop Cam or DroidCam/Iriun).');
        }
    };

    const stopCamera = () => {
        intentionalCameraStopRef.current = true;
        detectionLoopActiveRef.current = false;
        setIsStreaming(false);
        if (videoRef.current?.srcObject) {
            videoRef.current.srcObject.getTracks().forEach(t => {
                t.onended = null;
                t.onmute = null;
                t.onunmute = null;
                t.stop();
            });
            videoRef.current.srcObject = null;
        }
        setTimeout(() => {
            intentionalCameraStopRef.current = false;
        }, 300);
    };

    const switchCamera = async (deviceId) => {
        setSelectedCameraId(deviceId);
        setCameraSwitching(true);
        await startCamera(deviceId || null);
        setCameraSwitching(false);
    };

    const connectWebSocket = () => {
        // If already connecting or open, don't start another one
        if (wsRef.current && wsRef.current.readyState < 2) return;
        
        // Derive WebSocket URL from API_BASE_URL
        // API_BASE_URL is like https://huggingface.co/spaces/Satyam124/medinsight-ai-api
        // or http://localhost:8000
        const wsBase = API_BASE_URL.replace(/^http/, 'ws');
        const wsUrl = `${wsBase}/ws/vitals`;
        
        console.log(`[Vitals] Connecting to ${wsUrl}`);
        const ws = new WebSocket(wsUrl);
        
        ws.onopen = () => { 
            console.log("[Vitals] WebSocket Connected");
            lastWsMessageAtRef.current = Date.now();
            setError(null); 
        };
        ws.onmessage = (event) => {
            try {
                const d = JSON.parse(event.data);
                lastWsMessageAtRef.current = Date.now();
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

    useEffect(() => {
        const watchdog = setInterval(() => {
            const ws = wsRef.current;
            const stale = Date.now() - lastWsMessageAtRef.current > 25000;

            if (!ws || ws.readyState === WebSocket.CLOSED) {
                connectWebSocket();
                return;
            }

            if (ws.readyState === WebSocket.OPEN && stale) {
                try { ws.close(); } catch (e) {}
                if (!reconnectTimerRef.current) {
                    reconnectTimerRef.current = setTimeout(() => {
                        reconnectTimerRef.current = null;
                        connectWebSocket();
                    }, 500);
                }
            }
        }, 4000);

        return () => {
            clearInterval(watchdog);
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (!trendAnalysis) return;
        fetchLongTermTrend(trendPatientId, trendDays);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [trendDays]);

    const fetchAISummary = async (patientInfo) => {
        try {
            setVitals(prev => ({ ...prev, ai_summary: 'Analyzing...' }));
            const base = getApiBase();
            const params = new URLSearchParams();
            if (vitals.session_id) params.set('session_id', vitals.session_id);
            if (patientInfo?.patientId) params.set('patient_id', patientInfo.patientId);
            if (patientInfo?.name) params.set('patient_name', patientInfo.name);
            if (patientInfo?.contact) params.set('patient_contact', patientInfo.contact);
            if (patientInfo?.language) params.set('language', patientInfo.language);
            
            const { data: { session } } = await supabase.auth.getSession();
            const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
            
            const suffix = params.toString() ? `?${params.toString()}` : '';
            const res = await fetch(`${base}/api/vitals/session${suffix}`, { headers });
            
            if (res.ok) {
                const data = await res.json();
                setVitals(prev => ({ 
                    ...prev, 
                    ai_summary: data.summary || '',
                    ai_summary_translated: data.hindi_translation || '',
                    ai_risk_level: data.risk_level || ''
                }));
                if (data.archived) {
                    setCompareMessage('Vitals session successfully archived as a Report.');
                }
            }
        } catch (e) {
            console.error("Error fetching AI summary:", e);
            setVitals(prev => ({ ...prev, ai_summary: 'Error generating summary.' }));
        }
    };

    const openPatientModal = (action) => {
        setPendingAction(action);
        setPatientForm({ patientId: patientInputId || '', name: '', contact: '', language: 'English' });
        setPatientFormError('');
        setShowPatientModal(true);
    };

    const handlePatientFormSubmit = async () => {
        if (!patientForm.patientId.trim()) { setPatientFormError('Patient ID is required.'); return; }
        if (!patientForm.name.trim()) { setPatientFormError('Patient name is required.'); return; }
        if (!patientForm.contact.trim()) { setPatientFormError('Contact number is required.'); return; }
        setShowPatientModal(false);
        if (pendingAction === 'summary') {
            fetchAISummary(patientForm);
        } else if (pendingAction === 'pdf') {
            try {
                setCompareLoading(true);
                const base = getApiBase();
                const params = new URLSearchParams();
                if (vitals.session_id) params.set('session_id', vitals.session_id);
                params.set('patient_id', patientForm.patientId);
                params.set('patient_name', patientForm.name);
                params.set('patient_contact', patientForm.contact);
                params.set('language', patientForm.language);

                const { data: { session } } = await supabase.auth.getSession();
                const headers = session?.access_token
                    ? { Authorization: `Bearer ${session.access_token}` }
                    : {};

                const res = await fetch(`${base}/api/vitals/report?${params.toString()}`, {
                    method: 'GET',
                    headers,
                });

                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    setCompareMessage(err.error || 'Failed to download PDF report.');
                    return;
                }

                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `vitals_report_${patientForm.patientId}_${Date.now()}.pdf`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);

                setCompareMessage('PDF downloaded and synced to Insight Feed.');
            } catch (e) {
                setCompareMessage('Failed to download PDF report.');
            } finally {
                setCompareLoading(false);
            }
        }
    };

    const fetchLongTermTrend = async (patientId = trendPatientId, days = trendDays) => {
        if (!patientId || !String(patientId).trim()) {
            setTrendAnalysis(null);
            setCompareMessage('Save a linked patient session first to view long-term trends.');
            return;
        }
        try {
            setTrendLoading(true);
            const base = getApiBase();
            const query = new URLSearchParams({ patient_id: patientId, days: String(days) });
            const res = await fetch(`${base}/api/vitals/long-term-trend?${query.toString()}`);
            const data = await res.json();
            if (!res.ok) {
                setCompareMessage(data.error || 'Failed to fetch long-term trend.');
                return;
            }
            setTrendAnalysis(data.analysis || null);
        } catch (e) {
            setCompareMessage('Could not fetch long-term trend.');
        } finally {
            setTrendLoading(false);
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
        openPatientModal('pdf');
    };

    const saveSession = async () => {
        setCompareMessage('');
        const linkedPatientId = patientInputId.trim();
        if (!linkedPatientId) {
            setCompareMessage('Link a patient ID before saving this session.');
            return;
        }
        try {
            setCompareLoading(true);
            const base = getApiBase();
            const res = await fetch(`${base}/api/vitals/save-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: vitals.session_id || null,
                    patient_id: linkedPatientId,
                    condition_tag: 'linked-session',
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setCompareMessage(data.error || 'Failed to save session.');
                return;
            }
            setSavedSessionId(data.session_id || '');
            setCompareMessage(`Session saved: ${data.session_id}`);
            setTrendPatientId(data.patient_id || linkedPatientId);
            if (data.long_term_trend) {
                setTrendAnalysis(data.long_term_trend);
            } else {
                fetchLongTermTrend(data.patient_id || linkedPatientId);
            }
        } catch (e) {
            setCompareMessage('Could not save session. Please retry.');
        } finally {
            setCompareLoading(false);
        }
    };

    const parseReferenceCsv = (raw) => {
        const rows = raw
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean);
        const parsed = [];
        for (const row of rows) {
            const [t, hr, rr, spo2] = row.split(',').map((v) => v?.trim());
            const timestamp_sec = Number(t);
            if (Number.isNaN(timestamp_sec)) continue;
            parsed.push({
                timestamp_sec,
                hr: hr ? Number(hr) : null,
                rr: rr ? Number(rr) : null,
                spo2: spo2 ? Number(spo2) : null,
            });
        }
        return parsed.filter((r) => !Number.isNaN(r.timestamp_sec));
    };

    const saveReference = async () => {
        setCompareMessage('');
        const sessionId = savedSessionId || vitals.session_id;
        if (!sessionId) {
            setCompareMessage('Save a session first.');
            return;
        }
        const readings = parseReferenceCsv(referenceInput);
        if (!readings.length) {
            setCompareMessage('Enter reference rows as: time,hr,rr,spo2');
            return;
        }
        try {
            setCompareLoading(true);
            const base = getApiBase();
            const res = await fetch(`${base}/api/vitals/reference`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: sessionId,
                    device_name: 'Apple Watch',
                    condition_tag: 'judge-demo',
                    readings,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setCompareMessage(data.error || 'Failed to save reference readings.');
                return;
            }
            setReferenceId(data.reference_id || '');
            setCompareMessage(`Reference saved: ${data.reference_id}`);
        } catch (e) {
            setCompareMessage('Could not save reference data.');
        } finally {
            setCompareLoading(false);
        }
    };

    const runCompare = async () => {
        setCompareMessage('');
        const sessionId = savedSessionId || vitals.session_id;
        if (!sessionId || !referenceId) {
            setCompareMessage('Need both session and reference IDs.');
            return;
        }
        try {
            setCompareLoading(true);
            const base = getApiBase();
            const query = new URLSearchParams({ session_id: sessionId, reference_id: referenceId });
            const res = await fetch(`${base}/api/vitals/compare?${query.toString()}`);
            const data = await res.json();
            if (!res.ok) {
                setCompareMessage(data.error || 'Comparison failed.');
                return;
            }
            setCompareResult(data);
            setCompareMessage('Comparison complete.');
        } catch (e) {
            setCompareMessage('Could not run comparison.');
        } finally {
            setCompareLoading(false);
        }
    };

    const runCalibrate = async () => {
        setCompareMessage('');
        const sessionId = savedSessionId || vitals.session_id;
        if (!sessionId || !referenceId) {
            setCompareMessage('Save session and reference before calibration.');
            return;
        }
        try {
            setCompareLoading(true);
            const base = getApiBase();
            const res = await fetch(`${base}/api/vitals/calibrate-live`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: sessionId,
                    reference_id: referenceId,
                    metrics: ['hr', 'rr', 'spo2'],
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setCompareMessage(data.error || 'Calibration failed.');
                return;
            }
            setCompareMessage('Live calibration applied. Continue streaming for improved alignment.');
        } catch (e) {
            setCompareMessage('Could not calibrate live.');
        } finally {
            setCompareLoading(false);
        }
    };

    const formatTime = (sec) => {
        const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };


    const getQualityColor = (q) => q > 60 ? '#059669' : q > 30 ? '#d97706' : '#dc2626';
    const getAgeBand = (age) => {
        if (!age) return 'adult';
        if (age < 20) return 'teen';
        if (age < 60) return 'adult';
        return 'senior';
    };

    const getAgeRanges = (ageBand) => {
        if (ageBand === 'teen') {
            return { hr: [55, 105], rr: [12, 20], spo2Min: 95, label: 'Teen (13-19)' };
        }
        if (ageBand === 'senior') {
            return { hr: [55, 95], rr: [12, 24], spo2Min: 94, label: 'Senior (60+)' };
        }
        return { hr: [60, 100], rr: [12, 20], spo2Min: 95, label: 'Adult (20-59)' };
    };

    const evaluateAgeCrossVerification = (metrics, ranges) => {
        const issues = [];

        if ((metrics.bpm || 0) > 0 && (metrics.bpm < ranges.hr[0] || metrics.bpm > ranges.hr[1])) {
            issues.push(`HR out of age range (${ranges.hr[0]}-${ranges.hr[1]} BPM)`);
        }
        if ((metrics.respiration || 0) > 0 && (metrics.respiration < ranges.rr[0] || metrics.respiration > ranges.rr[1])) {
            issues.push(`RR out of age range (${ranges.rr[0]}-${ranges.rr[1]} RPM)`);
        }
        if ((metrics.spo2 || 0) > 0 && metrics.spo2 < ranges.spo2Min) {
            issues.push(`SpO2 below age threshold (>=${ranges.spo2Min}%)`);
        }

        if (!issues.length) {
            return { severity: 'ok', text: `Age-verified for ${ranges.label}` };
        }
        return { severity: issues.length >= 2 ? 'high' : 'medium', text: issues.join(' | ') };
    };
    const getStressColors = (level) => {
        if (level === 'HIGH') return { tone: '#dc2626', bg: '#fff1f2', accent: '#fecdd3' };
        if (level === 'MODERATE') return { tone: '#d97706', bg: '#fff7ed', accent: '#fed7aa' };
        return { tone: '#059669', bg: '#ecfdf5', accent: '#a7f3d0' };
    };
    const getRiskColors = (level) => {
        if (level === 'CRITICAL') return { tone: '#dc2626', bg: '#fff1f2', accent: '#fecdd3' };
        if (level === 'WARNING') return { tone: '#d97706', bg: '#fff7ed', accent: '#fed7aa' };
        return { tone: '#059669', bg: '#ecfdf5', accent: '#a7f3d0' };
    };
    const getTrendColors = (direction) => {
        if (direction === 'increasing') return { tone: '#2563eb', bg: '#eff6ff', accent: '#bfdbfe' };
        if (direction === 'decreasing') return { tone: '#7c3aed', bg: '#f5f3ff', accent: '#ddd6fe' };
        return { tone: '#475569', bg: '#f8fafc', accent: '#cbd5e1' };
    };
    const trendDotColor = (direction) => {
        if (direction === 'increasing') return '#2563eb';
        if (direction === 'decreasing') return '#7c3aed';
        return '#64748b';
    };
    const getLongTrendTheme = (status) => {
        if (status === 'MEDICAL ATTENTION ADVISED') {
            return { bg: '#fff1f2', border: '#fecdd3', tone: '#b91c1c', banner: '#ef4444' };
        }
        if (status === 'WATCH LIST') {
            return { bg: '#fffbeb', border: '#fde68a', tone: '#a16207', banner: '#f59e0b' };
        }
        return { bg: '#ecfdf5', border: '#a7f3d0', tone: '#047857', banner: '#22c55e' };
    };

    const buildSparklinePoints = (values, width = 220, height = 58) => {
        if (!values || values.length === 0) return '';
        const min = Math.min(...values);
        const max = Math.max(...values);
        const range = max - min || 1;
        return values
            .map((val, idx) => {
                const x = values.length === 1 ? width / 2 : (idx / (values.length - 1)) * width;
                const y = height - ((val - min) / range) * (height - 8) - 4;
                return `${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .join(' ');
    };

    const renderMiniGraph = (title, values, color, suffix = '') => {
        if (!values || values.length === 0) {
            return (
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.65rem' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', marginBottom: '0.35rem' }}>{title}</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>No daily data yet</div>
                </div>
            );
        }
        const points = buildSparklinePoints(values);
        const latest = values[values.length - 1];
        return (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.65rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b' }}>{title}</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color }}>{`${latest}${suffix}`}</span>
                </div>
                <svg viewBox="0 0 220 58" width="100%" height="58" preserveAspectRatio="none">
                    <polyline fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" points={points} />
                </svg>
            </div>
        );
    };

    const isCalibrating = vitals.calibration_pct < 100 && vitals.bpm === 0;
    const ageBand = getAgeBand(userAge);
    const ageRanges = getAgeRanges(ageBand);
    const ageCheck = evaluateAgeCrossVerification(vitals, ageRanges);
    const ageStatusBg = ageCheck.severity === 'high' ? '#fff1f2' : (ageCheck.severity === 'medium' ? '#fffbeb' : '#ecfdf5');
    const ageStatusTone = ageCheck.severity === 'high' ? '#be123c' : (ageCheck.severity === 'medium' ? '#a16207' : '#065f46');
    const stressColors = getStressColors(vitals.stress_level);
    const riskColors = getRiskColors(vitals.ai_risk);
    const trendColors = getTrendColors(vitals.vital_trend?.direction);
    const trendData = vitals.vital_trend || {
        direction: 'stable',
        arrow: '->',
        label: 'Stable',
        summary: 'Gathering baseline',
        heart_rate: 'stable',
        respiration: 'stable',
        spo2: 'stable',
    };
    const longTrend = trendAnalysis || { trend_status: 'STABLE', trend_indicator: 'Stable', daily_vitals: [] };
    const longTrendTheme = getLongTrendTheme(longTrend.trend_status);
    const dailySeries = longTrend.daily_vitals || [];
    const dailyHr = dailySeries.map((d) => Number(d.avg_heart_rate || 0));
    const dailyRr = dailySeries.map((d) => Number(d.avg_respiration || 0));
    const dailySpo2 = dailySeries.map((d) => Number(d.avg_spo2 || 0));

    return (
        <div className="vitals-layout-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(340px, 1fr)', gap: '1.5rem', alignItems: 'start' }}>
            {/* Left: Video Feed */}
            <div className="neo-card vitals-left-panel" style={{ background: 'white', padding: '1.25rem', position: 'relative' }}>
                <div className="vitals-top-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Camera size={24} color="var(--primary)" /> Real-Time Feed
                    </h3>
                    <div className="vitals-controls-row" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <select
                            value={selectedCameraId}
                            onChange={(e) => switchCamera(e.target.value)}
                            disabled={cameraSwitching}
                            style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0.35rem 0.45rem', fontSize: '0.74rem', maxWidth: '260px' }}
                        >
                            {cameraDevices.length === 0 && <option value="">No camera detected</option>}
                            {cameraDevices.map((d, idx) => (
                                <option key={d.deviceId || idx} value={d.deviceId}>
                                    {(d.label || `Camera ${idx + 1}`) + (isPhoneDevice(d.label) ? ' (Phone)' : '')}
                                </option>
                            ))}
                        </select>
                        <button
                            onClick={loadVideoDevices}
                            style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0.28rem 0.45rem', background: '#fff', fontSize: '0.7rem', cursor: 'pointer' }}
                        >
                            Refresh
                        </button>
                        {isPhoneCamera && (
                            <span style={{ fontSize: '0.7rem', color: '#166534', background: '#dcfce7', border: '1px solid #86efac', borderRadius: '999px', padding: '0.12rem 0.45rem', fontWeight: 700 }}>
                                PHONE CAM
                            </span>
                        )}
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
                <div className="vitals-graphs" style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
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
            <div className="vitals-right-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                
                {/* Health Alert Section */}
                {vitals.bpm > 0 ? (
                    <div className="neo-card" style={{
                        background: vitals.alert === "Normal" && ageCheck.severity === 'ok' ? '#ecfdf5' : '#fff1f2',
                        padding: '1.5rem', border: '2px solid black', boxShadow: '4px 4px 0px black',
                        borderColor: vitals.alert === "Normal" && ageCheck.severity === 'ok' ? '#059669' : '#e11d48'
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
                                <p style={{ margin: '0.45rem 0 0', fontWeight: 700, fontSize: '0.85rem', color: ageStatusTone }}>
                                    {ageCheck.text}
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
                <div className="neo-card" style={{ background: '#f3f4f6', padding: '1.25rem', flex: 1 }}>
                    <h3 style={{ margin: '0 0 1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '2rem', letterSpacing: '-0.3px' }}>
                        <Activity size={24} color="var(--primary)" /> Biometric Analysis
                    </h3>

                    {vitals.bpm > 0 ? (
                        <>
                            <div className="vitals-metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.8rem', marginBottom: '1rem' }}>
                                {/* Heart Rate */}
                                <div className="metric-card" style={{ background: '#eef0f6' }}>
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
                                <div className="metric-card" style={{ background: '#f3efea' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#666', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.75rem' }}>
                                        <Wind size={16} color="#3b82f6" /> RESPIRATION
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.2rem' }}>
                                        <span style={{ fontSize: '2rem', fontWeight: 800, color: '#1a1a1a' }}>{vitals.respiration || '--'}</span>
                                        <span style={{ fontWeight: 700, color: '#666', fontSize: '0.7rem' }}>RPM</span>
                                    </div>
                                </div>

                                {/* SpO2 */}
                                <div className="metric-card" style={{ background: '#eaf6ef' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#666', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                                        <Droplets size={16} color="#0ea5e9" /> SpO₂ (EST.)
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.2rem' }}>
                                        <span style={{ fontSize: '2rem', fontWeight: 800, color: '#1a1a1a' }}>{vitals.spo2 || '--'}</span>
                                        <span style={{ fontWeight: 700, color: '#666', fontSize: '0.7rem' }}>%</span>
                                    </div>
                                </div>

                                <div className="metric-card" style={{ background: '#eef0f6' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#666', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.75rem' }}>
                                        <BarChart3 size={16} color="#6366f1" /> HRV
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.2rem' }}>
                                        <span style={{ fontSize: '2rem', fontWeight: 800, color: '#1a1a1a' }}>{vitals.hrv || '--'}</span>
                                        <span style={{ fontWeight: 700, color: '#666', fontSize: '0.7rem' }}>ms</span>
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: '#6366f1', marginTop: '0.2rem', fontWeight: 600 }}>
                                        {vitals.hrv_status || 'Collecting data'}
                                    </div>
                                </div>

                                <div className="metric-card" style={{ background: stressColors.bg }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#666', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.75rem' }}>
                                        <Activity size={16} color={stressColors.tone} /> STRESS LEVEL
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginBottom: '0.35rem' }}>
                                        <span style={{ fontSize: '1.2rem', fontWeight: 800, color: stressColors.tone }}>{vitals.stress_level || 'LOW'}</span>
                                        <span style={{ fontWeight: 800, color: '#111827', fontSize: '1.9rem' }}>{Math.round(vitals.stress_score || 0)}%</span>
                                    </div>
                                    <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                                        <div style={{ width: `${Math.min(100, Math.max(0, vitals.stress_score || 0))}%`, height: '100%', background: stressColors.tone, transition: 'width 0.3s' }} />
                                    </div>
                                </div>

                                <div className="metric-card" style={{ background: riskColors.bg }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#666', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.75rem' }}>
                                        <Shield size={16} color={riskColors.tone} /> AI RISK
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 'clamp(1rem, 1.2vw, 1.25rem)',
                                            fontWeight: 800,
                                            color: riskColors.tone,
                                            lineHeight: 1.1,
                                            maxWidth: '100%',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis'
                                        }}
                                    >
                                        {vitals.ai_risk || 'NORMAL'}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.35rem' }}>
                                        Classifier confidence {Math.round((vitals.ai_risk_confidence || 0) * 100)}%
                                    </div>
                                </div>
                            </div>

                            <div className="vitals-trend-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                                <div className="metric-card metric-card-wide" style={{ background: '#f3efea' }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.45rem' }}>RESPIRATORY VARIABILITY</div>
                                    <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f766e', lineHeight: 1.1 }}>{vitals.respiratory_variability_status || 'Collecting data'}</div>
                                    <div style={{ marginTop: '0.3rem', fontSize: '0.85rem', color: '#334155' }}>
                                        Interval spread {Math.round(vitals.respiratory_variability || 0)} ms
                                    </div>
                                </div>

                                <div className="metric-card metric-card-wide" style={{ background: trendColors.bg }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.45rem' }}>VITAL TREND</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                                        <span style={{ fontSize: '1.8rem', color: trendColors.tone }}>{trendData.arrow || '->'}</span>
                                        <span style={{ fontSize: '2rem', fontWeight: 800, color: '#111827', lineHeight: 1.1 }}>{trendData.label || 'Stable'}</span>
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: '#334155', marginBottom: '0.4rem' }}>{trendData.summary || 'Gathering baseline'}</div>
                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '0.72rem', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '999px', padding: '0.15rem 0.45rem' }}><span style={{ color: trendDotColor(trendData.heart_rate), marginRight: '0.2rem' }}>●</span>HR</span>
                                        <span style={{ fontSize: '0.72rem', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '999px', padding: '0.15rem 0.45rem' }}><span style={{ color: trendDotColor(trendData.respiration), marginRight: '0.2rem' }}>●</span>RR</span>
                                        <span style={{ fontSize: '0.72rem', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '999px', padding: '0.15rem 0.45rem' }}><span style={{ color: trendDotColor(trendData.spo2), marginRight: '0.2rem' }}>●</span>SpO2</span>
                                    </div>
                                </div>
                            </div>



                            {/* Signal Quality */}
                            <div style={{ marginTop: '1rem', padding: '1rem', background: '#e8eaee', borderRadius: '16px', border: '1px solid #d4d7dd' }}>
                                <div style={{ marginBottom: '0.65rem', background: ageStatusBg, border: `1px solid ${ageStatusTone}33`, borderRadius: '10px', padding: '0.6rem 0.75rem' }}>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', letterSpacing: '0.4px' }}>
                                        AGE PROFILE: {ageRanges.label} {userAge ? `(Age ${userAge})` : '(default)'}
                                    </div>
                                    <div style={{ marginTop: '0.2rem', fontSize: '0.72rem', color: ageStatusTone, fontWeight: 700 }}>
                                        Expected HR {ageRanges.hr[0]}-{ageRanges.hr[1]} BPM | RR {ageRanges.rr[0]}-{ageRanges.rr[1]} RPM | SpO2 {'>='} {ageRanges.spo2Min}%
                                    </div>
                                </div>
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
                                <div style={{ marginTop: '0.7rem', fontSize: '0.72rem', color: '#64748b', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.5rem' }}>
                                    <div>HR ±{(vitals.hr_uncertainty || 0).toFixed(1)}</div>
                                    <div>RR ±{(vitals.rr_uncertainty || 0).toFixed(1)}</div>
                                    <div>SpO₂ ±{(vitals.spo2_uncertainty || 0).toFixed(1)}</div>
                                </div>
                                <div style={{ marginTop: '0.45rem', fontSize: '0.68rem', color: '#475569' }}>
                                    {vitals.quality_reason || 'Signal reason unavailable'}
                                </div>
                            </div>

                            {/* Patient linkage + Compare Panel */}
                            <div style={{ marginTop: '0.85rem', borderRadius: '12px', border: '1px solid #c7d2fe', overflow: 'hidden' }}>

                                {/* Patient linkage row */}
                                <div style={{ padding: '0.75rem 0.9rem', background: patientInputId ? 'linear-gradient(135deg,#eef2ff,#f0fdf4)' : '#f8faff', borderBottom: '1px solid #c7d2fe', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <div style={{ background: patientInputId ? '#5227FF' : '#cbd5e1', padding: '0.35rem', borderRadius: '6px', flexShrink: 0 }}>
                                        <Shield size={13} color="white" />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '0.65rem', fontWeight: 800, color: patientInputId ? '#5227FF' : '#94a3b8', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{patientInputId ? 'Linked Patient' : 'Link Patient'}</div>
                                        <input
                                            type="text"
                                            value={patientInputId}
                                            onChange={(e) => setPatientInputId(e.target.value)}
                                            placeholder="Enter Patient ID to link session…"
                                            style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: '0.78rem', fontWeight: 700, color: '#1a1a1a', padding: 0, marginTop: '0.1rem' }}
                                        />
                                    </div>
                                    {patientInputId && (
                                        <span style={{ fontSize: '0.65rem', background: '#dcfce7', color: '#16a34a', padding: '0.15rem 0.5rem', borderRadius: '10px', fontWeight: 700, flexShrink: 0 }}>Linked</span>
                                    )}
                                </div>

                                {/* Session actions */}
                                <div style={{ padding: '0.9rem', background: '#eef2ff' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#3730a3', marginBottom: '0.5rem' }}>ACCURACY CROSS-CHECK</div>
                                <div className="vitals-action-row" style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                                    <button onClick={saveSession} disabled={compareLoading} style={{ padding: '0.45rem 0.7rem', border: '1px solid #1e293b', background: 'white', fontWeight: 700, cursor: 'pointer' }}>1) Save Session</button>
                                    <button onClick={saveReference} disabled={compareLoading} style={{ padding: '0.45rem 0.7rem', border: '1px solid #1e293b', background: 'white', fontWeight: 700, cursor: 'pointer' }}>2) Save Reference</button>
                                    <button onClick={runCompare} disabled={compareLoading} style={{ padding: '0.45rem 0.7rem', border: '1px solid #1e293b', background: '#1e293b', color: 'white', fontWeight: 700, cursor: 'pointer' }}>3) Compare</button>
                                    <button onClick={runCalibrate} disabled={compareLoading} style={{ padding: '0.45rem 0.7rem', border: '1px solid #1e293b', background: '#0f766e', color: 'white', fontWeight: 700, cursor: 'pointer' }}>4) Calibrate Live</button>
                                </div>
                                <textarea
                                    value={referenceInput}
                                    onChange={(e) => setReferenceInput(e.target.value)}
                                    placeholder={'time,hr,rr,spo2\n10,78,15,98\n20,80,16,98'}
                                    style={{ width: '100%', minHeight: '84px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0.5rem', fontSize: '0.75rem' }}
                                />
                                <div style={{ marginTop: '0.4rem', fontSize: '0.7rem', color: '#475569' }}>
                                    Session: {savedSessionId || vitals.session_id || '--'} | Reference: {referenceId || '--'}
                                </div>
                                {compareMessage && <div style={{ marginTop: '0.4rem', fontSize: '0.72rem', color: '#0f172a' }}>{compareMessage}</div>}
                                {compareResult && (
                                    <div style={{ marginTop: '0.7rem', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.5rem' }}>
                                        {[
                                            ['HR', compareResult.hr],
                                            ['RR', compareResult.rr],
                                            ['SpO2', compareResult.spo2],
                                        ].map(([label, m]) => (
                                            <div key={label} style={{ background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0.5rem' }}>
                                                <div style={{ fontSize: '0.7rem', fontWeight: 800 }}>{label}</div>
                                                <div style={{ fontSize: '0.68rem', color: '#334155' }}>MAE: {m?.mae ?? '--'}</div>
                                                <div style={{ fontSize: '0.68rem', color: '#334155' }}>RMSE: {m?.rmse ?? '--'}</div>
                                                <div style={{ fontSize: '0.68rem', color: '#334155' }}>r: {m?.correlation ?? '--'}</div>
                                                <div style={{ fontSize: '0.68rem', color: '#334155' }}>±tol: {m?.within_tolerance_pct ?? '--'}%</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
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

                {/* Long-Term Health Trend Analysis */}
                <div className="neo-card" style={{
                    background: longTrendTheme.bg,
                    borderRadius: '16px',
                    padding: '1rem',
                    border: `2px solid ${longTrendTheme.border}`,
                    boxShadow: '4px 4px 0px black',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '1rem' }}>
                            <TrendingUp size={19} color={longTrendTheme.tone} /> HEALTH TREND ANALYSIS
                        </h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <select
                                value={trendDays}
                                onChange={(e) => setTrendDays(Number(e.target.value))}
                                style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0.2rem 0.45rem', fontSize: '0.74rem' }}
                            >
                                <option value={7}>7 days</option>
                                <option value={14}>14 days</option>
                            </select>
                            <button
                                onClick={() => fetchLongTermTrend(trendPatientId, trendDays)}
                                style={{ border: '1px solid #0f172a', borderRadius: '8px', padding: '0.25rem 0.55rem', background: '#fff', fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer' }}
                            >
                                REFRESH
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.55rem' }}>
                        {renderMiniGraph('Heart Rate', dailyHr, '#dc2626', ' bpm')}
                        {renderMiniGraph('Respiration', dailyRr, '#2563eb', ' rpm')}
                        {renderMiniGraph('SpO2', dailySpo2, '#0ea5e9', ' %')}
                    </div>

                    <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '0.7rem' }}>
                        <div style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 700, marginBottom: '0.2rem' }}>AI TREND STATUS</div>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: longTrendTheme.tone }}>{longTrend.trend_status || 'STABLE'}</div>
                        <div style={{ fontSize: '0.8rem', color: '#334155', marginTop: '0.2rem' }}>{longTrend.trend_indicator || 'Stable trend'}</div>
                        {trendLoading && <div style={{ marginTop: '0.3rem', fontSize: '0.75rem', color: '#64748b' }}>Analyzing daily history...</div>}
                    </div>

                    {longTrend.warning_required && (
                        <div style={{
                            background: '#fff',
                            borderRadius: '10px',
                            border: `1.5px solid ${longTrendTheme.banner}`,
                            padding: '0.7rem',
                            color: '#7f1d1d',
                            fontWeight: 700,
                            display: 'flex',
                            gap: '0.5rem',
                            alignItems: 'flex-start'
                        }}>
                            <AlertTriangle size={18} color={longTrendTheme.banner} style={{ marginTop: '0.1rem' }} />
                            <div>
                                <div>Long-term abnormal health trend detected. Medical checkup recommended.</div>
                                {longTrend.ai_warning && (
                                    <div style={{ marginTop: '0.35rem', fontSize: '0.74rem', fontWeight: 600, color: '#334155' }}>{longTrend.ai_warning}</div>
                                )}
                            </div>
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
                            onClick={() => openPatientModal('summary')}
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
                        minHeight: '160px',
                        maxHeight: '400px',
                        overflowY: 'auto',
                        fontSize: '0.95rem',
                        lineHeight: '1.6',
                        color: '#1e293b'
                    }}>
                        {(vitals.ai_summary || vitals.ai_summary_translated) ? (
                            <div className="ai-content">
                                {vitals.ai_summary_translated ? (
                                    <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Translated Summary ({patientForm.language})</span>
                                        </div>
                                        {vitals.ai_summary_translated.split('\n').map((line, i) => (
                                            <p key={i} style={{ margin: '0 0 0.5rem' }}>{line}</p>
                                        ))}
                                    </div>
                                ) : (
                                    <>
                                        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Clinical Summary (English)</div>
                                        {vitals.ai_summary.split('\n').map((line, i) => {
                                            if (line.startsWith('##')) {
                                                return <h4 key={i} style={{ margin: '1rem 0 0.5rem', color: 'var(--primary)', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>{line.replace('##', '').trim()}</h4>;
                                            }
                                            if (line.startsWith('Recommendation:')) {
                                                return <div key={i} style={{ marginTop: '1rem', padding: '0.8rem', background: '#f0fdf4', borderLeft: '4px solid #22c55e', fontWeight: 600 }}>{line}</div>;
                                            }
                                            return <p key={i} style={{ margin: '0 0 0.8rem' }}>{line}</p>;
                                        })}
                                    </>
                                )}
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

            {/* Patient Info Modal */}
            {showPatientModal && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 9999,
                    background: 'rgba(0,0,0,0.55)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '1rem'
                }}>
                    <div className="neo-card" style={{
                        background: '#ffffff',
                        border: '3px solid #111827',
                        boxShadow: '8px 8px 0px #111827',
                        borderRadius: '4px',
                        padding: '2rem',
                        width: '100%',
                        maxWidth: '480px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1.25rem'
                    }}>
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '0.3rem' }}>
                                    {pendingAction === 'summary' ? 'AI Health Summary' : 'Download PDF Report'}
                                </div>
                                <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, color: '#111827', letterSpacing: '-0.5px' }}>
                                    Patient Details
                                </h3>
                            </div>
                            <button onClick={() => setShowPatientModal(false)} style={{
                                background: 'none', border: '2px solid #111827', borderRadius: '4px',
                                width: '32px', height: '32px', cursor: 'pointer', fontWeight: 900,
                                fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '2px 2px 0px #111827', flexShrink: 0
                            }}>✕</button>
                        </div>

                        {/* Error */}
                        {patientFormError && (
                            <div style={{
                                background: '#fff1f2', border: '2px solid #e11d48',
                                borderRadius: '4px', padding: '0.6rem 0.8rem',
                                fontSize: '0.82rem', fontWeight: 600, color: '#be123c',
                                boxShadow: '2px 2px 0px #e11d48'
                            }}>
                                {patientFormError}
                            </div>
                        )}

                        {/* Field: Patient ID */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Patient ID *</label>
                            <input
                                value={patientForm.patientId}
                                onChange={e => setPatientForm(p => ({ ...p, patientId: e.target.value }))}
                                placeholder="e.g. PT-001"
                                style={{
                                    padding: '0.7rem 0.9rem',
                                    border: '2px solid #111827',
                                    borderRadius: '4px',
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                    outline: 'none',
                                    boxShadow: '3px 3px 0px #111827'
                                }}
                            />
                        </div>

                        {/* Field: Name */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Patient Name *</label>
                            <input
                                value={patientForm.name}
                                onChange={e => setPatientForm(p => ({ ...p, name: e.target.value }))}
                                placeholder="Full name"
                                style={{
                                    padding: '0.7rem 0.9rem',
                                    border: '2px solid #111827',
                                    borderRadius: '4px',
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                    outline: 'none',
                                    boxShadow: '3px 3px 0px #111827'
                                }}
                            />
                        </div>

                        {/* Field: Contact */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Contact Number *</label>
                            <input
                                value={patientForm.contact}
                                onChange={e => setPatientForm(p => ({ ...p, contact: e.target.value }))}
                                placeholder="e.g. +91 98765 43210"
                                style={{
                                    padding: '0.7rem 0.9rem',
                                    border: '2px solid #111827',
                                    borderRadius: '4px',
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                    outline: 'none',
                                    boxShadow: '3px 3px 0px #111827'
                                }}
                            />
                        </div>

                        {/* Field: Language */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Preferred Report Language</label>
                            <input
                                value={patientForm.language}
                                onChange={e => setPatientForm(p => ({ ...p, language: e.target.value }))}
                                placeholder="e.g. English, Hindi, Telugu..."
                                style={{
                                    padding: '0.7rem 0.9rem',
                                    border: '2px solid #111827',
                                    borderRadius: '4px',
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                    outline: 'none',
                                    boxShadow: '3px 3px 0px #111827'
                                }}
                            />
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                            <button
                                onClick={() => setShowPatientModal(false)}
                                style={{
                                    flex: 1, padding: '0.8rem',
                                    background: '#ffffff', color: '#111827',
                                    border: '2px solid #111827', borderRadius: '4px',
                                    fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                                    boxShadow: '3px 3px 0px #111827', textTransform: 'uppercase', letterSpacing: '0.5px'
                                }}
                            >Cancel</button>
                            <button
                                onClick={handlePatientFormSubmit}
                                style={{
                                    flex: 2, padding: '0.8rem',
                                    background: '#111827', color: '#ffffff',
                                    border: '2px solid #111827', borderRadius: '4px',
                                    fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                                    boxShadow: '3px 3px 0px #64748b', textTransform: 'uppercase', letterSpacing: '0.5px'
                                }}
                            >
                                {pendingAction === 'summary' ? 'Generate Summary' : 'Download PDF'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }
                .animate-pulse { animation: pulse 1s infinite cubic-bezier(0.4, 0, 0.6, 1); }

                .vitals-layout-grid {
                    min-width: 0;
                }

                .vitals-controls-row > * {
                    flex-shrink: 0;
                }

                .vitals-metrics-grid > div,
                .vitals-trend-grid > div {
                    min-width: 0;
                }

                .metric-card {
                    padding: 1rem;
                    border-radius: 22px;
                    border: 3px solid #111827;
                    box-shadow: 5px 5px 0px #000;
                    min-height: 156px;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                }

                .metric-card-wide {
                    min-height: 174px;
                }

                @media (max-width: 1200px) {
                    .vitals-layout-grid {
                        grid-template-columns: minmax(0, 1fr) !important;
                    }
                    .vitals-right-panel {
                        order: 2;
                    }
                    .vitals-left-panel {
                        order: 1;
                    }
                }

                @media (max-width: 900px) {
                    .vitals-metrics-grid {
                        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                    }
                    .vitals-trend-grid {
                        grid-template-columns: minmax(0, 1fr) !important;
                    }
                }

                @media (max-width: 640px) {
                    .vitals-top-row {
                        flex-direction: column;
                        align-items: flex-start !important;
                    }
                    .vitals-controls-row {
                        width: 100%;
                        justify-content: flex-start !important;
                    }
                    .vitals-controls-row select {
                        max-width: 100% !important;
                        min-width: 200px;
                    }
                    .vitals-metrics-grid {
                        grid-template-columns: minmax(0, 1fr) !important;
                    }
                    .vitals-action-row button {
                        flex: 1 1 150px;
                    }
                }
            `}} />
        </div>
    );
};

export default VitalsMonitor;
