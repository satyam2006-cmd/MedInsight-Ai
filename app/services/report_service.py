"""
PDF Report Generator for Vitals Monitoring Sessions.
Uses reportlab to generate a highly professional, clinical-LaTeX-style PDF report.
"""
import io
import time
from typing import Dict, Any

try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch, mm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether, Image
    from reportlab.lib.enums import TA_CENTER, TA_LEFT
    HAS_REPORTLAB = True
except ImportError:
    HAS_REPORTLAB = False

try:
    import plotly.graph_objects as go
    from plotly.subplots import make_subplots
    HAS_PLOTLY = True
except ImportError:
    HAS_PLOTLY = False


def _generate_plotly_chart(session_data: Dict[str, Any]) -> bytes:
    if not HAS_PLOTLY:
        return None
    
    hr_trend = session_data.get('hr_trend') or []
    resp_trend = session_data.get('resp_trend') or []
    spo2_trend = session_data.get('spo2_trend') or []
    
    if not hr_trend and not resp_trend and not spo2_trend:
        return None
        
    fig = make_subplots(
        rows=3, cols=1, 
        shared_xaxes=True, 
        vertical_spacing=0.08,
        subplot_titles=("Heart Rate (BPM)", "Respiration Rate (RPM)", "Oxygen Saturation (SpO₂ %)")
    )
    
    # 1. Heart Rate
    if hr_trend:
        start_time = hr_trend[0][0]
        x_hr = [t[0] - start_time for t in hr_trend]
        y_hr = [t[1] for t in hr_trend]
        fig.add_trace(
            go.Scatter(
                x=x_hr, y=y_hr, 
                mode='lines+markers', 
                name='Heart Rate', 
                line=dict(color='#ff6b8a', width=2),
                marker=dict(size=3)
            ),
            row=1, col=1
        )
        
    # 2. Respiration Rate
    if resp_trend:
        start_time = resp_trend[0][0] if resp_trend else (hr_trend[0][0] if hr_trend else 0)
        x_rr = [t[0] - start_time for t in resp_trend]
        y_rr = [t[1] for t in resp_trend]
        fig.add_trace(
            go.Scatter(
                x=x_rr, y=y_rr, 
                mode='lines+markers', 
                name='Respiration Rate', 
                line=dict(color='#3b82f6', width=2),
                marker=dict(size=3)
            ),
            row=2, col=1
        )
        
    # 3. SpO2
    if spo2_trend:
        start_time = spo2_trend[0][0] if spo2_trend else (hr_trend[0][0] if hr_trend else 0)
        x_spo2 = [t[0] - start_time for t in spo2_trend]
        y_spo2 = [t[1] for t in spo2_trend]
        fig.add_trace(
            go.Scatter(
                x=x_spo2, y=y_spo2, 
                mode='lines+markers', 
                name='SpO2', 
                line=dict(color='#0ea5e9', width=2),
                marker=dict(size=3)
            ),
            row=3, col=1
        )
        
    fig.update_layout(
        height=380, 
        width=480, 
        title_text="Vitals Signal Telemetry Trends",
        title_font=dict(size=12, family="Helvetica-Bold", color="#0f172a"),
        showlegend=False,
        margin=dict(l=35, r=35, t=40, b=35),
        plot_bgcolor="#f8fafc",
        paper_bgcolor="#ffffff",
    )
    
    fig.update_xaxes(showgrid=True, gridcolor='#e2e8f0', linecolor='#cbd5e1', tickfont=dict(size=7))
    fig.update_yaxes(showgrid=True, gridcolor='#e2e8f0', linecolor='#cbd5e1', tickfont=dict(size=7))
    fig.update_xaxes(title_text="Elapsed Time (seconds)", row=3, col=1, title_font=dict(size=8))
    
    return fig.to_image(format="png")


def generate_vitals_report(session_data: Dict[str, Any]) -> bytes:
    """
    Generate a professional LaTeX/clinical style PDF report from a vitals session summary.
    Returns PDF as bytes.
    """
    if not HAS_REPORTLAB:
        raise ImportError("reportlab is not installed. Install with: pip install reportlab")

    buffer = io.BytesIO()
    
    # 20mm margins for LaTeX feel
    doc = SimpleDocTemplate(
        buffer, 
        pagesize=A4,
        topMargin=20 * mm, 
        bottomMargin=20 * mm,
        leftMargin=20 * mm, 
        rightMargin=20 * mm
    )

    styles = getSampleStyleSheet()
    
    # Custom LaTeX/Academic Font Styles
    title_style = ParagraphStyle(
        'Title', 
        parent=styles['Title'],
        fontName='Helvetica-Bold',
        fontSize=20, 
        spaceAfter=4,
        textColor=colors.HexColor('#0f172a'),
        alignment=TA_LEFT
    )
    
    clinic_style = ParagraphStyle(
        'ClinicHeader', 
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10, 
        textColor=colors.HexColor('#475569'),
        alignment=TA_LEFT
    )
    
    meta_style = ParagraphStyle(
        'MetaHeader', 
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9, 
        textColor=colors.HexColor('#64748b'),
        alignment=TA_CENTER,
        spaceAfter=15
    )
    
    section_heading = ParagraphStyle(
        'SectionHeading', 
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=12, 
        textColor=colors.HexColor('#1e293b'),
        spaceBefore=14, 
        spaceAfter=6
    )
    
    table_cell_bold = ParagraphStyle(
        'TableCellBold', 
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        textColor=colors.HexColor('#1e293b')
    )
    
    table_cell = ParagraphStyle(
        'TableCell', 
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        textColor=colors.HexColor('#334155')
    )
    
    normal_style = ParagraphStyle(
        'NormalStyle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#334155')
    )

    elements = []

    # 1. Header (LaTeX Title & Institution info)
    h_details = session_data.get("hospital_details") or {}
    hospital_name = h_details.get("hospital_name") or "MedInsight Clinical AI Platform"
    admin_name = h_details.get("admin_name") or ""
    
    header_data = [
        [
            Paragraph(hospital_name.upper(), clinic_style),
            Paragraph(f"Date: {time.strftime('%Y-%m-%d %H:%M:%S')}", ParagraphStyle('RightText', parent=styles['Normal'], fontName='Helvetica', fontSize=9, alignment=2, textColor=colors.HexColor('#475569')))
        ]
    ]
    header_table = Table(header_data, colWidths=[290, 190])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
    ]))
    
    elements.append(header_table)
    elements.append(Spacer(1, 4))
    elements.append(Paragraph("CLINICAL VITALS SIGNALS REPORT", title_style))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#0f172a'), spaceAfter=10))

    # 2. Patient Demographics & Registry Card (Professional Booktabs Style Table)
    p_id = session_data.get("patient_id") or "N/A"
    p_name = session_data.get("patient_name") or "Anonymous Session"
    p_contact = session_data.get("patient_contact") or "N/A"
    p_lang = session_data.get("language") or "English"

    patient_data = [
        [
            Paragraph("<b>Patient Name:</b>", table_cell), 
            Paragraph(p_name, table_cell_bold),
            Paragraph("<b>Patient ID:</b>", table_cell), 
            Paragraph(p_id, table_cell_bold)
        ],
        [
            Paragraph("<b>Contact No:</b>", table_cell), 
            Paragraph(p_contact, table_cell),
            Paragraph("<b>Target Language:</b>", table_cell), 
            Paragraph(p_lang, table_cell)
        ]
    ]
    
    patient_table = Table(patient_data, colWidths=[90, 150, 90, 150])
    patient_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('PADDING', (0, 0), (-1, -1), 6),
    ]))
    
    elements.append(patient_table)
    elements.append(Spacer(1, 10))

    # 3. Session Stats & Averages Card
    elements.append(Paragraph("Session Summary Statistics", section_heading))
    
    avg_hr = session_data.get('avg_hr') if session_data.get('avg_hr') is not None else 0.0
    avg_rr = session_data.get('avg_rr') if session_data.get('avg_rr') is not None else 0.0
    avg_spo2 = session_data.get('avg_spo2') if session_data.get('avg_spo2') is not None else 0.0
    hrv_sdnn = session_data.get('hrv_sdnn') if session_data.get('hrv_sdnn') is not None else 0.0
    avg_signal_quality = session_data.get('avg_signal_quality') if session_data.get('avg_signal_quality') is not None else 0.0
    session_duration_sec = session_data.get('session_duration_sec') if session_data.get('session_duration_sec') is not None else 0.0
    duration_min = session_duration_sec / 60
    
    summary_data = [
        [
            Paragraph("Metric", table_cell_bold),
            Paragraph("Calculated Mean", table_cell_bold),
            Paragraph("Normal Reference", table_cell_bold),
            Paragraph("Diagnostic Status", table_cell_bold)
        ],
        [
            Paragraph("Heart Rate", table_cell),
            Paragraph(f"{avg_hr} BPM", table_cell_bold),
            Paragraph("60 - 100 BPM", table_cell),
            Paragraph("Normal" if 60 <= avg_hr <= 100 else "Attention Required", table_cell)
        ],
        [
            Paragraph("Respiration Rate", table_cell),
            Paragraph(f"{avg_rr} RPM", table_cell_bold),
            Paragraph("12 - 20 RPM", table_cell),
            Paragraph("Normal" if 12 <= avg_rr <= 20 else "Attention Required", table_cell)
        ],
        [
            Paragraph("Oxygen Saturation (SpO₂)", table_cell),
            Paragraph(f"{avg_spo2} %", table_cell_bold),
            Paragraph("95 - 100 %", table_cell),
            Paragraph("Normal" if avg_spo2 >= 95 else "Hypoxia Risk", table_cell)
        ],
        [
            Paragraph("HRV (SDNN)", table_cell),
            Paragraph(f"{hrv_sdnn} ms", table_cell_bold),
            Paragraph("&gt; 50 ms", table_cell),
            Paragraph("Good Variability" if hrv_sdnn >= 50 else "Sub-optimal", table_cell)
        ],
        [
            Paragraph("Signal Integrity", table_cell),
            Paragraph(f"{avg_signal_quality} %", table_cell),
            Paragraph("&gt; 70 %", table_cell),
            Paragraph("High Quality" if avg_signal_quality >= 70 else "Low Quality", table_cell)
        ]
    ]

    summary_table = Table(summary_data, colWidths=[150, 110, 100, 120])
    summary_table.setStyle(TableStyle([
        ('LINEABOVE', (0, 0), (-1, 0), 1.5, colors.HexColor('#0f172a')),
        ('LINEBELOW', (0, 0), (-1, 0), 1.0, colors.HexColor('#0f172a')),
        ('LINEBELOW', (0, 1), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('LINEBELOW', (0, -1), (-1, -1), 1.5, colors.HexColor('#0f172a')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('PADDING', (0, 0), (-1, -1), 5),
    ]))
    
    elements.append(summary_table)
    elements.append(Spacer(1, 10))

    # 3.5. Plotly Trend Chart
    try:
        chart_bytes = _generate_plotly_chart(session_data)
        if chart_bytes:
            chart_stream = io.BytesIO(chart_bytes)
            elements.append(Paragraph("Vitals Signal Telemetry Trends", section_heading))
            elements.append(Image(chart_stream, width=480, height=380))
            elements.append(Spacer(1, 10))
    except Exception as e:
        print(f"Error generating or inserting Plotly chart: {e}")

    # 4. Chronological Vital Signals Log (Align & sample readings over session)
    hr_trend = session_data.get('hr_trend') or []
    resp_trend = session_data.get('resp_trend') or []
    spo2_trend = session_data.get('spo2_trend') or []
    
    readings_list = []
    if hr_trend:
        n = len(hr_trend)
        step = max(1, n // 10)  # Sample up to 10 points to fit beautifully
        selected_hr = hr_trend[::step][:10]
        
        def get_nearest(timestamp, trend_list, default_val=0.0):
            if not trend_list:
                return default_val
            best_val = default_val
            min_dist = float('inf')
            for t, val in trend_list:
                dist = abs(t - timestamp)
                if dist < min_dist:
                    min_dist = dist
                    best_val = val
            return best_val

        start_time = hr_trend[0][0]
        for t, hr_val in selected_hr:
            offset_sec = int(t - start_time)
            offset_str = f"+{offset_sec // 60:02d}:{offset_sec % 60:02d}"
            rr_val = get_nearest(t, resp_trend, avg_rr)
            spo2_val = get_nearest(t, spo2_trend, avg_spo2)
            
            readings_list.append([
                Paragraph(offset_str, table_cell),
                Paragraph(f"{hr_val:.1f} BPM", table_cell_bold),
                Paragraph(f"{rr_val:.1f} RPM", table_cell),
                Paragraph(f"{spo2_val:.1f} %", table_cell)
            ])

    if readings_list:
        elements.append(Paragraph("Chronological Signals Sample Registry", section_heading))
        readings_header = [
            [
                Paragraph("Time Elapsed", table_cell_bold),
                Paragraph("Heart Rate", table_cell_bold),
                Paragraph("Respiration Rate", table_cell_bold),
                Paragraph("Oxygen Saturation", table_cell_bold)
            ]
        ]
        readings_table_data = readings_header + readings_list
        readings_table = Table(readings_table_data, colWidths=[120, 120, 120, 120])
        readings_table.setStyle(TableStyle([
            ('LINEABOVE', (0, 0), (-1, 0), 1.2, colors.HexColor('#475569')),
            ('LINEBELOW', (0, 0), (-1, 0), 0.8, colors.HexColor('#475569')),
            ('LINEBELOW', (0, 1), (-1, -1), 0.5, colors.HexColor('#f1f5f9')),
            ('LINEBELOW', (0, -1), (-1, -1), 1.2, colors.HexColor('#475569')),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('PADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(readings_table)
        elements.append(Spacer(1, 10))

    # 5. Clinical Diagnostics Summary Section
    ai_summary_text = session_data.get('ai_summary', '')
    if ai_summary_text:
        ai_elements = []
        ai_elements.append(Paragraph("Clinical Diagnostics Summary", section_heading))
        
        # Clinical card box styling
        parsed_paragraphs = []
        lines = ai_summary_text.split('\n')
        for line in lines:
            line = line.strip()
            if not line:
                continue
            if line.startswith('##'):
                text = line.replace('##', '').strip()
                parsed_paragraphs.append(Paragraph(f"<b>{text}</b>", ParagraphStyle('Sub', parent=normal_style, fontName='Helvetica-Bold', fontSize=9.5, spaceBefore=4, spaceAfter=2)))
            elif line.startswith('-') or line.startswith('*'):
                text = line[1:].strip()
                parsed_paragraphs.append(Paragraph(f"• {text}", ParagraphStyle('Bullet', parent=normal_style, leftIndent=12, spaceAfter=2)))
            else:
                parsed_paragraphs.append(Paragraph(line, ParagraphStyle('Text', parent=normal_style, spaceAfter=4)))

        # Create elegant visual panel with thick left border
        card_table_data = [[Spacer(1, 1), parsed_paragraphs]]
        card_table = Table(card_table_data, colWidths=[6, 474])
        card_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
            ('LINELEFT', (0, 0), (0, -1), 3, colors.HexColor('#0f172a')),
            ('BOX', (1, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('LEFTPADDING', (0, 0), (0, -1), 0),
            ('RIGHTPADDING', (0, 0), (0, -1), 0),
            ('TOPPADDING', (0, 0), (0, -1), 0),
            ('BOTTOMPADDING', (0, 0), (0, -1), 0),
            ('PADDING', (1, 0), (-1, -1), 8),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        
        ai_elements.append(card_table)
        elements.append(KeepTogether(ai_elements))

    # 6. Long-term trend section
    long_term = session_data.get('long_term_trend') or {}
    if long_term:
        trend_elements = []
        trend_elements.append(Spacer(1, 10))
        trend_elements.append(Paragraph("Long-Term Health Trend Analysis", section_heading))
        status = long_term.get('trend_status', 'STABLE')
        indicator = long_term.get('trend_indicator', 'Stable trend')
        summary = long_term.get('summary', 'No long-term summary available.')
        rules = long_term.get('abnormal_rules_triggered', [])
        warning = long_term.get('ai_warning', '')

        trend_paragraphs = [
            Paragraph(f"<b>Trend Status:</b> {status} | <b>Indicator:</b> {indicator}", normal_style),
            Paragraph(summary, normal_style)
        ]

        if rules:
            for rule in rules:
                trend_paragraphs.append(Paragraph(f"• Detected Pattern: {rule}", ParagraphStyle('LongTrendBullet', parent=normal_style, leftIndent=12, spaceAfter=2)))

        if warning:
            trend_paragraphs.append(Spacer(1, 4))
            trend_paragraphs.append(Paragraph(
                f"<b>Clinical Suggestion:</b> {warning}",
                ParagraphStyle('LongTrendWarn', parent=normal_style, fontName='Helvetica-Bold', textColor=colors.HexColor('#9f1239')),
            ))

        card_trend_data = [[Spacer(1, 1), trend_paragraphs]]
        card_trend = Table(card_trend_data, colWidths=[6, 474])
        card_trend.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#fff1f2') if status != 'STABLE' else colors.HexColor('#f8fafc')),
            ('LINELEFT', (0, 0), (0, -1), 3, colors.HexColor('#be123c') if status != 'STABLE' else colors.HexColor('#475569')),
            ('BOX', (1, 0), (-1, -1), 0.5, colors.HexColor('#ffe4e6') if status != 'STABLE' else colors.HexColor('#e2e8f0')),
            ('LEFTPADDING', (0, 0), (0, -1), 0),
            ('RIGHTPADDING', (0, 0), (0, -1), 0),
            ('TOPPADDING', (0, 0), (0, -1), 0),
            ('BOTTOMPADDING', (0, 0), (0, -1), 0),
            ('PADDING', (1, 0), (-1, -1), 8),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        
        trend_elements.append(card_trend)
        elements.append(KeepTogether(trend_elements))

    # 7. Clinical Alerts History
    alerts = session_data.get('alerts', [])
    if alerts:
        alert_elements = []
        alert_elements.append(Spacer(1, 10))
        alert_elements.append(Paragraph("Clinical Triggered Alerts Log", section_heading))
        alert_data = [[
            Paragraph("Timestamp Offset", table_cell_bold),
            Paragraph("Triggered Vital Warning Signal", table_cell_bold)
        ]]
        for ts, alert in alerts:
            t_str = time.strftime('%H:%M:%S', time.localtime(ts))
            alert_data.append([
                Paragraph(t_str, table_cell),
                Paragraph(alert, ParagraphStyle('AlertText', parent=normal_style, textColor=colors.HexColor('#be123c'), fontName='Helvetica-Bold'))
            ])
        alert_table = Table(alert_data, colWidths=[180, 300])
        alert_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#fef2f2')),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#fee2e2')),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#fca5a5')),
            ('PADDING', (0, 0), (-1, -1), 5),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        alert_elements.append(alert_table)
        elements.append(KeepTogether(alert_elements))

    # Footer Disclaimer
    elements.append(Spacer(1, 15))
    elements.append(HRFlowable(width="100%", thickness=0.8, color=colors.HexColor('#cbd5e1')))
    elements.append(Spacer(1, 6))
    elements.append(Paragraph(
        "<b>DISCLAIMER:</b> This vitals telemetry analysis report was auto-generated by the MedInsight System. "
        "The estimated metrics are based on digital video photoplethysmography (PPG) and should not be used as a primary "
        "basis for diagnostic or medical decisions. Please consult a qualified clinical professional for precise diagnostic evaluations.",
        ParagraphStyle('Disclaimer', parent=normal_style, fontSize=7.5, leading=10, textColor=colors.HexColor('#94a3b8'), alignment=TA_CENTER)
    ))

    doc.build(elements)
    return buffer.getvalue()


def build_clinical_summary_sentence(summary: dict) -> str:
    avg_hr = round(summary.get('avg_hr') if summary.get('avg_hr') is not None else 0.0, 1)
    avg_rr = round(summary.get('avg_rr') if summary.get('avg_rr') is not None else 0.0, 1)
    avg_spo2 = round(summary.get('avg_spo2') if summary.get('avg_spo2') is not None else 0.0, 1)
    hrv = round(summary.get('hrv_sdnn') if summary.get('hrv_sdnn') is not None else 0.0, 1)
    quality = round(summary.get('avg_signal_quality') if summary.get('avg_signal_quality') is not None else 0.0, 1)
    
    duration_sec = round(summary.get('session_duration_sec') if summary.get('session_duration_sec') is not None else 0.0)
    if duration_sec < 60:
        duration_phrase = f"{duration_sec}-second"
    else:
        mins = duration_sec // 60
        secs = duration_sec % 60
        if secs == 0:
            duration_phrase = f"{mins}-minute"
        else:
            duration_phrase = f"{mins}-minute {secs}-second"
            
    alert_count = len(summary.get('alerts', []))
    
    abnormalities = []
    hr_status = "normal"
    if avg_hr < 60 or avg_hr > 100:
        hr_status = "abnormal"
        abnormalities.append("heart rate")
        
    rr_status = "normal"
    if avg_rr < 12 or avg_rr > 20:
        rr_status = "abnormal"
        abnormalities.append("respiration rate")
        
    spo2_status = "normal"
    if avg_spo2 < 95:
        spo2_status = "abnormal"
        abnormalities.append("peripheral oxygen saturation (SpO2)")
        
    if not abnormalities:
        vitals_status_phrase = "vital signs were within normal limits"
    else:
        if len(abnormalities) == 1:
            vitals_status_phrase = f"vital signs were largely within normal limits, with the exception of {abnormalities[0]}"
        else:
            vitals_status_phrase = f"vital signs showed abnormalities in {', '.join(abnormalities[:-1])} and {abnormalities[-1]}"
            
    hrv_phrase = "good" if hrv >= 50 else "sub-optimal"
    
    if avg_spo2 < 95:
        spo2_detail = f"However, the average SpO2 was {avg_spo2}%, which is below the normal threshold of >95%, indicating mild hypoxemia."
    else:
        spo2_detail = f"The average SpO2 was {avg_spo2}%, which is within the normal threshold of >95%."
        
    quality_phrase = "high" if quality >= 70 else "low"
    reliability_phrase = "supporting high data reliability" if quality >= 70 else "and may impact the reliability of the recorded data"
    
    if alert_count == 0:
        alerts_phrase = "No high-level alerts were triggered."
    else:
        alerts_phrase = f"{alert_count} high-level alerts were triggered during the session."
        
    sentence = (
        f"During a {duration_phrase} remote monitoring session, {vitals_status_phrase}. "
        f"Average heart rate ({avg_hr} BPM) was {hr_status} and respiration rate ({avg_rr} RPM) was {rr_status}. "
        f"Heart rate variability (SDNN {hrv} ms) was {hrv_phrase}. "
        f"{spo2_detail} "
        f"Signal quality was {quality}%, which is {quality_phrase} {reliability_phrase}. "
        f"{alerts_phrase}"
    )
    return sentence
