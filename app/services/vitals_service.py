import numpy as np
import scipy.signal
import time
from typing import List, Tuple, Optional
from app.services.jade_service import jadeR

class VitalsService:
    def __init__(self, buffer_size: int = 400): 
        self.buffer_size = buffer_size
        self.data_buffer = [] # List of [r, g, b]
        self.times = []
        self.bpm = 0.0
        self.respiration_rate = 0.0
        self.fps = 0.0
        self.last_calc_time = 0.0
        self.smooth_bpm = 0.0
        self.smooth_rpm = 0.0

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
                
                # Smoothing (exponential moving average)
                if new_bpm > 0:
                    if self.smooth_bpm == 0:
                        self.smooth_bpm = new_bpm
                    else:
                        self.smooth_bpm = 0.7 * self.smooth_bpm + 0.3 * new_bpm
                    self.bpm = self.smooth_bpm
                
                if new_rpm > 0:
                    if self.smooth_rpm == 0:
                        self.smooth_rpm = new_rpm
                    else:
                        self.smooth_rpm = 0.7 * self.smooth_rpm + 0.3 * new_rpm
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

    def _calculate_vitals(self) -> Tuple[float, float, List[float]]:
        """
        Core engine calculation for heart rate (BPM) and respiration rate (RPM).
        Uses JADE ICA to separate signal sources and spectral analysis to identify vitals.
        """
        try:
            # 1. Prepare and Normalization
            X = np.array(self.data_buffer).T # Shape (3, N)
            L = X.shape[1]
            X_proc = np.zeros_like(X, dtype=float)
            
            for i in range(3):
                # Detrend to remove slow drifts
                X_proc[i] = scipy.signal.detrend(X[i])
                # Z-score normalization for ICA stability
                X_proc[i] = (X_proc[i] - np.mean(X_proc[i])) / (np.std(X_proc[i]) + 1e-6)
            
            # 2. Source Separation (Vitals Engine ICA)
            B = jadeR(X_proc)
            ICA = np.asarray(np.dot(B, X_proc)) # Shape (3, N)
            
            # 3. Spectral Analysis and Source Selection
            best_bpm = self.bpm
            best_rpm = self.respiration_rate
            best_spectrum = []
            
            component_scores = []
            component_vitals = []
            
            for i in range(3):
                source = ICA[i].flatten()
                
                # Apply Hamming window and FFT
                windowed = np.hamming(L) * source
                fft_data = np.abs(np.fft.rfft(windowed))
                freqs = float(self.fps) / L * np.arange(L // 2 + 1)
                freqs_bpm = 60.0 * freqs
                
                # Filter for Heart Rate (45-180 BPM)
                hr_mask = (freqs_bpm >= 45) & (freqs_bpm <= 180)
                hr_idx = np.where(hr_mask)[0]
                
                if len(hr_idx) > 0:
                    hr_mags = fft_data[hr_idx]
                    peak_idx = hr_idx[np.argmax(hr_mags)]
                    bpm_val = float(freqs_bpm[peak_idx])
                    
                    # Score by peak-to-sum power ratio (prominence)
                    max_p = np.max(hr_mags)
                    sum_p = np.sum(hr_mags)
                    score = max_p / (sum_p + 1e-6)
                    
                    # Respiration Rate (8-25 RPM)
                    freqs_rpm = 60.0 * freqs
                    rr_mask = (freqs_rpm >= 8) & (freqs_rpm <= 25)
                    rr_idx = np.where(rr_mask)[0]
                    rpm_val = 0.0
                    if len(rr_idx) > 0:
                        rr_peak_idx = rr_idx[np.argmax(fft_data[rr_idx])]
                        rpm_val = float(freqs_rpm[rr_peak_idx])
                    
                    # Normalize spectrum for telemetry/visualization
                    norm_spectrum = (hr_mags / (max_p + 1e-6)).tolist()
                    
                    component_scores.append(score)
                    component_vitals.append((bpm_val, rpm_val, norm_spectrum))
                else:
                    component_scores.append(-1)
                    component_vitals.append((0, 0, []))
            
            # Select the most likely pulse source
            best_idx = int(np.argmax(component_scores))
            if component_scores[best_idx] > 0:
                best_bpm, best_rpm, best_spectrum = component_vitals[best_idx]
                
            return float(best_bpm), float(best_rpm), best_spectrum
            
        except Exception as e:
            print(f"Vitals Engine Error: {e}")
            return self.bpm, self.respiration_rate, []
