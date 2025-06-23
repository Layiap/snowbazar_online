import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import logo from "./assets/Snowteam_Logo_2016.png";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";


function App() {
  const navigate = useNavigate();
  const { uuid } = useParams();
  const imBearbeitungsmodus = !!uuid;

  const [artikel, setArtikel] = useState([]);
  const [einwilligung, setEinwilligung] = useState(false);
  const [einwilligungFehler, setEinwilligungFehler] = useState(false);

  const [kunde, setKunde] = useState({
    name: "",
    telefon: "",
    email: "",
    bemerkung: "",
  });

  const [neuerArtikel, setNeuerArtikel] = useState({
    beschreibung: "",
    groesse: "",
    preis: "",
  });

  const [kundeFehler, setKundeFehler] = useState({
    name: false,
    telefon: false,
    email: false,
  });

  const [artikelFehler, setArtikelFehler] = useState({
    beschreibung: false,
    preis: false,
  });

  const handleKundeChange = (e) => {
    setKunde({ ...kunde, [e.target.name]: e.target.value });
  };

  const handleArtikelInputChange = (e) => {
    setNeuerArtikel({ ...neuerArtikel, [e.target.name]: e.target.value });
  };

  const handleArtikelKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault(); // verhindert Form-Submit oder Zeilenumbruch
      addArtikel();
    }
  };

  const addArtikel = () => {
    const errors = {
      beschreibung: !neuerArtikel.beschreibung.trim(),
      preis: !neuerArtikel.preis.trim(),
    };

    setArtikelFehler(errors);

    if (errors.beschreibung || errors.preis) return;

    setArtikel([...artikel, neuerArtikel]);
    setNeuerArtikel({ beschreibung: "", groesse: "", preis: "" });
    setArtikelFehler({ beschreibung: false, preis: false });
  };

  const removeArtikel = (index) => {
    const updated = [...artikel];
    updated.splice(index, 1);
    setArtikel(updated);
  };

  const handleSubmit = async () => {
    if (!einwilligung) {
      setEinwilligungFehler(true);
      toast.warning("Bitte der Datenschutzerklärung zustimmen.");
      return;
    }

    const errors = {
      name: !kunde.name.trim(),
      telefon: !kunde.telefon.trim(),
      email: !kunde.email.trim(),
    };

    setKundeFehler(errors);

    const hatFehler = Object.values(errors).some(Boolean);
    if (hatFehler || artikel.length === 0) {
      if (artikel.length === 0) {
        toast.warning("Bitte mindestens einen Artikel hinzufügen.");
      }
      return;
    }

    try {
      const methode = imBearbeitungsmodus ? "PUT" : "POST";
      const url = imBearbeitungsmodus
        ? `${import.meta.env.VITE_API_URL}/api/anmeldung/${uuid}`
        : `${import.meta.env.VITE_API_URL}/api/anmeldung`;

      const payload = {
        ...kunde,
        artikel,
        ...(imBearbeitungsmodus ? { uuid } : {}),
      };

      const response = await fetch(url, {
        method: methode,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.status === 422) {
        const emailFehler = result.detail?.some(
          (e) => e.loc?.includes("email") && e.type?.includes("value_error")
        );
        if (emailFehler) {
          setKundeFehler((prev) => ({ ...prev, email: true }));
          toast.error("Bitte eine gültige E-Mail-Adresse eingeben.");
        } else {
          toast.error("Ungültige Eingabedaten.");
        }
        return;
      }

      if (response.ok) {
        toast.success("Daten erfolgreich gespeichert!");
        navigate(`/bestaetigung/${result.kunde_uuid || uuid}`);
      } else {
        toast.error("Fehler: " + result.detail || "Unbekannter Fehler");
        console.error(result.detail);
      }
    } catch (err) {
      console.error(err);
      toast.error("Serverfehler beim Speichern");
    }
  };


  useEffect(() => {
    if (imBearbeitungsmodus) {
      fetch(`${import.meta.env.VITE_API_URL}/api/anmeldung/${uuid}`)
        .then((res) => res.json())
        .then((daten) => {
          setKunde({
            name: daten.name,
            telefon: daten.telefon,
            email: daten.email,
            bemerkung: daten.bemerkung || "",
          });
          setArtikel(daten.artikel || []);
        })
        .catch(() => toast.error("Fehler beim Laden der Anmeldung"));
    }
  }, [uuid]);


  return (
    <div className="max-w-2xl mx-auto p-4">
      <header className="flex items-center gap-4 mb-8 border-b pb-4">
        <img src={logo} alt="Logo" className="h-16" />
        <div>
          <h1 className="text-3xl font-extrabold text-sky-800">
            Artikel Voranmeldung
          </h1>
          <p className="text-gray-600 text-sm">Snowteam Tettnang</p>
        </div>
      </header>

      <section className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-blue-800 mb-2">So funktioniert die Voranmeldung</h2>
        <ul className="list-disc list-inside text-sm text-blue-900 space-y-1">
          <li>Artikel können online vorab angemeldet werden, damit die Warenannahme vor Ort schneller geht.</li>
          <li>Nach der Anmeldung erhalten Sie einen QR-Code, den Sie vor Ort vorzeigen können – sowohl auf dem Handy als auch per E-Mail.</li>
          <li>Die Artikelliste kann nachträglich nochmals bearbeitet oder ergänzt werden.</li>
        </ul>
      </section>


      <section className="space-y-4">
        <div className="bg-white shadow-md rounded-lg p-6 space-y-4 border border-gray-200">
          <h2 className="text-xl font-semibold text-sky-700">Persönliche Daten</h2>

          <input
            name="name"
            placeholder="Name *"
            value={kunde.name}
            onChange={handleKundeChange}
            disabled={imBearbeitungsmodus}
            className={`w-full p-2 border rounded 
              ${kundeFehler.name ? "border-red-500" : "border-gray-300"} 
              ${imBearbeitungsmodus ? "bg-gray-100 text-gray-600 cursor-not-allowed" : "bg-white"}
            `}
          />

          {kundeFehler.name && (
            <p className="text-red-500 text-sm mt-1">Name ist erforderlich.</p>
          )}
          <input
            name="telefon"
            placeholder="Telefon *"
            value={kunde.telefon}
            onChange={handleKundeChange}
            disabled={imBearbeitungsmodus}
            className={`w-full p-2 border rounded 
              ${kundeFehler.telefon ? "border-red-500" : "border-gray-300"} 
              ${imBearbeitungsmodus ? "bg-gray-100 text-gray-600 cursor-not-allowed" : "bg-white"}
            `}
          />

          {kundeFehler.telefon && (
            <p className="text-red-500 text-sm mt-1">Telefon ist erforderlich.</p>
          )}

          <input
            name="email"
            placeholder="E-Mail *"
            type="email"
            value={kunde.email}
            onChange={handleKundeChange}
            disabled={imBearbeitungsmodus}
            className={`w-full p-2 border rounded 
              ${kundeFehler.email ? "border-red-500" : "border-gray-300"} 
              ${imBearbeitungsmodus ? "bg-gray-100 text-gray-600 cursor-not-allowed" : "bg-white"}
            `}
          />

          {kundeFehler.email && (
            <p className="text-red-500 text-sm mt-1">E-Mail ist erforderlich.</p>
          )}

          <textarea
            name="bemerkung"
            placeholder="Hinweise / Anmerkungen"
            value={kunde.bemerkung}
            onChange={handleKundeChange}
            className="w-full p-2 border border-gray-300 rounded"
          ></textarea>
        </div>
      </section>


      <section className="mt-6">
        <div className="bg-white shadow-md rounded-lg p-6 space-y-4 border border-gray-200">
          <h2 className="text-xl font-semibold text-sky-700">Artikel hinzufügen</h2>

          <input
            name="beschreibung"
            placeholder="Artikelbeschreibung *"
            value={neuerArtikel.beschreibung}
            onChange={handleArtikelInputChange}
            onKeyDown={handleArtikelKeyDown}
            className={`w-full p-2 border rounded ${artikelFehler.beschreibung ? "border-red-500" : "border-gray-300"
              }`}
          />
          {artikelFehler.beschreibung && (
            <p className="text-red-500 text-sm mt-1">Beschreibung ist erforderlich.</p>
          )}

          <input
            name="groesse"
            placeholder="Größe (optional)"
            value={neuerArtikel.groesse}
            onChange={handleArtikelInputChange}
            onKeyDown={handleArtikelKeyDown}
            className="w-full p-2 border border-gray-300 rounded"
          />

          <input
            name="preis"
            placeholder="Preis (€) *"
            type="number"
            step="0.01"
            value={neuerArtikel.preis}
            onChange={handleArtikelInputChange}
            onKeyDown={handleArtikelKeyDown}
            className={`w-full p-2 border rounded ${artikelFehler.preis ? "border-red-500" : "border-gray-300"
              }`}
          />
          {artikelFehler.preis && (
            <p className="text-red-500 text-sm mt-1">Preis ist erforderlich.</p>
          )}

          <button
            onClick={addArtikel}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          >
            + Artikel hinzufügen
          </button>
        </div>
      </section>


      {artikel.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xl font-semibold text-sky-700 mb-2">
            📦 Hinzugefügte Artikel
          </h2>
          <ul className="space-y-2">
            {artikel.map((a, i) => (
              <li
                key={i}
                className="border rounded p-3 flex justify-between items-start bg-gray-50"
              >
                <div>
                  <p className="font-semibold">{a.beschreibung}</p>
                  {a.groesse && <p className="text-sm text-gray-600">Größe: {a.groesse}</p>}
                  <p className="text-sm font-medium text-green-700">Preis: {a.preis} €</p>
                </div>
                <button
                  onClick={() => removeArtikel(i)}
                  className="text-red-500 text-sm hover:underline"
                >
                  Löschen
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-6">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={einwilligung}
            onChange={(e) => {
              setEinwilligung(e.target.checked);
              setEinwilligungFehler(false);
            }}
            className="mt-1"
          />
          <span>
            Ich stimme zu, dass meine Angaben zur Durchführung des Skibazars verarbeitet
            werden dürfen. Die Daten werden nach dem Bazar gelöscht. Eine Weitergabe
            an Dritte erfolgt nicht.
          </span>
        </label>
        {einwilligungFehler && (
          <p className="text-red-500 text-sm mt-1">Bitte zustimmen, um fortzufahren.</p>
        )}
      </div>



      <button
        onClick={handleSubmit}
        className="mt-6 w-full bg-green-600 text-white p-3 rounded text-lg font-semibold"
      >
        {imBearbeitungsmodus ? "Änderungen speichern" : "Anmeldung absenden"}
      </button>
      <ToastContainer position="top-center" autoClose={3000} hideProgressBar={false} />
    </div>
  );
}

export default App;
