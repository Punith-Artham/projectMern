# Major MERN + Flask AI (Hybrid Monorepo)

This repository hosts:

- `client/`: React + Vite frontend
- `server/`: Node.js + Express API (MERN backend) on port `5001`
- `app.py`: Flask AI service on port `5000`

## Target architecture (production-ready)

Recommended split (safe next step) while keeping current logic unchanged:

```text
major-mern/
	services/
		flask-ai/
			app.py
			requirements.txt
			templates/
			static/
			uploads/
			data.json
			dataset.json
			cart.json
			orders.json
			.env.example
		mern-api/
			package.json
			.env.example
			src/
		mern-web/
			package.json
			.env.example
			src/
	scripts/
	.gitignore
	README.md
```

Current repo can continue running as-is until you complete file moves.

## Ports and service contract

- Flask AI service: `http://localhost:5000`
- MERN backend API: `http://localhost:5001`
- React dev server: `http://localhost:5173`

MERN backend now proxies AI calls to Flask:

- `POST /api/inference/predict-size` -> Flask `POST /predict_size`
- `POST /api/inference/try-on` -> Flask `POST /upload`

## Environment separation

### Node backend (`server/.env`)

Copy `server/.env.example` to `server/.env`:

```dotenv
PORT=5001
NODE_ENV=development
CLIENT_URL=http://localhost:5173
MONGO_URI=<your_mongodb_connection_string>
JWT_SECRET=<your_strong_jwt_secret>
JWT_EXPIRES_IN=7d
FLASK_AI_URL=http://localhost:5000
```

### React frontend (`client/.env`)

Copy `client/.env.example` to `client/.env`:

```dotenv
VITE_API_BASE_URL=http://localhost:5001/api
```

### Flask service

Keep existing Flask logic untouched. Run explicitly on `5000`:

```bash
python app.py
```

If you later move Flask under `services/flask-ai`, use a dedicated `.env` there and keep secrets out of source code.

## Run locally

1. Install root and JS dependencies:
	 - `npm install`
	 - `npm install --prefix server`
	 - `npm install --prefix client`
2. Start Flask service (`5000`):
	 - `python app.py`
3. Start MERN API + React app:
	 - `npm run dev`

## Safe migration steps (without breaking Flask)

1. Create `services/flask-ai`, `services/mern-api`, `services/mern-web` folders.
2. Move Flask files first (`app.py`, `templates`, `static`, `uploads`, JSON data files, `requirements.txt`) as one batch.
3. Run Flask alone and verify endpoints (`/predict_size`, `/upload`, `/get_data`) before touching MERN.
4. Move Node `server/` to `services/mern-api` and React `client/` to `services/mern-web`.
5. Update root scripts/CI paths only after both services run independently.
6. Keep `FLASK_AI_URL` in Node env pointing to Flask service URL.
7. Add reverse proxy (Nginx) only after local validation passes.

## Deployment best practice

- Deploy Flask AI and MERN API as separate services/containers.
- Use internal network calls from MERN API to Flask (`FLASK_AI_URL`).
- Put React behind CDN/static host.
- Keep secrets in platform env variables (never hardcode keys).
- Apply health checks and timeout/retry limits between services.