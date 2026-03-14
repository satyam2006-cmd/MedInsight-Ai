import cv2
import numpy as np
import time
from camera import Camera
from signal_processing import SignalProcessor
from heart_rate import HeartRateAnalyzer

def main():
    # Configuration
    BUFFER_SIZE = 450  # 15 seconds at 30 fps
    FS = 30
    
    # Initialize components
    cam = Camera()
    processor = SignalProcessor(fs=FS)
    analyzer = HeartRateAnalyzer(fs=FS)
    
    # Buffers
    signal_buffer = [] # Store mean RGB values
    times = []
    
    print("rPPG Heart Rate Engine Starting...")
    print("Stay still and look at the camera for best results.")

    try:
        while True:
            frame, frame_rgb = cam.get_frame()
            if frame is None:
                break

            # 1. Extraction
            mean_rgb, roi_data = cam.get_roi_signals(frame_rgb)
            
            if mean_rgb is not None:
                signal_buffer.append(mean_rgb)
                times.append(time.time())
                
                # Keep buffer at fixed size
                if len(signal_buffer) > BUFFER_SIZE:
                    signal_buffer.pop(0)
                    times.pop(0)

                # Visual Feedback: Draw ROIs
                for roi_name, pts in roi_data.items():
                    cv2.polylines(frame, [pts], True, (0, 255, 0), 2)

            # 2. Processing (only if buffer is full enough)
            bpm_text = "Stabilizing..."
            if len(signal_buffer) >= 150: # Start showing after 5 seconds
                # Convert buffer to numpy array
                signals = np.array(signal_buffer)
                
                # Preprocess
                preprocessed = processor.preprocess(signals)
                
                # Separate Sources (ICA)
                sources = processor.separate_sources(preprocessed)
                
                # Filter Components
                filtered = processor.bandpass_filter(sources)
                
                # Analyze Heart Rate
                bpm, xf, yf = analyzer.get_best_component(filtered)
                
                if bpm > 0:
                    bpm_text = f"BPM: {int(bpm)}"
                
                # (Optional) Visualization of the pulse waveform on frame
                # For simplicity, we'll just show the text here
                
            # 3. UI Overlay
            cv2.putText(frame, bpm_text, (50, 50), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 255, 0), 3)
            cv2.putText(frame, f"Frames: {len(signal_buffer)}/{BUFFER_SIZE}", (50, 100), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)
            
            # Show live feed
            cv2.imshow('rPPG Vitals Engine', frame)

            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

    except Exception as e:
        print(f"Error in main loop: {e}")
    finally:
        cam.release()
        cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
