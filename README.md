# MSBM-HR Suite

AI-Agentic Human Resource Management platform with geofenced attendance, automated payroll, and enterprise security.

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (Auth, Database, Edge Functions)
- **Maps**: Mapbox GL JS
- **State**: TanStack React Query

## Getting Started

```bash
npm install
npm run dev
```

The app runs at `http://localhost:8080`.

## Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/public key |
| `VITE_MAPBOX_TOKEN` | Mapbox GL access token |
