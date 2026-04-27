# DriveGuard

AI-powered Google Drive protection — detect leaked sharing links, search images by visual similarity or face, and scan files for sensitive data (PII).

Built for the Google Solution Challenge · Team Level 01

---

## Features

| Feature | Description |
|---------|-------------|
| **Leaked Link Scanner** | Finds all Drive files shared as "Anyone with the link" or publicly on the web |
| **Image Search** | Upload a photo; find visually similar images across your Drive using CLIP embeddings |
| **Text Search** | Describe what you are looking for in natural language; AI finds matching photos |
| **Face Match** | Upload a photo of a person; DeepFace scans your Drive for all photos of that person |
| **PII Scan** | Scans Drive documents for emails, phone numbers, credit cards, and other sensitive data |

---

## Tech Stack

- **Frontend**: React 19 + Vite
- **Backend**: Python FastAPI
- **AI / ML**: OpenAI CLIP (image + text embeddings), DeepFace (face recognition), Presidio (PII detection)
- **Vector DB**: Pinecone (semantic image search)
- **Auth**: Google OAuth 2.0
- **Drive**: Google Drive API v3

---

## Setup

### Prerequisites

- Python 3.11+
- Node.js 20+
- A Google Cloud project with the **Drive API** and **OAuth 2.0** enabled
- A [Pinecone](https://pinecone.io) account with an index (dimension: 512, metric: cosine)

### 1. Google OAuth credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
2. Create an **OAuth 2.0 Client ID** (type: Web application)
3. Add `http://127.0.0.1:8000/api/auth/callback` to Authorized redirect URIs
4. Download the credentials JSON and save it as `backend/credentials.json`

### 2. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r ../requirements.txt
python -m spacy download en_core_web_lg  # required for PII detection

cp .env.example .env            # fill in PINECONE_API_KEY and PINECONE_INDEX
uvicorn main:app --reload
```

The API will be available at `http://127.0.0.1:8000`.  
Swagger docs: `http://127.0.0.1:8000/docs`

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env            # default: VITE_API_URL=http://127.0.0.1:8000/api
npm run dev
```

Open `http://localhost:5173` in your browser and click **Connect with Google Drive**.

### 4. Index your Drive images (one-time)

Before image/text search works, index your Drive photos into Pinecone:

```bash
cd backend
python indexer.py
```

---

## Running with Docker

```bash
# Copy and fill in environment files first
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

docker-compose up --build
```

- Frontend: `http://localhost`
- Backend API: `http://localhost:8000`

---

## Project Structure

```
DriveGuard/
├── backend/
│   ├── api/
│   │   ├── auth.py       # Google OAuth endpoints
│   │   ├── face.py       # Face recognition search
│   │   ├── leaked.py     # Leaked link scanner
│   │   ├── search.py     # Image + text search
│   │   └── security.py   # PII detection
│   ├── services/
│   │   ├── clip_service.py
│   │   ├── drive_service.py
│   │   ├── face_service.py
│   │   ├── pii_service.py
│   │   └── pinecone_service.py
│   ├── indexer.py
│   └── main.py
├── frontend/
│   └── src/
│       ├── App.jsx
│       └── main.jsx
├── docker-compose.yml
└── requirements.txt
```
