FROM python:3.11-slim

WORKDIR /app

# requirements.txt installieren
COPY backend/requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# App-Code korrekt kopieren
COPY backend/app /app/backend/app

EXPOSE 8000

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
