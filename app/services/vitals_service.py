import numpy as np
import scipy.signal
from scipy.signal import butter, filtfilt, welch, find_peaks
import time
from collections import deque
from typing import List, Tuple, Optional, Dict, Any
from app.services.jade_service import jadeR

class VitalsService:
    def __init__(self, buffer_size: int = 900):
        self.buffer_size = buffer_size  # ~30s at 30fps
        self.data_buffer = []  # List of [r, g, b]
        self.times = []
        self.bpm = 0.0
        self.respiration_rate = 0.0
        self.spo2 = 0.0
        self.fps = 0.0
        self.last_calc_time = 0.0
        self.smooth_bpm = 0.0
        self.smooth_rpm = 0.0
        # BPM history for median filtering
        self.bpm_history = deque(maxlen=10)
        self.rpm_history = deque(maxlen=10)
        # Session statistics
        self.session_start = time.time()
        self.hr_min = float('inf')
        self.hr_max = 0.0
        self.hr_readings = []  # (timestamp, bpm) for trend
        self.signal_quality = 0.0
        self.motion_status = "GOOD" # Initialize motion status
        self.hrv_sdnn = 0.0
        self.health_score = 0
        self.ews_score = 0
        self.peak_indices = []
        self.calibration_pct = 0.0
        self.waveform = []  # last 200 green samples for frontend graph
        self.alerts_history = []

    def process_signal(self, values: List[float], timestamp: float) -> Dict[str, Any]:
        """
        Receives RGB values and returns a comprehensive vitals dictionary.
        """
        self.data_buffer.append(values)
        self.times.append(timestamp)

        # Maintain buffer size
        if len(self.data_buffer) > self.buffer_size:
            self.data_buffer.pop(0)
            self.times.pop(0)

        L = len(self.data_buffer)
        alert = "Normal"
        spectrum = []
        current_time = time.time()

        # Track green channel for waveform display
        green_val = values[1] if len(values) > 1 else 0
        self.waveform.append(green_val)
        if len(self.waveform) > 200:
            self.waveform = self.waveform[-200:]

        # Calibration progress
        target_samples = min(self.buffer_size, 900)
        self.calibration_pct = min(100.0, (L / target_samples) * 100.0)

        if L > 10:
            # Calculate FPS
            duration = self.times[-1] - self.times[0]
            if duration > 0:
                self.fps = float(L - 1) / duration

            # Calculate vitals every 1 second once enough buffer
            if L >= 150 and (current_time - self.last_calc_time) > 1.0:
                result = self._calculate_vitals()
                self.last_calc_time = current_time

                new_bpm = result['bpm']
                new_rpm = result['rpm']
                spectrum = result['spectrum']
                self.signal_quality = result['signal_quality']
                self.peak_indices = result['peaks']

                # Median-filter + adaptive EMA for BPM
                if new_bpm > 0:
                    self.bpm_history.append(new_bpm)
                    median_bpm = float(np.median(list(self.bpm_history))) if len(self.bpm_history) >= 3 else new_bpm

                    if self.smooth_bpm == 0:
                        self.smooth_bpm = median_bpm
                    else:
                        deviation = abs(median_bpm - self.smooth_bpm)
                        if deviation > 20:
                            alpha = 0.6
                        elif deviation > 8:
                            alpha = 0.3
                        else:
                            alpha = 0.1
                        self.smooth_bpm = (1 - alpha) * self.smooth_bpm + alpha * median_bpm
                    self.bpm = self.smooth_bpm

                    # Session min/max
                    if self.bpm > 30:  # Only valid readings
                        if self.bpm < self.hr_min:
                            self.hr_min = self.bpm
                        if self.bpm > self.hr_max:
                            self.hr_max = self.bpm
                        self.hr_readings.append((current_time - self.session_start, round(self.bpm, 1)))
                        # Keep last 120 readings (~2 min of history)
                        if len(self.hr_readings) > 120:
                            self.hr_readings = self.hr_readings[-120:]

                if new_rpm > 0:
                    self.rpm_history.append(new_rpm)
                    median_rpm = float(np.median(list(self.rpm_history))) if len(self.rpm_history) >= 3 else new_rpm

                    if self.smooth_rpm == 0:
                        self.smooth_rpm = median_rpm
                    else:
                        deviation = abs(median_rpm - self.smooth_rpm)
                        if deviation > 10:
                            alpha = 0.5
                        elif deviation > 4:
                            alpha = 0.25
                        else:
                            alpha = 0.1
                        self.smooth_rpm = (1 - alpha) * self.smooth_rpm + alpha * median_rpm
                    self.respiration_rate = self.smooth_rpm

                # SpO2 Estimation Smoothing
                new_spo2 = result.get('spo2', 0.0)
                if new_spo2 > 0:
                    if self.spo2 == 0:
                        self.spo2 = new_spo2
                    else:
                        self.spo2 = 0.9 * self.spo2 + 0.1 * new_spo2

                # Compute HRV from peak intervals
                self.hrv_sdnn = result.get('hrv', 0.0)

                # Compute health score and EWS
                self.health_score = self._compute_health_score()
                self.ews_score = self._compute_ews()

                # Emergency alerts
                alert = self._check_alerts()

        # Build response
        session_elapsed = current_time - self.session_start
        return {
            "bpm": round(self.bpm, 1) if self.bpm else 0,
            "respiration": round(self.respiration_rate, 1) if self.respiration_rate else 0,
            "spo2": round(self.spo2, 1) if self.spo2 else 0,
            "fps": round(self.fps, 1) if self.fps else 0,
            "alert": alert,
            "spectrum": spectrum,
            "status": "tracking" if self.bpm > 0 else ("calibrating" if self.calibration_pct < 100 else "buffering"),
            "signal_quality": round(self.signal_quality, 1),
            "motion_status": self.motion_status,
            "health_score": self.health_score,
            "ews": self.ews_score,
            "hrv": round(self.hrv_sdnn, 1),
            "calibration_pct": round(self.calibration_pct, 1),
            "hr_min": round(self.hr_min, 1) if self.hr_min != float('inf') else 0,
            "hr_max": round(self.hr_max, 1),
            "hr_trend": self.hr_readings[-30:],  # Last 30 points for chart
            "waveform": self.waveform[-200:],
            "peaks": self.peak_indices[-20:],  # Last 20 peak positions
            "session_time": round(session_elapsed, 0),
        }

    def _check_alerts(self) -> str:
        """Emergency detection rules."""
        alerts = []
        if self.bpm > 120:
            alerts.append("Tachycardia (HR>120)")
        elif self.bpm > 110:
            alerts.append("Elevated HR")
        if 0 < self.bpm < 50:
            alerts.append("Bradycardia (HR<50)")
        if self.respiration_rate > 24:
            alerts.append("Rapid Breathing (RR>24)")
        elif 0 < self.respiration_rate < 8:
            alerts.append("Low Respiration")
            
        if 0 < self.spo2 < 92:
            alerts.append("Low Oxygen (SpO2<92%)")

        if self.motion_status == "POOR":
            alerts.insert(0, "Motion detected. Please stay still.")

        if alerts:
            alert_str = " | ".join(alerts)
            self.alerts_history.append((time.time(), alert_str))
            if len(self.alerts_history) > 50:
                self.alerts_history = self.alerts_history[-50:]
            return alert_str
        return "Normal"

    def _compute_health_score(self) -> int:
        """Composite health score 0-100 based on HR, RR, HRV, signal quality."""
        score = 100

        # HR penalty
        if self.bpm > 0:
            if self.bpm < 50 or self.bpm > 120:
                score -= 30
            elif self.bpm < 55 or self.bpm > 110:
                score -= 15
            elif self.bpm < 60 or self.bpm > 100:
                score -= 5

        # RR penalty
        if self.respiration_rate > 0:
            if self.respiration_rate < 8 or self.respiration_rate > 24:
                score -= 25
            elif self.respiration_rate < 10 or self.respiration_rate > 20:
                score -= 10

        # SpO2 penalty
        if self.spo2 > 0:
            if self.spo2 < 92:
                score -= 30
            elif self.spo2 < 95:
                score -= 10

        # HRV bonus (higher is better, >50ms is good)
        if self.hrv_sdnn > 50:
            score += 5
        elif self.hrv_sdnn < 20 and self.hrv_sdnn > 0:
            score -= 10

        # Signal quality factor
        quality_factor = self.signal_quality / 100.0
        score = int(score * max(0.5, quality_factor))

        return max(0, min(100, score))

    def _compute_ews(self) -> int:
        """Early Warning Score — clinical risk assessment."""
        ews = 0

        # Heart rate scoring
        if self.bpm > 0:
            if self.bpm > 130 or self.bpm < 40:
                ews += 3
            elif self.bpm > 110 or self.bpm < 50:
                ews += 2
            elif self.bpm > 100 or self.bpm < 55:
                ews += 1

        # Respiration rate scoring
        if self.respiration_rate > 0:
            if self.respiration_rate > 25 or self.respiration_rate < 8:
                ews += 3
            elif self.respiration_rate > 21 or self.respiration_rate < 9:
                ews += 2
            elif self.respiration_rate > 20 or self.respiration_rate < 12:
                ews += 1

        # SpO2 scoring
        if self.spo2 > 0:
            if self.spo2 <= 91:
                ews += 3
            elif self.spo2 <= 93:
                ews += 2
            elif self.spo2 <= 95:
                ews += 1

        return ews

    # =====================================================
    # SIGNAL PROCESSING ENGINE
    # =====================================================

    def _pos_extract(self, X: np.ndarray, L: int) -> np.ndarray:
        """POS rPPG signal extraction (Wang et al., 2017)."""
        WinSec = 1.6
        N = X.shape[1]
        win_len = max(int(self.fps * WinSec), 32)
        H = np.zeros(N)
        P = np.array([[0, 1, -1], [-2, 1, 1]], dtype=float)

        for t in range(0, N - win_len + 1):
            window = X[:, t:t + win_len]
            means = np.mean(window, axis=1, keepdims=True)
            means[means < 1e-6] = 1e-6
            C_n = window / means
            S = P @ C_n
            std_s0, std_s1 = np.std(S[0]), np.std(S[1])
            alpha = std_s0 / std_s1 if std_s1 > 1e-6 else 0.0
            h = S[0] + alpha * S[1]
            h = h - np.mean(h)
            H[t:t + win_len] += h * np.hanning(win_len)
        return H

    def _harmonic_score(self, freqs_bpm: np.ndarray, psd: np.ndarray, peak_bpm: float) -> float:
        """Check for harmonic support at 2x fundamental."""
        harmonic_bpm = 2.0 * peak_bpm
        mask = (freqs_bpm >= harmonic_bpm - 5) & (freqs_bpm <= harmonic_bpm + 5)
        idx = np.where(mask)[0]
        if len(idx) > 0:
            return float(np.max(psd[idx]) / (np.sum(psd) + 1e-6))
        return 0.0

    def _calculate_vitals(self) -> Dict[str, Any]:
        """Core engine: ICA + POS fusion with all analytics."""
        try:
            X = np.array(self.data_buffer).T  # (3, N)
            L = X.shape[1]
            X_proc = np.zeros_like(X, dtype=float)

            # Motion Artifact Detection Before Processing
            motion_quality = self._detect_motion_artifacts(X)
            
            # If motion is severe, skip calculation and freeze last values
            if motion_quality < 30:
                self.motion_status = "POOR"
                return {
                    'bpm': self.bpm,
                    'rpm': self.respiration_rate,
                    'spo2': self.spo2,
                    'spectrum': [],
                    'signal_quality': 0, # Very poor
                    'peaks': [],
                    'hrv': self.hrv_sdnn,
                }
            elif motion_quality < 70:
                self.motion_status = "MODERATE"
            else:
                self.motion_status = "GOOD"

            for i in range(3):
                X_proc[i] = scipy.signal.detrend(X[i])
                X_proc[i] = (X_proc[i] - np.mean(X_proc[i])) / (np.std(X_proc[i]) + 1e-6)

            fps = self.fps
            if fps < 5:
                return {'bpm': self.bpm, 'rpm': self.respiration_rate, 'spo2': self.spo2, 'spectrum': [],
                        'signal_quality': 0, 'peaks': [], 'hrv': 0}

            b, a = butter(4, [0.75 / (fps / 2), 3.0 / (fps / 2)], btype='band')
            for i in range(3):
                X_proc[i] = filtfilt(b, a, X_proc[i])

            # === ICA ===
            B = jadeR(X_proc)
            ICA = np.asarray(np.dot(B, X_proc))
            ica_bpm, ica_conf, ica_spec = self._extract_hr_from_components(ICA, L)

            # === POS ===
            pos_signal = self._pos_extract(X, L)
            pos_filtered = filtfilt(b, a, pos_signal)
            pos_bpm, pos_conf, pos_spec = self._extract_hr_single(pos_filtered, L)

            # === Fusion ===
            best_bpm = self.bpm
            best_spec = []
            best_conf = 0.0
            best_source = None

            if ica_conf > 0.05 or pos_conf > 0.05:
                if ica_conf >= pos_conf:
                    best_bpm, best_spec, best_conf = ica_bpm, ica_spec, ica_conf
                    best_source = ICA[int(np.argmax([self._extract_hr_single(ICA[i].flatten(), L)[1] for i in range(3)]))]
                else:
                    best_bpm, best_spec, best_conf = pos_bpm, pos_spec, pos_conf
                    best_source = pos_filtered

            # === Signal Quality (0-100) ===
            sig_quality = min(100, max(0, best_conf * 200))  # Scale confidence to 0-100

            # === Peak Detection ===
            peaks = []
            hrv = 0.0
            if best_source is not None and len(best_source) > 50:
                # Bandpass the best source for peak detection
                try:
                    bp_b, bp_a = butter(2, [0.8 / (fps / 2), 2.5 / (fps / 2)], btype='band')
                    peak_signal = filtfilt(bp_b, bp_a, best_source.flatten())
                    min_distance = int(fps * 0.4)  # Min 0.4s between beats (~150bpm max)
                    peak_idx, peak_props = find_peaks(peak_signal,
                                                      distance=max(1, min_distance),
                                                      prominence=np.std(peak_signal) * 0.3)
                    peaks = peak_idx.tolist()

                    # === HRV (SDNN) ===
                    if len(peak_idx) > 2:
                        intervals = np.diff(peak_idx) / fps * 1000  # in ms
                        # Filter out unrealistic intervals
                        valid = intervals[(intervals > 300) & (intervals < 2000)]
                        if len(valid) > 2:
                            hrv = float(np.std(valid))
                except Exception:
                    pass

            # === Respiration ===
            best_rpm = self._extract_respiration(ICA, L)

            # === SpO2 Estimation (Empirical AC/DC Ratio) ===
            spo2_val = 0.0
            try:
                # Use unfiltered raw buffer for SpO2 calculation
                X_raw = np.array(self.data_buffer).T
                dc_red = np.mean(X_raw[0]) + 1e-6
                ac_red = np.std(X_raw[0])
                dc_blue = np.mean(X_raw[2]) + 1e-6
                ac_blue = np.std(X_raw[2])
                
                ratio = (ac_red / dc_red) / (ac_blue / dc_blue) if (ac_blue / dc_blue) > 1e-6 else 0
                if ratio > 0:
                    spo2_val = 110.0 - 25.0 * ratio
                    spo2_val = max(80.0, min(100.0, spo2_val))
            except Exception:
                pass

            return {
                'bpm': float(best_bpm),
                'rpm': float(best_rpm),
                'spo2': float(spo2_val),
                'spectrum': best_spec,
                'signal_quality': sig_quality,
                'peaks': peaks,
                'hrv': hrv,
            }

        except Exception as e:
            print(f"Vitals Engine Error: {e}")
            return {'bpm': self.bpm, 'rpm': self.respiration_rate, 'spo2': self.spo2, 'spectrum': [],
                    'signal_quality': 0, 'peaks': [], 'hrv': 0}

    def _extract_hr_from_components(self, ICA, L):
        scores, bpms, spectra = [], [], []
        for i in range(3):
            bpm_val, conf, spec = self._extract_hr_single(ICA[i].flatten(), L)
            scores.append(conf)
            bpms.append(bpm_val)
            spectra.append(spec)
        best = int(np.argmax(scores))
        return bpms[best], scores[best], spectra[best]

    def _extract_hr_single(self, source, L):
        if len(source) < 32:
            return 0.0, -1.0, []
        nperseg = min(256, L // 2)
        if nperseg < 16:
            return 0.0, -1.0, []

        freqs_hz, psd = welch(source, fs=self.fps, nperseg=nperseg, nfft=max(512, nperseg * 2))
        freqs_bpm = 60.0 * freqs_hz
        hr_mask = (freqs_bpm >= 45) & (freqs_bpm <= 180)
        hr_idx = np.where(hr_mask)[0]

        if len(hr_idx) == 0:
            return 0.0, -1.0, []

        hr_mags = psd[hr_idx]
        peak_idx = hr_idx[np.argmax(hr_mags)]

        # Parabolic interpolation
        if 0 < peak_idx < len(psd) - 1:
            a_v, b_v, g_v = psd[peak_idx - 1], psd[peak_idx], psd[peak_idx + 1]
            p = 0.5 * (a_v - g_v) / (a_v - 2 * b_v + g_v + 1e-9)
            bpm_val = float(freqs_bpm[peak_idx] + p * (freqs_bpm[1] - freqs_bpm[0]))
        else:
            bpm_val = float(freqs_bpm[peak_idx])

        max_p = np.max(hr_mags)
        prominence = float(max_p / (np.sum(hr_mags) + 1e-6))
        harmonic = self._harmonic_score(freqs_bpm, psd, bpm_val)
        confidence = prominence + 0.3 * harmonic
        norm_spec = (hr_mags / (max_p + 1e-6)).tolist()

        return bpm_val, confidence, norm_spec

    def _extract_respiration(self, ICA, L):
        rpm_scores = []
        for i in range(3):
            source = ICA[i].flatten()
            windowed = np.hamming(L) * source
            fft_data = np.abs(np.fft.rfft(windowed))
            freqs_rpm = 60.0 * (float(self.fps) / L * np.arange(L // 2 + 1))
            rr_mask = (freqs_rpm >= 8) & (freqs_rpm <= 25)
            rr_idx = np.where(rr_mask)[0]
            if len(rr_idx) > 0:
                mags = fft_data[rr_idx]
                rpm_scores.append(np.max(mags) / (np.sum(mags) + 1e-6))
            else:
                rpm_scores.append(-1)

        best_i = int(np.argmax(rpm_scores))
        rr_src = ICA[best_i].flatten()
        rr_w = np.hamming(L) * rr_src
        rr_fft = np.abs(np.fft.rfft(rr_w))
        rr_f = 60.0 * (float(self.fps) / L * np.arange(L // 2 + 1))
        mask = (rr_f >= 8) & (rr_f <= 25)
        idx = np.where(mask)[0]
        if len(idx) > 0:
            return float(rr_f[idx[np.argmax(rr_fft[idx])]])
        return self.respiration_rate

    def _detect_motion_artifacts(self, X: np.ndarray) -> float:
        """
        Detect motion artifacts based on signal characteristics.
        Returns a quality score from 0-100 (100 = perfectly still, 0 = severe motion).
        """
        quality_score = 100.0
        
        # We look at the raw brightness (mean across all channels for each frame)
        # Using a recent window (e.g., last 3 seconds if 30fps = 90 frames)
        recent_frames = X[:, -90:] if X.shape[1] > 90 else X
        
        # Calculate frame-to-frame intensity differences (derivative)
        diffs = np.diff(recent_frames, axis=1)
        
        # 1. Variance of the derivative (detects high-frequency jitter/movement)
        diff_variances = np.var(diffs, axis=1)
        mean_diff_var = np.mean(diff_variances)
        
        # 2. Sudden amplitude spikes (detects large shifts like head turning)
        max_diffs = np.max(np.abs(diffs), axis=1)
        mean_max_diff = np.mean(max_diffs)
        
        # Thresholds (need to be tuned empirically, these are starting values)
        # Assuming typical signal values are in the 0-255 range
        if mean_max_diff > 15: # Large sudden change
            quality_score -= 50
        elif mean_max_diff > 8:
            quality_score -= 20
            
        if mean_diff_var > 5: # High variance / jitter
            quality_score -= 40
        elif mean_diff_var > 2:
            quality_score -= 15
            
        return max(0.0, min(100.0, quality_score))

    def get_session_summary(self) -> Dict[str, Any]:
        """Return session summary for reports."""
        elapsed = time.time() - self.session_start
        return {
            "session_duration_sec": round(elapsed, 0),
            "avg_hr": round(np.mean([r[1] for r in self.hr_readings]) if self.hr_readings else 0, 1),
            "min_hr": round(self.hr_min, 1) if self.hr_min != float('inf') else 0,
            "max_hr": round(self.hr_max, 1),
            "avg_rr": round(self.respiration_rate, 1),
            "avg_spo2": round(self.spo2, 1),
            "avg_signal_quality": round(self.signal_quality, 1),
            "health_score": self.health_score,
            "ews": self.ews_score,
            "hrv_sdnn": round(self.hrv_sdnn, 1),
            "alerts": self.alerts_history[-10:],
            "hr_trend": self.hr_readings,
        }
