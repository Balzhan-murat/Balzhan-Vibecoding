$proj = $PSScriptRoot
$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")

Set-Location "$proj\frontend"

Write-Host "Starting frontend on http://localhost:3000 ..." -ForegroundColor Green
npm run dev
