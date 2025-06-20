import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import QRCode from "react-qr-code";
import { Link } from "react-router-dom";


function Bestätigung() {
    const { uuid } = useParams();
    const [daten, setDaten] = useState(null);

    useEffect(() => {
        fetch(`http://localhost:8000/api/anmeldung/${uuid}`)
            .then((res) => res.json())
            .then(setDaten)
            .catch((err) => console.error(err));
    }, [uuid]);

    if (!daten) return <p className="p-4">Lade Daten...</p>;

    return (
        <div className="max-w-2xl mx-auto p-4 space-y-6">
            <h1 className="text-2xl font-bold text-sky-700">Anmeldung erfolgreich</h1>

            <div className="bg-white border rounded shadow p-4">
                <p className="font-semibold">Name:</p>
                <p>{daten.name}</p>

                <p className="font-semibold mt-2">Telefon:</p>
                <p>{daten.telefon}</p>

                <p className="font-semibold mt-2">E-Mail:</p>
                <p>{daten.email}</p>

                {daten.bemerkung && (
                    <>
                        <p className="font-semibold mt-2">Hinweis:</p>
                        <p>{daten.bemerkung}</p>
                    </>
                )}
            </div>

            <div className="bg-white border rounded shadow p-4">
                <h2 className="font-semibold text-sky-700 mb-2">Artikel</h2>
                <ul className="space-y-2">
                    {daten.artikel.map((a, i) => (
                        <li key={i} className="border p-2 rounded bg-gray-50">
                            <p className="font-semibold">{a.beschreibung}</p>
                            {a.groesse && <p>Größe: {a.groesse}</p>}
                            <p className="text-green-700">Preis: {a.preis} €</p>
                        </li>
                    ))}
                </ul>
                <div className="text-center">
                    <Link
                        to={`/bearbeiten/${uuid}`}
                        className="inline-block mt-4 px-4 py-2 bg-sky-600 text-white rounded hover:bg-sky-700"
                    >
                        📝 Artikel bearbeiten
                    </Link>
                </div>

            </div>

            <section className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex flex-col items-center space-y-4">
                <QRCode value={uuid} size={128} />
                <p className="text-sm text-blue-900 text-center max-w-xs">
                    Bitte zeige den QR-Code bei der Warenannahme vor.
                    Er enthält deineArtikel von der Voranmeldung und beschleunigt dann den Ablauf vor Ort.
                </p>
            </section>


        </div>
    );
}

export default Bestätigung;
