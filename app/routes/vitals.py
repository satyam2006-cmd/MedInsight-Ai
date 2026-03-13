from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse, Response
from ..services.vitals_service import VitalsService
from ..services.report_service import generate_vitals_report
from ..services.ai_summary_service import ai_summary_service
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
        summary = _active_service.get_session_summary()
        # Ensure we only generate a summary if we don't have one cached or we want a fresh one
        # For simplicity, generate it on demand here if enough data exists
        if summary.get('avg_hr', 0) > 0 and 'ai_summary' not in summary:
             ai_text = await ai_summary_service.generate_summary(summary)
             summary['ai_summary'] = ai_text
             # Optionally cache it back in the service to avoid regenerating every time
             _active_service.ai_summary_cache = ai_text
        elif hasattr(_active_service, 'ai_summary_cache'):
             summary['ai_summary'] = _active_service.ai_summary_cache
        return summary

    return JSONResponse(content={"error": "No active session"}, status_code=404)

@router.get("/api/vitals/report")
async def get_report():
    """Generate and download PDF report."""
    if not _active_service:
        return JSONResponse(content={"error": "No active session"}, status_code=404)
    try:
        summary = _active_service.get_session_summary()
        
        # Always try to generate a fresh AI summary for the final report if there's valid data
        if summary.get('avg_hr', 0) > 0:
            ai_text = await ai_summary_service.generate_summary(summary)
            summary['ai_summary'] = ai_text
            
        pdf_bytes = generate_vitals_report(summary)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=vitals_report.pdf"}
        )
    except ImportError as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(content={"error": f"Report generation failed: {e}"}, status_code=500)
