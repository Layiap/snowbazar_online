import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function AdminDashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem("admin_token");

  const [saisons, setSaisons] = useState([]);
  const [currentCount, setCurrentCount] = useState(null);
  const [currentAnmeldungen, setCurrentAnmeldungen] = useState([]);
  const [showCurrentTable, setShowCurrentTable] = useState(false);
  const [saisonName, setSaisonName] = useState("");
  const [archiving, setArchiving] = useState(false);

  const [expandedSaisonId, setExpandedSaisonId] = useState(null);
  const [saisonDetail, setSaisonDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [logEintraege, setLogEintraege] = useState([]);
  const [showLog, setShowLog] = useState(false);

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: token,
  };

  const loadData = useCallback(async () => {
    try {
      const allRes = await fetch(`${import.meta.env.VITE_API_URL}/api/anmeldung/all`, {
        headers: { Authorization: token },
      });
      if (allRes.status === 403) {
        localStorage.removeItem("admin_token");
        navigate("/admin");
        return;
      }
      const allData = await allRes.json();
      setCurrentCount(allData.length);
      setCurrentAnmeldungen(allData);

      const saisonRes = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/saisons`, {
        headers: { Authorization: token },
      });
      const saisonData = await saisonRes.json();
      setSaisons(saisonData);

      const logRes = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/log`, {
        headers: { Authorization: token },
      });
      setLogEintraege(await logRes.json());
    } catch {
      toast.error("Fehler beim Laden der Daten");
    }
  }, [token, navigate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const fetchSaisonDetail = async (saisonId) => {
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/saisons/${saisonId}`, {
      headers: { Authorization: token },
    });
    if (!res.ok) throw new Error("Fehler beim Laden der Saison");
    return await res.json();
  };

  const handleSaisonClick = async (saison) => {
    if (expandedSaisonId === saison.id) {
      setExpandedSaisonId(null);
      setSaisonDetail(null);
      return;
    }
    setLoadingDetail(true);
    try {
      const detail = await fetchSaisonDetail(saison.id);
      setSaisonDetail(detail);
      setExpandedSaisonId(saison.id);
    } catch {
      toast.error("Saison konnte nicht geladen werden");
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleDownload = async (saison) => {
    try {
      let detail;
      if (expandedSaisonId === saison.id && saisonDetail) {
        detail = saisonDetail;
      } else {
        detail = await fetchSaisonDetail(saison.id);
      }
      const blob = new Blob([JSON.stringify(detail, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `saison-${saison.name.replace(/\//g, "-")}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Download fehlgeschlagen");
    }
  };

  const handleArchive = async () => {
    if (!saisonName.trim()) {
      toast.warning("Bitte einen Saisonnamen eingeben");
      return;
    }
    const confirmed = window.confirm(
      `Alle ${currentCount} aktuellen Anmeldungen in Saison "${saisonName}" archivieren?`
    );
    if (!confirmed) return;

    setArchiving(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/archivieren`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ name: saisonName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.detail || "Fehler beim Archivieren");
        return;
      }
      toast.success(`${data.anzahl} Anmeldungen in "${data.saison}" archiviert`);
      setSaisonName("");
      setExpandedSaisonId(null);
      setSaisonDetail(null);
      setShowCurrentTable(false);
      await loadData();
    } catch {
      toast.error("Serverfehler beim Archivieren");
    } finally {
      setArchiving(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    navigate("/admin");
  };

  const renderKundenTable = (kunden) => {
    const rows = [];
    for (const kunde of kunden) {
      if (kunde.artikel.length === 0) {
        rows.push({ kunde, artikel: null, first: true });
      } else {
        kunde.artikel.forEach((art, i) => {
          rows.push({ kunde, artikel: art, first: i === 0 });
        });
      }
    }

    if (rows.length === 0) {
      return <p className="text-sm text-gray-500 mt-3">Keine Anmeldungen vorhanden.</p>;
    }

    return (
      <div className="overflow-x-auto mt-4">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-sky-50 text-sky-800 text-left">
              <th className="border border-gray-200 px-3 py-2">Name</th>
              <th className="border border-gray-200 px-3 py-2">Telefon</th>
              <th className="border border-gray-200 px-3 py-2">E-Mail</th>
              <th className="border border-gray-200 px-3 py-2">Beschreibung</th>
              <th className="border border-gray-200 px-3 py-2">Größe</th>
              <th className="border border-gray-200 px-3 py-2">Preis</th>
              <th className="border border-gray-200 px-3 py-2">Link</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="border border-gray-200 px-3 py-1.5">
                  {row.first ? row.kunde.name : ""}
                </td>
                <td className="border border-gray-200 px-3 py-1.5 text-gray-500">
                  {row.first ? row.kunde.telefon : ""}
                </td>
                <td className="border border-gray-200 px-3 py-1.5 text-gray-500">
                  {row.first ? row.kunde.email : ""}
                </td>
                <td className="border border-gray-200 px-3 py-1.5">
                  {row.artikel ? row.artikel.beschreibung : "–"}
                </td>
                <td className="border border-gray-200 px-3 py-1.5">
                  {row.artikel ? row.artikel.groesse : "–"}
                </td>
                <td className="border border-gray-200 px-3 py-1.5">
                  {row.artikel ? `${row.artikel.preis.toFixed(2)} €` : "–"}
                </td>
                <td className="border border-gray-200 px-3 py-1.5">
                  {row.first ? (
                    <a
                      href={`/bearbeiten/${row.kunde.uuid}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-600 hover:text-sky-800 hover:underline whitespace-nowrap"
                    >
                      Bearbeiten ↗
                    </a>
                  ) : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6 pt-8">
      <div className="flex justify-between items-center border-b pb-4">
        <h1 className="text-2xl font-bold text-sky-800">Admin Dashboard</h1>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-500 hover:underline"
        >
          Abmelden
        </button>
      </div>

      {/* Aktuelle Anmeldungen */}
      <div className="bg-white shadow-md rounded-lg p-6 border border-gray-200">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-semibold text-sky-700 mb-2">Aktuelle Anmeldungen</h2>
            <p className="text-4xl font-bold text-sky-900">
              {currentCount === null ? "..." : currentCount}
            </p>
            <p className="text-sm text-gray-500 mt-1">nicht archivierte Anmeldungen</p>
          </div>
          {currentCount > 0 && (
            <button
              onClick={() => setShowCurrentTable((v) => !v)}
              className="text-sm text-sky-700 hover:text-sky-900 border border-sky-300 hover:border-sky-500 px-3 py-1 rounded mt-1"
            >
              {showCurrentTable ? "Ausblenden ▲" : "Anzeigen ▼"}
            </button>
          )}
        </div>
        {showCurrentTable && renderKundenTable(currentAnmeldungen)}
      </div>

      {/* Saison archivieren */}
      <div className="bg-white shadow-md rounded-lg p-6 border border-gray-200 space-y-4">
        <h2 className="text-xl font-semibold text-sky-700">Saison archivieren</h2>
        <input
          type="text"
          placeholder='Saisonname, z.B. "2025/26"'
          value={saisonName}
          onChange={(e) => setSaisonName(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded"
        />
        <button
          onClick={handleArchive}
          disabled={archiving || currentCount === 0}
          className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white px-4 py-2 rounded font-semibold"
        >
          {archiving ? "Wird archiviert..." : "Jetzt archivieren"}
        </button>
        {currentCount === 0 && (
          <p className="text-sm text-gray-500">Keine aktuellen Anmeldungen vorhanden.</p>
        )}
      </div>

      {/* Archivierte Saisons */}
      <div className="bg-white shadow-md rounded-lg p-6 border border-gray-200">
        <h2 className="text-xl font-semibold text-sky-700 mb-4">Archivierte Saisons</h2>
        {saisons.length === 0 ? (
          <p className="text-gray-500 text-sm">Noch keine Saisons archiviert.</p>
        ) : (
          <ul className="space-y-2">
            {saisons.map((s) => (
              <li key={s.id} className="border rounded bg-gray-50">
                <div className="flex justify-between items-center p-3">
                  <button
                    onClick={() => handleSaisonClick(s)}
                    className="flex items-center gap-2 text-left font-semibold text-sky-900 hover:text-sky-600"
                  >
                    <span className="text-xs text-gray-400">
                      {expandedSaisonId === s.id ? "▼" : "▶"}
                    </span>
                    {s.name}
                    <span className="text-sm font-normal text-gray-500">
                      {s.anzahl} Anmeldungen
                    </span>
                  </button>
                  <button
                    onClick={() => handleDownload(s)}
                    className="text-sm text-sky-700 hover:text-sky-900 border border-sky-300 hover:border-sky-500 px-3 py-1 rounded"
                  >
                    JSON ↓
                  </button>
                </div>
                {expandedSaisonId === s.id && (
                  <div className="px-3 pb-4">
                    {loadingDetail ? (
                      <p className="text-sm text-gray-400 mt-3">Lade Daten...</p>
                    ) : (
                      saisonDetail && renderKundenTable(saisonDetail.kunden)
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Logbuch */}
      <div className="bg-white shadow-md rounded-lg p-6 border border-gray-200">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-sky-700">Logbuch</h2>
          <button
            onClick={() => setShowLog((v) => !v)}
            className="text-sm text-sky-700 hover:text-sky-900 border border-sky-300 hover:border-sky-500 px-3 py-1 rounded"
          >
            {showLog ? "Ausblenden ▲" : "Anzeigen ▼"}
          </button>
        </div>
        {showLog && (
          logEintraege.length === 0 ? (
            <p className="text-sm text-gray-500 mt-4">Noch keine Einträge vorhanden.</p>
          ) : (
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-sky-50 text-sky-800 text-left">
                    <th className="border border-gray-200 px-3 py-2">Datum / Uhrzeit</th>
                    <th className="border border-gray-200 px-3 py-2">Ereignis</th>
                    <th className="border border-gray-200 px-3 py-2">Name</th>
                    <th className="border border-gray-200 px-3 py-2">Artikel</th>
                  </tr>
                </thead>
                <tbody>
                  {logEintraege.map((e, i) => {
                    const badgeClass =
                      e.ereignis === "Neue Anmeldung"
                        ? "bg-green-100 text-green-800"
                        : e.ereignis === "Bearbeitung gespeichert"
                        ? "bg-orange-100 text-orange-800"
                        : "bg-blue-100 text-blue-800";
                    const zeit = new Date(e.zeitstempel).toLocaleString("de-DE", {
                      dateStyle: "short",
                      timeStyle: "short",
                    });
                    return (
                      <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="border border-gray-200 px-3 py-1.5 text-gray-500 whitespace-nowrap">
                          {zeit}
                        </td>
                        <td className="border border-gray-200 px-3 py-1.5">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${badgeClass}`}>
                            {e.ereignis}
                          </span>
                        </td>
                        <td className="border border-gray-200 px-3 py-1.5">{e.kunde_name}</td>
                        <td className="border border-gray-200 px-3 py-1.5 text-center">
                          {e.artikel_anzahl !== null ? e.artikel_anzahl : "–"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      <ToastContainer position="top-center" autoClose={3000} />
    </div>
  );
}

export default AdminDashboard;
