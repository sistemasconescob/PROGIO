# Script para correr PROGIO localmente sin Docker
# Requiere: Python 3.11+, PostgreSQL instalado localmente

param(
    [string]$DbUser = "postgres",
    [string]$DbPassword = "postgres",
    [string]$DbHost = "localhost",
    [string]$DbPort = "5432",
    [string]$DbName = "progio"
)

$ErrorActionPreference = "Stop"

Write-Host "=== PROGIO — Setup local ===" -ForegroundColor Cyan

# 1. Crear entorno virtual
if (-not (Test-Path "venv")) {
    Write-Host "[1/5] Creando entorno virtual..." -ForegroundColor Yellow
    python -m venv venv
}

# 2. Activar entorno virtual
Write-Host "[2/5] Activando entorno virtual..." -ForegroundColor Yellow
& "venv\Scripts\Activate.ps1"

# 3. Instalar dependencias
Write-Host "[3/5] Instalando dependencias..." -ForegroundColor Yellow
pip install -r requirements.txt --quiet

# 4. Configurar .env para local
Write-Host "[4/5] Configurando variables de entorno..." -ForegroundColor Yellow
$dbUrl = "postgresql+asyncpg://${DbUser}:${DbPassword}@${DbHost}:${DbPort}/${DbName}"

$envContent = @"
DATABASE_URL=$dbUrl
SECRET_KEY=progio-dev-secret-key-2026-cambia-en-produccion
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
MAX_FAILED_ATTEMPTS=5
LOCKOUT_MINUTES=15
ENVIRONMENT=development
"@
$envContent | Out-File -FilePath ".env" -Encoding utf8

Write-Host ""
Write-Host "IMPORTANTE: Crea la base de datos '$DbName' en PostgreSQL antes de continuar." -ForegroundColor Magenta
Write-Host "Puedes hacerlo con: psql -U $DbUser -c `"CREATE DATABASE $DbName;`"" -ForegroundColor Gray
Write-Host ""
$confirm = Read-Host "¿Ya creaste la base de datos? (s/n)"
if ($confirm -ne "s") {
    Write-Host "Crea la base de datos y vuelve a ejecutar este script." -ForegroundColor Red
    exit 1
}

# 5. Ejecutar migraciones y levantar servidor
Write-Host "[5/5] Ejecutando migraciones Alembic..." -ForegroundColor Yellow
$env:DATABASE_URL = $dbUrl
alembic upgrade head

Write-Host ""
Write-Host "=== Iniciando servidor ===" -ForegroundColor Green
Write-Host "API disponible en: http://localhost:8000" -ForegroundColor Cyan
Write-Host "Documentación:     http://localhost:8000/docs" -ForegroundColor Cyan
Write-Host "Usuario admin:     admin@progio.co / Admin1234!" -ForegroundColor Cyan
Write-Host ""
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
