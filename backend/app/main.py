from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader
from pydantic import BaseModel, EmailStr
from typing import List
import uuid
import os
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Float, ForeignKey, text
from sqlalchemy.orm import declarative_base, relationship, sessionmaker, Session
from .mail import sende_bestaetigungsmail

print("🔁 SKIBAZAR BACKEND STARTET MIT NEUEM CODE")
# ---------------- Optional: .env für lokale Entwicklung laden ----------------
from dotenv import load_dotenv
load_dotenv()

# ---------------- API-Key Absicherung ----------------

API_KEY = os.getenv("API_KEY_SKIBAZAR")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")
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

DATABASE_URL = "sqlite:///./db/voranmeldung.db"
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
    saison_id = Column(Integer, ForeignKey("saisons.id"), nullable=True)

    artikel = relationship("Artikel", back_populates="kunde", cascade="all, delete")
    saison = relationship("Saison", back_populates="kunden")


class Artikel(Base):
    __tablename__ = "artikel"

    id = Column(Integer, primary_key=True, index=True)
    beschreibung = Column(String)
    groesse = Column(String)
    preis = Column(Float)
    kunde_id = Column(Integer, ForeignKey("kunden.id"), nullable=False)

    kunde = relationship("Kunde", back_populates="artikel")


class Saison(Base):
    __tablename__ = "saisons"

    id   = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)

    kunden = relationship("Kunde", back_populates="saison")


class LogEintrag(Base):
    __tablename__ = "log_eintraege"

    id             = Column(Integer, primary_key=True, index=True)
    zeitstempel    = Column(String, nullable=False)
    ereignis       = Column(String, nullable=False)
    kunde_name     = Column(String)
    kunde_uuid     = Column(String)
    artikel_anzahl = Column(Integer, nullable=True)


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

class AdminLoginRequest(BaseModel):
    password: str

class SaisonCreate(BaseModel):
    name: str

# ---------------- DB Initialisierung ----------------

def run_migrations():
    Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        result = conn.execute(text("PRAGMA table_info(kunden)"))
        columns = [row[1] for row in result]
        if "saison_id" not in columns:
            conn.execute(text("ALTER TABLE kunden ADD COLUMN saison_id INTEGER REFERENCES saisons(id)"))
            conn.commit()

run_migrations()

# ---------------- Hilfsfunktion für DB-Session ----------------

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def log_ereignis(db: Session, ereignis: str, kunde_name: str, kunde_uuid: str, artikel_anzahl: int = None):
    eintrag = LogEintrag(
        zeitstempel=datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
        ereignis=ereignis,
        kunde_name=kunde_name,
        kunde_uuid=kunde_uuid,
        artikel_anzahl=artikel_anzahl,
    )
    db.add(eintrag)
    db.commit()

# ---------------- API-Endpunkte ----------------

@app.get("/api/anmeldung/all")
def alle_anmeldungen(db: Session = Depends(get_db), _: str = Depends(check_api_key)):
    kunden = db.query(Kunde).filter(Kunde.saison_id == None).all()
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

    log_ereignis(db, "Neue Anmeldung", anmeldung.name, kunde_uuid, len(anmeldung.artikel))

    print("📦 Aktive ENV Variablen:")
    print(f"SMTP_SERVER: {os.getenv('SMTP_SERVER')}")
    print(f"SMTP_USER: {os.getenv('SMTP_USER')}")

    # Hintergrund-Task starten
    link = f"https://bazar.snowteam-tt.de/bearbeiten/{kunde_uuid}"
    background_tasks.add_task(
        sende_bestaetigungsmail,
        anmeldung.email,
        artikel_liste,
        link,
        anmeldung.name,
        kunde_uuid
    )

    return {"status": "ok", "kunde_uuid": neuer_kunde.uuid}


@app.get("/api/anmeldung/{kunde_uuid}")
def anmeldung_anzeigen(kunde_uuid: str, db: Session = Depends(get_db)):
    kunde = db.query(Kunde).filter(Kunde.uuid == kunde_uuid, Kunde.saison_id == None).first()

    if not kunde:
        raise HTTPException(status_code=404, detail="Kunde nicht gefunden")

    log_ereignis(db, "Seite aufgerufen", kunde.name, kunde.uuid)

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
    bestehend = db.query(Kunde).filter(Kunde.uuid == uuid, Kunde.saison_id == None).first()
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
    log_ereignis(db, "Bearbeitung gespeichert", bestehend.name, uuid, len(data.artikel))
    return {"status": "updated", "kunde_uuid": uuid}


# ---------------- Admin-Endpunkte ----------------

@app.post("/api/admin/login")
def admin_login(data: AdminLoginRequest):
    if not ADMIN_PASSWORD or data.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Ungültiges Passwort")
    return {"token": API_KEY}


@app.get("/api/admin/saisons")
def saisons_list(db: Session = Depends(get_db), _: str = Depends(check_api_key)):
    return [
        {"id": s.id, "name": s.name, "anzahl": len(s.kunden)}
        for s in db.query(Saison).all()
    ]


@app.post("/api/admin/archivieren")
def archivieren(data: SaisonCreate, db: Session = Depends(get_db), _: str = Depends(check_api_key)):
    if not data.name.strip():
        raise HTTPException(status_code=400, detail="Saisonname darf nicht leer sein")

    saison = db.query(Saison).filter(Saison.name == data.name.strip()).first()
    if not saison:
        saison = Saison(name=data.name.strip())
        db.add(saison)
        db.flush()

    aktuelle = db.query(Kunde).filter(Kunde.saison_id == None).all()
    count = len(aktuelle)
    for k in aktuelle:
        k.saison_id = saison.id

    db.commit()
    return {"status": "archiviert", "saison": saison.name, "anzahl": count}


@app.get("/api/admin/log")
def get_log(db: Session = Depends(get_db), _: str = Depends(check_api_key)):
    eintraege = db.query(LogEintrag).order_by(LogEintrag.id.desc()).limit(200).all()
    return [
        {
            "zeitstempel": e.zeitstempel,
            "ereignis": e.ereignis,
            "kunde_name": e.kunde_name,
            "kunde_uuid": e.kunde_uuid,
            "artikel_anzahl": e.artikel_anzahl,
        }
        for e in eintraege
    ]


@app.get("/api/admin/saisons/{saison_id}")
def saison_detail(saison_id: int, db: Session = Depends(get_db), _: str = Depends(check_api_key)):
    saison = db.query(Saison).filter(Saison.id == saison_id).first()
    if not saison:
        raise HTTPException(status_code=404, detail="Saison nicht gefunden")
    return {
        "id": saison.id,
        "name": saison.name,
        "kunden": [
            {
                "uuid": k.uuid,
                "name": k.name,
                "telefon": k.telefon,
                "email": k.email,
                "bemerkung": k.bemerkung,
                "artikel": [
                    {"beschreibung": a.beschreibung, "groesse": a.groesse, "preis": a.preis}
                    for a in k.artikel
                ]
            }
            for k in saison.kunden
        ]
    }
