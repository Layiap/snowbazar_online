FROM python:3.11-slim

WORKDIR /app

# Requirements installieren
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App-Code kopieren
COPY . /app

EXPOSE 8000

# Pfad zur FastAPI-App korrigieren (liegt unter app/)
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]


