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

## Quick Start

### 1. Clone & Configure

```bash
cp .env.example backend/.env
# Edit backend/.env with your MONGODB_URL, SMTP config, GEMINI_API_KEY
```

### 2. Run with Docker Compose

```bash
docker-compose up --build
```

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **Swagger Docs**: http://localhost:8000/api/docs

### 3. First Login

```
Email: director@pulmoscan.ai
Password: Director@2024!
```

---

## ML Model Setup

### Download Dataset

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

### Train Model

```bash
python train.py
# Trained model saved to: ml_model/weights/lung_cancer_model.h5
# Copy to: backend/ml_model/weights/lung_cancer_model.h5
```

> **Without trained model**: The system uses realistic mock predictions for demo purposes.

---

## Project Structure

```
TRY_06/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app + lifespan
│   │   ├── config.py            # Settings (Pydantic)
│   │   ├── database.py          # MongoDB/Beanie connection
│   │   ├── models/              # Beanie document models
│   │   ├── schemas/             # Pydantic request/response schemas
│   │   ├── routers/             # API route handlers
│   │   ├── services/            # Business logic layer
│   │   ├── core/                # Auth, security, permissions
│   │   ├── ai/                  # ML model loader + predictor + GradCAM
│   │   └── utils/               # File handling, PDF, helpers
│   ├── scripts/mongo-init.js
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── app/                 # Next.js App Router pages
│   │   │   ├── login/           # Login page
│   │   │   ├── change-password/ # First-login password change
│   │   │   ├── director/        # Director dashboard + user mgmt + reports
│   │   │   ├── receptionist/    # Reception dashboard + patient reg
│   │   │   ├── junior-doctor/   # CT upload + AI prediction + reports
│   │   │   ├── senior-doctor/   # Review queue + approve/publish
│   │   │   └── patient/         # Patient portal + PDF download
│   │   ├── components/
│   │   │   ├── layout/          # DashboardLayout, AuthGuard, Sidebar
│   │   │   ├── charts/          # Chart.js components
│   │   │   └── ui/              # StatCard, Badge, LoadingSpinner
│   │   ├── lib/                 # API client (axios), utils
│   │   ├── store/               # Zustand auth store
│   │   └── types/               # TypeScript types
│   ├── package.json
│   └── Dockerfile
│
├── ml_model/
│   ├── download_dataset.py      # Kaggle dataset downloader + organizer
│   ├── train.py                 # EfficientNetB3 training (2-phase)
│   └── requirements.txt
│
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
| GET | `/api/v1/reports/queue` | Get review queue |
| POST | `/api/v1/reports/{id}/review` | Approve/reject/re-evaluate |
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

- JWT access tokens (30min) + refresh tokens (7 days)
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

See `backend/.env.example` for all required variables.

Key variables:
- `MONGODB_URL` — MongoDB connection string
- `JWT_SECRET_KEY` — Change in production!
- `SMTP_*` — Email server for credential delivery
- `GEMINI_API_KEY` — Google AI Studio API key
- `DIRECTOR_EMAIL/PASSWORD` — Bootstrap director account

---

## License

Academic/capstone project use. © 2024 PulmoScan AI Team.
