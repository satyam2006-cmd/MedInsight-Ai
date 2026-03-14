import numpy as np
from scipy.fft import fft, fftfreq

class HeartRateAnalyzer:
    def __init__(self, fs=30, window_size=450): # 15 seconds @ 30 FPS
        self.fs = fs
        self.window_size = window_size
        self.bpm_history = []
        self.ema_alpha = 0.1 # Smoothing factor for EMA
        self.current_bpm = 0

    def calculate_bpm(self, filtered_signal):
        """
        Identify dominant frequency in the filtered signal using FFT
        """
        N = len(filtered_signal)
        yf = fft(filtered_signal)
        xf = fftfreq(N, 1 / self.fs)
        
        # Only look at positive frequencies
        pos_mask = xf > 0
        xf_pos = xf[pos_mask]
        yf_pos = np.abs(yf[pos_mask])
        
        # Human heart rate is typically between 0.7 Hz and 4 Hz
        range_mask = (xf_pos >= 0.7) & (xf_pos <= 4.0)
        yf_range = yf_pos[range_mask]
        xf_range = xf_pos[range_mask]
        
        if len(yf_range) == 0:
            return 0, None, None
            
        # Find peak frequency
        peak_idx = np.argmax(yf_range)
        peak_freq = xf_range[peak_idx]
        
        bpm = peak_freq * 60
        
        # Stability: Exponential Moving Average
        if self.current_bpm == 0:
            self.current_bpm = bpm
        else:
            self.current_bpm = (self.ema_alpha * bpm) + (1 - self.ema_alpha) * self.current_bpm
            
        return self.current_bpm, xf_pos, yf_pos

    def get_best_component(self, components):
        """
        Out of the ICA components, pick the one with the strongest periodicity 
        in the heart rate range (highest peak magnitude)
        """
        best_bpm = 0
        max_peak = -1
        best_xf = None
        best_yf = None
        
        for i in range(components.shape[1]):
            bpm, xf, yf = self.calculate_bpm(components[:, i])
            peak_val = np.max(yf[(xf >= 0.7) & (xf <= 4.0)]) if yf is not None else 0
            
            if peak_val > max_peak:
                max_peak = peak_val
                best_bpm = bpm
                best_xf = xf
                best_yf = yf
                
        return best_bpm, best_xf, best_yf
