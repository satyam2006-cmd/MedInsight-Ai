import logging
import re

logger = logging.getLogger(__name__)

class RAGService:
    """
    Lightweight keyword-based retrieval for medical grounding.
    Optimized for Render's 512MB RAM limit by avoiding heavy models like SentenceTransformers/Torch.
    """

    def __init__(self):
        # Initial seed items (knowledge base)
        self.kb_content = [
            "Normal Hemoglobin (Hb) levels: Men: 13.5-17.5 g/dL, Women: 12.0-15.5 g/dL. Low levels may indicate anemia.",
            "Normal fasting blood sugar: 70-99 mg/dL. Prediabetes: 100-125 mg/dL. Diabetes: 126 mg/dL or higher.",
            "Total Cholesterol: Desirable: <200 mg/dL. Borderline high: 200-239 mg/dL. High: >=240 mg/dL.",
            "Blood Pressure: Normal: <120/80 mmHg. Elevated: 120-129/<80 mmHg. Hypertension Stage 1: 130-139/80-89 mmHg.",
            "HBA1c levels: Normal: <5.7%. Prediabetes: 5.7%-6.4%. Diabetes: >=6.5%.",
            "Platelet Count: Normal range is 150,000 to 450,000 platelets per microliter of blood.",
            "Bilirubin: Normal total bilirubin is typically 0.1 to 1.2 mg/dL."
        ]
        logger.info("RAGService (Lightweight Mode) initialized.")

    def seed_knowledge_base(self, docs):
        """Adds more documents to the knowledge base."""
        if docs:
            self.kb_content.extend(docs)

    def retrieve_context(self, query: str, top_k: int = 2) -> str:
        """
        Retrieves relevant medical context using keyword overlap.
        Extremely memory efficient.
        """
        if not query or not self.kb_content:
            return ""

        try:
            # Simple keyword extraction (ignore short stop words)
            keywords = set(re.findall(r'\b\w{4,}\b', query.lower()))
            
            scored_docs = []
            for doc in self.kb_content:
                doc_lower = doc.lower()
                # Count how many query keywords appear in the document
                score = sum(1 for kw in keywords if kw in doc_lower)
                if score > 0:
                    scored_docs.append((score, doc))
            
            # Sort by score and take top_k
            scored_docs.sort(key=lambda x: x[0], reverse=True)
            results = [doc for score, doc in scored_docs[:top_k]]
            
            if results:
                logger.info(f"Retrieved {len(results)} relevant medical context items via keywords.")
                return "\n".join(results)
            return ""
            
        except Exception as e:
            logger.error(f"Lightweight RAG retrieval failed: {str(e)}")
            return ""

rag_service = RAGService()
