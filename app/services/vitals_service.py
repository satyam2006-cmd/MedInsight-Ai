import numpy as np
import scipy.signal
from scipy.signal import butter, filtfilt, welch
import time
from collections import deque
from typing import List, Tuple, Optional
from app.services.jade_service import jadeR

class VitalsService:
    def __init__(self, buffer_size: int = 512): 
        self.buffer_size = buffer_size
        self.data_buffer = [] # List of [r, g, b]
        self.times = []
        self.bpm = 0.0
        self.respiration_rate = 0.0
        self.fps = 0.0
        self.last_calc_time = 0.0
        self.smooth_bpm = 0.0
        self.smooth_rpm = 0.0
        # BPM history for median filtering (last 10 readings)
        self.bpm_history = deque(maxlen=10)
        self.rpm_history = deque(maxlen=10)

    def process_signal(self, values: List[float], timestamp: float) -> Tuple[float, float, float, str, List[float]]:
        """
        Receives a list of RGB values [r, g, b] and processes it.
        Returns (bpm, respiration_rate, current_fps, health_alert, power_spectrum)
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
        
        if L > 10:
            # Calculate FPS
            duration = self.times[-1] - self.times[0]
            if duration > 0:
                self.fps = float(L-1) / duration

            # Throttle: Only calculate vitals every 1 second
            if L >= 150 and (current_time - self.last_calc_time) > 1.0:
                new_bpm, new_rpm, spectrum = self._calculate_vitals()
                self.last_calc_time = current_time
                
                # Median-filter BPM history before smoothing
                if new_bpm > 0:
                    self.bpm_history.append(new_bpm)
                    if len(self.bpm_history) >= 3:
                        median_bpm = float(np.median(list(self.bpm_history)))
                    else:
                        median_bpm = new_bpm
                    
                    if self.smooth_bpm == 0:
                        self.smooth_bpm = median_bpm
                    else:
                        # 3-tier adaptive EMA
                        deviation = abs(median_bpm - self.smooth_bpm)
                        if deviation > 20:
                            alpha = 0.6   # large jump — track fast
                        elif deviation > 8:
                            alpha = 0.3   # moderate change
                        else:
                            alpha = 0.1   # stable — smooth heavily
                        self.smooth_bpm = (1 - alpha) * self.smooth_bpm + alpha * median_bpm
                    self.bpm = self.smooth_bpm
                
                if new_rpm > 0:
                    self.rpm_history.append(new_rpm)
                    if len(self.rpm_history) >= 3:
                        median_rpm = float(np.median(list(self.rpm_history)))
                    else:
                        median_rpm = new_rpm
                    
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
                
                # Health Alert Logic
                if self.bpm > 110:
                    alert = "High Heart Rate (Tachycardia)"
                elif self.bpm < 50 and self.bpm > 0:
                    alert = "Low Heart Rate (Bradycardia)"
                elif self.respiration_rate > 25:
                    alert = "High Respiration (Tachypnea)"
                elif self.respiration_rate < 8 and self.respiration_rate > 0:
                    alert = "Low Respiration (Bradypnea)"

        return self.bpm, self.respiration_rate, self.fps, alert, spectrum

    def _pos_extract(self, X: np.ndarray, L: int) -> np.ndarray:
        """
        POS (Plane-Orthogonal-to-Skin) rPPG signal extraction.
        Wang et al., IEEE Trans. Biomed. Eng., 2017.
        
        X: shape (3, N) — raw RGB time series
        Returns: 1D pulse signal of length N
        """
        WinSec = 1.6  # ~1.6 second window
        N = X.shape[1]
        win_len = max(int(self.fps * WinSec), 32)
        H = np.zeros(N)
        
        # Projection matrix for POS
        P = np.array([[0, 1, -1], [-2, 1, 1]], dtype=float)
        
        for t in range(0, N - win_len + 1):
            # Temporal normalization within the window
            window = X[:, t:t + win_len]  # (3, win_len)
            means = np.mean(window, axis=1, keepdims=True)
            means[means < 1e-6] = 1e-6
            C_n = window / means  # column-wise normalization
            
            # POS projection
            S = P @ C_n  # (2, win_len)
            
            # Adaptive combination
            std_s0 = np.std(S[0])
            std_s1 = np.std(S[1])
            if std_s1 > 1e-6:
                alpha = std_s0 / std_s1
            else:
                alpha = 0.0
            
            h = S[0] + alpha * S[1]
            
            # Overlap-add with Hanning window
            h = h - np.mean(h)
            H[t:t + win_len] += h * np.hanning(win_len)
        
        return H

    def _harmonic_score(self, freqs_bpm: np.ndarray, psd: np.ndarray, peak_bpm: float) -> float:
        """
        Check for harmonic support at 2× the fundamental frequency.
        Returns a bonus score if a harmonic is found.
        """
        harmonic_bpm = 2.0 * peak_bpm
        harmonic_mask = (freqs_bpm >= harmonic_bpm - 5) & (freqs_bpm <= harmonic_bpm + 5)
        harmonic_idx = np.where(harmonic_mask)[0]
        
        if len(harmonic_idx) > 0:
            harmonic_power = np.max(psd[harmonic_idx])
            total_power = np.sum(psd) + 1e-6
            return float(harmonic_power / total_power)
        return 0.0

    def _calculate_vitals(self) -> Tuple[float, float, List[float]]:
        """
        Core engine: combines ICA + POS for heart rate, uses confidence-weighted fusion.
        """
        try:
            # 1. Prepare and Normalization
            X = np.array(self.data_buffer).T  # Shape (3, N)
            L = X.shape[1]
            X_proc = np.zeros_like(X, dtype=float)
            
            for i in range(3):
                X_proc[i] = scipy.signal.detrend(X[i])
                X_proc[i] = (X_proc[i] - np.mean(X_proc[i])) / (np.std(X_proc[i]) + 1e-6)
            
            # Bandpass filter before ICA (0.75 - 3.0 Hz)
            fps = self.fps
            if fps < 5:
                return self.bpm, self.respiration_rate, []
            
            b, a = butter(4, [0.75 / (fps/2), 3.0 / (fps/2)], btype='band')
            for i in range(3):
                X_proc[i] = filtfilt(b, a, X_proc[i])
            
            # ======= METHOD 1: ICA (JADE) =======
            B = jadeR(X_proc)
            ICA = np.asarray(np.dot(B, X_proc))
            
            ica_bpm, ica_confidence, ica_spectrum = self._extract_hr_from_components(ICA, L)
            
            # ======= METHOD 2: POS =======
            pos_signal = self._pos_extract(X, L)
            # Bandpass the POS signal
            pos_filtered = filtfilt(b, a, pos_signal)
            pos_bpm, pos_confidence, pos_spectrum = self._extract_hr_single(pos_filtered, L)
            
            # ======= Confidence-weighted fusion =======
            best_bpm = self.bpm
            best_spectrum = []
            
            # Require minimum confidence to update
            MIN_CONFIDENCE = 0.05
            
            if ica_confidence > MIN_CONFIDENCE or pos_confidence > MIN_CONFIDENCE:
                if ica_confidence >= pos_confidence:
                    best_bpm = ica_bpm
                    best_spectrum = ica_spectrum
                else:
                    best_bpm = pos_bpm
                    best_spectrum = pos_spectrum
            # else: hold previous BPM (don't update with low-confidence readings)
            
            # ======= Respiration (separate ICA component) =======
            best_rpm = self._extract_respiration(ICA, L)
            
            return float(best_bpm), float(best_rpm), best_spectrum
            
        except Exception as e:
            print(f"Vitals Engine Error: {e}")
            return self.bpm, self.respiration_rate, []

    def _extract_hr_from_components(self, ICA: np.ndarray, L: int) -> Tuple[float, float, list]:
        """
        Extract heart rate from 3 ICA components, returning best BPM, confidence, and spectrum.
        """
        component_scores = []
        component_bpms = []
        component_spectra = []
        
        for i in range(3):
            source = ICA[i].flatten()
            bpm_val, confidence, norm_spectrum = self._extract_hr_single(source, L)
            component_scores.append(confidence)
            component_bpms.append(bpm_val)
            component_spectra.append(norm_spectrum)
        
        best_idx = int(np.argmax(component_scores))
        return component_bpms[best_idx], component_scores[best_idx], component_spectra[best_idx]

    def _extract_hr_single(self, source: np.ndarray, L: int) -> Tuple[float, float, list]:
        """
        Extract heart rate from a single signal using Welch's PSD + parabolic interpolation + harmonic check.
        Returns (bpm, confidence_score, normalized_spectrum).
        """
        if len(source) < 32:
            return 0.0, -1.0, []
        
        # Welch's PSD with good frequency resolution
        nperseg = min(256, L // 2)
        if nperseg < 16:
            return 0.0, -1.0, []
        
        freqs_hz, psd = welch(source, fs=self.fps, nperseg=nperseg, nfft=max(512, nperseg * 2))
        freqs_bpm = 60.0 * freqs_hz
        
        # Filter for Heart Rate (45-180 BPM)
        hr_mask = (freqs_bpm >= 45) & (freqs_bpm <= 180)
        hr_idx = np.where(hr_mask)[0]
        
        if len(hr_idx) == 0:
            return 0.0, -1.0, []
        
        hr_mags = psd[hr_idx]
        peak_local_idx = np.argmax(hr_mags)
        peak_idx = hr_idx[peak_local_idx]
        
        # Parabolic interpolation for sub-bin precision
        if 0 < peak_idx < len(psd) - 1:
            alpha_v = psd[peak_idx - 1]
            beta_v = psd[peak_idx]
            gamma_v = psd[peak_idx + 1]
            denom = alpha_v - 2 * beta_v + gamma_v + 1e-9
            p = 0.5 * (alpha_v - gamma_v) / denom
            bpm_val = float(freqs_bpm[peak_idx] + p * (freqs_bpm[1] - freqs_bpm[0]))
        else:
            bpm_val = float(freqs_bpm[peak_idx])
        
        # Confidence = peak prominence (peak-to-sum ratio)
        max_p = np.max(hr_mags)
        sum_p = np.sum(hr_mags)
        prominence = float(max_p / (sum_p + 1e-6))
        
        # Harmonic bonus
        harmonic_bonus = self._harmonic_score(freqs_bpm, psd, bpm_val)
        confidence = prominence + 0.3 * harmonic_bonus
        
        # Normalize spectrum
        norm_spectrum = (hr_mags / (max_p + 1e-6)).tolist()
        
        return bpm_val, confidence, norm_spectrum

    def _extract_respiration(self, ICA: np.ndarray, L: int) -> float:
        """
        Separate ICA component selection and extraction for respiration rate.
        """
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
        
        best_rpm_idx = int(np.argmax(rpm_scores))
        
        rr_source = ICA[best_rpm_idx].flatten()
        rr_windowed = np.hamming(L) * rr_source
        rr_fft = np.abs(np.fft.rfft(rr_windowed))
        rr_freqs = 60.0 * (float(self.fps) / L * np.arange(L // 2 + 1))
        rr_mask_final = (rr_freqs >= 8) & (rr_freqs <= 25)
        rr_idx_final = np.where(rr_mask_final)[0]
        
        if len(rr_idx_final) > 0:
            rr_peak = rr_idx_final[np.argmax(rr_fft[rr_idx_final])]
            return float(rr_freqs[rr_peak])
        
        return self.respiration_rate
