from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from typing import List
import uuid
from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, ForeignKey
from sqlalchemy.orm import declarative_base, relationship, sessionmaker, Session

# ---------------- FastAPI Setup ----------------

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # für Frontend-Zugriff
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

@app.post("/api/anmeldung")
def anmeldung_speichern(anmeldung: AnmeldungCreate, db: Session = Depends(get_db)):
    kunde_uuid = str(uuid.uuid4())

    neuer_kunde = Kunde(
        uuid=kunde_uuid,
        name=anmeldung.name,
        telefon=anmeldung.telefon,
        email=anmeldung.email,
        bemerkung=anmeldung.bemerkung
    )

    for art in anmeldung.artikel:
        neuer_kunde.artikel.append(
            Artikel(
                beschreibung=art.beschreibung,
                groesse=art.groesse,
                preis=art.preis
            )
        )

    db.add(neuer_kunde)
    db.commit()
    db.refresh(neuer_kunde)

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
