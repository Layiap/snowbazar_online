from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader
from pydantic import BaseModel, EmailStr
from typing import List
import uuid
import os
from sqlalchemy import create_engine, Column, Integer, String, Float, ForeignKey
from sqlalchemy.orm import declarative_base, relationship, sessionmaker, Session
from .mail import sende_bestaetigungsmail

print("🔁 SKIBAZAR BACKEND STARTET MIT NEUEM CODE")
# ---------------- Optional: .env für lokale Entwicklung laden ----------------
from dotenv import load_dotenv
load_dotenv()

# ---------------- API-Key Absicherung ----------------

API_KEY = os.getenv("API_KEY_SKIBAZAR")
api_key_header = APIKeyHeader(name="Authorization")

def check_api_key(key: str = Depends(api_key_header)):
    print(f"Empfangener Key: '{key}'")
    print(f"Erwarteter Key:  '{API_KEY}'")
    if key != API_KEY:
        raise HTTPException(status_code=403, detail="Nicht autorisiert")

# ---------------- FastAPI Setup ----------------

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Für Frontend-Zugriff
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------- Datenbank Setup ----------------

DATABASE_URL = "sqlite:///./voranmeldung.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(bind=engine, autoflush=False)
Base = declarative_base()

# ---------------- DB-Modelle ----------------

class Kunde(Base):
    __tablename__ = "kunden"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String, unique=True, index=True)
    name = Column(String, nullable=False)
    telefon = Column(String)
    email = Column(String)
    bemerkung = Column(String)

    artikel = relationship("Artikel", back_populates="kunde", cascade="all, delete")


class Artikel(Base):
    __tablename__ = "artikel"

    id = Column(Integer, primary_key=True, index=True)
    beschreibung = Column(String)
    groesse = Column(String)
    preis = Column(Float)
    kunde_id = Column(Integer, ForeignKey("kunden.id"), nullable=False)

    kunde = relationship("Kunde", back_populates="artikel")


# ---------------- Pydantic-Schemas ----------------

class ArtikelCreate(BaseModel):
    beschreibung: str
    groesse: str
    preis: float

class AnmeldungCreate(BaseModel):
    name: str
    telefon: str
    email: EmailStr
    bemerkung: str = ""
    artikel: List[ArtikelCreate]

# ---------------- DB Initialisierung ----------------

Base.metadata.create_all(bind=engine)

# ---------------- Hilfsfunktion für DB-Session ----------------

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ---------------- API-Endpunkte ----------------

@app.get("/api/anmeldung/all")
def alle_anmeldungen(db: Session = Depends(get_db), _: str = Depends(check_api_key)):
    kunden = db.query(Kunde).all()
    return [
        {
            "uuid": k.uuid,
            "name": k.name,
            "telefon": k.telefon,
            "email": k.email,
            "bemerkung": k.bemerkung,
            "artikel": [
                {
                    "beschreibung": art.beschreibung,
                    "groesse": art.groesse,
                    "preis": art.preis
                } for art in k.artikel
            ]
        } for k in kunden
    ]

@app.post("/api/anmeldung")
def anmeldung_speichern(
    anmeldung: AnmeldungCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    kunde_uuid = str(uuid.uuid4())

    neuer_kunde = Kunde(
        uuid=kunde_uuid,
        name=anmeldung.name,
        telefon=anmeldung.telefon,
        email=anmeldung.email,
        bemerkung=anmeldung.bemerkung
    )

    artikel_liste = []
    for art in anmeldung.artikel:
        neuer_artikel = Artikel(
            beschreibung=art.beschreibung,
            groesse=art.groesse,
            preis=art.preis
        )
        neuer_kunde.artikel.append(neuer_artikel)
        artikel_liste.append({
            "beschreibung": art.beschreibung,
            "groesse": art.groesse,
            "preis": art.preis
        })

    db.add(neuer_kunde)
    db.commit()
    db.refresh(neuer_kunde)

    print("📦 Aktive ENV Variablen:")
    print(f"SMTP_SERVER: {os.getenv('SMTP_SERVER')}")
    print(f"SMTP_USER: {os.getenv('SMTP_USER')}")

    # Hintergrund-Task starten
    link = f"https://bazar.snowteam-tt.de/bearbeiten/{kunde_uuid}"
    sende_bestaetigungsmail(
        anmeldung.email,
        artikel_liste,
        link,
        anmeldung.name,
        kunde_uuid
    )

    return {"status": "ok", "kunde_uuid": neuer_kunde.uuid}


@app.get("/api/anmeldung/{kunde_uuid}")
def anmeldung_anzeigen(kunde_uuid: str, db: Session = Depends(get_db)):
    kunde = db.query(Kunde).filter_by(uuid=kunde_uuid).first()

    if not kunde:
        raise HTTPException(status_code=404, detail="Kunde nicht gefunden")

    return {
        "uuid": kunde.uuid,
        "name": kunde.name,
        "telefon": kunde.telefon,
        "email": kunde.email,
        "bemerkung": kunde.bemerkung,
        "artikel": [
            {
                "beschreibung": art.beschreibung,
                "groesse": art.groesse,
                "preis": art.preis
            }
            for art in kunde.artikel
        ]
    }

@app.put("/api/anmeldung/{uuid}")
def update_anmeldung(uuid: str, data: AnmeldungCreate, db: Session = Depends(get_db)):
    bestehend = db.query(Kunde).filter(Kunde.uuid == uuid).first()
    if not bestehend:
        raise HTTPException(status_code=404, detail="Anmeldung nicht gefunden")

    bestehend.name = data.name
    bestehend.telefon = data.telefon
    bestehend.email = data.email
    bestehend.bemerkung = data.bemerkung

    db.query(Artikel).filter(Artikel.kunde_id == bestehend.id).delete()

    for artikel in data.artikel:
        neuer_artikel = Artikel(
            beschreibung=artikel.beschreibung,
            groesse=artikel.groesse,
            preis=artikel.preis,
            kunde_id=bestehend.id
        )
        db.add(neuer_artikel)

    db.commit()
    return {"status": "updated", "kunde_uuid": uuid}
