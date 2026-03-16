---
title: MedInsight AI
emoji: 🏥
colorFrom: purple
colorTo: indigo
sdk: docker
pinned: false
---

# 🏥 MedInsight AI

**MedInsight AI** is a comprehensive medical intelligence platform that combines advanced AI analysis with real-time vitals monitoring. Transform complex medical documents into clear insights, manage patient records, and monitor vital signs using cutting-edge computer vision and machine learning technologies.

---

## ✨ Key Features

-   **🔍 Advanced Medical Analysis**: AI-powered analysis of medical reports using Google Gemini 2.5 Flash
-   **🫀 Real-Time Vitals Monitoring**: Contactless heart rate and respiration tracking using JADE ICA algorithm
-   **👥 Patient Management**: Complete patient record system with Supabase database integration
-   **📊 Report Generation**: Automated medical report analysis with hospital branding and contact details
-   **🌍 Multilingual Support**: Instant translation into multiple languages (Hindi, Marathi, Spanish, etc.)
-   **🔊 Audio Insights**: Text-to-speech with synchronized word highlighting
-   **📱 Modern Web Interface**: Responsive React application with neo-brutalist design
-   **🔒 Secure Authentication**: JWT-based user authentication and data protection
-   **📋 Report Sharing**: Share medical reports securely with unique links
-   **⚡ High Performance**: Optimized FastAPI backend with WebSocket support for real-time features

---

## 🛠️ Tech Stack

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

### Infrastructure
-   **Containerization**: Docker
-   **Frontend Deployment**: Vercel
-   **Backend Deployment**: Hugging Face Spaces / Render
-   **Database**: Supabase (managed PostgreSQL)

---

## 🏗️ Architecture

MedInsight AI follows a modern, scalable microservices architecture:

### Core Components

-   **Frontend Client (React + Vite)**:
    - User interface with real-time vitals monitoring
    - Document upload and processing
    - Patient management dashboard
    - Report sharing and viewing

-   **FastAPI Backend**:
    - RESTful API endpoints for all operations
    - WebSocket support for real-time vitals streaming
    - Authentication and authorization
    - AI model orchestration

-   **AI & Processing Layer**:
    - **Google Gemini 2.5 Flash**: Advanced medical document analysis
    - **JADE ICA Algorithm**: Real-time vitals extraction from video streams
    - **Google Cloud Vision**: OCR for medical documents
    - **Text-to-Speech Engines**: Multiple TTS providers for audio output

-   **Data Layer**:
    - **Supabase**: User management, patient records, and report storage
    - **Real-time subscriptions**: Live updates for collaborative features

### Data Flow

1. **Document Processing**: Upload → OCR → AI Analysis → Translation → Storage
2. **Vitals Monitoring**: Video Stream → JADE ICA → Real-time Metrics → WebSocket Updates
3. **Patient Management**: Authentication → CRUD Operations → Report Linking → Sharing

---

## 🚀 Getting Started

### Prerequisites
-   Python 3.11+
-   Node.js 18+
-   Docker (optional)
-   [Google Gemini API Key](https://aistudio.google.com/app/apikey)
-   [Supabase Project](https://supabase.com)

### 1. Local Development Setup

**Clone the repository:**
```bash
git clone https://github.com/satyam2006-cmd/MedInsight-Ai.git
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
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000`
- API Documentation: `http://localhost:8000/docs`

### 2. Docker Deployment

**Build and run with Docker:**
```bash
# Build the image
docker build -t medinsight-ai .

# Run the container
docker run -p 7860:7860 --env-file .env medinsight-ai
```

### 3. Production Deployment

**Frontend (Vercel):**
```bash
cd frontend
npm run build
# Deploy to Vercel with vercel.json configuration
```

**Backend (Hugging Face Spaces / Render):**
- Use the provided Dockerfile
- Set environment variables in deployment platform
- Configure CORS for your frontend domain

---

## 📊 API Endpoints

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

## ⚙️ Environment Variables

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
| `VITE_API_URL` | Backend API URL (production) | **Yes (Prod)** |

---

## 🔧 Development

### Project Structure
```
MedInsight-Ai/
├── app/                    # FastAPI backend
│   ├── main.py            # Application entry point
│   ├── config.py          # Configuration settings
│   ├── ai_engine.py       # Gemini AI integration
│   ├── routes/            # API endpoints
│   │   ├── analyze.py     # Document analysis
│   │   ├── patients.py    # Patient management
│   │   ├── vitals.py      # Vitals monitoring
│   │   └── tts.py         # Text-to-speech
│   └── services/          # Business logic
│       ├── db_service.py  # Supabase operations
│       ├── vitals_service.py # JADE ICA processing
│       └── ...
├── frontend/              # React application
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── lib/           # Utilities and configs
│   │   └── ocr-engine/    # OCR processing
│   └── ...
├── requirements.txt       # Python dependencies
└── Dockerfile            # Container configuration
```

### Key Components

- **VitalsMonitor.jsx**: Real-time camera-based vitals tracking
- **Patients.jsx**: Patient management interface
- **Reports.jsx**: Medical report dashboard
- **JADE ICA Algorithm**: Advanced signal processing for vitals extraction
- **Supabase Integration**: Real-time database with authentication

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Google AI** for Gemini models and Cloud Vision
- **Supabase** for the amazing real-time database
- **JADE ICA Research** for the vitals monitoring algorithm
- **FastAPI** and **React** communities for excellent frameworks

---

## 📞 Support

For support, email support@medinsight.ai or join our Discord community.

**MedInsight AI** - Transforming healthcare with AI, one patient at a time. 🏥🤖

---


## ⚙️ Environment Variables

| Variable | Description | Required |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | Your Google AI Studio API Key | **Yes** |
| `DEBUG` | Enable auto-reload for development | No |
| `VITE_API_URL` | Production Backend URL (Frontend Only) | **Yes (Prod)** |

---

## ⚖️ Disclaimer
MedInsight AI is for **informational and educational purposes only**. It does not provide medical diagnoses, treatment advice, or professional healthcare recommendations. Always verify results with a qualified physician.

---

## 👨‍💻 Author
**Satyam Bhagat**  
[GitHub](https://github.com/satyam2006-cmd) | [Email](mailto:satyambhagat200623@gmail.com)
