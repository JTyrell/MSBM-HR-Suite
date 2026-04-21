# ── Stage 1: Build ────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Accept Vite env vars as build args
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
ARG VITE_MAPBOX_TOKEN

# Set them as env vars so Vite can inline them at build time
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID
ENV VITE_MAPBOX_TOKEN=$VITE_MAPBOX_TOKEN

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .
RUN npm run build

# ── Stage 2: Serve ────────────────────────────────────────────
FROM nginx:alpine

# Copy nginx config as a template (contains ${PORT})
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Railway injects $PORT; nginx:alpine's docker-entrypoint auto-runs
# envsubst on /etc/nginx/templates/*.template → /etc/nginx/conf.d/
# Default to port 80 if $PORT is not set
ENV PORT=80

CMD ["nginx", "-g", "daemon off;"]
