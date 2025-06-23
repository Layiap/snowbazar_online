# --- Build-Phase ---
FROM node:18 as build

WORKDIR /app

# Kopiere nur package.json für Caching
COPY frontend/package*.json ./
RUN npm install

# Kopiere den Rest des Frontends
COPY frontend ./

# Kopiere explizit die Umgebungsdatei für den Produktions-Build
COPY frontend/.env.production .env

# Baue das Frontend mit Vite im Produktionsmodus
RUN npm run build

# --- NGINX-Phase ---
FROM nginx:alpine

# Kopiere das gebaute Frontend in das NGINX-HTML-Verzeichnis
COPY --from=build /app/dist /usr/share/nginx/html

# Optional: eigene nginx.conf hier einfügen, wenn vorhanden
# COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
