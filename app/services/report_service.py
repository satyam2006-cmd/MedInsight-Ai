"""
PDF Report Generator for Vitals Monitoring Sessions.
Uses reportlab to generate a clinical-style PDF report.
"""
import io
import time
from typing import Dict, Any

try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch, mm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether
    from reportlab.lib.enums import TA_CENTER, TA_LEFT
    HAS_REPORTLAB = True
except ImportError:
    HAS_REPORTLAB = False


def generate_vitals_report(session_data: Dict[str, Any]) -> bytes:
    """
    Generate a PDF report from a vitals session summary.
    Returns PDF as bytes.
    """
    if not HAS_REPORTLAB:
        raise ImportError("reportlab is not installed. Install with: pip install reportlab")

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4,
                            topMargin=30 * mm, bottomMargin=20 * mm,
                            leftMargin=20 * mm, rightMargin=20 * mm)

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('Title', parent=styles['Title'],
                                  fontSize=24, spaceAfter=6,
                                  textColor=colors.HexColor('#1a237e'))
    subtitle_style = ParagraphStyle('Subtitle', parent=styles['Normal'],
                                     fontSize=12, textColor=colors.grey,
                                     alignment=TA_CENTER, spaceAfter=20)
    heading_style = ParagraphStyle('Heading', parent=styles['Heading2'],
                                    fontSize=14, textColor=colors.HexColor('#283593'),
                                    spaceBefore=16, spaceAfter=8)
    normal_style = styles['Normal']

    elements = []

    # Header
    elements.append(Paragraph("MedInsight AI — Vitals Report", title_style))
    elements.append(Paragraph(f"Generated: {time.strftime('%Y-%m-%d %H:%M:%S')}", subtitle_style))
    elements.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#1a237e')))
    elements.append(Spacer(1, 12))

    # Session Overview
    elements.append(Paragraph("Session Overview", heading_style))
    duration_min = session_data.get('session_duration_sec', 0) / 60
    overview_data = [
        ['Duration', f"{duration_min:.1f} minutes"],
        ['Signal Quality', f"{session_data.get('avg_signal_quality', 0)}%"],

    ]
    overview_table = Table(overview_data, colWidths=[150, 300])
    overview_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#e8eaf6')),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#c5cae9')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('PADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(overview_table)
    elements.append(Spacer(1, 16))

    # Vital Signs
    elements.append(Paragraph("Vital Signs", heading_style))
    vitals_data = [
        ['Metric', 'Value', 'Normal Range'],
        ['Heart Rate', f"{session_data.get('avg_hr', 0)} BPM", '60-100 BPM'],
        ['Min Heart Rate', f"{session_data.get('min_hr', 0)} BPM", '—'],
        ['Max Heart Rate', f"{session_data.get('max_hr', 0)} BPM", '—'],
        ['Respiration Rate', f"{session_data.get('avg_rr', 0)} RPM", '12-20 RPM'],
        ['SpO₂ (Est.)', f"{session_data.get('avg_spo2', 0)} %", '95-100 %'],
        ['HRV (SDNN)', f"{session_data.get('hrv_sdnn', 0)} ms", '>50 ms'],
    ]
    vitals_table = Table(vitals_data, colWidths=[150, 150, 150])
    vitals_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a237e')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#c5cae9')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('PADDING', (0, 0), (-1, -1), 8),
        ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
    ]))
    elements.append(vitals_table)
    elements.append(Spacer(1, 16))

    # Alerts
    alerts = session_data.get('alerts', [])
    if alerts:
        elements.append(Paragraph("Alert History", heading_style))
        alert_data = [['Time', 'Alert']]
        for ts, alert in alerts:
            t_str = time.strftime('%H:%M:%S', time.localtime(ts))
            alert_data.append([t_str, alert])
        alert_table = Table(alert_data, colWidths=[100, 350])
        alert_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#c62828')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#ef9a9a')),
            ('PADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(alert_table)
    else:
        elements.append(Paragraph("Alert History", heading_style))
        elements.append(Paragraph("No alerts recorded during this session.", normal_style))

    elements.append(Spacer(1, 16))

    # AI Health Summary Section
    ai_summary_text = session_data.get('ai_summary', '')
    if ai_summary_text:
        ai_elements = []
        ai_elements.append(Paragraph("AI Health Summary", heading_style))
        ai_elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#e8eaf6')))
        ai_elements.append(Spacer(1, 8))
        
        # Simple parsing of the markdown-like output from AI
        lines = ai_summary_text.split('\n')
        for line in lines:
            line = line.strip()
            if not line:
                continue
            if line.startswith('##'):
                # Treat as subheading
                text = line.replace('##', '').strip()
                ai_elements.append(Paragraph(f"<b>{text}</b>", ParagraphStyle('Sub', parent=normal_style, spaceAfter=6, spaceBefore=6)))
            elif line.startswith('-') or line.startswith('*'):
                text = line[1:].strip()
                ai_elements.append(Paragraph(f"• {text}", ParagraphStyle('Bullet', parent=normal_style, leftIndent=15, spaceAfter=4)))
            else:
                ai_elements.append(Paragraph(line, ParagraphStyle('Text', parent=normal_style, spaceAfter=8)))
                
        elements.append(KeepTogether(ai_elements))

    # Long-term trend section
    long_term = session_data.get('long_term_trend') or {}
    if long_term:
        elements.append(Spacer(1, 14))
        elements.append(Paragraph("Long-Term Health Trend Analysis", heading_style))
        status = long_term.get('trend_status', 'STABLE')
        indicator = long_term.get('trend_indicator', 'Stable trend')
        summary = long_term.get('summary', 'No long-term summary available.')
        rules = long_term.get('abnormal_rules_triggered', [])
        warning = long_term.get('ai_warning', '')

        elements.append(Paragraph(f"<b>Trend Status:</b> {status}", normal_style))
        elements.append(Paragraph(f"<b>Indicator:</b> {indicator}", normal_style))
        elements.append(Paragraph(summary, normal_style))

        if rules:
            elements.append(Spacer(1, 6))
            elements.append(Paragraph("<b>Detected Patterns:</b>", normal_style))
            for rule in rules:
                elements.append(Paragraph(f"• {rule}", ParagraphStyle('LongTrendBullet', parent=normal_style, leftIndent=15, spaceAfter=3)))

        if warning:
            elements.append(Spacer(1, 6))
            elements.append(Paragraph(
                f"<b>Recommendation:</b> {warning}",
                ParagraphStyle('LongTrendWarn', parent=normal_style, textColor=colors.HexColor('#9f1239')),
            ))

    elements.append(Spacer(1, 24))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.grey))
    elements.append(Spacer(1, 8))
    elements.append(Paragraph("This report was auto-generated by MedInsight AI. "
                              "For clinical decisions, consult a healthcare professional.",
                              ParagraphStyle('Disclaimer', parent=normal_style,
                                             fontSize=8, textColor=colors.grey,
                                             alignment=TA_CENTER)))

    doc.build(elements)
    return buffer.getvalue()
