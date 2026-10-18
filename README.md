# Viện Dưỡng Lão Tâm An Care V7.5 — Enterprise Elderly Care Management Platform

[![Tam An Care CI](https://github.com/homeassistantnerd/Tam_An_Care-but-better/actions/workflows/ci.yml/badge.svg)](https://github.com/homeassistantnerd/Tam_An_Care-but-better/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-12.0.1-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![React](https://img.shields.io/badge/React-18.3.1-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9%20%2F%206.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: Proprietary](https://img.shields.io/badge/License-Proprietary-blue.svg)](LICENSE)

**Tâm An Care V7.5** is an enterprise-grade nursing home and geriatric care management platform. It delivers comprehensive clinical workflows, medical admissions, medication management (eMAR), daily living assistance (ADL), HACCP 24-hour food safety operations, 15-role RBAC security enforcement, and executive intelligence dashboards for nursing facility leadership.

---

## 🏛️ System Architecture & Workspace Structure

The project is structured as a unified npm monorepo with high-performance native TypeScript execution:

```
Tam_An_Care/
├── api/                       # Backend service (NestJS 12 + Express + pg + pdf-lib)
│   ├── src/
│   │   ├── admissions/        # A4 medical handover & personal belongings intake
│   │   ├── audit/             # Immutable audit logging & compliance tracking
│   │   ├── common/            # Enterprise HTTP security middleware & request tracing
│   │   ├── database/          # PostgreSQL connection pooling & migrations
│   │   ├── health/            # Liveness, readiness, and database health probes
│   │   └── health-reports/    # Clinical summaries, vital stats & PDF report generator
│   └── test/                  # Backend smoke & integration tests (Node native test runner)
├── frontend/                  # Modern PWA frontend (React 18 + Vite 6 + Tailwind CSS)
│   ├── src/
│   │   ├── api/               # Typed HTTP client with Bearer auth & 401 handling
│   │   ├── app/               # Application router & Lazy-loaded feature routes
│   │   ├── auth/              # 15-Role RBAC matrix, capabilities, and session tokens
│   │   ├── components/        # Reusable UI primitives, navigation & notifications
│   │   ├── features/          # Modular domain pages (Kitchen, Billing, eMAR, etc.)
│   │   └── types/             # Shared TypeScript domain contracts
│   └── test/                  # Frontend smoke & RBAC verification tests
├── database/
│   ├── schema.sql             # Canonical PostgreSQL DDL (residents, admissions, audit)
│   ├── migrations/            # Ordered migrations; rbac-migrations/ for resident-scope RBAC
│   ├── seeds/                 # Demo data (never load in production)
│   └── bootstrap.sh           # Initialise an empty DB: schema + every migration, in order
├── ops/finance/               # Finance & service-contract migrations (v22 001 → v32 010)
├── ops/ci/                    # Finance/contract regression tests (run by npm test / CI)
├── deploy/                    # Production deployment configurations (Nginx, SSL, Systemd)
├── docs/                      # Clinical specifications, domain logic & deployment guides
│   └── domain/                # Preserved clinical standards, RBAC matrix & operations
├── scripts/                   # Automated repository maintenance & security audit tools
├── .env.example               # Unified environment variables template
├── docker-compose.yml         # Containerized development & production orchestration
└── package.json               # Root monorepo workspace configuration
```

---

## 🚀 Key Clinical & Operational Features

1. **Executive Command Center**: Real-time leadership KPI overview tracking pending admissions, resident leaves, on-duty staffing levels, and critical medical alerts.
2. **HACCP 24-Hour Food Safety Architecture**:
   - 3-zone temperature control (`FREEZER` ≤ -18°C, `CHILLER` 0–4°C, `DRY_ROOM` ≤ 25°C).
   - Automated 24-hour retention countdown timer with mandatory disposal logging.
   - Standardized 4-texture diet matrix: `REGULAR_SOFT` (Cơm mềm), `MASHED_SOFT` (Cháo/Cơm nghiền), `PUREED_SOUP` (Xay nhuyễn), `TUBE_FEEDING` (Ăn qua Sonde).
3. **A4 Medical Admission & Handover System**:
   - Printable handover records with `@media print` layout and binary PDF rendering via `pdf-lib`.
   - Mandatory 3-party physical/digital signatures: Guardian / Resident, Receiving Nurse, and Shift Supervisor.
4. **CareView Gate & 15-Role RBAC Policy**:
   - Explicit role-based route guards and capability checks spanning 15 distinct healthcare roles (`ADMIN`, `SUPERVISOR`, `CARE_MANAGER`, `MEDICAL_HEAD`, `PSYCHOLOGIST`, `SOCIAL_WORKER`, `NURSE`, `CAREGIVER`, `NUTRITIONIST`, `HOUSEKEEPING`, `REHABILITATION_SPECIALIST`, `SECURITY`, `ACCOUNTANT`, `RECEPTIONIST`, `GUARDIAN`).
   - Granular caregiver assignment scopes preventing unauthorized inspection of clinical notes.
5. **UTF-8 BOM CSV Exports**:
   - All administrative, resident, and kitchen export routines prepend the UTF-8 Byte Order Mark (`﻿`), guaranteeing zero mojibake or character distortion in Microsoft Excel for Vietnamese diacritics.
6. **Progressive Web App (PWA)**:
   - Offline-capable service worker, responsive touch interfaces for iPad and Android tablets, and one-click desktop/mobile installation.
7. **Enterprise Security Standards**:
   - Automated secret scanning, `x-request-id` header correlation, strict HTTP security headers (`nosniff`, `DENY`, `no-referrer`), and JWT bearer token invalidation on HTTP 401.

---

## 📋 Prerequisites

- **Node.js**: `v20.0.0` or higher (Tested on Node 22 LTS and Node 24)
- **npm**: `v9.0.0` or higher
- **PostgreSQL**: `v16.0` or higher (or run via Docker Compose)
- **Docker & Docker Compose** (Optional, for containerized execution)

---

## ⚙️ Environment Configuration

Copy the unified environment template to `.env` in the root (or in `./api/.env` and `./frontend/.env`):

```bash
cp .env.example .env
```

### Key Environment Variables

| Variable | Default Value | Description |
|---|---|---|
| `NODE_ENV` | `development` | Runtime environment (`development` / `production`) |
| `PORT` | `3000` | Port for the NestJS API service |
| `DATABASE_URL` | `postgresql://taman:taman_dev_password@localhost:5432/taman_care` | PostgreSQL connection string |
| `JWT_SECRET` | *(Random 32+ char string)* | Cryptographic secret for signing and verifying authentication tokens |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated whitelist of allowed CORS origins |
| `VITE_API_BASE_URL` | `http://localhost:3000` | Base URL used by the frontend to communicate with the backend |

---

## 🛠️ Installation & Quick Start

### 1. Unified Monorepo Setup

Install dependencies across all workspaces in a single command from the repository root:

```bash
# Clone the repository
git clone https://github.com/homeassistantnerd/Tam_An_Care-but-better.git
cd Tam_An_Care-but-better

# Install each workspace from its own lockfile
npm ci --workspaces=false --prefix api
npm ci --workspaces=false --prefix frontend

# Create the database: schema + all migrations, then demo data (see docs/DEPLOYMENT.md)
PGHOST=localhost PGUSER=taman PGPASSWORD=... PGDATABASE=taman_care npm run db:bootstrap
npm run db:seed
```

### 2. Local Development Mode

Start both the backend API and frontend development servers concurrently:

```bash
# Terminal 1: Start Backend API (NestJS with hot reload)
npm run start:api
# API will be live at http://localhost:3000 (Swagger docs at http://localhost:3000/docs outside production)

# Terminal 2: Start Frontend PWA (Vite dev server)
npm run start:frontend
# Frontend will be live at http://localhost:5173
```

### 3. Docker Compose Deployment

Run the complete stack (PostgreSQL 16 + NestJS API + Nginx web on :5173). On an empty volume PostgreSQL runs `database/bootstrap.sh` and loads demo data (staff `TA-DIR-01`, password `TamAn@2026`):

```bash
docker compose up -d --build
```

Verify service readiness:
```bash
curl http://localhost:3000/api/health/ready
```

---

## 🧪 Testing & Quality Assurance

The repository utilizes Node.js native test runner and type-stripping for lightning-fast test execution without transpilation overhead.

```bash
# API + frontend tests and the ops/ci finance/contract regression suite (no database needed)
npm test

# PostgreSQL-backed suites (schema bootstrap, meals, DOB, finance, contracts) against a disposable PostgreSQL 16
npm run test:integration

# Run backend API tests only
npm run test:api

# Run frontend tests only
npm run test:frontend

# Run the automated secret and security audit scanner
npm run security:audit

# Verify production builds for all workspaces
npm run build
```

### Smoke Test Coverage Highlights

- **Frontend (`frontend/test/smoke.test.ts`)**:
  - Full RBAC route guard validation for `ADMIN`, `CAREGIVER`, `NURSE`, and supervisory staff.
  - Verification of director-exclusive capabilities and eMAR medication administration permissions.
  - Resident lifecycle route permissions (`canManageLifecycle`).
  - Validation of all 15 human actor roles with Vietnamese human-readable labels.
  - Caregiver assigned resident scope filtering.
  - UTF-8 BOM (`﻿`) byte prefixing and character integrity for Vietnamese strings.
  - Recognition of all 4 HACCP diet preparation textures.
- **Backend API (`api/test/smoke.test.mts`)**:
  - HTTP security response headers (`x-content-type-options`, `x-frame-options`, `referrer-policy`, `permissions-policy`).
  - Automatic `x-request-id` tracking across requests.
  - HACCP 24-hour food retention expiration calculations.
  - Storage zone temperature compliance thresholds (`FREEZER`, `CHILLER`, `DRY_ROOM`).
  - A4 medical admission 3-party required signatures validation.
  - Binary PDF document generation using `pdf-lib`.

---

## 🚢 Production Deployment

For enterprise production deployments on Debian Linux:

Follow the [deployment guide](docs/DEPLOYMENT.md) (Vietnamese): local development, Docker quick start,
production with HTTPS + Docker secrets, first Supervisor account, and upgrading a database that already holds data.

```bash
docker compose -f deploy/production/docker-compose.production.yml --env-file deploy/production/.env up -d --build
```

---

## 📖 Clinical & Technical Documentation

- **Domain Specifications**: [docs/domain/](docs/domain/)
  - [Clinical Standards & Health Trends](docs/domain/taman-care-clinical-standards.md)
  - [Roles & RBAC Access Matrix](docs/domain/taman-care-roles-rbac.md)
  - [Facility Management & Operations](docs/domain/taman-care-facility.md)
  - [Medication Inventory & eMAR Workflows](docs/domain/taman-care-medication-inventory.md)
  - [Billing & Financial Invoicing](docs/domain/taman-care-billing.md)
  - [Family Portal Specifications](docs/domain/taman-care-family-portal.md)
- **Deployment Guide**: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) · [Release governance](docs/RELEASE_GOVERNANCE.md)
- **Feature specifications**: [docs/features/](docs/features/) · **Finance**: [docs/finance/](docs/finance/)
- **Testing Guide**: [TESTERS_GUIDE.md](TESTERS_GUIDE.md)
- **Design Specifications**: [DESIGN.md](DESIGN.md)

---

## 📄 License

Proprietary — All rights reserved © 2026 Viện Dưỡng Lão Tâm An Care.
