# PulmoScan AI — Start Backend (PowerShell)
Write-Host "Starting PulmoScan AI Backend..." -ForegroundColor Cyan
Set-Location "$PSScriptRoot\backend"
& ".\.venv\Scripts\uvicorn.exe" app.main:app --host 0.0.0.0 --port 8000 --reload
