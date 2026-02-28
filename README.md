# 🏥 MedInsight AI

[![Deploy to Render](https://render.com/images/deploy-to-render.svg)](https://render.com/deploy?repo=https://github.com/satyam2006-cmd/MedInsight-Ai)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/satyam2006-cmd/MedInsight-Ai&env=VITE_API_URL)

**MedInsight AI** is a cutting-edge medical report analyzer that transforms complex, jargon-heavy medical documents into clear, patient-friendly insights. Using **Google Gemini 1.5 Flash** and **gTTS**, it provides visual analysis, multilingual translations, and synchronized audio playback with word-by-word highlighting.

---

## ✨ Key Features

-   **🔍 AI-Powered Vision (OCR Free)**: Directly analyzes medical PDFs and images (JPG/PNG) using Gemini's native multimodal capabilities. No local OCR installation required!
-   **🌍 Multilingual Translation**: Instantly translates complex medical summaries into your preferred language (Hindi, Marathi, Spanish, etc.).
-   **🔊 Audio Insights (gTTS)**: Hear your report summary spoken aloud in a natural voice.
-   **🖍️ Word-by-Word Highlighting**: Follow along with the audio! The translated text highlights in real-time as it's being read.
-   **⚡ Neo-Brutalist UI**: A high-contrast, modern, and accessible interface for a premium user experience.
-   **🛡️ Safety First**: Built-in non-diagnostic logic ensures a clear disclaimer is always present for patient safety.

---

## 🛠️ Tech Stack

-   **Frontend**: React, Vite, Lucide-React (Icons)
-   **Style**: Custom Vanilla CSS (Neo-Brutalism Design)
-   **Backend**: FastAPI (Python 3.9+)
-   **LLM Engine**: Google Generative AI (Gemini 1.5 Flash)
-   **TTS Engine**: gTTS (Google Text-to-Speech)
-   **Deployment**: Vercel (Frontend) & Render (Backend)

---

## 🚀 Getting Started

### Prerequisites
-   Python 3.9+
-   Node.js (for frontend)
-   [Google Gemini API Key](https://aistudio.google.com/app/apikey)

### 1. Local Setup

**Clone the repository:**
```bash
git clone https://github.com/satyam2006-cmd/MedInsight-Ai.git
cd MedInsight-Ai
```

**Set up the Backend:**
```bash
# Install dependencies
pip install -r requirements.txt

# Create .env file
echo "GEMINI_API_KEY=your_key_here" > .env
echo "DEBUG=True" >> .env

# Start FastAPI
python -m app.main
```

**Set up the Frontend:**
```bash
cd frontend
npm install
npm run dev
```

The app will be available at `http://localhost:5173`.

---

## 🌐 Deployment

### Backend (Render / Heroku)
1.  Connect your GitHub repo to **Render**.
2.  Choose **Web Service**.
3.  **Build Command**: `pip install -r requirements.txt`
4.  **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips='*'`
5.  Add `GEMINI_API_KEY` to Environment Variables.

### Frontend (Vercel)
1.  Import the repo into **Vercel**.
2.  Set the **Root Directory** to `.` (the `vercel.json` handles the subfolder build).
3.  Add **Environment Variable**: `VITE_API_URL` = *Your Backend URL*.
4.  Deploy!

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
