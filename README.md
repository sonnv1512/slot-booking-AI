# Parking Slot Booking System with AI Assistant

A full-stack parking slot booking application with an integrated AI assistant for user support. Built with Flask (Python backend) and React (frontend), featuring user authentication, admin dashboard, and an AI-powered chat assistant.

## Features

- **User Authentication**: Staff login with role-based access (staff/admin)
- **Slot Booking**: Book parking slots for specific dates (up to configurable days in advance)
- **Admin Dashboard**: Manage users, view all bookings, grid calendar view, system settings
- **AI Assistant**: Conversational AI helper for parking inquiries and booking assistance
- **REST API**: Full RESTful API with session-based authentication

## Tech Stack

- **Backend**: Flask (Python 3.10+), SQLite, Flask-Bcrypt, Flask-CORS
- **Frontend**: React 19, React Router DOM
- **AI**: llama-cpp-python for local GGUF model inference, with external API fallback
- **Database**: SQLite (development), easily swappable to PostgreSQL

## Project Structure

```
slot-booking-AI/
├── backend/
│   ├── app.py              # Main Flask application
│   ├── ai_service.py       # AI model management & providers
│   ├── database.py         # Database initialization
│   ├── requirements.txt    # Python dependencies
│   └── database.db         # SQLite database file
├── frontend/
│   ├── src/
│   │   ├── App.js          # Main React app
│   │   ├── config.js       # API configuration
│   │   └── ...             # React components
│   ├── package.json        # Node dependencies
│   └── .env.development    # Frontend env variables
└── README.md               # This file
```

## Prerequisites

- Python 3.10+
- Node.js 18+
- npm or yarn

## Installation

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create and activate a virtual environment:
   ```bash
   # On Windows
   python -m venv venv
   venv\Scripts\activate

   # On macOS/Linux
   python3 -m venv venv
   source venv/bin/activate
   ```

3. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. (Optional) Copy `.env.example` to `.env` and configure:
   ```bash
   copy .env.example .env
   ```

5. (Optional) Download a GGUF AI model for local AI:
   - Place the model file in `backend/models/` (or configure path in `.env`)
   - Recommended: Quantized models like gemma-4-E2B-it-UD-IQ2_M.gguf

6. Run the backend:
   ```bash
   python app.py
   ```
   The API will be available at `http://127.0.0.1:5000`

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install Node dependencies:
   ```bash
   npm install
   ```

3. (Optional) Configure API URL in `.env.development`:
   ```
   REACT_APP_API_URL=http://127.0.0.1:5000
   ```

4. Run the frontend:
   ```bash
   npm start
   ```
   The app will open at `http://localhost:3000`

## Environment Variables

### Backend (.env.example)

| Variable | Description | Default |
|----------|-------------|---------|
| `CORS_ORIGIN` | Allowed CORS origin | `http://127.0.0.1:3000` |
| `SECRET_KEY` | Flask session secret key | (dev key - change in production) |
| `FLASK_DEBUG` | Enable debug mode | `false` |
| `PORT` | Server port | `5000` |
| `AI_PROVIDER` | AI provider: `local` or `external` | `local` |
| `AI_MODEL_PATH` | Path to GGUF model file | `models/ai-model.gguf` |
| `AI_EXTERNAL_API_URL` | External AI API URL | `https://api.openai.com/v1/chat/completions` |
| `AI_EXTERNAL_API_KEY` | External AI API key | (empty) |
| `AI_TEMPERATURE` | AI response creativity (0-1) | `0.7` |
| `AI_MAX_TOKENS` | Max tokens in AI response | `512` |
| `AI_N_CTX` | AI context window size | `2048` |

### Frontend (.env.development)

| Variable | Description | Default |
|----------|-------------|---------|
| `REACT_APP_API_URL` | Backend API base URL | (empty - uses relative paths) |

## API Endpoints

### Public
- `GET /` - API health check
- `GET /api/spaces` - List available parking slots
- `GET /api/spaces/available?date=YYYY-MM-DD` - Get available slots for a date

### Authentication
- `POST /api/login` - User login
- `POST /api/logout` - User logout
- `GET /api/check-auth` - Check authentication status

### User (Authenticated)
- `POST /api/bookings` - Create a booking
- `GET /api/my-bookings?user_id=X` - Get user's bookings
- `DELETE /api/bookings/<id>?user_id=X` - Cancel a booking

### Admin
- `GET /api/admin/all-bookings` - View all bookings
- `GET /api/admin/grid-view?days=7` - Calendar grid view
- `GET /api/admin/users` - List all users
- `POST /api/admin/users` - Create new user
- `POST /api/admin/users/import` - Bulk import users
- `DELETE /api/admin/users/<id>` - Delete user
- `PUT /api/admin/users/<id>/role` - Change user role
- `PUT /api/admin/users/<id>/password` - Change user password
- `GET /api/admin/slots` - List all parking slots
- `POST /api/admin/parking-slots` - Create parking slot
- `DELETE /api/admin/parking-slots/<id>` - Delete parking slot
- `PUT /api/admin/parking-slots/<id>/restricted` - Toggle restricted status
- `PUT /api/admin/settings/max-days` - Set max booking days
- `PUT /api/admin/settings/space-status` - Set space availability

### AI
- `GET /api/ai/health` - AI service health check
- `POST /api/ai/chat` - AI chat endpoint

## Default Admin Account

After database initialization, create an admin user via the admin dashboard or API:

```bash
# Example: Create admin via API (after logging in as existing admin)
curl -X POST http://127.0.0.1:5000/api/admin/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Admin", "email": "admin@school.edu", "password": "admin123", "role": "admin"}'
```

## Development Notes

- The database is auto-initialized on first run (`database.py` creates tables if missing)
- Session-based authentication uses Flask sessions with secure cookies
- Passwords are hashed using bcrypt
- AI features fall back gracefully if local model is unavailable


# Local AI Model

This project uses a quantized GGUF model for local AI inference.

## Model File

- **Model**: Qwen3.5-2B
- **Format**: GGUF (Q4_K_M quantization)
- **Size**: ~1.2GB
- **Location**: `backend/models/qwen3-5.gguf`

## Download

### Linux / macOS

```bash
# Using wget
wget -O backend/models/qwen3-5.gguf "https://huggingface.co/unsloth/Qwen3.5-2B-GGUF/resolve/main/Qwen3.5-2B-Q4_K_M.gguf?download=true"

# Or using curl
curl -L -o backend/models/qwen3-5.gguf "https://huggingface.co/unsloth/Qwen3.5-2B-GGUF/resolve/main/Qwen3.5-2B-Q4_K_M.gguf?download=true"
```

### Windows (PowerShell)

```powershell
# Using Invoke-WebRequest
Invoke-WebRequest -Uri "https://huggingface.co/unsloth/Qwen3.5-2B-GGUF/resolve/main/Qwen3.5-2B-Q4_K_M.gguf?download=true" -OutFile "backend\models\qwen3-5.gguf"

# Or using curl
curl -L -o backend\models\qwen3-5.gguf "https://huggingface.co/unsloth/Qwen3.5-2B-GGUF/resolve/main/Qwen3.5-2B-Q4_K_M.gguf?download=true"
```

## Notes

- The model is already included in this repository at `backend/models/qwen3-5.gguf`
- Only download again if you need to update or if the file is missing
- Requires `llama-cpp-python` with GGUF support to run

## License

MIT License