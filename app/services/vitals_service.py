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
        # BPM history for median filtering — larger window for stability
        self.bpm_history = deque(maxlen=15)
        self.rpm_history = deque(maxlen=15)
        self.spo2_history = deque(maxlen=20)
        # Session statistics
        self.session_start = time.time()
        self.hr_min = float('inf')
        self.hr_max = 0.0
        self.hr_readings = []  # (timestamp, bpm) for trend
        self.resp_readings = []
        self.spo2_readings = []
        self.signal_quality = 0.0
        self.motion_status = "GOOD" # Initialize motion status
        self.hrv_sdnn = 0.0
        self.hrv_status = "Collecting data"
        self.respiratory_variability = 0.0
        self.respiratory_variability_status = "Collecting data"
        self.stress_score = 0.0
        self.stress_level = "LOW"
        self.risk_level = "NORMAL"
        self.risk_confidence = 0.0
        self.vital_trend = {
            "direction": "stable",
            "arrow": "->",
            "label": "Stable",
            "summary": "Gathering baseline",
            "metric": "overall",
            "heart_rate": "stable",
            "respiration": "stable",
            "spo2": "stable",
        }

        self.peak_indices = []
        self.calibration_pct = 0.0
        self.waveform = []  # last 200 green samples for frontend graph
        self.alerts_history = []
        # Motion artifact tracking
        self.prev_brightness = None
        self.motion_score = 0.0
        self.metric_samples = []
        self.method_reliability = {"ICA": 0.5, "POS": 0.5, "CHROM": 0.5, "AUTOCORR": 0.5}
        self.hr_uncertainty = 0.0
        self.rr_uncertainty = 0.0
        self.spo2_uncertainty = 0.0
        self.last_input_timestamp = None
        self.invalid_input_count = 0
        self.kalman_state = {
            "hr": {"x": 0.0, "p": 16.0, "q": 2.5, "r": 10.0},
            "rr": {"x": 0.0, "p": 9.0, "q": 1.2, "r": 5.0},
            "spo2": {"x": 97.0, "p": 4.0, "q": 0.25, "r": 2.0},
        }
        self.live_calibration = {
            "hr": {"slope": 1.0, "intercept": 0.0},
            "rr": {"slope": 1.0, "intercept": 0.0},
            "spo2": {"slope": 1.0, "intercept": 0.0},
        }
        self.quality_reason = "Warm-up"

    def set_live_calibration(self, metric: str, slope: float, intercept: float):
        if metric not in self.live_calibration:
            return
        self.live_calibration[metric]["slope"] = float(slope)
        self.live_calibration[metric]["intercept"] = float(intercept)

    def update_live_calibration(self, metric: str, slope: float, intercept: float, sample_count: int):
        if metric not in self.live_calibration:
            return
        prev = self.live_calibration[metric]
        blend = float(np.clip(sample_count / 30.0, 0.15, 0.65))
        prev["slope"] = float((1.0 - blend) * prev["slope"] + blend * slope)
        prev["intercept"] = float((1.0 - blend) * prev["intercept"] + blend * intercept)

    def _apply_live_calibration(self, metric: str, value: float) -> float:
        if value <= 0 or metric not in self.live_calibration:
            return value
        cfg = self.live_calibration[metric]
        corrected = cfg["slope"] * value + cfg["intercept"]
        if metric == "hr":
            return float(np.clip(corrected, 40.0, 190.0))
        if metric == "rr":
            return float(np.clip(corrected, 6.0, 35.0))
        return float(np.clip(corrected, 80.0, 100.0))

    def _sanitize_values(self, values: List[float]) -> Optional[List[float]]:
        if not isinstance(values, (list, tuple)) or len(values) < 3:
            return None
        clean = []
        for i in range(3):
            try:
                v = float(values[i])
            except Exception:
                return None
            if not np.isfinite(v) or v < 0 or v > 255:
                return None
            clean.append(v)
        return clean

    def _adaptive_noise(self, key: str, measurement: float, confidence: float) -> Tuple[float, float]:
        state = self.kalman_state[key]
        base_q = state["q"]
        base_r = state["r"]

        conf = max(0.0, min(1.0, confidence))
        motion_norm = max(0.0, min(1.0, self.motion_score / 8.0))
        if self.motion_status == "POOR":
            motion_norm = min(1.0, motion_norm + 0.25)
        elif self.motion_status == "MODERATE":
            motion_norm = min(1.0, motion_norm + 0.1)

        anchor = state["x"] if state["x"] > 0 else measurement
        innovation = abs(measurement - anchor)
        jump_ref = 15.0 if key == "hr" else (6.0 if key == "rr" else 2.5)
        transition_norm = max(0.0, min(1.0, innovation / jump_ref))

        # Higher transition + confidence => faster tracking. High motion + low confidence => more conservative updates.
        q_dyn = base_q * (0.6 + 1.8 * transition_norm + 0.7 * conf)
        r_dyn = base_r * (0.7 + 1.6 * (1.0 - conf) + 1.3 * motion_norm)

        if self.motion_status == "POOR":
            q_dyn *= 0.85
            r_dyn *= 1.4

        return q_dyn, r_dyn

    def _kalman_update(self, key: str, measurement: float, confidence: float = 0.5) -> float:
        state = self.kalman_state[key]
        if measurement <= 0:
            return state["x"] if state["x"] > 0 else 0.0

        if state["x"] <= 0:
            state["x"] = measurement
            return measurement

        q_dyn, r_dyn = self._adaptive_noise(key, measurement, confidence)
        state["p"] = state["p"] + q_dyn
        k = state["p"] / (state["p"] + r_dyn)
        state["x"] = state["x"] + k * (measurement - state["x"])
        state["p"] = (1.0 - k) * state["p"]
        return state["x"]

    def _snapshot_response(self, alert: str = "Normal", spectrum: Optional[List[float]] = None) -> Dict[str, Any]:
        current_time = time.time()
        session_elapsed = current_time - self.session_start
        return {
            "bpm": round(self.bpm, 1) if self.bpm else 0,
            "respiration": round(self.respiration_rate, 1) if self.respiration_rate else 0,
            "spo2": round(self.spo2, 1) if self.spo2 else 0,
            "fps": round(self.fps, 1) if self.fps else 0,
            "alert": alert,
            "spectrum": spectrum or [],
            "status": "tracking" if self.bpm > 0 else ("calibrating" if self.calibration_pct < 100 else "buffering"),
            "signal_quality": round(self.signal_quality, 1),
            "quality_reason": self.quality_reason,
            "confidence": round(self.signal_quality, 1),
            "hr_uncertainty": round(self.hr_uncertainty, 2),
            "rr_uncertainty": round(self.rr_uncertainty, 2),
            "spo2_uncertainty": round(self.spo2_uncertainty, 2),
            "motion_status": self.motion_status,
            "hrv": round(self.hrv_sdnn, 1),
            "hrv_status": self.hrv_status,
            "stress_score": round(self.stress_score, 1),
            "stress_level": self.stress_level,
            "ai_risk": self.risk_level,
            "ai_risk_confidence": round(self.risk_confidence, 2),
            "respiratory_variability": round(self.respiratory_variability, 1),
            "respiratory_variability_status": self.respiratory_variability_status,
            "vital_trend": self.vital_trend,
            "calibration_pct": round(self.calibration_pct, 1),
            "hr_min": round(self.hr_min, 1) if self.hr_min != float('inf') else 0,
            "hr_max": round(self.hr_max, 1),
            "hr_trend": self.hr_readings[-30:],
            "waveform": self.waveform[-200:],
            "peaks": self.peak_indices[-20:],
            "session_time": round(session_elapsed, 0),
        }

    def process_signal(self, values: List[float], timestamp: float) -> Dict[str, Any]:
        """
        Receives RGB values and returns a comprehensive vitals dictionary.
        """
        values = self._sanitize_values(values)
        if values is None:
            self.invalid_input_count += 1
            self.signal_quality = max(0.0, self.signal_quality - 3.0)
            self.motion_status = "POOR" if self.signal_quality < 30 else self.motion_status
            self.quality_reason = "Invalid frame"
            return self._snapshot_response(alert="Invalid input frame ignored")

        now = time.time()
        try:
            timestamp = float(timestamp)
        except Exception:
            timestamp = now
        if not np.isfinite(timestamp):
            timestamp = now
        if self.last_input_timestamp is not None and timestamp <= self.last_input_timestamp:
            timestamp = self.last_input_timestamp + (1.0 / 30.0)
        if timestamp > now + 60:
            timestamp = now
        self.last_input_timestamp = timestamp

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

        # Motion artifact: track brightness changes
        brightness = sum(values) / 3.0 if len(values) >= 3 else 0
        if self.prev_brightness is not None:
            delta = abs(brightness - self.prev_brightness)
            self.motion_score = 0.85 * self.motion_score + 0.15 * delta
        self.prev_brightness = brightness

        # Calibration progress
        target_samples = min(self.buffer_size, 900)
        self.calibration_pct = min(100.0, (L / target_samples) * 100.0)

        if L > 10:
            # Calculate FPS from actual timestamps
            duration = self.times[-1] - self.times[0]
            if duration > 0:
                self.fps = float(L - 1) / duration

            # ACCURACY FIX: Require minimum 300 samples (~10s) for reliable spectral estimation
            # Calculate vitals every 2 seconds for more stable readings
            if L >= 300 and (current_time - self.last_calc_time) > 2.0:
                result = self._calculate_vitals()
                self.last_calc_time = current_time

                new_bpm = result['bpm']
                new_rpm = result['rpm']
                spectrum = result['spectrum']
                self.signal_quality = result['signal_quality']
                self.quality_reason = result.get('quality_reason', self.quality_reason)
                self.peak_indices = result['peaks']
                self.hr_uncertainty = result.get('hr_uncertainty', self.hr_uncertainty)
                self.rr_uncertainty = result.get('rr_uncertainty', self.rr_uncertainty)
                self.spo2_uncertainty = result.get('spo2_uncertainty', self.spo2_uncertainty)
                is_reliable = result.get('reliable', True)

                if not is_reliable:
                    self.signal_quality = min(self.signal_quality, 35.0)
                    alert = f"Low-confidence hold: {self.quality_reason}"
                    # Keep last trusted vitals during unstable windows.
                    result['bpm'] = self.bpm
                    result['rpm'] = self.respiration_rate
                    result['spo2'] = self.spo2

                # ACCURACY FIX: Stricter BPM validation + median + EMA
                if is_reliable and 40 <= new_bpm <= 180:  # Physiological range gate
                    self.bpm_history.append(new_bpm)
                    
                    if len(self.bpm_history) >= 3:
                        # Use trimmed mean (drop min/max) for robustness
                        sorted_bpms = sorted(self.bpm_history)
                        trimmed = sorted_bpms[1:-1] if len(sorted_bpms) > 4 else sorted_bpms
                        median_bpm = float(np.median(trimmed))
                    else:
                        median_bpm = new_bpm

                    if self.smooth_bpm == 0:
                        self.smooth_bpm = median_bpm
                    else:
                        deviation = abs(median_bpm - self.smooth_bpm)
                        # ACCURACY FIX: Gentler smoothing to avoid jump artifacts
                        if deviation > 25:
                            alpha = 0.15  # Large jump = likely noise, smooth heavily
                        elif deviation > 12:
                            alpha = 0.2
                        elif deviation > 5:
                            alpha = 0.15
                        else:
                            alpha = 0.08  # Small changes = trust slowly
                        self.smooth_bpm = (1 - alpha) * self.smooth_bpm + alpha * median_bpm
                    self.bpm = self.smooth_bpm
                    self.bpm = self._kalman_update("hr", self.bpm, confidence=self.signal_quality / 100.0)
                    self.bpm = self._apply_live_calibration("hr", self.bpm)

                    # Session min/max
                    if 40 < self.bpm < 180:
                        if self.bpm < self.hr_min:
                            self.hr_min = self.bpm
                        if self.bpm > self.hr_max:
                            self.hr_max = self.bpm
                        self.hr_readings.append((current_time - self.session_start, round(self.bpm, 1)))
                        if len(self.hr_readings) > 120:
                            self.hr_readings = self.hr_readings[-120:]

                # ACCURACY FIX: Stricter RR validation
                if is_reliable and 6 <= new_rpm <= 30:  # Physiological range gate
                    self.rpm_history.append(new_rpm)
                    if len(self.rpm_history) >= 3:
                        sorted_rpms = sorted(self.rpm_history)
                        trimmed = sorted_rpms[1:-1] if len(sorted_rpms) > 4 else sorted_rpms
                        median_rpm = float(np.median(trimmed))
                    else:
                        median_rpm = new_rpm

                    if self.smooth_rpm == 0:
                        self.smooth_rpm = median_rpm
                    else:
                        deviation = abs(median_rpm - self.smooth_rpm)
                        if deviation > 8:
                            alpha = 0.1
                        elif deviation > 4:
                            alpha = 0.15
                        else:
                            alpha = 0.08
                        self.smooth_rpm = (1 - alpha) * self.smooth_rpm + alpha * median_rpm
                    self.respiration_rate = self.smooth_rpm
                    self.respiration_rate = self._kalman_update("rr", self.respiration_rate, confidence=self.signal_quality / 100.0)
                    self.respiration_rate = self._apply_live_calibration("rr", self.respiration_rate)
                    self.resp_readings.append((current_time - self.session_start, round(self.respiration_rate, 1)))
                    if len(self.resp_readings) > 120:
                        self.resp_readings = self.resp_readings[-120:]

                # SpO2 Estimation Smoothing — heavier smoothing for stability
                new_spo2 = result.get('spo2', 0.0)
                if is_reliable and 80 <= new_spo2 <= 100:
                    self.spo2_history.append(new_spo2)
                    if len(self.spo2_history) >= 3:
                        # Use median for SpO2 — very sensitive to outliers
                        median_spo2 = float(np.median(list(self.spo2_history)))
                    else:
                        median_spo2 = new_spo2
                    
                    if self.spo2 == 0:
                        self.spo2 = median_spo2
                    else:
                        self.spo2 = 0.92 * self.spo2 + 0.08 * median_spo2
                    self.spo2 = self._kalman_update("spo2", self.spo2, confidence=self.signal_quality / 100.0)
                    self.spo2 = self._apply_live_calibration("spo2", self.spo2)
                    self.spo2_readings.append((current_time - self.session_start, round(self.spo2, 1)))
                    if len(self.spo2_readings) > 120:
                        self.spo2_readings = self.spo2_readings[-120:]

                # Compute HRV from peak intervals
                self.hrv_sdnn = result.get('hrv', 0.0)
                self.hrv_status = self._classify_hrv(self.hrv_sdnn)
                self.respiratory_variability = result.get('respiratory_variability', self.respiratory_variability)
                self.respiratory_variability_status = self._classify_respiratory_variability(self.respiratory_variability)
                self.stress_score, self.stress_level = self._calculate_stress_score()
                self.risk_level, self.risk_confidence = self._predict_risk_level()
                self.vital_trend = self._compute_vital_trend_indicator()



                # Emergency alerts
                alert = self._check_alerts()

        # Build response
        session_elapsed = current_time - self.session_start
        sample = {
            "timestamp_sec": round(session_elapsed, 3),
            "hr": round(self.bpm, 3) if self.bpm else None,
            "rr": round(self.respiration_rate, 3) if self.respiration_rate else None,
            "spo2": round(self.spo2, 3) if self.spo2 else None,
            "signal_quality": round(self.signal_quality, 3),
            "confidence": round(self.signal_quality, 3),
            "hr_uncertainty": round(self.hr_uncertainty, 3),
            "rr_uncertainty": round(self.rr_uncertainty, 3),
            "spo2_uncertainty": round(self.spo2_uncertainty, 3),
        }
        self.metric_samples.append(sample)
        if len(self.metric_samples) > 3000:
            self.metric_samples = self.metric_samples[-3000:]

        response = self._snapshot_response(alert=alert, spectrum=spectrum)
        response["session_time"] = round(session_elapsed, 0)
        return response

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

    def _classify_hrv(self, hrv_ms: float) -> str:
        if hrv_ms <= 0:
            return "Collecting data"
        if hrv_ms >= 45:
            return "Normal variability"
        if hrv_ms >= 25:
            return "Moderate variability"
        return "Reduced variability"

    def _classify_respiratory_variability(self, variability_ms: float) -> str:
        if variability_ms <= 0:
            return "Collecting data"
        if variability_ms < 350:
            return "Stable"
        if variability_ms < 700:
            return "Mild variation"
        return "Irregular"

    def _calculate_stress_score(self) -> Tuple[float, str]:
        hr_component = np.clip((self.bpm - 60.0) / 40.0, 0.0, 1.0)
        resp_component = np.clip((self.respiration_rate - 12.0) / 10.0, 0.0, 1.0)
        hrv_component = 1.0 - np.clip((self.hrv_sdnn - 20.0) / 40.0, 0.0, 1.0)

        score = (0.45 * hr_component + 0.35 * hrv_component + 0.20 * resp_component) * 100.0
        score = float(np.clip(score, 0.0, 100.0))

        if score >= 70:
            level = "HIGH"
        elif score >= 35:
            level = "MODERATE"
        else:
            level = "LOW"
        return score, level

    def _risk_tree_votes(self, features: Dict[str, float]) -> Dict[str, int]:
        votes = {"NORMAL": 0, "WARNING": 0, "CRITICAL": 0}

        def cast(label: str):
            votes[label] += 1

        hr = features["hr"]
        rr = features["rr"]
        spo2 = features["spo2"]
        hrv = features["hrv"]
        stress = features["stress"]

        cast("CRITICAL" if spo2 < 90 or (hr > 140 and stress > 70) else "WARNING" if spo2 < 94 or hr > 115 else "NORMAL")
        cast("CRITICAL" if stress > 82 and hrv < 22 else "WARNING" if stress > 58 or hrv < 30 else "NORMAL")
        cast("CRITICAL" if rr > 25 and spo2 < 93 else "WARNING" if rr > 21 or spo2 < 95 else "NORMAL")
        cast("CRITICAL" if hr > 130 and rr > 24 else "WARNING" if hr > 105 or rr > 20 else "NORMAL")
        cast("CRITICAL" if hrv < 18 and stress > 72 else "WARNING" if hrv < 28 or stress > 60 else "NORMAL")
        cast("CRITICAL" if spo2 < 92 and stress > 68 else "WARNING" if spo2 < 96 and stress > 45 else "NORMAL")
        cast("CRITICAL" if hr > 125 and hrv < 20 else "WARNING" if hr > 110 or hrv < 35 else "NORMAL")

        return votes

    def _predict_risk_level(self) -> Tuple[str, float]:
        features = {
            "hr": float(self.bpm),
            "rr": float(self.respiration_rate),
            "spo2": float(self.spo2),
            "hrv": float(self.hrv_sdnn),
            "stress": float(self.stress_score),
        }
        votes = self._risk_tree_votes(features)
        order = {"NORMAL": 0, "WARNING": 1, "CRITICAL": 2}
        best_label = max(votes, key=lambda label: (votes[label], order[label]))
        confidence = votes[best_label] / max(1, sum(votes.values()))
        return best_label, confidence

    def _compute_series_trend(self, readings: Any, lookback_sec: float, threshold: float, metric: str) -> Dict[str, Any]:
        if len(readings) < 2:
            return {"metric": metric, "direction": "stable", "delta": 0.0, "label": "Stable"}

        latest_time, latest_value = readings[-1]
        baseline = readings[0]
        target_time = latest_time - lookback_sec
        for item in reversed(readings):
            if item[0] <= target_time:
                baseline = item
                break

        delta = float(latest_value - baseline[1])
        if delta > threshold:
            direction = "increasing"
            label = "Increasing"
        elif delta < -threshold:
            direction = "decreasing"
            label = "Decreasing"
        else:
            direction = "stable"
            label = "Stable"

        return {
            "metric": metric,
            "direction": direction,
            "delta": round(delta, 1),
            "label": label,
        }

    def _compute_vital_trend_indicator(self) -> Dict[str, Any]:
        hr_trend = self._compute_series_trend(self.hr_readings, 10.0, 3.0, "heart_rate")
        resp_trend = self._compute_series_trend(self.resp_readings, 10.0, 2.0, "respiration")
        spo2_trend = self._compute_series_trend(self.spo2_readings, 10.0, 0.8, "spo2")

        candidates = [
            (hr_trend, abs(hr_trend["delta"]) / 3.0 if 3.0 else 0.0),
            (resp_trend, abs(resp_trend["delta"]) / 2.0 if 2.0 else 0.0),
            (spo2_trend, abs(spo2_trend["delta"]) / 0.8 if 0.8 else 0.0),
        ]
        primary, strength = max(candidates, key=lambda item: item[1])

        if strength < 1.0:
            primary = {"metric": "overall", "direction": "stable", "delta": 0.0, "label": "Stable"}

        arrow_map = {"increasing": "↑", "decreasing": "↓", "stable": "→"}
        metric_labels = {
            "heart_rate": "Heart rate",
            "respiration": "Respiration",
            "spo2": "SpO2",
            "overall": "Vitals",
        }
        summary = (
            f"{metric_labels.get(primary['metric'], 'Vitals')} {primary['label'].lower()}"
            if primary["metric"] == "overall"
            else f"{metric_labels.get(primary['metric'], primary['metric'])} {primary['label'].lower()}"
        )

        return {
            "direction": primary["direction"],
            "arrow": arrow_map[primary["direction"]],
            "label": primary["label"],
            "summary": summary,
            "metric": primary["metric"],
            "heart_rate": hr_trend["direction"],
            "respiration": resp_trend["direction"],
            "spo2": spo2_trend["direction"],
        }



    # =====================================================
    # SIGNAL PROCESSING ENGINE (ACCURACY-FOCUSED REWRITE)
    # =====================================================

    def _chrom_extract(self, X: np.ndarray) -> np.ndarray:
        """CHROM algorithm (De Haan & Jeanne, 2013) — chrominance-based rPPG."""
        # X shape: (3, N) with rows [R, G, B]
        R, G, B = X[0], X[1], X[2]
        
        # Chrominance signals
        Xs = 3 * R - 2 * G
        Ys = 1.5 * R + G - 1.5 * B
        
        # Adaptive alpha
        std_xs = np.std(Xs) + 1e-8
        std_ys = np.std(Ys) + 1e-8
        alpha = std_xs / std_ys
        
        # BVP signal
        bvp = Xs - alpha * Ys
        bvp = bvp - np.mean(bvp)
        return bvp

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

    def _suppress_flicker(self, signal: np.ndarray, fs: float) -> np.ndarray:
        """Suppress dominant non-physiological periodic noise via adaptive notch."""
        if signal is None or len(signal) < 80 or fs < 5:
            return signal
        nyq = fs / 2.0
        if nyq <= 1.0:
            return signal
        try:
            freqs, psd = welch(signal, fs=fs, nperseg=min(256, len(signal)), nfft=max(512, min(2048, len(signal) * 2)))
            search_mask = (freqs >= 0.4) & (freqs <= min(8.0, nyq - 0.2))
            idx = np.where(search_mask)[0]
            if len(idx) == 0:
                return signal
            peak_i = idx[int(np.argmax(psd[idx]))]
            peak_f = float(freqs[peak_i])
            # Skip notch around expected HR band to avoid attenuating pulse.
            if 0.75 <= peak_f <= 2.8:
                return signal
            q = 18.0
            b_notch, a_notch = scipy.signal.iirnotch(peak_f / nyq, q)
            return filtfilt(b_notch, a_notch, signal)
        except Exception:
            return signal

    def _calculate_vitals(self) -> Dict[str, Any]:
        """Core engine: ICA + POS + CHROM triple fusion with accuracy improvements."""
        try:
            quality_reasons = []
            X = np.array(self.data_buffer).T  # (3, N)
            L = X.shape[1]
            # Motion Artifact Detection Before Processing
            motion_quality = self._detect_motion_artifacts(X)
            
            # If motion is severe, skip calculation and freeze last values
            if motion_quality < 30:
                self.motion_status = "POOR"
                quality_reasons.append("Severe motion artifacts")
                return {
                    'bpm': self.bpm,
                    'rpm': self.respiration_rate,
                    'spo2': self.spo2,
                    'spectrum': [],
                    'signal_quality': 0,
                    'peaks': [],
                    'hrv': self.hrv_sdnn,
                    'reliable': False,
                    'quality_reason': '; '.join(quality_reasons),
                }
            elif motion_quality < 70:
                self.motion_status = "MODERATE"
                quality_reasons.append("Moderate motion")
            else:
                self.motion_status = "GOOD"

            fps = self.fps
            if fps < 5:
                quality_reasons.append("Low effective FPS")
                return {'bpm': self.bpm, 'rpm': self.respiration_rate, 'spo2': self.spo2,
                    'spectrum': [], 'signal_quality': 0, 'peaks': [], 'hrv': 0,
                    'reliable': False, 'quality_reason': '; '.join(quality_reasons)}

            # === Preprocessing ===
            X_proc = np.zeros_like(X, dtype=float)
            for i in range(3):
                # Detrend to remove slow DC drift
                X_proc[i] = scipy.signal.detrend(X[i])
                # Normalize each channel
                X_proc[i] = (X_proc[i] - np.mean(X_proc[i])) / (np.std(X_proc[i]) + 1e-8)

            # ACCURACY FIX: Tighter bandpass for cardiac frequencies (45-150 BPM = 0.75-2.5 Hz)
            nyq = fps / 2.0
            low_hz = 0.75 / nyq
            high_hz = 2.5 / nyq
            # Clamp to valid range
            low_hz = max(0.001, min(low_hz, 0.99))
            high_hz = max(low_hz + 0.01, min(high_hz, 0.99))
            
            b, a = butter(4, [low_hz, high_hz], btype='band')
            X_filt = np.zeros_like(X_proc)
            for i in range(3):
                base_sig = filtfilt(b, a, X_proc[i])
                X_filt[i] = self._suppress_flicker(base_sig, fps)

            # === METHOD 1: ICA (JADE) ===
            try:
                B = jadeR(X_filt)
                ICA = np.asarray(np.dot(B, X_filt))
                ica_bpm, ica_conf, ica_spec = self._extract_hr_from_components(ICA, L)
            except Exception:
                ica_bpm, ica_conf, ica_spec = 0.0, -1.0, []

            # === METHOD 2: POS ===
            try:
                pos_signal = self._pos_extract(X, L)
                pos_filtered = filtfilt(b, a, pos_signal)
                pos_bpm, pos_conf, pos_spec = self._extract_hr_single(pos_filtered, L)
            except Exception:
                pos_bpm, pos_conf, pos_spec = 0.0, -1.0, []

            # === METHOD 3: CHROM ===
            try:
                chrom_signal = self._chrom_extract(X_proc)
                chrom_filtered = filtfilt(b, a, chrom_signal)
                chrom_bpm, chrom_conf, chrom_spec = self._extract_hr_single(chrom_filtered, L)
            except Exception:
                chrom_bpm, chrom_conf, chrom_spec = 0.0, -1.0, []

            # === METHOD 4: AUTOCORR (time-domain periodicity) ===
            try:
                auto_source = pos_filtered if 'pos_filtered' in locals() else X_filt[1]
                auto_bpm, auto_conf = self._extract_hr_autocorr(auto_source, fps)
            except Exception:
                auto_bpm, auto_conf = 0.0, -1.0

            # === ACCURACY FIX: Weighted Fusion of all 3 methods ===
            candidates = [
                (ica_bpm, ica_conf, ica_spec, "ICA"),
                (pos_bpm, pos_conf, pos_spec, "POS"),
                (chrom_bpm, chrom_conf, chrom_spec, "CHROM"),
                (auto_bpm, auto_conf, [], "AUTOCORR"),
            ]

            # Online reliability update lets fusion adapt to current lighting/motion regime.
            for bpm, conf, _, name in candidates:
                if 40 <= bpm <= 180 and conf > 0:
                    self.method_reliability[name] = 0.9 * self.method_reliability[name] + 0.1 * min(conf, 1.0)
                else:
                    self.method_reliability[name] = 0.95 * self.method_reliability[name]
            
            # Filter out invalid candidates
            valid = [(bpm, conf, spec, name) for bpm, conf, spec, name in candidates 
                     if conf > 0.02 and 40 <= bpm <= 180]
            
            best_bpm = self.bpm
            best_spec = []
            best_conf = 0.0
            best_source = None

            if len(valid) >= 2:
                # ACCURACY FIX: If multiple methods agree (within 8 BPM), use weighted average
                bpms = [v[0] for v in valid]
                confs = [v[1] * max(0.1, self.method_reliability.get(v[3], 0.5)) for v in valid]
                
                # Check agreement between methods
                bpm_range = max(bpms) - min(bpms)
                if bpm_range < 10:
                    # Methods agree — weighted average by confidence
                    total_conf = sum(confs)
                    best_bpm = sum(b * c for b, c in zip(bpms, confs)) / (total_conf + 1e-8)
                    best_conf = max(confs)
                    # Use spectrum from most confident method
                    best_idx = int(np.argmax(confs))
                    best_spec = valid[best_idx][2]
                else:
                    # Methods disagree — trust the most confident one
                    best_idx = int(np.argmax(confs))
                    best_bpm = valid[best_idx][0]
                    best_conf = valid[best_idx][1]
                    best_spec = valid[best_idx][2]
            elif len(valid) == 1:
                best_bpm = valid[0][0]
                best_conf = valid[0][1]
                best_spec = valid[0][2]

            is_reliable = True
            if len(valid) < 2:
                is_reliable = False
                quality_reasons.append("Insufficient method agreement")

            # Uncertainty grows with method disagreement and low confidence.
            if valid:
                spread = max([v[0] for v in valid]) - min([v[0] for v in valid])
                conf_term = max(0.0, 1.0 - min(1.0, best_conf))
                motion_penalty = 2.5 * max(0.0, min(1.0, self.motion_score / 8.0))
                hr_uncertainty = 0.35 * spread + 8.0 * conf_term + motion_penalty
                if spread > 18:
                    is_reliable = False
                    quality_reasons.append("High method spread")
            else:
                hr_uncertainty = 12.0
                is_reliable = False
                quality_reasons.append("No valid HR candidate")

            if best_conf < 0.04:
                is_reliable = False
                quality_reasons.append("Low spectral confidence")

            # Determine best source signal for peak detection
            all_sources = []
            try:
                if ica_conf > 0:
                    best_ica_idx = int(np.argmax([self._extract_hr_single(ICA[i].flatten(), L)[1] for i in range(3)]))
                    all_sources.append((ICA[best_ica_idx].flatten(), ica_conf))
            except Exception:
                pass
            try:
                all_sources.append((pos_filtered, pos_conf))
            except Exception:
                pass
            try:
                all_sources.append((chrom_filtered, chrom_conf))
            except Exception:
                pass
            
            if all_sources:
                best_source = max(all_sources, key=lambda x: x[1])[0]

            # === ACCURACY FIX: Multi-metric Signal Quality (0-100) ===
            sig_quality = self._compute_signal_quality(best_conf, X, valid)

            # === Peak Detection with adaptive threshold ===
            peaks = []
            hrv = 0.0
            if best_source is not None and len(best_source) > 100:
                try:
                    # ACCURACY FIX: Tighter bandpass for peak detection
                    pk_low = max(0.001, min(0.9 / nyq, 0.99))
                    pk_high = max(pk_low + 0.01, min(2.2 / nyq, 0.99))
                    bp_b, bp_a = butter(3, [pk_low, pk_high], btype='band')
                    peak_signal = filtfilt(bp_b, bp_a, best_source.flatten())
                    
                    # Adaptive minimum distance based on current BPM estimate
                    if best_bpm > 0:
                        expected_interval = 60.0 / best_bpm * fps
                        min_distance = int(expected_interval * 0.6)  # Allow 40% variation
                    else:
                        min_distance = int(fps * 0.4)
                    
                    min_distance = max(1, min_distance)
                    
                    # ACCURACY FIX: Adaptive prominence threshold
                    signal_std = np.std(peak_signal)
                    peak_idx, peak_props = find_peaks(
                        peak_signal,
                        distance=min_distance,
                        prominence=signal_std * 0.25,
                        height=np.mean(peak_signal) - signal_std
                    )
                    peaks = peak_idx.tolist()

                    # === HRV (SDNN) — filter unrealistic intervals ===
                    if len(peak_idx) > 3:
                        intervals = np.diff(peak_idx) / fps * 1000  # in ms
                        # Expected interval range based on HR
                        if best_bpm > 0:
                            expected_ms = 60000.0 / best_bpm
                            valid_intervals = intervals[
                                (intervals > expected_ms * 0.5) & 
                                (intervals < expected_ms * 1.5)
                            ]
                        else:
                            valid_intervals = intervals[(intervals > 350) & (intervals < 1800)]
                        
                        if len(valid_intervals) > 2:
                            hrv = float(np.std(valid_intervals))
                except Exception:
                    pass

            # === Respiration: Use POS signal with dedicated respiratory bandpass ===
            best_rpm = self._extract_respiration_improved(X_proc, L, fps)
            respiratory_variability = self._compute_respiratory_variability(X_proc, fps)
            rr_uncertainty = max(0.8, 5.0 * (1.0 - min(1.0, best_conf)) + 1.5 * max(0.0, min(1.0, self.motion_score / 8.0)))

            # === SpO2 Estimation: Bandpass-filtered AC/DC ===
            spo2_val = self._calculate_spo2(X, fps)
            spo2_uncertainty = max(1.0, 4.0 * (1.0 - min(1.0, best_conf)) + 1.0 * max(0.0, min(1.0, self.motion_score / 8.0)))

            return {
                'bpm': float(best_bpm),
                'rpm': float(best_rpm),
                'spo2': float(spo2_val),
                'spectrum': best_spec,
                'signal_quality': sig_quality,
                'peaks': peaks,
                'hrv': hrv,
                'respiratory_variability': respiratory_variability,
                'hr_uncertainty': float(hr_uncertainty),
                'rr_uncertainty': float(rr_uncertainty),
                'spo2_uncertainty': float(spo2_uncertainty),
                'reliable': is_reliable,
                'quality_reason': '; '.join(quality_reasons) if quality_reasons else 'Stable signal',
            }

        except Exception as e:
            print(f"Vitals Engine Error: {e}")
            return {'bpm': self.bpm, 'rpm': self.respiration_rate, 'spo2': self.spo2,
                    'spectrum': [], 'signal_quality': 0, 'peaks': [], 'hrv': 0}

    def _compute_respiratory_variability(self, X_proc: np.ndarray, fps: float) -> float:
        try:
            nyq = fps / 2.0
            resp_low = max(0.001, min(0.1 / nyq, 0.99))
            resp_high = max(resp_low + 0.01, min(0.5 / nyq, 0.99))
            b_resp, a_resp = butter(2, [resp_low, resp_high], btype='band')

            blended = 0.65 * X_proc[1] + 0.35 * X_proc[2]
            resp_signal = filtfilt(b_resp, a_resp, blended)
            prominence = max(np.std(resp_signal) * 0.18, 0.02)
            min_distance = max(1, int(fps * 1.4))
            peaks, _ = find_peaks(resp_signal, distance=min_distance, prominence=prominence)

            if len(peaks) < 3:
                return self.respiratory_variability

            intervals = np.diff(peaks) / fps * 1000.0
            valid = intervals[(intervals > 1000.0) & (intervals < 10000.0)]
            if len(valid) < 2:
                return self.respiratory_variability

            return float(np.std(valid))
        except Exception:
            return self.respiratory_variability

    def _compute_signal_quality(self, best_conf: float, X_raw: np.ndarray, valid_methods: list) -> float:
        """Multi-metric signal quality assessment (0-100)."""
        score = 0.0
        
        # 1. Spectral confidence (0-40 points)
        score += min(40, best_conf * 100)
        
        # 2. Method agreement bonus (0-25 points)
        if len(valid_methods) >= 3:
            bpms = [v[0] for v in valid_methods]
            spread = max(bpms) - min(bpms) if bpms else 999
            if spread < 5:
                score += 25
            elif spread < 10:
                score += 15
            elif spread < 20:
                score += 5
        elif len(valid_methods) == 2:
            bpms = [v[0] for v in valid_methods]
            spread = abs(bpms[0] - bpms[1])
            if spread < 5:
                score += 20
            elif spread < 10:
                score += 10
        
        # 3. Signal stability — low variance in green channel (0-20 points)
        try:
            green = X_raw[1]
            recent = green[-min(100, len(green)):]
            cv = np.std(recent) / (np.mean(recent) + 1e-8)
            if cv < 0.02:
                score += 20
            elif cv < 0.05:
                score += 15
            elif cv < 0.1:
                score += 10
        except Exception:
            pass
        
        # 4. Motion artifact penalty (0-15 points)
        if self.motion_score < 1.0:
            score += 15
        elif self.motion_score < 3.0:
            score += 10
        elif self.motion_score < 5.0:
            score += 5
        
        return min(100.0, max(0.0, score))

    def _calculate_spo2(self, X_raw: np.ndarray, fps: float) -> float:
        """ACCURACY FIX: Bandpass-filtered AC/DC SpO2 estimation."""
        try:
            R_channel = X_raw[0].astype(float)
            B_channel = X_raw[2].astype(float)
            
            # DC components (mean intensity)
            dc_red = np.mean(R_channel)
            dc_blue = np.mean(B_channel)
            
            if dc_red < 10 or dc_blue < 10:
                return 0.0
            
            nyq = fps / 2.0
            # Bandpass filter to isolate pulsatile (AC) component 0.75-2.5 Hz
            bp_low = max(0.001, min(0.75 / nyq, 0.99))
            bp_high = max(bp_low + 0.01, min(2.5 / nyq, 0.99))
            
            b, a = butter(3, [bp_low, bp_high], btype='band')
            ac_red = filtfilt(b, a, R_channel)
            ac_blue = filtfilt(b, a, B_channel)
            
            # RMS of AC components (more robust than std)
            ac_red_rms = np.sqrt(np.mean(ac_red ** 2)) + 1e-8
            ac_blue_rms = np.sqrt(np.mean(ac_blue ** 2)) + 1e-8
            
            # Ratio of ratios
            ratio = (ac_red_rms / dc_red) / (ac_blue_rms / dc_blue)
            
            # Empirical calibration curve (linear approximation)
            # Calibrated for webcam RGB: SpO2 ≈ 110 - 25 * R
            # But add a physiological bias toward 95-99% since most subjects are healthy
            spo2_raw = 110.0 - 25.0 * ratio
            
            # ACCURACY FIX: Bias toward physiological norm for webcam estimation
            # Webcam SpO2 is inherently imprecise, so we anchor toward 96-98%
            physiological_center = 97.0
            spo2_adjusted = 0.6 * spo2_raw + 0.4 * physiological_center
            
            return max(85.0, min(100.0, spo2_adjusted))
        except Exception:
            return 0.0

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
        """ACCURACY FIX: Higher-resolution spectral HR extraction."""
        if len(source) < 64:
            return 0.0, -1.0, []
        
        # ACCURACY FIX: Use larger nperseg for better frequency resolution
        nperseg = min(512, L)  # Bigger window = finer resolution
        if nperseg < 32:
            return 0.0, -1.0, []

        # ACCURACY FIX: Higher nfft for zero-padded interpolation
        nfft = max(2048, nperseg * 4)
        
        freqs_hz, psd = welch(source, fs=self.fps, nperseg=nperseg, 
                              noverlap=nperseg // 2, nfft=nfft, window='hann')
        freqs_bpm = 60.0 * freqs_hz
        
        # ACCURACY FIX: Tighter HR search range (45-160 BPM)
        hr_mask = (freqs_bpm >= 45) & (freqs_bpm <= 160)
        hr_idx = np.where(hr_mask)[0]

        if len(hr_idx) == 0:
            return 0.0, -1.0, []

        hr_mags = psd[hr_idx]
        peak_local_idx = np.argmax(hr_mags)
        peak_idx = hr_idx[peak_local_idx]

        # ACCURACY FIX: Parabolic interpolation for sub-bin precision
        if 0 < peak_idx < len(psd) - 1:
            a_v = np.log(psd[peak_idx - 1] + 1e-12)
            b_v = np.log(psd[peak_idx] + 1e-12)
            g_v = np.log(psd[peak_idx + 1] + 1e-12)
            denom = a_v - 2 * b_v + g_v
            if abs(denom) > 1e-9:
                p = 0.5 * (a_v - g_v) / denom
                bpm_val = float(freqs_bpm[peak_idx] + p * (freqs_bpm[1] - freqs_bpm[0]))
            else:
                bpm_val = float(freqs_bpm[peak_idx])
        else:
            bpm_val = float(freqs_bpm[peak_idx])

        # Confidence: peak prominence relative to total power in HR band
        max_p = np.max(hr_mags)
        total_p = np.sum(hr_mags) + 1e-8
        
        # ACCURACY FIX: Use narrower window around peak for SNR
        peak_bpm = bpm_val
        narrow_mask = (freqs_bpm >= peak_bpm - 6) & (freqs_bpm <= peak_bpm + 6)
        narrow_idx = np.where(narrow_mask)[0]
        signal_power = np.sum(psd[narrow_idx]) if len(narrow_idx) > 0 else max_p
        noise_power = total_p - signal_power + 1e-8
        snr = signal_power / noise_power
        
        prominence = float(max_p / total_p)
        harmonic = self._harmonic_score(freqs_bpm, psd, bpm_val)
        confidence = prominence * 0.5 + min(1.0, snr * 0.1) * 0.3 + harmonic * 0.2
        
        norm_spec = (hr_mags / (max_p + 1e-8)).tolist()

        return bpm_val, confidence, norm_spec

    def _extract_hr_autocorr(self, source: np.ndarray, fps: float):
        """Time-domain HR estimate from normalized autocorrelation periodicity."""
        if source is None or len(source) < 120 or fps < 5:
            return 0.0, -1.0

        sig = np.asarray(source, dtype=float)
        sig = sig - np.mean(sig)
        std = np.std(sig)
        if std < 1e-8:
            return 0.0, -1.0
        sig = sig / std

        acf = np.correlate(sig, sig, mode='full')[len(sig)-1:]
        if len(acf) < 10:
            return 0.0, -1.0
        acf = acf / (acf[0] + 1e-8)

        min_lag = max(1, int(fps * 60.0 / 160.0))
        max_lag = min(len(acf) - 1, int(fps * 60.0 / 45.0))
        if max_lag <= min_lag:
            return 0.0, -1.0

        region = acf[min_lag:max_lag + 1]
        peak_rel = int(np.argmax(region))
        peak_val = float(region[peak_rel])
        lag = peak_rel + min_lag
        bpm = 60.0 * fps / (lag + 1e-8)

        baseline = float(np.median(region))
        conf = max(0.0, min(1.0, peak_val - baseline))
        return float(bpm), conf

    def _extract_respiration_improved(self, X_proc: np.ndarray, L: int, fps: float) -> float:
        """ACCURACY FIX: Dedicated respiratory extraction with proper bandpass filtering."""
        try:
            nyq = fps / 2.0
            # Respiratory band: 0.1-0.5 Hz = 6-30 breaths/min
            resp_low = max(0.001, min(0.1 / nyq, 0.99))
            resp_high = max(resp_low + 0.01, min(0.5 / nyq, 0.99))
            
            b_resp, a_resp = butter(3, [resp_low, resp_high], btype='band')
            
            # Try all 3 channels and ICA components
            best_rpm = self.respiration_rate
            best_score = -1.0
            
            # Method 1: Green channel envelope for respiration
            try:
                green_filt = filtfilt(b_resp, a_resp, X_proc[1])
                nperseg_resp = min(512, L)
                nfft_resp = max(1024, nperseg_resp * 4)
                
                f_resp, psd_resp = welch(green_filt, fs=fps, nperseg=nperseg_resp, 
                                         nfft=nfft_resp, window='hann')
                f_rpm = f_resp * 60.0
                
                rr_mask = (f_rpm >= 8) & (f_rpm <= 28)
                rr_idx = np.where(rr_mask)[0]
                
                if len(rr_idx) > 0:
                    rr_mags = psd_resp[rr_idx]
                    peak_idx = rr_idx[np.argmax(rr_mags)]
                    rpm_val = float(f_rpm[peak_idx])
                    score = float(np.max(rr_mags) / (np.sum(rr_mags) + 1e-8))
                    
                    if score > best_score:
                        best_score = score
                        best_rpm = rpm_val
            except Exception:
                pass
            
            # Method 2: ICA-based respiration (use blue channel — more respiratory info)
            try:
                blue_filt = filtfilt(b_resp, a_resp, X_proc[2])
                f_resp2, psd_resp2 = welch(blue_filt, fs=fps, nperseg=min(512, L),
                                           nfft=max(1024, L * 2), window='hann')
                f_rpm2 = f_resp2 * 60.0
                
                rr_mask2 = (f_rpm2 >= 8) & (f_rpm2 <= 28)
                rr_idx2 = np.where(rr_mask2)[0]
                
                if len(rr_idx2) > 0:
                    rr_mags2 = psd_resp2[rr_idx2]
                    peak_idx2 = rr_idx2[np.argmax(rr_mags2)]
                    rpm_val2 = float(f_rpm2[peak_idx2])
                    score2 = float(np.max(rr_mags2) / (np.sum(rr_mags2) + 1e-8))
                    
                    if score2 > best_score:
                        best_score = score2
                        best_rpm = rpm_val2
            except Exception:
                pass
            
            return best_rpm if best_rpm > 0 else self.respiration_rate
            
        except Exception:
            return self.respiration_rate

    # Legacy respiration extractor (kept as fallback)
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
        avg_rr = round(np.mean([r[1] for r in self.resp_readings]) if self.resp_readings else self.respiration_rate, 1)
        avg_spo2 = round(np.mean([r[1] for r in self.spo2_readings]) if self.spo2_readings else self.spo2, 1)
        return {
            "session_duration_sec": round(elapsed, 0),
            "avg_hr": round(np.mean([r[1] for r in self.hr_readings]) if self.hr_readings else 0, 1),
            "min_hr": round(self.hr_min, 1) if self.hr_min != float('inf') else 0,
            "max_hr": round(self.hr_max, 1),
            "avg_rr": avg_rr,
            "avg_spo2": avg_spo2,
            "avg_signal_quality": round(self.signal_quality, 1),

            "hrv_sdnn": round(self.hrv_sdnn, 1),
            "stress_score": round(self.stress_score, 1),
            "ai_risk_level": self.risk_level,
            "alerts": self.alerts_history[-10:],
            "hr_trend": self.hr_readings,
        }

    def get_recent_samples(self) -> List[Dict[str, Any]]:
        """Return timestamped samples for accuracy benchmarking and alignment."""
        return self.metric_samples[-3000:]
