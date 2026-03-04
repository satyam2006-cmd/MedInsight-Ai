import logging
import numpy as np

logger = logging.getLogger(__name__)

class RAGService:
    """Handles Retrieval-Augmented Generation using FAISS and SentenceTransformers."""

    def __init__(self):
        self._model = None
        self.index = None
        self.kb_content = []
        # Initial seed items
        self.seed_texts = [
            "Normal Hemoglobin (Hb) levels: Men: 13.5-17.5 g/dL, Women: 12.0-15.5 g/dL. Low levels may indicate anemia.",
            "Normal fasting blood sugar: 70-99 mg/dL. Prediabetes: 100-125 mg/dL. Diabetes: 126 mg/dL or higher.",
            "Total Cholesterol: Desirable: <200 mg/dL. Borderline high: 200-239 mg/dL. High: >=240 mg/dL.",
            "Blood Pressure: Normal: <120/80 mmHg. Elevated: 120-129/<80 mmHg. Hypertension Stage 1: 130-139/80-89 mmHg.",
            "HBA1c levels: Normal: <5.7%. Prediabetes: 5.7%-6.4%. Diabetes: >=6.5%.",
            "Platelet Count: Normal range is 150,000 to 450,000 platelets per microliter of blood.",
            "Bilirubin: Normal total bilirubin is typically 0.1 to 1.2 mg/dL."
        ]
        logger.info("RAGService initialized (Lazy Loading Enabled).")

    def _get_model(self):
        """Lazy-loads the SentenceTransformer model."""
        if self._model is None:
            try:
                from sentence_transformers import SentenceTransformer
                logger.info("Initial loading of SentenceTransformer model (this may take a moment)...")
                self._model = SentenceTransformer('all-MiniLM-L6-v2')
                # Initialize index with seed data once model is ready
                self._initialize_index()
            except Exception as e:
                logger.error(f"Failed to load SentenceTransformer: {str(e)}")
        return self._model

    def _initialize_index(self):
        """Hidden initialization after model is loaded."""
        if not self.kb_content and self.seed_texts:
            self.seed_knowledge_base(self.seed_texts)

    def seed_knowledge_base(self, docs):
        """Indexes a list of documents into the FAISS vector store."""
        model = self._get_model()
        if not docs or not model:
            return
        
        import faiss
        self.kb_content.extend(docs)
        embeddings = model.encode(docs)
        
        dimension = embeddings.shape[1]
        if self.index is None:
            self.index = faiss.IndexFlatL2(dimension)
        
        self.index.add(np.array(embeddings).astype('float32'))

    def retrieve_context(self, query: str, top_k: int = 3) -> str:
        """Retrieves relevant medical context for a given query."""
        model = self._get_model()
        if not model or self.index is None or not query:
            return ""

        try:
            query_vector = model.encode([query])
            distances, indices = self.index.search(np.array(query_vector).astype('float32'), top_k)
            
            context_chunks = []
            for i in indices[0]:
                if i != -1 and i < len(self.kb_content):
                    context_chunks.append(self.kb_content[i])
            
            return "\n".join(context_chunks)
        except Exception as e:
            logger.error(f"RAG retrieval failed: {str(e)}")
            return ""

rag_service = RAGService()
