# DriveGuard

AI-powered Google Drive protection — detect leaked sharing links, search images by visual similarity or face, and scan files for sensitive data (PII).

Built for the **Google Solution Challenge** · Team Level 01

---

## Features

| Feature | Description |
|---------|-------------|
| **Leaked Link Scanner** | Finds all Drive files shared as "Anyone with the link" or publicly on the web |
| **Image Search** | Upload a photo; find visually similar images across your Drive using CLIP embeddings |
| **Text Search** | Describe what you are looking for in natural language; Gemini AI + CLIP finds matching photos |
| **Face Match** | Upload a photo of a person; DeepFace scans your Drive for all photos of that person |
| **PII Scan** | Scans Drive documents for emails, phone numbers, credit cards, and other sensitive data |
| **Chrome Extension** | All features accessible from a browser popup, plus inline warning badges on Drive pages |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite |
| Backend | Python FastAPI |
| Image embeddings | OpenAI CLIP (ViT-B/32, 512-dim) |
| Face recognition | DeepFace + FaceNet |
| PII detection | Microsoft Presidio + spaCy |
| Vector database | Pinecone (serverless, cosine) |
| Query enhancement | Google Gemini 1.5 Flash |
| Auth | Google OAuth 2.0 |
| Drive | Google Drive API v3 |
| Extension | Chrome Manifest V3 (vanilla JS) |

---

## Step 1 — Get All Credentials (All Free)

You need four things: a Google Cloud project (free), a Pinecone account (free tier), a Gemini API key (free tier), and Python/Node installed locally.

---

### 1.1 Google Cloud — OAuth 2.0 + Drive API (Free)

Google Cloud has a permanent free tier. No credit card is needed for the APIs used here.

**A. Create a Google Cloud project**

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click the project dropdown at the top → **New Project**
3. Name it `DriveGuard` → click **Create**
4. Make sure the new project is selected in the top dropdown

**B. Enable Google Drive API**

1. In the left sidebar go to **APIs & Services** → **Library**
2. Search for `Google Drive API` → click it → click **Enable**

**C. Configure the OAuth consent screen**

1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **External** → click **Create**
3. Fill in:
   - App name: `DriveGuard`
   - User support email: your Gmail address
   - Developer contact email: your Gmail address
4. Click **Save and Continue** through the remaining steps (Scopes and Test Users can be skipped for now)
5. On the Summary page click **Back to Dashboard**
6. Click **Publish App** → confirm (this lets any Google account sign in, not just test accounts)

   > If you prefer to keep it in testing, add your own Gmail as a test user under **Test users**.

**D. Create OAuth 2.0 credentials**

1. Go to **APIs & Services** → **Credentials**
2. Click **+ Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Name: `DriveGuard Web`
5. Under **Authorized redirect URIs** click **+ Add URI** and add:
   ```
   http://127.0.0.1:8000/api/auth/callback
   ```
6. Click **Create**
7. In the dialog that appears click **Download JSON**
8. Rename the downloaded file to `credentials.json`
9. Move it into the `backend/` folder:
   ```
   DriveGuard/backend/credentials.json
   ```

---

### 1.2 Pinecone — Vector Database (Free Tier)

Pinecone's free Starter plan gives you one serverless index with plenty of capacity for personal Drive collections.

1. Go to [app.pinecone.io](https://app.pinecone.io) → **Sign up** (email or Google sign-in — no credit card needed)
2. After signing in, click **Create Index**
3. Fill in:
   - **Index name**: `driveguard` (remember this — you will set it as `PINECONE_INDEX`)
   - **Dimensions**: `512`
   - **Metric**: `cosine`
   - **Cloud / Region**: leave as the default (e.g., AWS us-east-1)
4. Click **Create Index** — it takes about 30 seconds
5. In the left sidebar go to **API Keys**
6. Copy the key shown (it starts with a long hex string) — this is your `PINECONE_API_KEY`

---

### 1.3 Gemini API Key (Free Tier)

Google AI Studio offers a free Gemini API tier (up to 15 requests/minute on Flash).

1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Sign in with your Google account
3. Click **Get API key** in the top bar
4. Click **Create API key in new project** (or choose an existing project)
5. Copy the key — this is your `GEMINI_API_KEY`

> Gemini is optional. If you skip this step, text search still works using CLIP alone — the query just will not be enhanced.

---

### 1.4 Summary — All your keys

After completing the steps above you will have:

| Key | Where it goes |
|-----|--------------|
| `credentials.json` (OAuth client) | `backend/credentials.json` |
| Pinecone API key | `backend/.env` → `PINECONE_API_KEY` |
| Pinecone index name | `backend/.env` → `PINECONE_INDEX` |
| Gemini API key | `backend/.env` → `GEMINI_API_KEY` |

---

## Step 2 — Run the Web Application

### 2.1 Prerequisites

Install these once if you do not have them:

- **Python 3.11+** — [python.org/downloads](https://www.python.org/downloads/)
- **Node.js 20+** — [nodejs.org](https://nodejs.org)
- **Git** — [git-scm.com](https://git-scm.com) (optional, for cloning)

### 2.2 Clone / download the project

```bash
git clone <repo-url>
cd DriveGuard
```

Or download and extract the ZIP, then open a terminal in the `DriveGuard/` folder.

### 2.3 Set up the backend

```bash
cd backend

# Create and activate a Python virtual environment
python -m venv venv

# Windows (Command Prompt)
venv\Scripts\activate

# Windows (PowerShell)
venv\Scripts\Activate.ps1

# macOS / Linux
source venv/bin/activate
```

Install Python dependencies:

```bash
pip install -r ../requirements.txt
```

> First install takes 5–10 minutes — CLIP, DeepFace, and spaCy models are large.

Download the spaCy language model required for PII detection:

```bash
python -m spacy download en_core_web_lg
```

Create your environment file:

```bash
cp .env.example .env
```

Open `backend/.env` in any text editor and fill in your keys:

```env
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_INDEX=driveguard
GEMINI_API_KEY=your_gemini_api_key_here
OAUTH_REDIRECT_URI=http://127.0.0.1:8000/api/auth/callback
FRONTEND_URL=http://localhost:5173
```

Make sure `backend/credentials.json` is in place (from Step 1.1 D).

Start the backend server:

```bash
uvicorn main:app --reload
```

You should see:

```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
```

Open [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) in your browser to confirm all API endpoints are listed.

### 2.4 Set up the frontend

Open a **new terminal** (keep the backend running) and run:

```bash
cd frontend
npm install
```

Create the frontend environment file:

```bash
# Windows
copy .env.example .env

# macOS / Linux
cp .env.example .env
```

The default `.env` content is already correct for local development:

```env
VITE_API_URL=http://127.0.0.1:8000/api
```

Start the frontend:

```bash
npm run dev
```

You should see:

```
  VITE v5.x.x  ready in xxx ms
  ➜  Local:   http://localhost:5173/
```

### 2.5 Sign in and connect Google Drive

1. Open [http://localhost:5173](http://localhost:5173) in Chrome
2. Click **Connect with Google Drive**
3. A Google sign-in page opens — choose your account and click **Allow**
4. You are redirected back to the app, now signed in
5. Your name and storage usage appear in the header

### 2.6 Index your Drive images (one-time setup)

Before Image Search and Text Search return results, you must index your Drive photos into Pinecone. Run this once (and re-run whenever you add new images to Drive):

```bash
# Make sure you are in the backend/ folder with the venv activated
python indexer.py
```

Expected output:

```
Connecting to Google Drive...
Fetching all images from Drive...
Found 142 images in your Drive
Processing 1/142: vacation_photo.jpg
Processing 2/142: birthday.png
...
✅ Indexing complete!
   Successful: 139
   Failed:     3
   Total vectors in Pinecone: 139
```

Failures are usually files that are too large or in unsupported formats — that is normal.

### 2.7 Use all features

| Feature | How to use |
|---------|-----------|
| **Leaked Links** | Click the **Security** tab → **Scan Now** — all publicly shared files appear with risk badges |
| **Image Search** | Click the **Image Search** tab → drag or upload a photo → click **Find Similar Images** |
| **Text Search** | Click the **Text Search** tab → type a description (e.g. "dog at the beach") → press Enter |
| **Face Match** | Click the **Face Match** tab → upload a face photo → click **Find Matching Faces** |
| **PII Scan** | Click the **PII** tab → click **Scan Now** — files with emails, phone numbers, etc. appear |

---

## Step 3 — Install the Chrome Extension

The Chrome extension connects to the same backend running on your machine. The backend must be running before you open the popup.

### 3.1 Generate extension icons (first time only)

The icons are already included in `extension/icons/`. If you want to regenerate them:

```bash
cd extension
pip install Pillow   # if not already installed
python generate_icons.py
```

### 3.2 Load the extension in Chrome

1. Open Chrome and go to: `chrome://extensions`
2. Turn on **Developer mode** using the toggle in the top-right corner
3. Click **Load unpacked**
4. In the file picker, navigate to and select the `DriveGuard/extension/` folder
5. Click **Select Folder**

The DriveGuard shield icon appears in your Chrome toolbar. If you do not see it, click the puzzle-piece Extensions icon and pin DriveGuard.

### 3.3 Connect your Google account in the extension

1. Click the DriveGuard shield icon in the toolbar
2. The popup opens showing the login screen
3. Click **Connect with Google**
4. A new tab opens with the Google OAuth page — sign in and allow access
5. The tab closes automatically and the popup switches to the main dashboard
6. Your Drive storage usage and stats appear on the Dashboard tab

> The extension polls `http://127.0.0.1:8000/api/auth/status` every 2 seconds until the OAuth flow completes. You can close the OAuth tab manually if it does not close itself.

### 3.4 Extension features

| Tab | What it does |
|-----|-------------|
| **Dashboard** | Storage bar, security stats, one-click full security scan |
| **Leaked** | Full list of exposed files with risk level, open/copy links |
| **Image** | Drag-and-drop image search against your indexed Drive photos |
| **Text** | Natural language search with Gemini query enhancement |
| **Face** | Upload a face photo and find matches across your Drive |
| **PII** | Scan documents for sensitive data entities |

### 3.5 Inline Drive badges (content script)

After you run a **Leaked Links** scan, the extension automatically injects warning badges on Google Drive, Docs, Sheets, Slides, and Gmail pages:

- **🔴 PUBLIC** — file is accessible to anyone on the internet
- **🟠 LEAKED** — file is accessible to anyone with the link

Click a badge to see a tooltip with the file name, risk description, and a link to open it in Drive.

### 3.6 Extension settings

Right-click the DriveGuard icon → **Options** (or go to `chrome://extensions` → DriveGuard → Details → Extension options) to configure:

| Setting | Default | Description |
|---------|---------|-------------|
| API URL | `http://127.0.0.1:8000/api` | Change this if your backend runs on a different port |
| Auto-scan every hour | On | Background scan runs automatically each hour |
| Desktop notifications | On | Get notified when new exposed files are found |
| Highlight leaked links | On | Inject warning badges on Drive pages |

---

## Running with Docker (Optional)

If you prefer Docker over manual setup:

```bash
# Copy and fill in environment files first
cp backend/.env.example backend/.env
# Edit backend/.env with your keys

docker-compose up --build
```

- Frontend: [http://localhost](http://localhost)
- Backend API: [http://localhost:8000](http://localhost:8000)
- Swagger docs: [http://localhost:8000/docs](http://localhost:8000/docs)

> For the Chrome extension to work with Docker, set the API URL in extension options to `http://localhost:8000/api`.

---

## Project Structure

```
DriveGuard/
├── backend/
│   ├── api/
│   │   ├── auth.py          # Google OAuth web flow
│   │   ├── drive.py         # Thumbnail proxy + Drive stats
│   │   ├── face.py          # Face recognition search
│   │   ├── leaked.py        # Leaked sharing-link scanner
│   │   ├── search.py        # Image + text CLIP search
│   │   └── security.py      # PII detection
│   ├── services/
│   │   ├── clip_service.py       # CLIP embeddings
│   │   ├── drive_service.py      # Drive API wrapper
│   │   ├── face_service.py       # DeepFace embeddings
│   │   ├── gemini_service.py     # Gemini query enhancement
│   │   ├── pii_service.py        # Presidio NLP engine
│   │   └── pinecone_service.py   # Vector DB upsert + search
│   ├── credentials.json     # OAuth client secret (not committed)
│   ├── .env.example
│   ├── indexer.py           # One-time Drive image indexer
│   └── main.py              # FastAPI app entrypoint
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env.example
│   └── vite.config.js
├── extension/
│   ├── manifest.json
│   ├── icons/               # icon16.png, icon48.png, icon128.png
│   ├── popup/               # popup.html, popup.css, popup.js
│   ├── background/          # service-worker.js
│   ├── content/             # content.js
│   ├── options/             # options.html, options.css, options.js
│   └── generate_icons.py
├── docker-compose.yml
├── requirements.txt
└── README.md
```

---

## Environment Variables Reference

### `backend/.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `PINECONE_API_KEY` | Yes | From app.pinecone.io → API Keys |
| `PINECONE_INDEX` | Yes | Name of your Pinecone index (e.g. `driveguard`) |
| `GEMINI_API_KEY` | No | From aistudio.google.com — enables query enhancement |
| `OAUTH_REDIRECT_URI` | Yes | Must match the URI in Google Cloud Console |
| `FRONTEND_URL` | Yes | Where to redirect after OAuth (e.g. `http://localhost:5173`) |

### `frontend/.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | Yes | Backend API base URL (e.g. `http://127.0.0.1:8000/api`) |

---

## Troubleshooting

**`ModuleNotFoundError: No module named 'deepface'`**
Run `pip install -r requirements.txt` again from inside the `backend/` folder with your venv activated.

**`en_core_web_lg` not found**
Run `python -m spacy download en_core_web_lg` with the venv activated.

**`credentials.json not found`**
Download it from Google Cloud Console (APIs & Services → Credentials → your OAuth client → Download JSON) and place it at `backend/credentials.json`.

**OAuth redirect error ("redirect_uri_mismatch")**
The redirect URI in Google Cloud Console must exactly match the one in `backend/.env`. Both must be `http://127.0.0.1:8000/api/auth/callback`.

**Image search returns no results**
Run `python indexer.py` first. Results only appear after your Drive images are indexed into Pinecone.

**Chrome extension shows "Error: Failed to fetch"**
The backend is not running. Start it with `uvicorn main:app --reload` from the `backend/` folder.

**Extension popup is blank**
Open `chrome://extensions`, find DriveGuard, click **Errors** to see the console output. The most common cause is the backend being unreachable.

---

## Credits

- [OpenAI CLIP](https://github.com/openai/CLIP) — visual embeddings
- [DeepFace](https://github.com/serengil/deepface) — face recognition
- [Microsoft Presidio](https://github.com/microsoft/presidio) — PII detection
- [Pinecone](https://pinecone.io) — vector search
- [Google Gemini](https://aistudio.google.com) — AI query enhancement
- [Google Drive API](https://developers.google.com/drive) — file access and permissions
