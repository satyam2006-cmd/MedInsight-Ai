import numpy as np
from scipy import signal
from sklearn.decomposition import FastICA

class SignalProcessor:
    def __init__(self, fs=30):
        self.fs = fs
        self.ica = FastICA(n_components=3, random_state=42, max_iter=1000)

    def preprocess(self, signals):
        """
        Input: (N, 3) array of RGB signals
        Steps: Centering, Normalization, Smoothing
        """
        # 1. Centering (Subtract mean)
        centered = signals - np.mean(signals, axis=0)
        
        # 2. Normalization (Unit variance)
        normalized = centered / np.std(centered, axis=0)
        
        # 3. Smoothing (Savitzky-Golay)
        # Window length must be odd, polyorder < window_length
        smoothed = np.zeros_like(normalized)
        for i in range(3):
            smoothed[:, i] = signal.savgol_filter(normalized[:, i], window_length=9, polyorder=3)
            
        return smoothed

    def separate_sources(self, signals):
        """
        Apply ICA to separate pulse from motion artifacts
        """
        try:
            # ICA expects (N, 3) where N is number of samples
            source_signals = self.ica.fit_transform(signals)
            return source_signals
        except Exception as e:
            print(f"ICA Error: {e}")
            return signals

    def bandpass_filter(self, data, lowcut=0.7, highcut=4.0, order=4):
        """
        Butterworth bandpass filter to isolate human heart rate (42-240 BPM)
        """
        nyquist = 0.5 * self.fs
        low = lowcut / nyquist
        high = highcut / nyquist
        b, a = signal.butter(order, [low, high], btype='band')
        
        filtered = np.zeros_like(data)
        if data.ndim == 1:
            return signal.filtfilt(b, a, data)
        else:
            for i in range(data.shape[1]):
                filtered[:, i] = signal.filtfilt(b, a, data[:, i])
            return filtered
