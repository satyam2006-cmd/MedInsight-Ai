import cv2
import mediapipe as mp
import numpy as np

class Camera:
    def __init__(self, device_id=0):
        self.cap = cv2.VideoCapture(device_id)
        self.cap.set(cv2.CAP_PROP_FPS, 30)
        self.mp_face_mesh = mp.solutions.face_mesh
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        
        # Landmarks for ROI extraction (approximate indices)
        self.FOREHEAD_LANDMARKS = [10, 67, 103, 107, 109, 151, 337, 297, 299, 332]
        self.LEFT_CHEEK_LANDMARKS = [123, 147, 213, 192, 214]
        self.RIGHT_CHEEK_LANDMARKS = [352, 376, 433, 416, 434]

    def get_frame(self):
        ret, frame = self.cap.read()
        if not ret:
            return None, None
        return frame, cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

    def get_roi_signals(self, frame_rgb):
        results = self.face_mesh.process(frame_rgb)
        if not results.multi_face_landmarks:
            return None, None

        landmarks = results.multi_face_landmarks[0].landmark
        h, w, _ = frame_rgb.shape
        
        # Extract pixel coordinates for ROI polygons
        def get_coords(indices):
            return np.array([(int(landmarks[i].x * w), int(landmarks[i].y * h)) for i in indices])

        forehead_pts = get_coords(self.FOREHEAD_LANDMARKS)
        l_cheek_pts = get_coords(self.LEFT_CHEEK_LANDMARKS)
        r_cheek_pts = get_coords(self.RIGHT_CHEEK_LANDMARKS)

        # Create masks for ROIs
        mask = np.zeros((h, w), dtype=np.uint8)
        cv2.fillPoly(mask, [forehead_pts, l_cheek_pts, r_cheek_pts], 255)
        
        # Calculate mean RGB for pixels in ROI
        roi_pixels = frame_rgb[mask == 255]
        if len(roi_pixels) == 0:
            return None, None
            
        mean_rgb = np.mean(roi_pixels, axis=0)
        
        roi_data = {
            'forehead': forehead_pts,
            'left_cheek': l_cheek_pts,
            'right_cheek': r_cheek_pts
        }
        
        return mean_rgb, roi_data

    def release(self):
        self.cap.release()
        self.face_mesh.close()
