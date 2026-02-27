import google.generativeai as genai
import json
import re
import time
from .config import settings
from .schemas import AnalysisResponse
from .services.translation_service import translation_service
import logging

logger = logging.getLogger(__name__)

class AIEngine:
    """Interfaces with Google Gemini LLM using Multimodal Vision to analyze medical documents"""
    
    def __init__(self):
        if not settings.GEMINI_API_KEY:
            logger.warning("GEMINI_API_KEY not found in environment variables.")
            self.model = None
        else:
            genai.configure(api_key=settings.GEMINI_API_KEY)
            # Switching to 'gemini-flash-latest' (1.5 Flash) to troubleshoot quota issues
            self.model = genai.GenerativeModel('gemini-flash-latest')
            logger.info("AIEngine initialized with gemini-flash-latest")

    async def analyze_medical_document(self, file_content: bytes, mime_type: str, target_language: str = "Hindi", extracted_text: str = None) -> AnalysisResponse:
        """Performs analysis using extracted text if available, otherwise falls back to multimodal"""
        if not self.model:
            raise Exception("Gemini model not initialized. Check API Key.")
        
        try:
            # Base prompt for the AI
            prompt_instr = f"""
            You are an expert medical communicator. 
            Analyze the following medical content and provide patient-friendly insights.
            
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
              "potential_concerns": ["Concern 1", "Concern 2"]
            }}
            """

            if extracted_text and extracted_text.strip():
                logger.info(f"Performing TEXT-ONLY AI analysis. Language: {target_language}")
                full_prompt = f"{prompt_instr}\n\nMEDICAL CONTENT TO ANALYZE:\n{extracted_text}"
                response = self.model.generate_content(
                    full_prompt,
                    generation_config=genai.types.GenerationConfig(
                        response_mime_type="application/json"
                    )
                )
            else:
                logger.info(f"Performing MULTIMODAL AI analysis (fallback). Language: {target_language}")
                # Fallback to vision if no text provided
                response = self.model.generate_content(
                    [
                        {"mime_type": mime_type, "data": file_content},
                        prompt_instr
                    ],
                    generation_config=genai.types.GenerationConfig(
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

            # Use Google Translate for the Hindi/Preferred Translation field
            summary_en = json_data.get("summary", "")
            if summary_en and target_language.lower() != 'english':
                translated = translation_service.translate_text(summary_en, target_language)
                json_data["hindi_translation"] = translated
                
                # Also translate lists
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

            # Validate with Pydantic
            validated_response = AnalysisResponse(**json_data)
            return validated_response

        except Exception as e:
            logger.error(f"AI analysis failed: {str(e)}")
            raise Exception(f"Failed to analyze medical document: {str(e)}")

ai_engine = AIEngine()
