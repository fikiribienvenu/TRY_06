# PulmoScan AI — Presentation Script
### Target Duration: ~9 minutes | ~1,350 words at average speaking pace

---

## INTRO [0:00 – 0:45] (~100 words)

"Hello everyone. Today I'm presenting **PulmoScan AI** — an AI-powered lung cancer prediction system designed for clinical environments.

Lung cancer is one of the leading causes of cancer deaths worldwide. Early detection dramatically improves survival rates, but radiologists are overloaded, and manual CT scan reading is slow and error-prone.

PulmoScan AI addresses this by combining computer vision, a structured clinical workflow, and role-based access — all in one web application.

Let me show you how it works."

---

## SECTION 1 — WHAT IS THE SYSTEM? [0:45 – 2:00] (~200 words)

**[Show the login page or landing page]**

"PulmoScan AI is a full-stack web application built for hospitals and diagnostic centers. The system handles the entire journey — from registering a patient, to uploading a CT scan, running an AI prediction, writing a clinical report, and finally delivering results to the patient.

The core purpose is simple: a radiologist uploads a CT scan image, and within seconds our AI model analyzes it and returns a diagnosis — classifying the scan into one of four lung cancer types:

- Adenocarcinoma  
- Squamous Cell Carcinoma  
- Large Cell Carcinoma  
- No Cancer detected  

Beyond the AI prediction, the system enforces a real-world clinical review workflow where reports must be reviewed and approved by a senior doctor before they ever reach the patient.

The tech stack is:
- **Frontend**: Next.js 15 with TypeScript and Tailwind CSS
- **Backend**: Python FastAPI with MongoDB
- **AI Model**: EfficientNetB3 trained on chest CT scan data using TensorFlow
- **AI Text**: Google Gemini 1.5 Flash for generating patient-friendly explanations
- **Auth**: JWT tokens with role-based access control"

---

## SECTION 2 — USER ROLES [2:00 – 3:15] (~200 words)

**[Show the Director dashboard or user management page]**

"The system has five distinct user roles, each with a dedicated dashboard and specific permissions.

**The Director** is at the top. This account is automatically created when the server starts, bootstrapped from environment variables. The Director manages all staff accounts — creating Radiologists, Senior Doctors, and Receptionists. The Director also has access to a full analytics dashboard showing cancer distribution, monthly scan activity, and a complete audit log trail.

**The Receptionist** registers patients and schedules appointments. They can also request a CT scan for a patient, which puts it in the Radiologist's queue.

**The Radiologist** is the core user. They upload CT scan images, run the AI prediction, view the Grad-CAM heatmap that shows which regions of the scan influenced the prediction, and then write the initial clinical report.

**The Senior Doctor** receives reports for review. They can approve, reject, or request re-evaluation. When approving, Gemini AI generates a patient-friendly explanation. Once published, the patient is notified.

**The Patient** can log in, view their published reports, download the PDF, and request appointments.

Every action in the system is logged in an immutable audit trail."

---

## SECTION 3 — LIVE DEMO: CORE WORKFLOW [3:15 – 6:30] (~450 words)

**[Walk through the actual running system]**

### Step 1 — Login as Director [3:15 – 3:35]
"Let me log in as the Director.

The credentials are bootstrapped automatically — email: director@pulmoscan.ai.

You can see the analytics dashboard with scan counts, cancer distribution charts, and recent activity. The Director can navigate to Users to create staff accounts."

---

### Step 2 — Create a Radiologist account [3:35 – 3:55]
"I'll go to Users, add a new Radiologist. The system generates a temporary password and sends it by email. On first login, staff are forced to change their password."

---

### Step 3 — Login as Receptionist, register a patient [3:55 – 4:20]
"Now switching to the Receptionist. I'll register a new patient — entering their name, date of birth, contact details, and medical history. The system assigns them a unique patient ID and creates their account automatically."

---

### Step 4 — Login as Radiologist, upload CT scan and run prediction [4:20 – 5:30]
"This is the most important part. I log in as the Radiologist and open the CT scan upload screen.

Before accepting the file, the system validates it — checking that it's actually a grayscale CT-like image, not a photo or document. If you try to upload a regular photo, the system rejects it with a clear message.

Once the image passes validation, I click **Run AI Prediction**.

The EfficientNetB3 model processes the 224×224 image and returns:
- The predicted cancer class
- A confidence score — for example, 87.3%
- Probabilities for all four classes

It also generates a **Grad-CAM heatmap** — a visual overlay that highlights the exact regions in the CT scan that the model focused on when making its decision. This is critical for clinical transparency.

Now I write the report — adding my clinical observations and notes — and submit it for senior doctor review."

---

### Step 5 — Login as Senior Doctor, review and approve [5:30 – 6:10]
"The Senior Doctor has a review queue. I open the pending report, read the radiologist's notes and the AI prediction, then click **Approve**.

At the moment of approval, the system calls **Google Gemini 1.5 Flash** to generate a plain-language explanation of the diagnosis for the patient — something a non-medical person can actually understand.

The report is then published and the patient receives an email notification."

---

### Step 6 — Login as Patient, view report [6:10 – 6:30]
"Finally, the Patient logs in, sees their notification, opens their published report, reads the Gemini-generated explanation, and downloads the PDF."

---

## SECTION 4 — TECHNICAL HIGHLIGHTS [6:30 – 7:45] (~200 words)

**[Switch to VS Code or a diagram if available]**

"Let me highlight a few technical decisions worth noting.

**CT Scan Validation** — before any image reaches the model, a custom validator checks color saturation, contrast levels, aspect ratio, and dark pixel ratio. This rejects regular photos and forces correct inputs.

**Mock Prediction Fallback** — if the trained model weights file isn't present, the system falls back to realistic mock predictions. This means the entire app is fully demonstrable without needing TensorFlow or the actual model weights.

**Report Workflow State Machine** — reports move through seven states: Draft → Pending Review → Under Review → Approved or Rejected → Published or Re-evaluation. This enforces the real clinical review process.

**Security** — JWT access tokens expire in 30 minutes, refresh tokens in 7 days. Failed login attempts are tracked, accounts lock after repeated failures, and every action — login, report creation, approval, export — is written to an immutable audit log.

**The AI model** is EfficientNetB3, trained in two phases: first with frozen base layers, then fine-tuned end-to-end. It was trained on the Kaggle Chest CT-Scan dataset with over 1,000 images per class."

---

## SECTION 5 — CLOSING [7:45 – 9:00] (~130 words)

"To summarize — PulmoScan AI is a complete, production-ready clinical system, not just a demo. It has:

- A real 5-role workflow that mirrors how hospitals actually operate  
- An AI model with visual explainability through Grad-CAM  
- Patient-friendly report generation through Gemini AI  
- Full security — JWT auth, RBAC, audit logs, input validation  
- PDF report generation and email notifications  
- Docker support for easy deployment  

The system is designed so that the AI assists the radiologist, not replaces them. Every prediction still goes through human review before reaching the patient.

This was built as a capstone project demonstrating how AI can meaningfully integrate into a real clinical workflow — safely, transparently, and at scale.

Thank you. I'm happy to take any questions."

---

## TIMING GUIDE

| Section | Time | Cumulative |
|---------|------|------------|
| Intro | 0:45 | 0:45 |
| What is the system | 1:15 | 2:00 |
| User roles | 1:15 | 3:15 |
| Live demo | 3:15 | 6:30 |
| Technical highlights | 1:15 | 7:45 |
| Closing | 1:15 | 9:00 |

---

## TIPS

- Speak at a steady pace — don't rush the demo sections
- Have all 5 accounts created and ready before recording
- Keep the browser DevTools closed
- If the AI model isn't loaded, that's fine — the mock prediction still shows the full UI flow
- Grad-CAM heatmap is the most visually impressive part — spend a moment on it
