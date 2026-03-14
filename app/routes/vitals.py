from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, Header
from fastapi.responses import JSONResponse, Response
from ..services.vitals_service import VitalsService
from ..services.report_service import generate_vitals_report
from ..services.ai_summary_service import ai_summary_service
from ..services.db_service import db_service, get_supabase_client
from ..services.trend_analysis_service import trend_analysis_service
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
import logging

logger = logging.getLogger(__name__)



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
async def get_session(
    session_id: str = None,
    language: str = "English",
    patient_id: str = None,
    patient_name: str = None,
    patient_contact: str = None,
    authorization: str = Header(None)
):
    """Return local session summary with AI analysis and automated archiving."""
    service, resolved_session_id = _resolve_service(session_id)
    if service:
        summary = service.get_session_summary()
        
        # Ensure we have a valid summary if enough data exists
        if summary.get('avg_hr', 0) > 0:
            # Generate structured AI insights (English + Translation + Risk)
            ai_data = await ai_summary_service.generate_summary(summary, target_language=language)
            summary.update(ai_data) # Inject summary_en, summary_target, risk_level
            
            # If patient info is provided, archive this as a permanent "Report"
            if patient_id and patient_name:
                try:
                    supabase = get_supabase_client(authorization) if authorization else get_supabase_client()
                    
                    # 1. Resolve or Create Patient
                    patient_record = None
                    by_custom = supabase.table("patients").select("id").eq("patient_custom_id", patient_id).limit(1).execute()
                    if by_custom.data:
                        patient_record = by_custom.data[0]
                    else:
                        patient_record = db_service.create_patient(
                            supabase=supabase,
                            name=patient_name,
                            number=patient_contact or "",
                            custom_id=patient_id
                        )
                    
                    # 2. Extract Branding Info
                    user = None
                    try:
                        auth_response = supabase.auth.get_user()
                        user = auth_response.user if auth_response and auth_response.user else None
                    except Exception: pass
                    
                    hospital_info = None
                    if user and user.user_metadata:
                        hospital_info = {
                            "hospital_name": user.user_metadata.get("hospital_name", ""),
                            "admin_name": user.user_metadata.get("admin_username", ""),
                            "email": user.email or "",
                        }

                    # 3. Create Report Record (archived in English as requested)
                    report_text = (
                        f"AI-Analyzed Vitals Session\n"
                        f"Patient: {patient_name} ({patient_id})\n"
                        f"Average HR: {summary.get('avg_hr')} BPM\n"
                        f"Average SpO2: {summary.get('avg_spo2')}%"
                    )
                    
                    analysis_data = {
                        "summary": ai_data.get("summary"),
                        "hindi_translation": ai_data.get("hindi_translation"),
                        "risk_level": ai_data.get("risk_level"),
                        "target_language": language or "English",
                        "source": "vitals_live",
                        "vitals_snapshot": {
                            "hr": summary.get("avg_hr"),
                            "spo2": summary.get("avg_spo2"),
                            "rr": summary.get("avg_rr"),
                            "hrv": summary.get("hrv_sdnn")
                        }
                    }
                    if hospital_info:
                        analysis_data["hospital_details"] = hospital_info

                    db_service.create_report(
                        supabase=supabase,
                        patient_id=patient_record.get("id"),
                        extracted_text=report_text,
                        analysis=analysis_data
                    )
                    summary["archived"] = True
                except Exception as e:
                    logger.error(f"Failed to auto-archive vitals to reports: {e}")
                    summary["archived"] = False

        summary["session_id"] = resolved_session_id
        return summary

    return JSONResponse(content={"error": "No active session"}, status_code=404)
@router.get("/api/vitals/report")
async def get_report(
    session_id: str = None,
    patient_id: str = None,
    patient_name: str = None,
    patient_contact: str = None,
    language: str = "English",
    authorization: str = Header(None),
):
    """Generate and download PDF report."""
    service, _ = _resolve_service(session_id)
    if not service:
        return JSONResponse(content={"error": "No active session"}, status_code=404)
    try:
        summary = service.get_session_summary()

        # Attach long-term trend analysis when this session has been persisted.
        if session_id:
            try:
                supabase = get_supabase_client()
                row = db_service.get_patient_session_by_session_id(supabase, session_id)
                if row and row.get("patient_id"):
                    historical = db_service.list_patient_sessions(supabase, patient_id=row["patient_id"], limit=365)
                    summary["long_term_trend"] = trend_analysis_service.analyze_sessions(historical, days=14)
            except Exception:
                pass
        
        # Always try to generate a fresh AI summary for the final report if there's valid data
        if summary.get('avg_hr', 0) > 0:
            ai_text = await ai_summary_service.generate_summary(summary)
            summary['ai_summary'] = ai_text

        # Persist a report entry so it appears in Insight Feed.
        if patient_id and patient_name and patient_contact:
            try:
                supabase = get_supabase_client(authorization) if authorization else get_supabase_client()

                patient_record = None
                by_custom = (
                    supabase.table("patients")
                    .select("id, patient_name, patient_custom_id, patient_number")
                    .eq("patient_custom_id", patient_id)
                    .limit(1)
                    .execute()
                )
                if by_custom.data and len(by_custom.data) > 0:
                    patient_record = by_custom.data[0]

                if not patient_record:
                    by_number = (
                        supabase.table("patients")
                        .select("id, patient_name, patient_custom_id, patient_number")
                        .eq("patient_number", patient_id)
                        .limit(1)
                        .execute()
                    )
                    if by_number.data and len(by_number.data) > 0:
                        patient_record = by_number.data[0]

                if not patient_record:
                    patient_record = db_service.create_patient(
                        supabase=supabase,
                        name=patient_name,
                        number=patient_contact,
                        custom_id=patient_id,
                    )

                user = None
                try:
                    auth_response = supabase.auth.get_user()
                    user = auth_response.user if auth_response and auth_response.user else None
                except Exception:
                    user = None

                hospital_info = None
                if user and user.user_metadata:
                    hospital_info = {
                        "hospital_name": user.user_metadata.get("hospital_name", ""),
                        "admin_name": user.user_metadata.get("admin_username", ""),
                        "email": user.email or "",
                        "phone": f"{user.user_metadata.get('country_code', '')} {user.user_metadata.get('phone', '')}".strip(),
                    }

                risk_level = summary.get("ai_risk_level") or "Unknown"
                ai_summary = summary.get("ai_summary") or "Vitals session exported successfully."
                report_text = (
                    f"Vitals session report for {patient_name} ({patient_id}).\n"
                    f"Average HR: {summary.get('avg_hr', 0)} BPM\n"
                    f"Average RR: {summary.get('avg_rr', 0)} RPM\n"
                    f"Average SpO2: {summary.get('avg_spo2', 0)}%\n"
                    f"Session Duration: {summary.get('session_duration_sec', 0)} sec"
                )

                analysis_payload = {
                    "summary": ai_summary,
                    "target_language": language or "English",
                    "risk_level": risk_level,
                    "source": "vitals_pdf",
                }
                if hospital_info:
                    analysis_payload["hospital_details"] = hospital_info

                db_service.create_report(
                    supabase=supabase,
                    patient_id=patient_record.get("id"),
                    extracted_text=report_text,
                    analysis=analysis_payload,
                )
            except Exception:
                # Report persistence should not block PDF generation.
                pass
            
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

    patient_key = (payload.patient_id or "").strip()
    if not patient_key:
        return JSONResponse(content={"error": "patient_id is required to save session"}, status_code=400)

    try:
        supabase = get_supabase_client()
        summary = service.get_session_summary()
        samples = service.get_recent_samples()
        saved = db_service.create_vitals_session(
            supabase=supabase,
            session_id=resolved_session_id,
            patient_id=patient_key,
            device_label=payload.device_label,
            condition_tag=payload.condition_tag,
            summary=summary,
            samples=samples,
        )

        db_service.create_patient_session(
            supabase=supabase,
            session_id=resolved_session_id,
            patient_id=patient_key,
            timestamp=time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
            heart_rate=summary.get("avg_hr", 0),
            respiration_rate=summary.get("avg_rr", 0),
            spo2=summary.get("avg_spo2", 0),
            hrv=summary.get("hrv_sdnn", 0),
            stress_score=summary.get("stress_score", 0),
            ai_risk_level=summary.get("ai_risk_level", "NORMAL"),
        )

        trend = db_service.list_patient_sessions(supabase, patient_id=patient_key, limit=365)
        trend_analysis = trend_analysis_service.analyze_sessions(trend, days=14)
        return {
            "session_id": saved.get("id"),
            "message": "Session saved successfully",
            "sample_count": len(samples),
            "patient_id": patient_key,
            "long_term_trend": trend_analysis,
        }
    except Exception as e:
        return JSONResponse(content={"error": f"Failed to save session: {e}"}, status_code=500)


@router.get("/api/vitals/long-term-trend")
async def get_long_term_trend(patient_id: str = Query(..., min_length=1), days: int = 7):
    """Return daily aggregation and long-term trend analysis for a patient."""
    try:
        supabase = get_supabase_client()
        sessions = db_service.list_patient_sessions(supabase, patient_id=patient_id, limit=365)
        analysis = trend_analysis_service.analyze_sessions(sessions, days=days)
        return {
            "patient_id": patient_id,
            "analysis": analysis,
        }
    except Exception as e:
        return JSONResponse(content={"error": f"Failed to analyze long-term trend: {e}"}, status_code=500)


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
