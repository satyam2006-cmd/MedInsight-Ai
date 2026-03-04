from google import genai
from google.genai import types
import json
import re
import time
import asyncio
from .config import settings
from .schemas import AnalysisResponse
from .services.translation_service import translation_service
from .services.rag_service import rag_service
import logging

logger = logging.getLogger(__name__)

class AIEngine:
    """Interfaces with Google Gemini LLM using the new google-genai package with RAG support"""
    
    def __init__(self):
        if not settings.GEMINI_API_KEY:
            logger.warning("GEMINI_API_KEY not found in environment variables.")
            self.client = None
        else:
            self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
            self.model_id = settings.GEMINI_MODEL
            logger.info(f"AIEngine initialized with {self.model_id} using google-genai client")

    async def analyze_medical_document(self, file_content: bytes, mime_type: str, target_language: str = "Hindi", extracted_text: str = None) -> AnalysisResponse:
        """Performs analysis using extracted text and RAG context"""
        if not self.client:
            raise Exception("Gemini client not initialized. Check API Key.")
        
        try:
            # Retrieve grounding context via RAG
            rag_context = ""
            if extracted_text:
                rag_context = rag_service.retrieve_context(extracted_text)
                logger.info("Retrieved RAG context for grounding.")

            # Base prompt for the AI
            prompt_instr = f"""
            You are an expert medical communicator. 
            Analyze the following medical content and provide patient-friendly insights.
            
            {"USE THE FOLLOWING MEDICAL CONTEXT AS A REFERENCE FOR NORMAL RANGES AND DEFINITIONS:" if rag_context else ""}
            {rag_context}
            
            STRICT RULES:
            1. NO DIAGNOSIS. Use phrases like "The report indicates..." or "This finding is often associated with...".
            2. NO TREATMENT RECOMMENDATIONS.
            3. NO HALLUCINATIONS. Only explain what is provided in the content.
            4. Focus on making complex terms easy to understand for a layperson.
            5. Provide a summary in simple English. At the very beginning of the summary, explicitly state the risk level using these terms:
               - If High: "This report contains findings that are Worrying/Alert."
               - If Medium: "This report contains findings that are an Alert (Moderate concern)."
               - If Low: "This report indicates findings that are Low Tension / Low Risk."
            6. Provide a placeholder field "translated_summary" which MUST be an empty string for now.
            7. Highlight key findings and potential health concerns (non-diagnostic).
            8. Determine Risk Level: Low, Medium, or High.
               High -> critical values, malignant, urgent, severe abnormalities
               Medium -> mild or moderate abnormalities
               Low -> mostly normal
            
            OUTPUT FORMAT:
            You MUST return valid JSON matching this schema:
            {{
              "summary": "Simple explanation here",
              "hindi_translation": "",
              "risk_level": "Low/Medium/High",
              "key_findings": ["Finding 1", "Finding 2"],
              "potential_concerns": ["Concern 1", "Concern 2"],
              "medical_entities": {{
                "symptoms": ["symptom 1"],
                "medications": ["medication 1"],
                "vital_signs": ["vital sign 1"]
              }}
            }}
            """

            if extracted_text and extracted_text.strip():
                logger.info(f"Performing AI analysis. Language: {target_language}. Using Model: {self.model_id}")
                print(f"DEBUG: Using model '{self.model_id}' for analysis")
                full_prompt = f"{prompt_instr}\n\nMEDICAL CONTENT TO ANALYZE:\n{extracted_text}"
                
                response = await self._generate_content_with_retry(
                    contents=full_prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json"
                    )
                )
            else:
                # Fallback to multimodal if no text extracted (though we prefer OCR now)
                logger.info("Performing MULTIMODAL AI analysis (fallback).")
                response = await self._generate_content_with_retry(
                    contents=[
                        types.Part.from_bytes(data=file_content, mime_type=mime_type),
                        prompt_instr
                    ],
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json"
                    )
                )
            
            # Clean response text and parse JSON
            raw_text = response.text
            json_match = re.search(r'\{.*\}', raw_text, re.DOTALL)
            if json_match:
                json_data = json.loads(json_match.group())
            else:
                json_data = json.loads(raw_text)

            # Translation handle
            summary_en = json_data.get("summary", "")
            if summary_en and target_language.lower() != 'english':
                translated = translation_service.translate_text(summary_en, target_language)
                json_data["hindi_translation"] = translated
                
                if "key_findings" in json_data:
                    json_data["key_findings"] = [
                        translation_service.translate_text(f, target_language) 
                        for f in json_data["key_findings"]
                    ]
                if "potential_concerns" in json_data:
                    json_data["potential_concerns"] = [
                        translation_service.translate_text(c, target_language) 
                        for c in json_data["potential_concerns"]
                    ]
            else:
                json_data["hindi_translation"] = summary_en

            return AnalysisResponse(**json_data)

        except Exception as e:
            logger.error(f"AI analysis failed: {str(e)}")
            raise Exception(f"Failed to analyze medical document: {str(e)}")

    async def _generate_content_with_retry(self, contents, config, max_retries=3):
        """Helper to call Gemini with exponential backoff on 429 errors"""
        for i in range(max_retries):
            try:
                # The google-genai client models.generate_content is synchronous
                # We use it directly but wrap the entire method in async
                return self.client.models.generate_content(
                    model=self.model_id,
                    contents=contents,
                    config=config
                )
            except Exception as e:
                err_msg = str(e).lower()
                # Check for 429 status code or 'rate limit' in error message
                if ("429" in err_msg or "rate limit" in err_msg) and i < max_retries - 1:
                    wait_time = (2 ** i) + 2  # 2, 4, 6 seconds
                    logger.warning(f"Gemini Rate Limit hit. Retrying in {wait_time}s... (Attempt {i+1}/{max_retries})")
                    await asyncio.sleep(wait_time)
                    continue
                raise e

ai_engine = AIEngine()
