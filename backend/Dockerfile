FROM python:3.11-slim

WORKDIR /app

# Requirements installieren
COPY backend/requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# RICHTIG: App-Code aus Projekt-Root kopieren
COPY backend/app /app/backend/app

EXPOSE 8000

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
