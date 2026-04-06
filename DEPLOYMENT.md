# Deployment Guide — BSSSC Parking Booking System

This app has a **Flask (Python) backend** and a **React frontend**.
The recommended setup for school intranet hosting is to run Flask on the server
and have it serve the built React files — one server, one port, no CORS issues.

---

## Requirements

- Python 3.9+
- Node.js 18+ and npm (only needed to build the frontend once)
- A server on the school network (Linux recommended)

---

## Step 1 — Install backend dependencies

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

---

## Step 2 — Build the React frontend

```bash
cd frontend
npm install
npm run build
```

This produces a `frontend/build/` folder of static files.

---

## Step 3 — Configure Flask to serve the React build

Add the following to `backend/app.py` **before** the route definitions
(after the existing imports):

```python
from flask import send_from_directory

# Serve React build
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react(path):
    if path != "" and os.path.exists(os.path.join('../frontend/build', path)):
        return send_from_directory('../frontend/build', path)
    return send_from_directory('../frontend/build', 'index.html')
```

> Note: adjust the path `'../frontend/build'` if your folder structure differs.

---

## Step 4 — Set environment variables

Create a file called `.env` in the `backend/` folder (never commit this file):

```
SECRET_KEY=some-long-random-string-change-this
FLASK_DEBUG=false
PORT=5000
CORS_ORIGIN=http://<server-ip>:5000
```

Replace `<server-ip>` with the actual IP of the school server.
Generate a proper SECRET_KEY with:
```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

Install `python-dotenv` to load the `.env` file:
```bash
pip install python-dotenv
```

Then add to the **top** of `backend/app.py`:
```python
from dotenv import load_dotenv
load_dotenv()
```

---

## Step 5 — Initialise the database

Run once to create the database and default users:

```bash
cd backend
source venv/bin/activate
python database.py
```

**IMPORTANT: Change the default passwords immediately after first login.**
Default accounts created:
- Staff: `john@school.com` / `password123`
- Admin: `hampson@school.com` / `adminpass`

Delete or update these via the Admin → Management → Users tab.

---

## Step 6 — Run the server

```bash
cd backend
source venv/bin/activate
python app.py
```

For a persistent server, use `gunicorn` or a `systemd` service:

```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

---

## Step 7 — Access the app

Users on the school network open: `http://<server-ip>:5000`

---

## Frontend API URL

The React build in step 2 will use **relative URLs** (`/api/...`) by default,
which works correctly when Flask serves the React files on the same host.

If for any reason the frontend and backend run on different servers, create
`frontend/.env.production` before running `npm run build`:

```
REACT_APP_API_URL=http://<backend-server-ip>:5000
```

---

## Security checklist before go-live

- [ ] `SECRET_KEY` is set to a random value in `.env`
- [ ] `FLASK_DEBUG=false` in `.env`
- [ ] Default users (`john@school.com`, `hampson@school.com`) have been deleted or had passwords changed
- [ ] `backend/database.db` is NOT committed to git (it contains user data)
- [ ] Server is only accessible within the school network (firewall/VLAN)
