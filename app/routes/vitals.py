from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse, Response
from ..services.vitals_service import VitalsService
from ..services.report_service import generate_vitals_report
from ..services.ai_summary_service import ai_summary_service
from ..services.db_service import db_service, get_supabase_client
from ..schemas import (
    SaveVitalsSessionRequest,
    CreateReferenceReadingsRequest,
    CompareVitalsResponse,
    LiveCalibrationRequest,
)
import json
import time
import uuid
import numpy as np


router = APIRouter()

# Persistent service for session endpoint access
_active_service = None
_active_session_id = None
_active_sessions = {}


def _resolve_service(session_id: str = None):
    if session_id and session_id in _active_sessions:
        return _active_sessions[session_id], session_id
    if _active_service and _active_session_id:
        return _active_service, _active_session_id
    return None, None


def _nearest_match_pairs(app_samples, ref_samples, metric_key: str, max_delta_sec: float = 2.0):
    pairs = []
    app_valid = [s for s in app_samples if s.get(metric_key) is not None]
    ref_valid = [s for s in ref_samples if s.get(metric_key) is not None]
    if not app_valid or not ref_valid:
        return pairs

    app_times = np.array([float(s.get("timestamp_sec", 0.0)) for s in app_valid], dtype=float)
    app_vals = np.array([float(s.get(metric_key)) for s in app_valid], dtype=float)
    used_app_idx = set()

    for ref in ref_valid:
        ref_t = float(ref.get("timestamp_sec", 0.0))
        deltas = np.abs(app_times - ref_t)
        sorted_idx = np.argsort(deltas)
        idx = None
        for cand in sorted_idx:
            cand_i = int(cand)
            if cand_i not in used_app_idx:
                idx = cand_i
                break
        if idx is None:
            continue
        delta = abs(app_times[idx] - ref_t)
        if delta <= max_delta_sec:
            pairs.append((float(app_vals[idx]), float(ref.get(metric_key))))
            used_app_idx.add(idx)
    return pairs


def _fit_linear_calibration(pairs, slope_bounds, intercept_bounds):
    if len(pairs) < 3:
        return 1.0, 0.0, 0
    app = np.array([p[0] for p in pairs], dtype=float)
    ref = np.array([p[1] for p in pairs], dtype=float)

    if len(pairs) >= 8 and np.std(app) > 1e-6:
        slope, intercept = np.polyfit(app, ref, 1)
    else:
        slope = (np.mean(ref) / (np.mean(app) + 1e-8)) if np.mean(app) > 1e-8 else 1.0
        intercept = 0.0

    slope = float(np.clip(slope, slope_bounds[0], slope_bounds[1]))
    intercept = float(np.clip(intercept, intercept_bounds[0], intercept_bounds[1]))
    return slope, intercept, int(len(pairs))


def _build_metric_bundle(pairs, tolerance: float):
    if not pairs:
        return {
            "count": 0,
            "mae": None,
            "rmse": None,
            "mape": None,
            "correlation": None,
            "within_tolerance_pct": None,
        }

    app = np.array([p[0] for p in pairs], dtype=float)
    ref = np.array([p[1] for p in pairs], dtype=float)
    errors = app - ref
    abs_errors = np.abs(errors)
    mae = float(np.mean(abs_errors))
    rmse = float(np.sqrt(np.mean(np.square(errors))))

    denom = np.where(np.abs(ref) < 1e-8, np.nan, np.abs(ref))
    mape_values = np.abs(errors) / denom
    if np.all(np.isnan(mape_values)):
        mape = None
    else:
        mape = float(np.nanmean(mape_values) * 100.0)

    if len(app) >= 2 and np.std(app) > 0 and np.std(ref) > 0:
        corr = float(np.corrcoef(app, ref)[0, 1])
    else:
        corr = None

    within = float(np.mean(abs_errors <= tolerance) * 100.0)
    return {
        "count": int(len(app)),
        "mae": round(mae, 4),
        "rmse": round(rmse, 4),
        "mape": round(mape, 4) if mape is not None else None,
        "correlation": round(corr, 4) if corr is not None else None,
        "within_tolerance_pct": round(within, 2),
    }

@router.websocket("/ws/vitals")
async def vitals_websocket(websocket: WebSocket):
    global _active_service, _active_session_id
    print("Incoming Vitals WebSocket connection...")
    await websocket.accept()
    print("Vitals WebSocket accepted")
    vitals_service = VitalsService()
    session_id = str(uuid.uuid4())
    _active_service = vitals_service
    _active_session_id = session_id
    _active_sessions[session_id] = vitals_service
    if len(_active_sessions) > 25:
        oldest_id = next(iter(_active_sessions.keys()))
        if oldest_id != session_id:
            _active_sessions.pop(oldest_id, None)
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            values = message.get("values")
            timestamp = message.get("timestamp", time.time())
            
            if values is not None:
                result = vitals_service.process_signal(values, timestamp)
                result["session_id"] = session_id
                await websocket.send_json(result)
                
    except WebSocketDisconnect:
        print("Vitals WebSocket disconnected")
    except Exception as e:
        print(f"Error in Vitals WebSocket: {e}")
        await websocket.close()

@router.get("/api/vitals/session")
async def get_session(session_id: str = None):
    """Return current session summary."""
    service, resolved_session_id = _resolve_service(session_id)
    if service:
        summary = service.get_session_summary()
        # Ensure we only generate a summary if we don't have one cached or we want a fresh one
        # For simplicity, generate it on demand here if enough data exists
        if summary.get('avg_hr', 0) > 0 and 'ai_summary' not in summary:
            ai_text = await ai_summary_service.generate_summary(summary)
            summary['ai_summary'] = ai_text
            # Optionally cache it back in the service to avoid regenerating every time
            service.ai_summary_cache = ai_text
        elif hasattr(service, 'ai_summary_cache'):
            summary['ai_summary'] = service.ai_summary_cache
        summary["session_id"] = resolved_session_id
        return summary

    return JSONResponse(content={"error": "No active session"}, status_code=404)

@router.get("/api/vitals/report")
async def get_report(session_id: str = None):
    """Generate and download PDF report."""
    service, _ = _resolve_service(session_id)
    if not service:
        return JSONResponse(content={"error": "No active session"}, status_code=404)
    try:
        summary = service.get_session_summary()
        
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


@router.post("/api/vitals/save-session")
async def save_session(payload: SaveVitalsSessionRequest):
    service, resolved_session_id = _resolve_service(payload.session_id)
    if not service or not resolved_session_id:
        return JSONResponse(content={"error": "No active session"}, status_code=404)

    try:
        supabase = get_supabase_client()
        summary = service.get_session_summary()
        samples = service.get_recent_samples()
        saved = db_service.create_vitals_session(
            supabase=supabase,
            session_id=resolved_session_id,
            patient_id=payload.patient_id,
            device_label=payload.device_label,
            condition_tag=payload.condition_tag,
            summary=summary,
            samples=samples,
        )
        return {
            "session_id": saved.get("id"),
            "message": "Session saved successfully",
            "sample_count": len(samples),
        }
    except Exception as e:
        return JSONResponse(content={"error": f"Failed to save session: {e}"}, status_code=500)


@router.post("/api/vitals/reference")
async def create_reference(payload: CreateReferenceReadingsRequest):
    if len(payload.readings) == 0:
        return JSONResponse(content={"error": "No reference readings provided"}, status_code=400)

    try:
        supabase = get_supabase_client()
        reading_payload = [r.model_dump() for r in payload.readings]
        saved = db_service.create_reference_readings(
            supabase=supabase,
            session_id=payload.session_id,
            device_name=payload.device_name,
            condition_tag=payload.condition_tag,
            readings=reading_payload,
        )
        return {
            "reference_id": saved.get("id"),
            "session_id": saved.get("session_id"),
            "count": len(reading_payload),
            "message": "Reference readings saved successfully",
        }
    except Exception as e:
        return JSONResponse(content={"error": f"Failed to save references: {e}"}, status_code=500)


@router.get("/api/vitals/compare", response_model=CompareVitalsResponse)
async def compare_session(session_id: str, reference_id: str):
    try:
        supabase = get_supabase_client()
        session = db_service.get_vitals_session(supabase, session_id)
        reference = db_service.get_reference_reading_set(supabase, reference_id)

        if not session:
            return JSONResponse(content={"error": "Vitals session not found"}, status_code=404)
        if not reference:
            return JSONResponse(content={"error": "Reference reading set not found"}, status_code=404)
        if reference.get("session_id") != session_id:
            return JSONResponse(content={"error": "Reference does not belong to session"}, status_code=400)

        app_samples = session.get("samples", []) or []
        ref_samples = reference.get("readings", []) or []

        hr_pairs = _nearest_match_pairs(app_samples, ref_samples, "hr", max_delta_sec=2.0)
        rr_pairs = _nearest_match_pairs(app_samples, ref_samples, "rr", max_delta_sec=3.0)
        spo2_pairs = _nearest_match_pairs(app_samples, ref_samples, "spo2", max_delta_sec=4.0)

        hr_metrics = _build_metric_bundle(hr_pairs, tolerance=5.0)
        rr_metrics = _build_metric_bundle(rr_pairs, tolerance=2.0)
        spo2_metrics = _build_metric_bundle(spo2_pairs, tolerance=2.0)

        db_service.create_accuracy_metric(
            supabase=supabase,
            session_id=session_id,
            reference_id=reference_id,
            hr_metrics=hr_metrics,
            rr_metrics=rr_metrics,
            spo2_metrics=spo2_metrics,
        )

        return {
            "session_id": session_id,
            "reference_id": reference_id,
            "hr": hr_metrics,
            "rr": rr_metrics,
            "spo2": spo2_metrics,
        }
    except Exception as e:
        return JSONResponse(content={"error": f"Comparison failed: {e}"}, status_code=500)


@router.post("/api/vitals/calibrate-live")
async def calibrate_live(payload: LiveCalibrationRequest):
    service, _ = _resolve_service(payload.session_id)
    if not service:
        return JSONResponse(content={"error": "Active in-memory session not found for calibration"}, status_code=404)

    try:
        supabase = get_supabase_client()
        session = db_service.get_vitals_session(supabase, payload.session_id)
        reference = db_service.get_reference_reading_set(supabase, payload.reference_id)

        if not session:
            return JSONResponse(content={"error": "Vitals session not found"}, status_code=404)
        if not reference:
            return JSONResponse(content={"error": "Reference reading set not found"}, status_code=404)
        if reference.get("session_id") != payload.session_id:
            return JSONResponse(content={"error": "Reference does not belong to session"}, status_code=400)

        app_samples = session.get("samples", []) or []
        ref_samples = reference.get("readings", []) or []

        calibrations = {}
        configs = {
            "hr": {"delta": 2.0, "slope": (0.75, 1.25), "intercept": (-25.0, 25.0)},
            "rr": {"delta": 3.0, "slope": (0.6, 1.4), "intercept": (-8.0, 8.0)},
            "spo2": {"delta": 4.0, "slope": (0.85, 1.15), "intercept": (-6.0, 6.0)},
        }

        for metric in payload.metrics:
            if metric not in configs:
                continue
            cfg = configs[metric]
            pairs = _nearest_match_pairs(app_samples, ref_samples, metric, max_delta_sec=cfg["delta"])
            slope, intercept, count = _fit_linear_calibration(pairs, cfg["slope"], cfg["intercept"])
            if count >= 3:
                service.update_live_calibration(metric, slope, intercept, count)
                active = service.live_calibration.get(metric, {"slope": 1.0, "intercept": 0.0})
                out_slope = active.get("slope", slope)
                out_intercept = active.get("intercept", intercept)
            else:
                out_slope = slope
                out_intercept = intercept
            calibrations[metric] = {
                "count": count,
                "slope": round(out_slope, 5),
                "intercept": round(out_intercept, 5),
                "applied": count >= 3,
            }

        return {
            "session_id": payload.session_id,
            "reference_id": payload.reference_id,
            "calibrations": calibrations,
            "message": "Live calibration updated",
        }
    except Exception as e:
        return JSONResponse(content={"error": f"Live calibration failed: {e}"}, status_code=500)
