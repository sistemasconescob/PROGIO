# PROGIO — Manual de ejecución

**Procesos de Gestión Integrado Online**  
Sistema de control operativo para servicios de lavado de vehículos · INVERJAM SAS

---

## Tabla de contenidos

1. [Requisitos previos](#1-requisitos-previos)
2. [Estructura del proyecto](#2-estructura-del-proyecto)
3. [Opción A — Ejecución local (desarrollo)](#3-opción-a--ejecución-local-desarrollo)
4. [Opción B — Ejecución con Docker Compose](#4-opción-b--ejecución-con-docker-compose)
5. [Credenciales de acceso](#5-credenciales-de-acceso)
6. [Módulos del sistema](#6-módulos-del-sistema)
7. [API — Documentación interactiva](#7-api--documentación-interactiva)
8. [Solución de problemas frecuentes](#8-solución-de-problemas-frecuentes)

---

## 1. Requisitos previos

### Para ejecución local

| Herramienta | Versión mínima | Descarga |
|---|---|---|
| Python | 3.11 o superior | https://www.python.org/downloads/ |
| Node.js | 18 LTS o superior | https://nodejs.org/ |
| PostgreSQL | 15 o superior | https://www.postgresql.org/download/ |
| Docker Desktop *(opcional)* | cualquier versión reciente | https://www.docker.com/products/docker-desktop/ |

### Para ejecución con Docker

| Herramienta | Versión mínima |
|---|---|
| Docker Desktop | cualquier versión reciente |

---

## 2. Estructura del proyecto

```
PROGIO/
├── app/                     # Backend FastAPI
│   ├── models/              # Modelos SQLAlchemy (ORM)
│   ├── routers/             # Endpoints de la API
│   ├── schemas/             # Esquemas Pydantic (validación)
│   ├── services/            # Lógica de negocio
│   ├── dependencies.py      # Autenticación y permisos (RBAC)
│   ├── database.py          # Conexión a PostgreSQL
│   └── main.py              # Punto de entrada de la aplicación
├── frontend/                # Interfaz web React + TypeScript
│   ├── src/
│   │   ├── pages/           # Páginas del sistema
│   │   ├── components/      # Componentes reutilizables
│   │   ├── api/             # Llamadas a la API
│   │   └── contexts/        # Estado global (auth, toast)
│   └── package.json
├── alembic/                 # Migraciones de base de datos
│   └── versions/
│       ├── 001_initial_schema.py
│       ├── 002_seed_data.py
│       └── 003_superuser_flag.py
├── docker-compose.yml       # Orquestación Docker
├── Dockerfile               # Imagen del backend
└── requirements.txt         # Dependencias Python
```

---

## 3. Opción A — Ejecución local (desarrollo)

Esta opción permite reinicio automático al guardar cambios en el código.

### Paso 1 — Base de datos con Docker

La forma más sencilla de tener PostgreSQL disponible localmente es levantarlo con Docker:

```powershell
docker-compose up -d db
```

Esto inicia solo el contenedor de la base de datos en el puerto **5432**.

> Si ya tienes PostgreSQL instalado nativamente, crea la base de datos y el usuario manualmente:
> ```sql
> CREATE USER progio WITH PASSWORD 'progio123';
> CREATE DATABASE progio OWNER progio;
> ```

### Paso 2 — Configurar el entorno del backend

Desde la raíz del proyecto, crea el entorno virtual e instala las dependencias:

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Crea el archivo `.env.local` en la raíz del proyecto con la URL de la base de datos:

```
DATABASE_URL=postgresql+asyncpg://progio:progio123@localhost:5432/progio
```

### Paso 3 — Ejecutar las migraciones

Las migraciones crean todas las tablas y cargan los datos iniciales (roles, permisos y usuario administrador):

```powershell
$env:DATABASE_URL="postgresql+asyncpg://progio:progio123@localhost:5432/progio"
alembic upgrade head
```

### Paso 4 — Iniciar el backend

```powershell
$env:DATABASE_URL="postgresql+asyncpg://progio:progio123@localhost:5432/progio"
.\venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

El backend queda disponible en: **http://localhost:8000**

### Paso 5 — Instalar dependencias del frontend

Abre una nueva terminal y entra a la carpeta del frontend:

```powershell
cd frontend
npm install
```

### Paso 6 — Iniciar el frontend

```powershell
npm run dev
```

La aplicación web queda disponible en: **http://localhost:3000**

---

## 4. Opción B — Ejecución con Docker Compose

Esta opción levanta todos los servicios (base de datos, backend y frontend) en contenedores con un solo comando.

### Paso 1 — Construir e iniciar todos los servicios

Desde la raíz del proyecto:

```bash
docker-compose up --build
```

Para ejecutar en segundo plano:

```bash
docker-compose up --build -d
```

Docker Compose levantará:

| Servicio | URL | Descripción |
|---|---|---|
| Frontend | http://localhost:3000 | Interfaz web |
| Backend (API) | http://localhost:8000 | API REST |
| Base de datos | localhost:5432 | PostgreSQL 16 |

Las migraciones se ejecutan automáticamente al iniciar el contenedor del backend.

### Paso 2 — Detener los servicios

```bash
docker-compose down
```

Para también eliminar los datos de la base de datos:

```bash
docker-compose down -v
```

### Reconstruir después de cambios

Si modificas el código del backend o el `requirements.txt`:

```bash
docker-compose up --build api
```

---

## 5. Credenciales de acceso

| Campo | Valor |
|---|---|
| **Usuario** | `admin` |
| **Contraseña** | `admin123` |

> El usuario `admin` tiene acceso total al sistema (`is_superuser = true`). Para crear otros usuarios con roles específicos, ingresa al módulo **Usuarios** dentro de la aplicación.

---

## 6. Módulos del sistema

| Módulo | Ruta | Descripción |
|---|---|---|
| Dashboard | `/` | Métricas generales, gráficas y resumen operativo |
| Servicios | `/services` | Ciclo de vida completo de servicios de lavado |
| Contratos | `/contracts` | Contratos In-House y Puntos de Servicio, con sedes |
| Vehículos | `/vehicles` | Registro de vehículos por cliente o flota |
| Clientes | `/clients` | Clientes ocasionales y registrados |
| Insumos | `/supplies` | Catálogo de insumos y registro de uso por servicio |
| Pre-Facturación | `/prebilling` | Creación, aprobación y anulación de pre-facturas |
| Indicadores Eco. | `/env-config` | Configuración de parámetros de CO₂ y huella hídrica |
| Reportes | `/reports` | Exportación en CSV y PDF por rango de fechas |
| Usuarios | `/users` | Gestión de usuarios y asignación de roles por contrato |
| Auditoría | `/audit` | Bitácora de eventos del sistema |

---

## 7. API — Documentación interactiva

Con el backend en ejecución, accede a la documentación automática generada por FastAPI:

- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

Desde Swagger UI puedes probar todos los endpoints directamente en el navegador. Para endpoints protegidos, haz clic en **Authorize** e ingresa el token JWT obtenido desde `POST /api/auth/login`.

### Endpoints principales

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/login` | Iniciar sesión, devuelve JWT |
| POST | `/api/auth/refresh` | Renovar token de acceso |
| GET | `/api/services` | Listar servicios (con filtros) |
| POST | `/api/services` | Crear nuevo servicio |
| POST | `/api/services/{id}/start` | Iniciar un servicio |
| POST | `/api/services/{id}/finish` | Finalizar un servicio |
| GET | `/api/contracts` | Listar contratos |
| GET | `/api/reports/services?format=csv` | Descargar reporte CSV |
| GET | `/api/reports/environmental?format=pdf` | Descargar reporte PDF ambiental |

---

## 8. Solución de problemas frecuentes

### Error: `type "contracttype" does not exist`

Las migraciones no se ejecutaron correctamente. Ejecuta:

```powershell
$env:DATABASE_URL="postgresql+asyncpg://progio:progio123@localhost:5432/progio"
alembic upgrade head
```

### Error: `Credenciales incorrectas` al iniciar sesión

Verifica que el backend esté apuntando a la base de datos correcta y que las migraciones se hayan ejecutado. La migración `002_seed_data` crea el usuario `admin`.

### Error: `ECONNRESET` o `ERR_NETWORK` en el frontend

El frontend no puede conectarse al backend. Verifica:

1. Que el backend esté corriendo en el puerto 8000.
2. Que `frontend/vite.config.ts` tenga el proxy apuntando a `http://localhost:8000` (no a `http://api:8000`).

### Error al instalar dependencias Python en Windows con Python 3.13

Algunas versiones antiguas de `pydantic-core` o `asyncpg` no tienen wheels precompilados para Python 3.13. Usa las versiones del `requirements.txt` incluido, que son compatibles con Python 3.11, 3.12 y 3.13.

### El puerto 5432 ya está en uso

Otro proceso (PostgreSQL nativo u otro contenedor) ocupa el puerto. Opciones:

```powershell
# Ver qué proceso usa el puerto
netstat -ano | findstr :5432

# O cambiar el puerto en docker-compose.yml:
# ports:
#   - "5433:5432"
# Y actualizar DATABASE_URL con el nuevo puerto
```

### Reconstruir la base de datos desde cero

```powershell
# Detener y eliminar contenedores y volúmenes
docker-compose down -v

# Volver a levantar (ejecuta migraciones automáticamente)
docker-compose up --build
```

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Recharts |
| Backend | Python 3.12+, FastAPI, SQLAlchemy 2 (asyncio), Pydantic v2 |
| Base de datos | PostgreSQL 16 |
| Autenticación | JWT (python-jose), bcrypt |
| ORM / Migraciones | SQLAlchemy + Alembic |
| Contenedores | Docker, Docker Compose |
| Reportes | ReportLab (PDF), CSV nativo Python |
