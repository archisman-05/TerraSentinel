# 🌍 ResQnet: Smart Resource Allocation System for NGOs

An AI-powered platform that intelligently collects community needs and matches volunteers using real-time data and Google Gemini AI.

---

## 🏗 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js)                       │
│  Dashboard · Live Map · Reports · AI Insights · Assignments     │
└──────────────────────┬──────────────────────────────────────────┘
                       │  REST API + WebSocket
┌──────────────────────▼──────────────────────────────────────────┐
│                   BACKEND (Node.js/Express)                     │
│  Auth · Reports · Tasks · Matching · Assignments · Dashboard    │
│                                                                 │
│  ┌─────────────────┐  ┌────────────────┐  ┌──────────────────┐ │
│  │  Gemini Service │  │ Matching Engine│  │  Socket.io WS    │ │
│  │  - analyzeReport│  │ - Algorithmic  │  │  - task:new      │ │
│  │  - matchVolunteers│ │ - AI scoring   │  │  - assignment:new│ │
│  │  - areaInsights │  │ - auto-assign  │  │  - task:updated  │ │
│  │  - weeklySummary│  └────────────────┘  └──────────────────┘ │
│  └─────────────────┘                                           │
└──────────────────────┬──────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────┐
│              DATABASE (PostgreSQL + PostGIS)                    │
│  users · volunteer_profiles · reports · tasks                   │
│  assignments · notifications · ai_insights · refresh_tokens     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
ngo-smart-resource/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── database.js          # pg Pool + query helpers
│   │   ├── controllers/
│   │   │   ├── authController.js    # signup/login/refresh/me
│   │   │   ├── reportController.js  # create/list/convert
│   │   │   ├── taskController.js    # CRUD + match + auto-assign
│   │   │   ├── assignmentController.js
│   │   │   ├── volunteerController.js
│   │   │   └── dashboardController.js
│   │   ├── middleware/
│   │   │   ├── auth.js              # JWT verify + role guard
│   │   │   └── validate.js          # express-validator wrapper
│   │   ├── routes/
│   │   │   └── index.js             # all routes wired
│   │   ├── services/
│   │   │   ├── geminiService.js     # Gemini AI integration
│   │   │   └── matchingService.js   # Smart matching engine
│   │   ├── utils/
│   │   │   └── logger.js            # Winston
│   │   ├── websocket/
│   │   │   └── socketManager.js     # Socket.io
│   │   └── server.js                # Express entry point
│   ├── Dockerfile
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── dashboard/
│   │   │   │   ├── page.tsx         # Admin dashboard
│   │   │   │   ├── map/page.tsx     # Live map
│   │   │   │   ├── tasks/page.tsx   # Task management
│   │   │   │   ├── reports/page.tsx # Report management
│   │   │   │   ├── volunteers/page.tsx
│   │   │   │   ├── assignments/page.tsx
│   │   │   │   ├── insights/page.tsx # AI insights
│   │   │   │   └── profile/page.tsx
│   │   │   ├── login/page.tsx
│   │   │   ├── signup/page.tsx
│   │   │   └── page.tsx             # Redirect
│   │   ├── components/
│   │   │   ├── dashboard/DashboardLayout.tsx
│   │   │   ├── map/ResourceMap.tsx  # Mapbox + markers + heatmap
│   │   │   ├── forms/ReportForm.tsx
│   │   │   └── Providers.tsx
│   │   ├── hooks/
│   │   │   └── useSocket.ts         # Socket.io client hook
│   │   ├── lib/
│   │   │   └── api.ts               # Axios + typed API helpers
│   │   └── store/
│   │       └── authStore.ts         # Zustand auth state
│   ├── Dockerfile
│   └── package.json
│
├── database/
│   └── schema.sql                   # Full PostgreSQL + PostGIS schema
│
├── docker/
│   └── nginx.conf                   # Nginx reverse proxy
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js 18+
- PostgreSQL 15+ with PostGIS extension
- Docker & Docker Compose (optional but recommended)

### Option A: Docker Compose (Recommended)

```bash
# 1. Clone and enter directory
git clone <repo> ngo-smart-resource
cd ngo-smart-resource

# 2. Copy and fill environment variables
cp .env.example .env
# Edit .env with your GEMINI_API_KEY, MAPBOX_TOKEN, etc.

# 3. Start everything
docker-compose up -d

# 4. Wait ~30s then access:
#    Frontend: http://localhost:3000
#    Backend:  http://localhost:5000
#    Health:   http://localhost:5000/health
```

### Option B: Manual Setup

**Database:**
```bash
psql -U postgres -c "CREATE DATABASE ngo_resource_db;"
psql -U postgres -d ngo_resource_db -f database/schema.sql
```

**Backend:**
```bash
cd backend
cp .env.example .env        # fill in values
npm install
npm run dev                  # starts on :5000
```

**Frontend:**
```bash
cd frontend
cp .env.local.example .env.local   # fill in values
npm install
npm run dev                         # starts on :3000
```

---

## 🔑 Environment Variables

| Variable                   | Where    | Description                          |
|----------------------------|----------|--------------------------------------|
| `DATABASE_URL`             | Backend  | PostgreSQL connection string         |
| `JWT_SECRET`               | Backend  | 64+ char random string               |
| `JWT_REFRESH_SECRET`       | Backend  | 64+ char random string               |
| `GEMINI_API_KEY`           | Backend  | Google AI Studio API key             |
| `AWS_ACCESS_KEY_ID`        | Backend  | S3 image upload                      |
| `AWS_SECRET_ACCESS_KEY`    | Backend  | S3 image upload                      |
| `AWS_S3_BUCKET`            | Backend  | S3 bucket name                       |
| `NEXT_PUBLIC_API_URL`      | Frontend | Backend API base URL                 |
| `NEXT_PUBLIC_WS_URL`       | Frontend | WebSocket server URL                 |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Frontend | Mapbox public access token           |

---

## 📡 API Reference

### Authentication
| Method | Endpoint            | Auth | Description           |
|--------|---------------------|------|-----------------------|
| POST   | `/api/auth/signup`  | ✗    | Register user         |
| POST   | `/api/auth/login`   | ✗    | Login, get tokens     |
| POST   | `/api/auth/refresh` | ✗    | Rotate refresh token  |
| POST   | `/api/auth/logout`  | ✗    | Invalidate token      |
| GET    | `/api/auth/me`      | ✓    | Get current user      |

### Reports
| Method | Endpoint                    | Auth  | Description            |
|--------|-----------------------------|-------|------------------------|
| POST   | `/api/reports`              | ✓     | Submit report + AI     |
| GET    | `/api/reports`              | Admin | List reports           |
| POST   | `/api/reports/:id/convert`  | Admin | Convert → task         |

### Tasks
| Method | Endpoint                        | Auth  | Description           |
|--------|---------------------------------|-------|-----------------------|
| GET    | `/api/tasks`                    | ✓     | List tasks (filtered) |
| GET    | `/api/tasks/map`                | ✗     | Map markers data      |
| GET    | `/api/tasks/insights`           | Admin | AI area insights      |
| GET    | `/api/tasks/:id`                | ✓     | Task details          |
| GET    | `/api/tasks/:id/matches`        | Admin | AI volunteer matches  |
| PUT    | `/api/tasks/:id/status`         | ✓     | Update status         |
| POST   | `/api/tasks/:id/auto-assign`    | Admin | AI auto-assign        |

### Assignments
| Method | Endpoint                        | Auth      | Description       |
|--------|---------------------------------|-----------|-------------------|
| POST   | `/api/assignments`              | Admin     | Manual assign     |
| GET    | `/api/assignments`              | ✓         | List assignments  |
| PUT    | `/api/assignments/:id/accept`   | Volunteer | Accept task       |
| PUT    | `/api/assignments/:id/complete` | Volunteer | Complete task     |

### Volunteers
| Method | Endpoint                 | Auth      | Description        |
|--------|--------------------------|-----------|---------------------|
| GET    | `/api/volunteers`        | Admin     | List volunteers     |
| GET    | `/api/volunteers/map`    | ✗         | Map marker data     |
| GET    | `/api/volunteers/:id`    | ✓         | Volunteer details   |
| PUT    | `/api/volunteers/profile`| Volunteer | Update own profile  |

### Dashboard
| Method | Endpoint                        | Auth  | Description        |
|--------|---------------------------------|-------|--------------------|
| GET    | `/api/dashboard/stats`          | Admin | KPI statistics     |
| GET    | `/api/dashboard/weekly-summary` | Admin | AI weekly summary  |

---

## 🧠 AI Integration (Gemini)

All AI features are in `backend/src/services/geminiService.js`:

### 1. Report Analysis
When a report is submitted, Gemini automatically:
- Generates a human-readable summary
- Classifies urgency (`low/medium/high/critical`)
- Identifies required volunteer skills
- Provides recommended immediate action

### 2. Smart Volunteer Matching
Combines two signals:
- **Algorithmic (40%):** distance + skill Jaccard similarity + urgency weight + rating
- **AI (60%):** Gemini analyzes task description and volunteer profiles, explains *why* each match was made

### 3. Area Insights
POST to `/api/tasks/insights` with coordinates to get:
- Trend detection ("Food shortage increasing in North area")
- Urgent alerts
- Resource requirement forecast
- Detailed narrative analysis

### 4. Weekly Summary
Auto-generated NGO impact report with highlights and recommendations.

---

## 🔄 Real-Time Events (WebSocket)

Connect to `NEXT_PUBLIC_WS_URL` with Socket.io:

```javascript
import { io } from 'socket.io-client';
const socket = io(WS_URL, { auth: { token: accessToken } });

socket.on('task:new',        (data) => { /* new task created */ });
socket.on('task:updated',    (data) => { /* status changed   */ });
socket.on('assignment:new',  (data) => { /* volunteer notified */ });
socket.on('volunteer:moved', (data) => { /* location update   */ });
```

---

## ☁️ Production Deployment

### Vercel (Frontend) + Render (Backend)

**Frontend → Vercel:**
```bash
cd frontend
npm run build
# Deploy via: vercel --prod
# Set env vars in Vercel dashboard
```

**Backend → Render:**
1. Create new Web Service on render.com
2. Connect GitHub repo, set root directory to `backend/`
3. Build command: `npm install`
4. Start command: `node src/server.js`
5. Add all environment variables

**Database → Supabase or Neon (managed Postgres + PostGIS):**
```bash
# On Supabase: enable PostGIS in SQL editor
CREATE EXTENSION IF NOT EXISTS postgis;
# Then run schema.sql
```

### AWS Full Deployment

```bash
# Build and push to ECR
aws ecr get-login-password --region us-east-1 | docker login ...
docker build -t ngo-backend ./backend
docker tag ngo-backend:latest <ecr-uri>/ngo-backend:latest
docker push <ecr-uri>/ngo-backend:latest

# Deploy with ECS Fargate or EC2
# RDS PostgreSQL with PostGIS extension enabled
```

---

## 🔒 Security Checklist

- [x] JWT access tokens (15min) + refresh tokens (7 days) with rotation
- [x] bcrypt password hashing (cost factor 12)
- [x] Role-based access control (admin/volunteer)
- [x] Rate limiting on all API routes (stricter on auth)
- [x] Helmet.js security headers
- [x] CORS properly configured
- [x] Input validation with express-validator
- [x] SQL injection prevention via parameterized queries
- [x] Non-root Docker user

---

## 🧪 Implementation Phases

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | ✅ | Auth (JWT, signup/login, roles) + User system |
| 2 | ✅ | Reports CRUD + Map visualization (Mapbox) |
| 3 | ✅ | Task management + Smart matching engine |
| 4 | ✅ | Real-time WebSocket updates |
| 5 | ✅ | Gemini AI (analysis, matching, insights, summaries) |
| 6 | ✅ | Docker + deployment configuration |

---

## 📄 Credentials

Create volunteer accounts via the `/signup` page.
