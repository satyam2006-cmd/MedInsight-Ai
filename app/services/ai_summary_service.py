from google import genai
from google.genai import types
import json
import logging
import asyncio
from typing import Dict, Any
from ..config import settings

logger = logging.getLogger(__name__)

class AISummaryService:
    """Generates AI health summaries based on vitals data."""
    
    def __init__(self):
        if not settings.GEMINI_API_KEY:
            logger.warning("GEMINI_API_KEY not found. AI Summaries will not be available.")
            self.client = None
        else:
            self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
            self.model_id = settings.GEMINI_MODEL
            logger.info(f"AISummaryService initialized with {self.model_id}")

    async def generate_summary(self, session_data: Dict[str, Any]) -> str:
        """Generates a clinical summary from the session vitals."""
        if not self.client:
            return "AI summary generation currently unavailable (API key missing)."
            
        try:
            prompt = f"""
            You are an expert AI clinical assistant. Based on the following vital signs recorded during a remote monitoring session, generate a concise, medical-style interpretation and recommendation.

            Recorded Vitals:
            - Average Heart Rate: {session_data.get('avg_hr', '--')} BPM (Normal: 60-100)
            - Min Heart Rate: {session_data.get('min_hr', '--')} BPM
            - Max Heart Rate: {session_data.get('max_hr', '--')} BPM
            - Average Respiration Rate: {session_data.get('avg_rr', '--')} RPM (Normal: 12-20)
            - Average SpO2: {session_data.get('avg_spo2', '--')}% (Normal: >95%)
            - HRV (SDNN): {session_data.get('hrv_sdnn', '--')} ms (Normal: >50ms indicates good variability)
            - Signal Quality: {session_data.get('avg_signal_quality', '--')}%
            - Alerts triggered during session: {', '.join([a[1] for a in session_data.get('alerts', [])]) if session_data.get('alerts') else 'None'}
            - Session Duration: {session_data.get('session_duration_sec', 0) / 60:.1f} minutes

            Requirements:
            1. Provide an 'overall patient condition' statement.
            2. Note any possible abnormalities clearly. If all values are normal, state that.
            3. Provide a recommended monitoring advice/action.
            4. Keep the tone professional, objective, and easy to read.
            5. Do NOT provide a definitive diagnosis, use phrases like "indicates", "suggests", or "appears".
            6. Format the output with clear headings: "## AI Health Summary" followed by the evaluation paragraphs, and a "Recommendation:" section at the end.
            """

            logger.info("Requesting AI health summary from Gemini.")
            response = await self._generate_content_with_retry(
                contents=prompt,
                config=types.GenerateContentConfig()
            )
            
            return response.text

        except Exception as e:
            logger.error(f"Failed to generate AI health summary: {e}")
            return "Error generating AI health summary. Please review vitals manually."

    async def _generate_content_with_retry(self, contents, config, max_retries=3):
        for i in range(max_retries):
            try:
                # The google-genai client models.generate_content is synchronous natively,
                # but depending on setup it might block. Wrapping in asyncio just in case
                # it's called in an event loop or we use async versions if available in the future.
                # Currently using the sync call as shown in existing ai_engine.py
                return self.client.models.generate_content(
                    model=self.model_id,
                    contents=contents,
                    config=config
                )
            except Exception as e:
                err_msg = str(e).lower()
                if ("429" in err_msg or "rate limit" in err_msg) and i < max_retries - 1:
                    wait_time = (2 ** i) + 2
                    logger.warning(f"Gemini Rate Limit hit. Retrying in {wait_time}s... (Attempt {i+1}/{max_retries})")
                    await asyncio.sleep(wait_time)
                    continue
                raise e

ai_summary_service = AISummaryService()
