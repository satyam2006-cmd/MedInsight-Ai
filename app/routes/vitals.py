from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from ..services.vitals_service import VitalsService
import json
import time

router = APIRouter()

@router.websocket("/ws/vitals")
async def vitals_websocket(websocket: WebSocket):
    print("Incoming Vitals WebSocket connection...")
    await websocket.accept()
    print("Vitals WebSocket accepted")
    vitals_service = VitalsService()
    
    try:
        while True:
            # Receive signal data from frontend
            # Data format: {"value": float, "timestamp": float}
            data = await websocket.receive_text()
            message = json.loads(data)
            
            values = message.get("values")
            timestamp = message.get("timestamp", time.time())
            
            if values is not None:
                bpm, respiration, fps, alert, spectrum = vitals_service.process_signal(values, timestamp)
                
                # Send back the calculated vitals
                await websocket.send_json({
                    "bpm": round(bpm, 1) if bpm else 0,
                    "respiration": round(respiration, 1) if respiration else 0,
                    "fps": round(fps, 1) if fps else 0,
                    "alert": alert,
                    "spectrum": spectrum,
                    "status": "tracking" if bpm > 0 else "buffering"
                })
                
    except WebSocketDisconnect:
        print("Vitals WebSocket disconnected")
    except Exception as e:
        print(f"Error in Vitals WebSocket: {e}")
        await websocket.close()
