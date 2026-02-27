# MedInsight AI: Medical Document Analyzer

MedInsight AI is a production-ready backend service that leverages OCR and Large Language Models (LLMs) to transform complex medical documents into patient-friendly insights.

## 🚀 Overview

The service accepts medical document uploads (Images or PDFs) and utilizes Google's Gemini 1.5 Flash model's native **Multimodal Vision** capabilities to analyze documents directly, eliminating the need for local OCR binaries.

### Key Features
- **AI-Powered Vision**: Directly processes Images and PDFs without external OCR tools.
- **Language Agnostic**: Natively understands medical documents in various languages.
- **AI Simplification**: Converts medical jargon into plain English.
- **Multilingual Support**: Provides instant Hindi translations for summaries.
- **Safety First**: Implements strict non-diagnostic logic to ensure patient safety.

## 🏗 Architecture

```text
+-------------------+       +-------------------------------+
|   Document Input  | ----> |       Gemini AI Engine        |
| (PDF/JPG/PNG)     |       | (OCR + Analysis + Translation)|
+---------+---------+       +---------------+---------------+
          |                                 |
          v                                 v
  +-------+-------+                 +-------+-------+
  | API (FastAPI) | <-------------- | Structured JSON|
  +---------------+                 +---------------+
```

## 🛠 Tech Stack
- **API**: FastAPI
- **LLM**: Google Generative AI (Gemini 1.5 Flash)
- **Validation**: Pydantic v2
- **Environment**: Python-dotenv
- **Frontend**: React (Neobrutalism Style)

## ⚙️ Setup Instructions

### Prerequisites
- Python 3.9+
- [Google Gemini API Key](https://aistudio.google.com/app/apikey)

### 1. Clone & Install Dependencies
```bash
git clone <repository-url>
cd medinsight-ai
pip install -r requirements.txt
cd frontend && npm install
```

### 2. Configuration
Create a `.env` file in the root:
```env
GEMINI_API_KEY=your_actual_api_key_here
```

### 3. Run the Application
```bash
python -m app.main
```
The server will start at `http://localhost:8000`.

## 📖 API Usage

### Analyze Document
**Endpoint**: `POST /analyze-report`
**Content-Type**: `multipart/form-data`

**Example (curl)**:
```bash
curl -X POST "http://localhost:8000/analyze-report" \
     -H "accept: application/json" \
     -H "Content-Type: multipart/form-data" \
     -F "file=@path/to/your/report.jpg" \
     -F "target_language=Hindi"
```

**Output**:
```json
{
  "summary": "Your blood test shows normal glucose levels...",
  "hindi_translation": "आपकी रक्त जांच में ग्लूकोज का स्तर सामान्य है...",
  "key_findings": ["Glucose: 95 mg/dL", "Hemoglobin: 14.2 g/dL"],
  "potential_concerns": ["None identified based on this report"]
}
```

## ⚖️ Safety & Disclaimer
This service is for **educational and informational purposes only**. It does not provide medical diagnoses or treatment recommendations. Always consult with a qualified healthcare professional regarding any medical results.
