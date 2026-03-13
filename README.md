# MedInsight AI

MedInsight AI is a comprehensive medical intelligence platform that combines advanced AI analysis with real-time vitals monitoring. Transform complex medical documents into clear insights, manage patient records, and monitor vital signs using cutting-edge computer vision and machine learning technologies.

---

## Key Features

-   **Advanced Medical Analysis**: AI-powered analysis of medical reports using Google Gemini 2.5 Flash.
-   **Precision Vitals Monitoring**: High-accuracy heart rate and respiration tracking using **MediaPipe Face Mesh** (468 landmarks) and the JADE ICA algorithm.
-   **AI Health Summary**: Intelligent session summarization powered by Google Gemini, providing actionable insights from vitals data.
-   **Unified Hub Architecture**: A clean, neo-brutalist dashboard for seamless navigation between modules.
-   **Patient Management**: Complete patient record system with Supabase database integration.
-   **Report Generation**: Automated medical report analysis with hospital branding and professional PDF output.
-   **Multilingual Support**: Instant translation into multiple languages (Hindi, Marathi, Spanish, etc.).
-   **Audio Insights**: Text-to-speech with synchronized word highlighting.
-   **Secure Authentication**: JWT-based user authentication and data protection.
-   **Report Sharing**: Share medical reports securely with unique links.
-   **High Performance**: Optimized FastAPI backend with WebSocket support for real-time features.

---

## Tech Stack

### Backend
-   **Framework**: FastAPI (Python 3.11+)
-   **AI Engine**: Google Generative AI (Gemini 2.5 Flash)
-   **Database**: Supabase (PostgreSQL)
-   **Vitals Processing**: NumPy, SciPy with JADE ICA algorithm
-   **OCR**: Google Cloud Vision, PDF processing
-   **TTS**: Google Text-to-Speech (gTTS), Edge TTS
-   **Translation**: Deep Translator API

### Frontend
-   **Framework**: React 18 with Vite
-   **Styling**: Tailwind CSS with custom neo-brutalist design
-   **State Management**: React Router for navigation
-   **Real-time Communication**: WebSocket for vitals monitoring
-   **Icons**: Lucide React
-   **Build Tool**: Vite with ESBuild

---

## Architecture

MedInsight AI follows a modern, scalable microservices architecture:

### Core Components

-   **Frontend Client (React + Vite)**:
    - Unified Hub interface with highly accessible core modules.
    - Real-time vitals monitoring interface via WebRTC.
    - Document upload, OCR extraction, and translation pipeline.
    - Patient management dashboard.

-   **FastAPI Backend**:
    - RESTful API endpoints for all operations.
    - WebSocket support for real-time vitals streaming.
    - Authentication and authorization.
    - AI model orchestration.

-   **Data Layer**:
    - **Supabase**: User management, patient records, and report storage.
    - Real-time subscriptions for live data availability.

---

## Getting Started

### Prerequisites
-   Python 3.11+
-   Node.js 18+
-   [Google Gemini API Key](https://aistudio.google.com/app/apikey)
-   [Supabase Project](https://supabase.com)

### Local Development Setup

**Clone the repository:**
```bash
git clone https://github.com/Hackverse-healthcare2026/wiet-hackverse-2-0-hackathon-project-submission-healthcare-wh05_just-code-it.git
cd MedInsight-Ai
```

**Set up the Backend:**
```bash
# Install Python dependencies
pip install -r requirements.txt

# Create environment file
cp .env.example .env
# Edit .env with your API keys

# Start FastAPI server
python -m app.main
```

**Set up the Frontend:**
```bash
cd frontend

# Install dependencies
npm install

# Create environment file
cp .env.example .env
# Edit .env with Supabase credentials

# Start development server
npm run dev
```

**Access the application:**
- Frontend: `http://localhost:3001`
- Backend API: `http://localhost:8000`

---

## API Endpoints

### Core Endpoints
- `POST /analyze` - Analyze medical documents
- `POST /patients` - Create patient records
- `GET /patients/{id}` - Retrieve patient data
- `WebSocket /ws/vitals` - Real-time vitals monitoring
- `POST /tts` - Generate audio from text
- `GET /health` - Health check endpoint

### Authentication
- JWT-based authentication required for patient operations
- Supabase handles user sessions and permissions

---

## Environment Variables

### Backend (.env)
| Variable | Description | Required |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | Google AI Studio API Key | **Yes** |
| `GEMINI_MODEL` | Gemini model version (default: gemini-2.5-flash) | No |
| `SUPABASE_URL` | Supabase project URL | **Yes** |
| `SUPABASE_KEY` | Supabase service role key | **Yes** |
| `DEBUG` | Enable development mode | No |

### Frontend (frontend/.env)
| Variable | Description | Required |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | Supabase project URL | **Yes** |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key | **Yes** |

---

## Development

### Project Structure
```
MedInsight-Ai/
├── app/                    # FastAPI backend
│   ├── main.py            # Application entry point
│   ├── config.py          # Configuration settings
│   ├── ai_engine.py       # Gemini AI integration
│   ├── routes/            # API endpoints
│   └── services/          # Business logic
├── frontend/              # React application
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Core pages (Hub, Analyzer, Vitals, etc.)
│   │   ├── lib/           # Utilities and configs
│   │   └── ocr-engine/    # OCR processing
│   └── index.css          # Core neo-brutalist styling
└── requirements.txt       # Python dependencies
```

---

## Disclaimer
MedInsight AI is for **informational and educational purposes only**. It does not provide medical diagnoses, treatment advice, or professional healthcare recommendations. Always verify results with a qualified physician.

---

