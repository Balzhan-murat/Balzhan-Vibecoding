$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")

Write-Host "Setting up PostgreSQL database..." -ForegroundColor Cyan

# Find psql
$psql = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psql) {
    $psql = Get-Item "C:\Program Files\PostgreSQL\*\bin\psql.exe" | Select-Object -Last 1
}

if (-not $psql) {
    Write-Host "psql not found. Make sure PostgreSQL is installed." -ForegroundColor Red
    exit 1
}

$psqlPath = if ($psql -is [System.IO.FileInfo]) { $psql.FullName } else { $psql.Source }

# Create DB and user
$sql = @"
DO `$`$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'recruiter') THEN
    CREATE USER recruiter WITH PASSWORD 'secret';
  END IF;
END `$`$;
CREATE DATABASE virtual_recruiter OWNER recruiter;
GRANT ALL PRIVILEGES ON DATABASE virtual_recruiter TO recruiter;
"@

$sql | & $psqlPath -U postgres
Write-Host "Database created successfully!" -ForegroundColor Green
