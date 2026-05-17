import os
import sys

# Add current directory to python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.report_service import generate_vitals_report

session_data = {
    "patient_id": "Pt - test2",
    "patient_name": "Satyam Bhagat",
    "patient_contact": "7620548131",
    "language": "English",
    "session_duration_sec": 42.0,
    "avg_hr": 55.2,
    "avg_rr": 10.9,
    "avg_spo2": 93.9,
    "hrv_sdnn": 194.2,
    "avg_signal_quality": 35.0,
    "hr_trend": [(1715950000 + i, 55.2 + i % 2) for i in range(10)],
    "resp_trend": [(1715950000 + i, 10.9 + i % 2) for i in range(10)],
    "spo2_trend": [(1715950000 + i, 93.9 + i % 2) for i in range(10)],
    "ai_summary": "Remote monitoring session data indicate mild bradycardia (average heart rate 55.2 BPM), mild bradypnea (average respiration rate 10.9 RPM), and mild hypoxia (average SpO2 93.9%). Heart Rate Variability (SDNN 194.2 ms) is preserved. The reliability of these readings is limited by a low signal quality (35.0%) and brief session duration (0.7 minutes). Further clinical assessment or repeat monitoring with improved signal integrity is advised.",
    "long_term_trend": {
        "trend_status": "STABLE",
        "trend_indicator": "Stable trend",
        "summary": "The patient's vital signals remain consistent with baseline metrics.",
        "abnormal_rules_triggered": ["Mild Bradycardia detected"],
        "ai_warning": "Monitor patient heart rate closely during rest."
    },
    "alerts": [
        (1715950010, "SpO2 dropped below 94%"),
        (1715950020, "Mild bradycardia alert")
    ],
    "hospital_details": {
        "hospital_name": "MedInsight Clinical AI Platform",
        "admin_name": "Dr. AI Assistant"
    }
}

print("Running generate_vitals_report...")
try:
    pdf_bytes = generate_vitals_report(session_data)
    print(f"Success! Generated PDF of size: {len(pdf_bytes)} bytes")
except Exception as e:
    import traceback
    traceback.print_exc()
    sys.exit(1)
