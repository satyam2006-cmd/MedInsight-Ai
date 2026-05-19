import os
import sys

# Add current directory to python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.report_service import generate_vitals_report

session_data = {
    "patient_id": "Pt - test2",
    "patient_name": "Satyam Bhagat",
    "patient_contact": "7620548131",
    "language": "Hindi",
    "session_duration_sec": 42.0,
    "avg_hr": 55.2,
    "avg_rr": 10.9,
    "avg_spo2": 93.9,
    "hrv_sdnn": 194.2,
    "avg_signal_quality": 35.0,
    "hr_trend": [(1715950000 + i, 55.2 + i % 2) for i in range(10)],
    "resp_trend": [(1715950000 + i, 10.9 + i % 2) for i in range(10)],
    "spo2_trend": [(1715950000 + i, 93.9 + i % 2) for i in range(10)],
    "ai_summary": "During a 42-second remote monitoring session, vital signs showed abnormalities in heart rate, respiration rate and peripheral oxygen saturation (SpO2). Average heart rate (55.2 BPM) and respiration rate (10.9 RPM) were abnormal. Heart rate variability (SDNN 194.2 ms) was good. However, the average SpO2 was 93.9%, which is below the normal threshold of >95%, indicating mild hypoxemia. Signal quality was 35.0%, which is low and may impact the reliability of the recorded data. 2 high-level alerts were triggered during the session.",
    "ai_summary_translated": "42-सेकंड के रिमोट मॉनिटरिंग सत्र के दौरान, महत्वपूर्ण संकेतों ने हृदय गति, श्वसन दर और परिधीय ऑक्सीजन संतृप्ति (SpO2) में असामान्यताओं को दिखाया। औसत हृदय गति (55.2 BPM) और श्वसन दर (10.9 RPM) असामान्य थीं। हृदय गति परिवर्तनशीलता (SDNN 194.2 ms) अच्छी थी। हालांकि, औसत SpO2 93.9% था, जो >95% की सामान्य सीमा से नीचे है, जो हल्के हाइपोक्सिमिया का संकेत देता है। सिग्नल की गुणवत्ता 35.0% थी, जो कम है और रिकॉर्ड किए गए डेटा की विश्वसनीयता को प्रभावित कर सकती है। सत्र के दौरान 2 उच्च-स्तरीय अलर्ट ट्रिगर किए गए।",
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
