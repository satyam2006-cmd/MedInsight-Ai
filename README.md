---
title: MedInsight AI
emoji: 🏥
colorFrom: blue
colorTo: green
sdk: docker
pinned: false
app_port: 7860
---

# 🏥 MedInsight AI

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
