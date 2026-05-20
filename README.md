# MedInsight AI

MedInsight AI is a full-stack clinical intelligence platform that combines document analysis, patient management, and camera-based vitals monitoring in one workflow.

It is built for teams who need to turn complex medical content into understandable outputs quickly, while keeping a structured patient record pipeline.

## What It Does

- Analyzes uploaded medical reports with AI
- Extracts text from images and PDFs (OCR)
- Generates plain-language summaries and multilingual outputs
- Provides text-to-speech output for accessibility and communication
- Tracks patients and links generated reports to patient records
- Streams contactless vitals analysis from live camera sessions
- Produces downloadable report artifacts for sharing and review

## Product Modules

- Hub: Central navigation across all clinical workflows
- Analyzer: Upload document, extract text, run AI analysis, translate output
- Patients: Register and manage patient records with report linkage
- Reports: Explore historical analyses and shared outputs
- Vitals: Real-time camera session processing and trend snapshots
- Profile: Organization/account settings and language preferences

## High-Level Architecture

- Frontend: React + Vite
- Backend: FastAPI
- Data: Supabase (auth + PostgreSQL)
- AI: Gemini-based analysis and summary generation
- OCR: Image/PDF text extraction pipeline
- Realtime: WebSocket vitals stream processing

## Tech Stack

- Python, FastAPI, Pydantic
- React, Vite, Lucide icons
- Supabase client + JWT-based session flow
- NumPy/SciPy-based vitals signal processing
- Docker for containerized deployment

## Quick Start

### 1) Backend

```bash
pip install -r requirements.txt
cp .env.example .env
python -m app.main
```

Backend default URL: http://localhost:8000

### 2) Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Frontend default URL: http://localhost:5173

## Environment Variables

### Backend (.env)

- GEMINI_API_KEY: AI provider key
- GEMINI_MODEL: model name (optional)
- SUPABASE_URL: Supabase project URL
- SUPABASE_KEY: Supabase key used by backend
- CORS_ALLOW_ORIGINS: comma-separated allowed frontend origins
- HOST, PORT, DEBUG: runtime settings

### Frontend (frontend/.env)

- VITE_API_URL: backend base URL (for production/dev proxy strategy)
- VITE_SUPABASE_URL: Supabase project URL
- VITE_SUPABASE_ANON_KEY: Supabase public anon key

## API Snapshot

- POST /analyze-report
- POST /patients
- GET /patients
- GET /tts
- WS /ws/vitals
- GET /health

## Deployment

- Frontend can be deployed with Vercel-compatible build output
- Backend can run via Docker, VM, or PaaS container runtime
- Configure CORS_ALLOW_ORIGINS for production domains before go-live

## Security Notes

- Keep all secrets in environment variables only
- Do not commit .env files
- Restrict CORS origins to trusted frontend domains
- Enforce upload type/size controls at API boundary

## Disclaimer

MedInsight AI is an assistive clinical software tool and does not replace licensed medical judgment.
