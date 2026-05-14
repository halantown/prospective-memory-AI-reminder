# Cooking for Friends

Browser-based prospective-memory experiment platform. Participants prepare a
dinner in a 2D home while handling phone distractors and doorbell/phone PM
trigger encounters.

## Quick Start

```bash
cd CookingForFriends
cp .env.development.example .env
docker compose up -d
```

```bash
cd CookingForFriends/backend
conda activate thesis_server
python main.py
```

```bash
cd CookingForFriends/frontend
npm install
npm run dev
```

- Frontend dev server: `http://localhost:3000`
- Backend/API docs: `http://localhost:5000/docs`
- Admin UI: `http://localhost:3000/admin`

## Documentation

Start at [docs/README.md](docs/README.md).

The docs are split into:

- `docs/development/` — current implementation references
- `docs/operations/` — incident and operational records
- `docs/research/` — experiment/storyboard materials

For backend incident fixes, record the post-mortem in
[docs/operations/incidents.md](docs/operations/incidents.md).
