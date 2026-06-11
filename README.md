# PulmoScan AI — Lung Cancer Prediction System

Production-ready AI-powered web application for lung cancer prediction using CT scan image analysis.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS, ShadCN UI, React Query, Chart.js |
| Backend | Python FastAPI, Motor (async MongoDB), Beanie ODM |
| Database | MongoDB 7.0 (local or Atlas) |
| AI Model | EfficientNetB3 (TensorFlow/Keras) + Grad-CAM heatmaps |
| AI Text | Google Gemini 1.5 Flash — patient explanations & recommendations |
| Auth | JWT Access + Refresh tokens, bcrypt password hashing |
| Email | aiosmtplib (SMTP) — async email notifications |
| PDF | ReportLab — clinical report generation |
| Containers | Docker + Docker Compose |

---

## User Roles

| Role | Capabilities |
|------|-------------|
| **Director** | User CRUD, analytics dashboard, audit logs, reports |
| **Senior Doctor** | Review queue, approve/reject/publish reports, Gemini explanations |
| **Junior Doctor** | Upload CT scans, run AI prediction, create reports |
| **Receptionist** | Register patients, manage appointments, request CT scans |
| **Patient** | View published reports, download PDF, request appointments |

---

## Running Locally (No Docker)

### Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 18+ | https://nodejs.org |
| Python | 3.11+ | https://python.org |
| MongoDB Community | 7.0 | https://www.mongodb.com/try/download/community — must be running before starting backend |

---

### 1. Clone

```powershell
git clone https://github.com/fikiribienvenu/TRY_06.git
cd TRY_06
```

---

### 2. Backend

```powershell
cd backend

# Create virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1        # Windows PowerShell
# source .venv/bin/activate          # macOS / Linux

# Install dependencies (lightweight — no TensorFlow required for dev)
pip install -r requirements-dev.txt

# Copy environment file
Copy-Item .env.example .env          # Windows
# cp .env.example .env               # macOS / Linux
```

**Edit `backend/.env`** — the defaults below work for local dev with no extra services needed:

```env
MONGODB_URL=mongodb://localhost:27017/pulmoscan
JWT_SECRET_KEY=change-this-in-production
JWT_REFRESH_SECRET_KEY=change-this-refresh-key-too
ENVIRONMENT=development

# Leave blank — credentials are printed to the server log during dev
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=

# Leave blank — fallback static text is used instead of AI-generated explanations
GEMINI_API_KEY=

# Director account bootstrapped automatically on first startup
DIRECTOR_EMAIL=director@pulmoscan.ai
DIRECTOR_PASSWORD=Director@2024!
```

**Start the backend:**

```powershell
# Option A — from inside backend/ with .venv active
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Option B — convenience script from project root
.\start-backend.ps1
```

Verify: http://localhost:8000/api/health should return `{"status":"healthy"}`

---

### 3. Frontend

Open a **second terminal**:

```powershell
cd frontend
npm install --legacy-peer-deps
npm run dev

# Or from project root:
# .\start-frontend.ps1
```

---

### 4. Open the app

| URL | Description |
|-----|-------------|
| http://localhost:3000 | Web application |
| http://localhost:8000/api/docs | Swagger / OpenAPI interactive docs |
| http://localhost:8000/api/health | Backend health check |

---

### 5. First login

```
Email:    director@pulmoscan.ai
Password: Director@2026!
```

The Director account is created automatically when the backend starts for the first time.
To reset the password, update `DIRECTOR_DEFAULT_PASSWORD` in `backend/.env` and restart the backend — credentials are synced on every startup.
From the Director dashboard you can create staff accounts (Senior Doctor, Junior Doctor, Receptionist).
Each new staff member receives a temporary password and must change it on first login.

---

### Creating accounts for each role

| Role | How to create |
|------|--------------|
| Director | Auto-bootstrapped on backend startup |
| Senior Doctor | Director dashboard → Users → Add User |
| Junior Doctor | Director dashboard → Users → Add User |
| Receptionist | Director dashboard → Users → Add User |
| Patient | Receptionist dashboard → Register Patient |

---

## Running with Docker

Requires Docker Desktop.

```bash
cp .env.example backend/.env
# Edit backend/.env with your MONGODB_URL, SMTP config, GEMINI_API_KEY
docker-compose up --build
```

- **Frontend**: http://localhost:3000
- **Backend API / Swagger**: http://localhost:8000/api/docs

---

## ML Model Setup (Optional)

Without the trained model the system uses realistic mock predictions for demo purposes.

### Download dataset

```bash
cd ml_model
pip install -r requirements.txt

# Get Kaggle API key from https://www.kaggle.com/settings/account
# Place kaggle.json in ~/.kaggle/
python download_dataset.py
```

**Dataset**: [Chest CT-Scan Images](https://www.kaggle.com/datasets/mohammadhossein77/chest-ct-scan-data)
- Adenocarcinoma
- Large Cell Carcinoma
- Normal (No Cancer)
- Squamous Cell Carcinoma

### Train model

```bash
python train.py
# Output: ml_model/weights/lung_cancer_model.h5
# Copy to: backend/ml_model/weights/lung_cancer_model.h5
```

---

## Project Structure

```
TRY_06/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app + lifespan
│   │   ├── config.py            # Settings (Pydantic BaseSettings)
│   │   ├── database.py          # MongoDB / Beanie connection
│   │   ├── models/              # Beanie document models
│   │   ├── schemas/             # Pydantic request/response schemas
│   │   ├── routers/             # API route handlers
│   │   ├── services/            # Business logic (email, PDF, Gemini)
│   │   ├── core/                # Auth, security, permissions, dependencies
│   │   ├── ai/                  # ML model loader + predictor + Grad-CAM
│   │   └── utils/               # File handling, helpers
│   ├── requirements-dev.txt     # Lightweight deps (no TensorFlow)
│   ├── requirements.txt         # Full deps including TensorFlow
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── app/                 # Next.js App Router pages
│   │   │   ├── login/
│   │   │   ├── change-password/
│   │   │   ├── director/
│   │   │   ├── receptionist/
│   │   │   ├── junior-doctor/
│   │   │   ├── senior-doctor/
│   │   │   └── patient/
│   │   ├── components/
│   │   │   ├── layout/          # DashboardLayout, AuthGuard, Sidebar
│   │   │   ├── charts/          # Chart.js wrappers
│   │   │   └── ui/              # Shared UI components
│   │   ├── lib/                 # Axios API client
│   │   ├── store/               # Zustand auth store
│   │   └── types/               # TypeScript types
│   ├── package.json
│   └── Dockerfile
│
├── ml_model/
│   ├── download_dataset.py      # Kaggle dataset downloader + organizer
│   ├── train.py                 # EfficientNetB3 two-phase training
│   └── requirements.txt
│
├── start-backend.ps1            # One-click backend start (PowerShell)
├── start-frontend.ps1           # One-click frontend start (PowerShell)
├── docker-compose.yml
└── README.md
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/login` | Login → JWT tokens |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| POST | `/api/v1/auth/change-password` | Change password |
| GET | `/api/v1/auth/me` | Current user profile |
| POST | `/api/v1/users` | Create staff (Director only) |
| GET | `/api/v1/users` | List users (Director only) |
| POST | `/api/v1/patients` | Register patient (Receptionist) |
| GET | `/api/v1/patients` | List/search patients |
| POST | `/api/v1/ct-scans/request` | Request CT scan |
| POST | `/api/v1/ct-scans/{id}/upload` | Upload CT image |
| POST | `/api/v1/ct-scans/{id}/predict` | Run AI prediction |
| POST | `/api/v1/reports` | Create report |
| POST | `/api/v1/reports/{id}/submit` | Submit to senior doctor |
| GET | `/api/v1/reports/queue` | Senior doctor review queue |
| POST | `/api/v1/reports/{id}/review` | Approve / reject / re-evaluate |
| POST | `/api/v1/reports/{id}/publish` | Publish + notify patient |
| GET | `/api/v1/reports/{id}/pdf` | Download report PDF |
| GET | `/api/v1/analytics/dashboard` | Director dashboard stats |
| GET | `/api/v1/analytics/cancer-distribution` | Cancer type breakdown |
| GET | `/api/v1/analytics/monthly-activity` | Monthly scan/patient counts |
| GET | `/api/v1/analytics/audit-logs` | Audit trail |
| GET | `/api/v1/notifications` | User notifications |

Full interactive docs: **http://localhost:8000/api/docs**

---

## MongoDB Collections

| Collection | Purpose |
|-----------|---------|
| `users` | All accounts (Director, Doctors, Receptionist, Patient) |
| `patients` | Patient demographic + medical profiles |
| `ct_scans` | Uploaded CT scan metadata + file references |
| `predictions` | AI model output per scan |
| `reports` | Clinical reports with workflow status |
| `appointments` | Patient appointment requests |
| `notifications` | In-app + email notification records |
| `audit_logs` | Immutable security and activity audit trail |
| `activities` | User activity feed |

---

## Security Features

- JWT access tokens (30 min) + refresh tokens (7 days)
- bcrypt password hashing (cost factor 12)
- Role-Based Access Control (5 roles, granular permissions)
- Forced password change on first login
- Failed login attempt tracking
- Complete audit log trail
- File upload validation (type + size)
- CORS protection
- GZip compression

---

## Environment Variables

See `backend/.env.example` for all variables.

Key variables:

| Variable | Description |
|----------|-------------|
| `MONGODB_URL` | MongoDB connection string |
| `JWT_SECRET_KEY` | Access token signing key — change in production |
| `JWT_REFRESH_SECRET_KEY` | Refresh token signing key — change in production |
| `SMTP_HOST/PORT/USER/PASSWORD` | Email server for credential delivery |
| `GEMINI_API_KEY` | Google AI Studio key for report explanations |
| `DIRECTOR_EMAIL` | Bootstrap director account email |
| `DIRECTOR_PASSWORD` | Bootstrap director account password |

---

## License

Academic/capstone project use. © 2024 PulmoScan AI Team.
