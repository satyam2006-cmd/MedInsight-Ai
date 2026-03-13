from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from statistics import mean
from typing import Any, Dict, List, Optional


class TrendAnalysisService:
    """Analyzes multi-day vitals and emits preventive health warnings."""

    def aggregate_daily_vitals(self, sessions: List[Dict[str, Any]], days: int = 7) -> List[Dict[str, Any]]:
        if not sessions:
            return []

        days = max(3, min(30, int(days)))
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        buckets: Dict[str, List[Dict[str, float]]] = defaultdict(list)

        for row in sessions:
            ts = row.get("timestamp") or row.get("created_at")
            if not ts:
                continue
            dt = self._parse_ts(ts)
            if not dt or dt < cutoff:
                continue

            date_key = dt.date().isoformat()
            try:
                sample = {
                    "heart_rate": float(row.get("heart_rate", 0) or 0),
                    "respiration_rate": float(row.get("respiration_rate", 0) or 0),
                    "spo2": float(row.get("spo2", 0) or 0),
                    "hrv": float(row.get("hrv", 0) or 0),
                    "stress_score": float(row.get("stress_score", 0) or 0),
                    "ai_risk_level": str(row.get("ai_risk_level", "NORMAL") or "NORMAL").upper(),
                }
            except Exception:
                continue

            buckets[date_key].append(sample)

        daily: List[Dict[str, Any]] = []
        for date_key in sorted(buckets.keys()):
            day_rows = buckets[date_key]
            if not day_rows:
                continue
            risk_counts = {"NORMAL": 0, "WARNING": 0, "CRITICAL": 0}
            for item in day_rows:
                lvl = item["ai_risk_level"]
                if lvl not in risk_counts:
                    lvl = "NORMAL"
                risk_counts[lvl] += 1

            top_risk = max(risk_counts, key=lambda key: risk_counts[key])
            daily.append(
                {
                    "date": date_key,
                    "session_count": len(day_rows),
                    "avg_heart_rate": round(mean([x["heart_rate"] for x in day_rows]), 1),
                    "avg_respiration": round(mean([x["respiration_rate"] for x in day_rows]), 1),
                    "avg_spo2": round(mean([x["spo2"] for x in day_rows]), 1),
                    "avg_hrv": round(mean([x["hrv"] for x in day_rows]), 1),
                    "avg_stress": round(mean([x["stress_score"] for x in day_rows]), 1),
                    "dominant_ai_risk": top_risk,
                    "warning_days": risk_counts["WARNING"],
                    "critical_days": risk_counts["CRITICAL"],
                }
            )
        return daily

    def analyze_daily_trends(self, daily_vitals: List[Dict[str, Any]]) -> Dict[str, Any]:
        if not daily_vitals:
            return {
                "trend_status": "STABLE",
                "trend_color": "green",
                "trend_indicator": "Stable trend",
                "abnormal_rules_triggered": [],
                "warning_required": False,
                "ai_warning": "Insufficient long-term data. Keep collecting daily sessions for 7 days.",
                "daily_vitals": [],
            }

        recent = daily_vitals[-14:]
        rules = []

        if self._consecutive_days(recent, "avg_heart_rate", lambda x: x > 100, min_days=3):
            rules.append("Heart rate above 100 BPM for 3+ consecutive days")

        if self._consecutive_days(recent, "avg_spo2", lambda x: x < 94, min_days=3):
            rules.append("SpO2 below 94% across multiple consecutive days")

        if self._monotonic_change(recent, "avg_hrv", direction="decrease", min_days=4):
            rules.append("HRV is decreasing continuously over multiple days")

        if self._monotonic_change(recent, "avg_stress", direction="increase", min_days=4):
            rules.append("Stress score is increasing continuously over multiple days")

        high_rr_days = sum(1 for d in recent if d.get("avg_respiration", 0) > 22 or d.get("avg_respiration", 0) < 10)
        if high_rr_days >= 3:
            rules.append("Respiration trend outside normal range on multiple days")

        concerning_risk_days = sum(1 for d in recent if d.get("dominant_ai_risk") in {"WARNING", "CRITICAL"})
        critical_days = sum(1 for d in recent if d.get("dominant_ai_risk") == "CRITICAL")
        if concerning_risk_days >= 3:
            rules.append("AI risk level repeatedly WARNING/CRITICAL")

        severity = "STABLE"
        if critical_days >= 2 or len(rules) >= 3:
            severity = "MEDICAL ATTENTION ADVISED"
        elif len(rules) >= 1:
            severity = "WATCH LIST"

        color = "green"
        indicator = "Stable"
        if severity == "WATCH LIST":
            color = "yellow"
            indicator = "Concerning pattern detected"
        elif severity == "MEDICAL ATTENTION ADVISED":
            color = "red"
            indicator = "Persistent abnormal pattern detected"

        warning = ""
        if severity == "WATCH LIST":
            warning = (
                "Your recent health data shows early concerning patterns over several days. "
                "Continue monitoring daily and consider medical consultation if this trend persists."
            )
        elif severity == "MEDICAL ATTENTION ADVISED":
            warning = (
                "Your recent health data shows repeated abnormal patterns in vital signs over multiple days. "
                "Please consider visiting a healthcare professional for a medical checkup."
            )

        return {
            "trend_status": severity,
            "trend_color": color,
            "trend_indicator": indicator,
            "abnormal_rules_triggered": rules,
            "warning_required": severity != "STABLE",
            "ai_warning": warning,
            "daily_vitals": recent,
            "summary": self._compose_summary(severity, rules),
        }

    def analyze_sessions(self, sessions: List[Dict[str, Any]], days: int = 7) -> Dict[str, Any]:
        daily = self.aggregate_daily_vitals(sessions, days=days)
        result = self.analyze_daily_trends(daily)
        result["window_days"] = max(3, min(30, int(days)))
        result["days_with_data"] = len(daily)
        return result

    def _compose_summary(self, severity: str, rules: List[str]) -> str:
        if severity == "STABLE":
            return "Long-term trend is stable over the monitored period."
        if not rules:
            return "Concerning multi-day pattern detected."
        return f"Long-term analysis found: {', '.join(rules)}."

    def _parse_ts(self, value: Any) -> Optional[datetime]:
        if isinstance(value, datetime):
            return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        if not isinstance(value, str):
            return None
        text = value.strip()
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        try:
            dt = datetime.fromisoformat(text)
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except Exception:
            return None

    def _consecutive_days(self, series: List[Dict[str, Any]], key: str, condition, min_days: int) -> bool:
        streak = 0
        for row in series:
            value = row.get(key)
            if value is not None and condition(value):
                streak += 1
                if streak >= min_days:
                    return True
            else:
                streak = 0
        return False

    def _monotonic_change(self, series: List[Dict[str, Any]], key: str, direction: str, min_days: int) -> bool:
        values = [float(x.get(key, 0) or 0) for x in series if x.get(key) is not None]
        if len(values) < min_days:
            return False

        streak = 1
        for i in range(1, len(values)):
            if direction == "decrease" and values[i] < values[i - 1]:
                streak += 1
            elif direction == "increase" and values[i] > values[i - 1]:
                streak += 1
            else:
                streak = 1
            if streak >= min_days:
                return True
        return False


trend_analysis_service = TrendAnalysisService()
