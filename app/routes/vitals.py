from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse, Response
from ..services.vitals_service import VitalsService
from ..services.report_service import generate_vitals_report
import json
import time

router = APIRouter()

# Persistent service for session endpoint access
_active_service = None

@router.websocket("/ws/vitals")
async def vitals_websocket(websocket: WebSocket):
    global _active_service
    print("Incoming Vitals WebSocket connection...")
    await websocket.accept()
    print("Vitals WebSocket accepted")
    vitals_service = VitalsService()
    _active_service = vitals_service
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            values = message.get("values")
            timestamp = message.get("timestamp", time.time())
            
            if values is not None:
                result = vitals_service.process_signal(values, timestamp)
                await websocket.send_json(result)
                
    except WebSocketDisconnect:
        print("Vitals WebSocket disconnected")
    except Exception as e:
        print(f"Error in Vitals WebSocket: {e}")
        await websocket.close()

@router.get("/api/vitals/session")
async def get_session():
    """Return current session summary."""
    if _active_service:
        return _active_service.get_session_summary()
    return JSONResponse(content={"error": "No active session"}, status_code=404)

@router.get("/api/vitals/report")
async def get_report():
    """Generate and download PDF report."""
    if not _active_service:
        return JSONResponse(content={"error": "No active session"}, status_code=404)
    try:
        summary = _active_service.get_session_summary()
        pdf_bytes = generate_vitals_report(summary)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=vitals_report.pdf"}
        )
    except ImportError as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)
    except Exception as e:
        return JSONResponse(content={"error": f"Report generation failed: {e}"}, status_code=500)
