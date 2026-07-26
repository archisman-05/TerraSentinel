# 🌍 TerraSentinal

> AI-powered Disaster Intelligence & Emergency Resource Allocation Platform

TerraSentinal is an intelligent disaster management platform that combines AI, geospatial analysis, real-time mapping, and volunteer coordination to help NGOs and emergency responders make faster and smarter decisions during disasters.

---

## 🚀 Features

### 🛰️ AI Disaster Intelligence
- Environmental risk analysis
- Weather data integration
- Elevation analysis
- Road accessibility analysis
- AI-generated disaster reports
- Resource recommendation engine

### 🗺️ Interactive Live Map
- OpenStreetMap + Leaflet
- Real-time NGO locations
- Volunteer locations
- SOS markers
- Disaster zones
- Location search
- Live environmental intelligence

### 🤝 Volunteer Management
- Volunteer registration
- Skill-based matching
- Nearby volunteer allocation
- Availability tracking

### 📋 Task Management
- Create emergency tasks
- AI-assisted volunteer assignment
- Priority management
- Resource tracking
- Status monitoring

### 🚨 SOS System
- Emergency reporting
- Real-time alerts
- Location-based assistance
- NGO notification system

### 📊 Analytics Dashboard
- Live statistics
- Resource utilization
- Disaster insights
- Weekly reports
- Performance metrics

---

# 🧠 AI Pipeline

```
Satellite & Environmental Data
            │
            ▼
    Weather APIs
    Elevation APIs
    OpenStreetMap
            │
            ▼
      Python AI Service
            │
            ▼
      OpenRouter LLM
            │
            ▼
 Risk Assessment Engine
            │
            ▼
Resource Recommendation
```

---

# 🛠 Tech Stack

## Frontend
- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- React Query
- Zustand
- React Leaflet
- Axios

## Backend
- Node.js
- Express.js
- PostgreSQL
- Socket.IO

## AI Service
- FastAPI
- Python
- OpenRouter API
- Weather APIs
- Elevation APIs

## Maps
- OpenStreetMap
- Leaflet
- Nominatim Geocoding

---

# 📂 Project Structure

```
TerraSentinal/
│
├── frontend/
│   ├── src/
│   ├── public/
│   └── package.json
│
├── backend/
│   ├── controllers/
│   ├── routes/
│   ├── services/
│   └── package.json
│
├── python-ai/
│   ├── services/
│   ├── app.py
│   └── requirements.txt
│
├── database/
│
└── README.md
```

---

# ⚙️ Installation

Clone the repository

```bash
git clone https://github.com/archisman-05/TerraSentinal.git
cd TerraSentinal
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd backend
npm install
npm run dev
```

### Python AI Service

```bash
cd python-ai

python -m venv venv

source venv/bin/activate
# Windows
venv\Scripts\activate

pip install -r requirements.txt

python app.py
```

---

# 🌐 Environment Variables

### Frontend

```
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_SOCKET_URL=
```

### Backend

```
PORT=
DATABASE_URL=
JWT_SECRET=
OPENROUTER_API_KEY=
```

### Python AI

```
OPENROUTER_API_KEY=
WEATHER_API_KEY=
```

---

# 📸 Screenshots

- Dashboard
- Live Disaster Map
- AI Analysis Panel
- Volunteer Management
- SOS System
- Reports

---

# 🎯 Future Roadmap

- Satellite imagery analysis
- Flood prediction
- Wildfire prediction
- Offline disaster intelligence
- Drone integration
- IoT sensor integration
- SMS emergency mode
- Mobile application
- Multi-language support

---

# 👥 Team

**The Last Commit**

Project developed during hackathons to improve disaster response using AI and geospatial intelligence.

---

# 📄 License

This project is licensed under the MIT License.

---

## ⭐ Support

If you like this project, consider giving it a ⭐ on GitHub.
