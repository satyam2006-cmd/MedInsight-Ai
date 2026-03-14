# rPPG Heart Rate Monitoring Engine

This is a high-accuracy, contactless heart rate monitoring system using remote photoplethysmography (rPPG).

## How it Works
The system detects the microscopic color changes in the human face caused by blood flow (the heart beat). It uses:
1.  **MediaPipe Face Mesh**: To track the forehead and cheek ROIs with sub-pixel stability.
2.  **FastICA**: To separate the blood volume pulse (BVP) from motion and ambient light noise.
3.  **Butterworth Bandpass**: To isolate standard human heart rate frequencies (0.7Hz - 4Hz).
4.  **FFT (Fast Fourier Transform)**: To precisely identify the dominant BPM peak.

## Project Structure
- `camera.py`: Webcam control and MediaPipe face tracking.
- `signal_processing.py`: Preprocessing (ICA, Filtering, Savitzky-Golay).
- `heart_rate.py`: Vitals analysis (FFT, BPM smoothing).
- `main.py`: Interactive visualization and control loop.

## Setup Instructions

1.  **Install Dependencies**:
    ```bash
    pip install -r requirements.txt
    ```

2.  **Run the Engine**:
    ```bash
    python main.py
    ```

## Tips for Best Results
- **Lighting**: Ensure your face is evenly lit by natural light or a bright office lamp. Avoid backlight.
- **Stability**: Stay as still as possible during the first 15 seconds (initial stabilization).
- **Framing**: Keep your face reasonably centered in the webcam view.

## Usage
- Press **'q'** to exit the application.
- The system starts calculating after ~5 seconds and reaches full 15-second accuracy shortly after.
