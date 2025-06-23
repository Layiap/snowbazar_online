import os
import smtplib
from email.message import EmailMessage
from email.utils import make_msgid
from jinja2 import Environment, FileSystemLoader
import qrcode
from io import BytesIO
from pathlib import Path
from dotenv import load_dotenv

# .env laden (nur nötig für lokale Entwicklung oder Deployment)
load_dotenv()

# SMTP Konfiguration
SMTP_SERVER = os.getenv("SMTP_SERVER")
SMTP_PORT = int(os.getenv("SMTP_PORT", 465))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASS = os.getenv("SMTP_PASS")
ABSENDER_EMAIL = os.getenv("ABSENDER_EMAIL", SMTP_USER)

# Template-Verzeichnis relativ zur Datei mail.py
TEMPLATE_DIR = Path(__file__).resolve().parent / "templates"
env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)))


def sende_bestaetigungsmail(empfaenger: str, artikel: list, link: str, name: str, uuid: str):
    # 🧾 QR-Code für UUID erzeugen
    qr = qrcode.QRCode(
        version=5,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=5,
        border=2
    )
    qr.add_data(uuid)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")

    buffer = BytesIO()
    img.save(buffer, format="PNG")
    qr_data = buffer.getvalue()
    buffer.close()

    # 🖋️ HTML-Template rendern
    template = env.get_template("email_template.html")
    html_body = template.render(name=name, artikel=artikel, link=link)

    # 📜 Fallback: Plain-Text-Version
    text_body = f"""Hallo {name},

vielen Dank für deine Vorabanmeldung zum Skibazar!
Bitte bring den QR-Code zur Warenannahme mit (nicht im Text sichtbar).

Artikel:
{chr(10).join([f"- {a['beschreibung']} ({a['groesse']}, {a['preis']} €)" for a in artikel])}

Bearbeiten: {link}
Mehr Infos: https://ssctettnang.wordpress.com/wintersport/aktuelles-skiabteilung/ski-und-sportbazar/
"""

    # 📧 E-Mail zusammensetzen
    msg = EmailMessage()
    msg["Subject"] = "Deine Skibazar-Voranmeldung"
    msg["From"] = ABSENDER_EMAIL
    msg["To"] = empfaenger

    msg.set_content(text_body)

    # 📎 QR-Code in HTML einbetten
    image_cid = make_msgid()[1:-1]  # CID ohne <>
    html_body = html_body.replace("cid:qrcode", f"cid:{image_cid}")
    msg.add_alternative(html_body, subtype="html")
    msg.get_payload()[1].add_related(qr_data, maintype="image", subtype="png", cid=image_cid)

    # 📤 Versand
    try:
        with smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT) as server:
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)
        print(f"E-Mail an {empfaenger} erfolgreich versendet.")
    except Exception as e:
        print(f"Fehler beim Senden der E-Mail an {empfaenger}: {e}")
