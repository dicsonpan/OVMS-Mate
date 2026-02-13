
# OVMS Mate

<div align="center">

<!-- You can replace this SVG with a hosted image later, but this serves as a placeholder -->
<img src="https://img.shields.io/badge/OVMS-Mate-blue?style=for-the-badge&logo=electric-vehicle&logoColor=white" alt="OVMS Mate Logo" />

<br/>

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)

**A modern, TeslaMate-inspired monitoring dashboard for Open Vehicle Monitoring System (OVMS).**

[Live Demo / Website](https://ovmsmate.com) | [Report Bug](https://github.com/dicsonpan/OVMS-Mate/issues)

</div>

---

## 📖 Introduction

**OVMS Mate** is a self-hosted (or cloud-hosted) visualization dashboard designed for EV owners using the [OVMS](https://www.openvehicles.com/) hardware.

While the official OVMS App is great for control, **OVMS Mate** focuses on **beautiful data visualization**, **historical analysis**, and **efficiency tracking**. It draws heavy inspiration from the famous [TeslaMate](https://github.com/teslamate-org/teslamate) project but is built for the open ecosystem of OVMS.

It is specifically optimized for the **BMW i3** (using specific PIDs/Metrics) but can be easily adapted for other OVMS-supported vehicles.

## ✨ Key Features

*   **TeslaMate-inspired UI**: A clean, dark-mode interface that looks great on mobile and desktop.
*   **Passive Logging**: The logger subscribes silently to MQTT topics (`v.b.*`, `v.p.*`, etc.) without waking the car unnecessarily. It captures data only when the car pushes updates.
*   **Drive Recording**: Automatically logs trips with detailed stats:
    *   Efficiency (Wh/km)
    *   Elevation & Speed Charts
    *   Total Consumption
    *   GPS Path on Map
*   **Smart Cost Tracking**: Define custom electricity tariffs for specific locations (e.g., "Home", "Work"). Supports **Time-of-Use (TOU)** pricing (Peak/Off-Peak rates) for accurate charging cost calculations.
*   **Charging Analytics**: detailed charging sessions with power curves (kW), SoC gain, and precise cost breakdown.
*   **Real-time Dashboard**: Live status of SoC, Range, Speed, Power, and Battery/Motor temperatures.
*   **AI Insights (Experimental)**: Integrated **Google Gemini AI** to analyze your drive efficiency and provide driving tips.

## 📸 Screenshots

<div align="center">
  <h3>Real-time Dashboard & Live Map</h3>
  <img src="https://private-user-images.githubusercontent.com/1907869/548024185-9287d329-8cb9-404e-86ec-022e0a055177.jpeg?jwt=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3NzA3ODcxMTUsIm5iZiI6MTc3MDc4NjgxNSwicGF0aCI6Ii8xOTA3ODY5LzU0ODAyNDE4NS05Mjg3ZDMyOS04Y2I5LTQwNGUtODZlYy0wMjJlMGEwNTUxNzcuanBlZz9YLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFLSUFWQ09EWUxTQTUzUFFLNFpBJTJGMjAyNjAyMTElMkZ1cy1lYXN0LTElMkZzMyUyRmF3czRfcmVxdWVzdCZYLUFtei1EYXRlPTIwMjYwMjExVDA1MTMzNVomWC1BbXotRXhwaXJlcz0zMDAmWC1BbXotU2lnbmF0dXJlPTYxNzk1MTllNTFjM2Q5OGJjMTc2MmQ2NmU3ZmE1MTA2YjkyYTNiZGM5ODNhOTBkYzBhZjBiNzBmODY4NjA2ZjQmWC1BbXotU2lnbmVkSGVhZGVycz1ob3N0In0.6cTCBvOqttlOCybl_tXUSswu7EazSIEo1YRLzo6WQog" width="45%" alt="Dashboard" />
  <img src="https://private-user-images.githubusercontent.com/1907869/548024214-8ad415ea-9d4e-4daf-8a8b-d66bf335c021.jpeg?jwt=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3NzA3ODcxMTUsIm5iZiI6MTc3MDc4NjgxNSwicGF0aCI6Ii8xOTA3ODY5LzU0ODAyNDIxNC04YWQ0MTVlYS05ZDRlLTRkYWYtOGE4Yi1kNjZiZjMzNWMwMjEuanBlZz9YLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFLSUFWQ09EWUxTQTUzUFFLNFpBJTJGMjAyNjAyMTElMkZ1cy1lYXN0LTElMkZzMyUyRmF3czRfcmVxdWVzdCZYLUFtei1EYXRlPTIwMjYwMjExVDA1MTMzNVomWC1BbXotRXhwaXJlcz0zMDAmWC1BbXotU2lnbmF0dXJlPTZmNmM1ODMxZjI1ZGM0N2YzMzYzZmUwOTEzMzhhODU5ZTBkZjAxOWM0NmVmMzZlMjI5ZjMzZjgzNDQxMGIwYTQmWC1BbXotU2lnbmVkSGVhZGVycz1ob3N0In0.YKK6cQjODHXx3dEHAn72_AJbC2mWezBFbFbmIIdwlmY" width="45%" alt="Map" />
</div>

<br/>

<div align="center">
  <h3>Drive History & Charging Analytics</h3>
  <img src="https://private-user-images.githubusercontent.com/1907869/548024236-226be862-1dea-408a-bc0f-d4960208c7a1.jpeg?jwt=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3NzA3ODcxMTUsIm5iZiI6MTc3MDc4NjgxNSwicGF0aCI6Ii8xOTA3ODY5LzU0ODAyNDIzNi0yMjZiZTg2Mi0xZGVhLTQwOGEtYmMwZi1kNDk2MDIwOGM3YTEuanBlZz9YLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFLSUFWQ09EWUxTQTUzUFFLNFpBJTJGMjAyNjAyMTElMkZ1cy1lYXN0LTElMkZzMyUyRmF3czRfcmVxdWVzdCZYLUFtei1EYXRlPTIwMjYwMjExVDA1MTMzNVomWC1BbXotRXhwaXJlcz0zMDAmWC1BbXotU2lnbmF0dXJlPWRlZTRiYTI2MjQ1MzEzM2MyNjkyNDQxMTZjMjJiZTMxNjAxZmQyOTQ0OTk2MGIzNTQ3NjYzZmQyMTNiNWI1ZTImWC1BbXotU2lnbmVkSGVhZGVycz1ob3N0In0.pvG-N4UOk-BkLcEBp98SaKubZ3m6tbVvucYnn-uvorM" width="45%" alt="Drives" />
  <img src="https://private-user-images.githubusercontent.com/1907869/548024260-dbb19bef-d231-42a4-b7d1-f85b3c8c6571.jpeg?jwt=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3NzA3ODcxMTUsIm5iZiI6MTc3MDc4NjgxNSwicGF0aCI6Ii8xOTA3ODY5LzU0ODAyNDI2MC1kYmIxOWJlZi1kMjMxLTQyYTQtYjdkMS1mODViM2M4YzY1NzEuanBlZz9YLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFLSUFWQ09EWUxTQTUzUFFLNFpBJTJGMjAyNjAyMTElMkZ1cy1lYXN0LTElMkZzMyUyRmF3czRfcmVxdWVzdCZYLUFtei1EYXRlPTIwMjYwMjExVDA1MTMzNVomWC1BbXotRXhwaXJlcz0zMDAmWC1BbXotU2lnbmF0dXJlPWVhYTljMWU4ZGY2MzM5YzlhNjljNzM0MjMzMjBjM2IwNTQyN2IzMzYxN2M2YmQyNzI1ZGEyNzBlN2JkNzNlZGYmWC1BbXotU2lnbmVkSGVhZGVycz1ob3N0In0.BD7CcCcmAAEImu01LIWajADcVDjmyXF8PRsiQ-WXFp4" width="45%" alt="Charging" />
</div>

## 🏗 Architecture

OVMS Mate modernizes the stack by separating data ingestion from visualization:

1.  **Logger (Node.js)**: A lightweight Docker container. It connects to your OVMS MQTT broker, listens for metrics, detects state changes (Driving/Charging), and pushes clean data to the database.
2.  **Database (Supabase)**: A PostgreSQL database that stores all telemetry, drives, and charging sessions.
3.  **Frontend (React/Vite)**: A responsive web application (hosted on Vercel, Netlify, or locally) that visualizes the data.

```mermaid
graph LR
    Car[OVMS Module] -- MQTT Push --> Broker[MQTT Broker]
    Broker -- Subscribe --> Logger[OVMS Mate Logger]
    Logger -- Insert --> DB[(Supabase PostgreSQL)]
    Frontend[React Web App] -- Query --> DB
```

## 🚀 Getting Started

### Prerequisites

1.  **OVMS Module**: Installed and running in your vehicle.
2.  **Supabase Account**: Create a free project at [supabase.com](https://supabase.com).
3.  **Docker Environment**: A VPS, NAS (Synology/QNAP), or Raspberry Pi to run the logger.

### Step 1: Database Setup

1.  Go to your Supabase Project -> **SQL Editor**.
2.  Copy the content of `supabase_schema.sql` from this repository and run it. This creates the necessary tables (`telemetry`, `drives`, `charges`).

### Step 2: Configuration

Create a `.env` file in the root directory (copy from `.env.example`):

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```ini
# OVMS MQTT Credentials
OVMS_ID=YourVehicleID
OVMS_USER=YourVehicleID
OVMS_PASS=YourSecretPassword
OVMS_SERVER=dexters-web.de (or your broker IP)

# Supabase Credentials (Found in Project Settings -> API)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key-starts-with-ey...

# Optional: Google Gemini API for AI Analysis
API_KEY=AIzaSy...
```

### Step 3: Run the Logger (Docker)

The logger needs to run continuously to collect data.

```bash
docker-compose up -d --build
```

### Step 4: Run the Frontend

You can deploy the frontend to **Vercel** (recommended for free SSL/hosting) or run it locally.

**Local Development:**
```bash
npm install
npm run dev
```

**Vercel Deployment:**
1.  Push your code to GitHub.
2.  Import project into Vercel.
3.  Add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `API_KEY` to Vercel Environment Variables.

## ☕ Support the Project

This project is free and open-source. If you find it useful for monitoring your EV, consider buying me a coffee! It helps keep the updates coming.

<a href="https://www.paypal.com/paypalme/dicsonpan" target="_blank">
  <img src="https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif" alt="Donate with PayPal" />
</a>

**PayPal**: dicsonpan@gmail.com

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

Distributed under the MIT License.
