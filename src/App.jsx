import React, { useEffect, useMemo, useRef, useState } from "react";

// ==============================================
// Casa Alofoke – Fan Tracker (NO OFICIAL)
// Vista previa en un solo archivo React
// ==============================================
// 🔹 Esta versión incluye:
//   - Pestañas: Inicio, Participantes, Noticias, Parejas, Métricas
//   - Un **único enlace** al live activo por 30 días (CONFIG.LIVE_URL)
//   - Player embebido si el enlace es de YouTube
//   - Votos (demo local) y horas online desde STREAM_START_ISO
//   - Embeds de métricas (si el enlace es de YouTube y se detecta el ID)
//   - **Quién va ganando** (ganador actual + Top 3)
//   - **Panel de votos manuales** (añadir, restar, establecer, importar/exportar JSON)
// 🔹 NUEVO: En pestaña **Noticias**, se muestra el **timeline de X (Twitter)**
//           de Santiago Matías, limitado a los **últimos 3 tweets**.

// ===================
// CONFIGURACIÓN RÁPIDA
// ===================
const CONFIG = {
  // ✅ Enlace ÚNICO del live (activo por 30 días)
  // Reemplázalo por el URL real del live (YouTube recomendado)
  LIVE_URL: "https://www.youtube.com/live/gOJvu0xYsdo",

  // Fecha/hora de inicio del reality (para calcular horas online)
  STREAM_START_ISO: "2025-08-11T00:00:00-04:00",

  // Fuentes de noticias (en producción, usa /api/news para leer RSS)
  NEWS_SOURCES: [
    { name: "Listín Diario", url: "https://listindiario.com/" },
    { name: "El Nacional", url: "https://elnacional.com.do/" },
    { name: "Diario Libre", url: "https://www.diariolibre.com/" },
    { name: "Noticias SIN", url: "https://noticiassin.com/" },
  ],

  // 🔹 Usuario de X (Twitter) para la sección Noticias
  // Según X, el handle de Santiago Matías es @matiasgarciard.
  X_HANDLE: "matiasgarciard",
};

// Participantes reales (puedes editar nombres/IG si cambian)
const PARTICIPANTS = [
  { id: "lapeki", name: "La Peki PR (Andrea Victoria Ojeda)", slug: "la-peki-pr", ig: "lapekipr" },
  { id: "giuseppe", name: "Giuseppe Benignini", slug: "giuseppe-benignini", ig: "gbenignini" },
  { id: "lagigi", name: "Gigi Núñez (La Gigi)", slug: "gigi-nunez", ig: "" },
  { id: "srjimenez", name: "Sr. Jiménez (Yariel Smirt Jiménez)", slug: "sr-jimenez", ig: "" },
  { id: "karola", name: "Karola Cendra", slug: "karola-cendra", ig: "karolalcendra_" },
  { id: "crazydesign", name: "Crazy Design (José Rafael Colón)", slug: "crazy-design", ig: "crazydesignrd" },
  { id: "vladimir", name: "Vladimir Gómez", slug: "vladimir-gomez", ig: "justvladyg" },
  { id: "mamikim", name: "Mami Kim (Kimberly Michell Guillermo)", slug: "mami-kim", ig: "mamikimreal" },
  { id: "luise", name: "Luise Martínez", slug: "luise-martinez", ig: "" },
  { id: "crusita", name: "Crusita (Darileidy Concepción)", slug: "crusita", ig: "crusita___" },
];

// Relaciones / Parejas (completa/edita handles cuando quieras)
const RELATIONS = [
  { name: "Pareja de La Peki", of: "lapeki", ig: "", x: "" },
  { name: "Pareja de Giuseppe", of: "giuseppe", ig: "", x: "" },
];

// ===================
// Utilidades de imagen
// ===================
function placeholderFor(name) {
  return `https://placehold.co/800x400?text=${encodeURIComponent(name)}`;
}
// Unavatar + proxy para CORS/resize
function igAvatarUrl(ig, w = 800, h = 400) {
  if (!ig) return "";
  const path = `unavatar.io/instagram/${encodeURIComponent(ig)}`;
  return `https://images.weserv.nl/?url=${path}&w=${w}&h=${h}&fit=cover`;
}
function getAvatar(p) {
  return p.ig ? igAvatarUrl(p.ig) : placeholderFor(p.name);
}

// ===================
// Utilidades de tiempo
// ===================
function diffNow(startIso) {
  const start = new Date(startIso).getTime();
  const now = Date.now();
  const ms = Math.max(0, now - start);
  const totalHours = Math.floor(ms / 3600000);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = Math.floor((ms % 3600000) / 60000);
  return { ms, totalHours, days, hours, minutes };
}
function formatDuration(d) {
  if (!d) return "";
  const parts = [];
  if (d.days) parts.push(`${d.days}d`);
  if (d.hours || d.days) parts.push(`${d.hours}h`);
  parts.push(`${d.minutes}m`);
  return parts.join(" ");
}

// ===================
// Enlace único → extraer ID de YouTube (solo regex; sin new URL)
// ===================
function parseYouTubeIdFromUrl(url) {
  if (!url || typeof url !== "string") return null;
  // watch?v=ID
  const q = url.match(/[?&]v=([a-zA-Z0-9_-]{6,})/);
  if (q) return q[1];
  // youtu.be/ID
  const yb = url.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/);
  if (yb) return yb[1];
  // youtube.com/live/ID
  const lv = url.match(/youtube\.com\/live\/([a-zA-Z0-9_-]{6,})/);
  if (lv) return lv[1];
  // youtube.com/embed/ID
  const em = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/);
  if (em) return em[1];
  return null;
}

function buildYouTubeEmbedUrl(id) {
  // autoplay muted para evitar bloqueos en algunos navegadores
  return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&rel=0`;
}

// ===================
// Ranking / Ganador actual
// ===================
function computeLeaderboard(votes) {
  const total = Object.values(votes || {}).reduce((a, b) => a + b, 0);
  const list = PARTICIPANTS.map((p) => ({
    ...p,
    score: votes?.[p.id] || 0,
  }))
    .sort((a, b) => b.score - a.score)
    .map((p, i) => ({
      ...p,
      rank: i + 1,
      pct: total ? Math.round((p.score * 1000) / total) / 10 : 0, // 1 decimal
    }));
  return { total, list, winner: list[0] };
}

// ===================
// Votos helpers (puros) para testear y usar en el hook
// ===================
function applyAddVotes(prev, pid, delta) {
  const d = parseInt(delta, 10);
  const safeDelta = Number.isFinite(d) ? d : 0;
  const next = Math.max(0, (prev?.[pid] || 0) + safeDelta);
  return { ...prev, [pid]: next };
}
function applySetVotes(prev, pid, value) {
  const v = parseInt(value, 10);
  const safe = Math.max(0, Number.isFinite(v) ? v : 0);
  return { ...prev, [pid]: safe };
}

// ===================
// Demo: noticias normalizadas (sigue como backup al timeline de X)
// ===================
function useNewsDemo() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const mock = [
      { title: "Arranca Casa Alofoke 24/7 con 10 participantes", source: "Listín Diario", url: CONFIG.LIVE_URL, ts: Date.now() - 3600e3 },
      { title: "Fanáticos votan y comentan en tiempo real", source: "El Nacional", url: CONFIG.LIVE_URL, ts: Date.now() - 2*3600e3 },
      { title: "Momentos virales del primer día", source: "Diario Libre", url: CONFIG.LIVE_URL, ts: Date.now() - 5*3600e3 },
    ];
    setItems(mock);
  }, []);
  const sorted = useMemo(() => [...items].sort((a,b) => b.ts - a.ts), [items]);
  return { items: sorted };
}

// ===================
// Votos (demo local)
// ===================
function useLocalVotes() {
  const key = "alofoke_preview_votes";
  const [votes, setVotes] = useState({});
  useEffect(() => {
    try { const raw = localStorage.getItem(key); if (raw) setVotes(JSON.parse(raw)); } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(votes)); } catch {}
  }, [votes]);

  const vote = (pid) => setVotes((v) => applyAddVotes(v, pid, 1));
  const addVotes = (pid, delta) => setVotes((v) => applyAddVotes(v, pid, delta));
  const setVotesFor = (pid, value) => setVotes((v) => applySetVotes(v, pid, value));
  const importVotes = (json) => {
    try {
      const obj = JSON.parse(json);
      if (!obj || typeof obj !== "object") return false;
      setVotes((prev) => {
        const merged = { ...prev };
        for (const k of Object.keys(obj)) {
          if (PARTICIPANTS.some((p) => p.id === k)) {
            const v = parseInt(obj[k], 10);
            merged[k] = Math.max(0, Number.isFinite(v) ? v : 0);
          }
        }
        return merged;
      });
      return true;
    } catch {
      return false;
    }
  };
  const exportVotes = () => JSON.stringify(votes, null, 2);
  const reset = () => setVotes({});
  const total = useMemo(() => Object.values(votes).reduce((a, b) => a + b, 0), [votes]);
  return { votes, vote, reset, total, addVotes, setVotesFor, importVotes, exportVotes };
}

// ===================
// Tests rápidos (console)
// ===================
function runDevTests() {
  const results = [];
  const assert = (name, cond) => results.push({ name, pass: !!cond });

  // Participantes
  assert("participants-count-is-10", Array.isArray(PARTICIPANTS) && PARTICIPANTS.length === 10);
  const ids = PARTICIPANTS.map((p) => p.id); const uniq = new Set(ids);
  assert("participant-ids-are-unique", uniq.size === ids.length);
  assert("participants-have-name-and-slug", PARTICIPANTS.every((p) => p.name && p.slug));

  // Avatares
  const withIG = PARTICIPANTS.filter((p) => p.ig);
  assert("igAvatarUrl-uses-weserv-proxy", withIG.every((p) => igAvatarUrl(p.ig).includes("images.weserv.nl") && igAvatarUrl(p.ig).includes("unavatar.io/instagram")));
  assert("getAvatar-returns-url", PARTICIPANTS.every((p) => typeof getAvatar(p) === "string" && getAvatar(p).length > 0));

  // Duración live
  const d = diffNow(CONFIG.STREAM_START_ISO);
  assert("duration-positive", d.totalHours >= 0);
  assert("formatDuration-nonempty", formatDuration(d).length > 0);

  // Enlace único y parsing de ID (pruebas adicionales)
  const ytId = parseYouTubeIdFromUrl(CONFIG.LIVE_URL);
  assert("live-url-exists", typeof CONFIG.LIVE_URL === "string" && CONFIG.LIVE_URL.length > 0);
  assert("youtube-id-parsed-or-null", ytId === null || /^[a-zA-Z0-9_-]{6,}$/.test(ytId));

  // Casos de parseo específicos
  const TID = "gOJvu0xYsdo";
  assert("parse-watch", parseYouTubeIdFromUrl(`https://www.youtube.com/watch?v=${TID}`) === TID);
  assert("parse-short", parseYouTubeIdFromUrl(`https://youtu.be/${TID}`) === TID);
  assert("parse-live", parseYouTubeIdFromUrl(`https://www.youtube.com/live/${TID}`) === TID);
  assert("parse-embed", parseYouTubeIdFromUrl(`https://www.youtube.com/embed/${TID}`) === TID);
  assert("parse-non-youtube", parseYouTubeIdFromUrl("https://vimeo.com/123456") === null);

  // Leaderboard
  const sampleVotes = { lapeki: 5, giuseppe: 2, crusita: 0 };
  const lb = computeLeaderboard(sampleVotes);
  assert("lb-length-10", lb.list.length === 10);
  assert("lb-total-7", lb.total === 7);
  assert("lb-winner-lapeki", lb.winner && lb.winner.id === "lapeki");
  const pctSum = Math.round(lb.list.reduce((s, x) => s + x.pct, 0));
  assert("lb-pct-sum-approx-100", Math.abs(pctSum - 100) <= 1);
  const lbZero = computeLeaderboard({});
  assert("lb-zero-safe", lbZero.total === 0 && lbZero.list.length === 10 && lbZero.winner.pct === 0);

  // Votos helpers puros
  let tmp = {};
  tmp = applyAddVotes(tmp, "lapeki", 3); // 3
  tmp = applyAddVotes(tmp, "lapeki", -1); // 2
  tmp = applySetVotes(tmp, "giuseppe", 10); // 10
  assert("applyAddVotes-nonnegative", tmp.lapeki === 2);
  assert("applySetVotes-assigns", tmp.giuseppe === 10);
  tmp = applyAddVotes(tmp, "lapeki", -999); // clamp to 0
  assert("applyAddVotes-clamp-0", tmp.lapeki === 0);

  // Config X
  assert("x-handle-present", typeof CONFIG.X_HANDLE === "string" && CONFIG.X_HANDLE.length > 0);

  console.group("AlofokePreview :: test results");
  const allPass = results.every((r) => r.pass);
  results.forEach((r) => console[r.pass ? "log" : "error"](`${r.pass ? "✓" : "✗"} ${r.name}`));
  console.log("ALL PASS:", allPass);
  console.groupEnd();
}

// ===================
// Embeds de Livecounts
// ===================
function buildLiveCounterUrl(videoId) {
  return `https://livecounts.io/embed/youtube-live-view-counter/${videoId}`;
}
function buildViewsCounterUrl(videoId) {
  return `https://livecounts.io/embed/youtube-view-counter/${videoId}`;
}

// ===================
// Embed del timeline de X (Twitter) — limitado a últimos N (tweetLimit)
// ===================
function loadTwitterScript() {
  if (typeof window !== "undefined" && window.twttr && window.twttr.widgets) return Promise.resolve(window.twttr);
  return new Promise((resolve, reject) => {
    const scriptId = "twitter-widgets";
    if (document.getElementById(scriptId)) {
      const check = () => (window.twttr && window.twttr.widgets) ? resolve(window.twttr) : setTimeout(check, 100);
      return check();
    }
    const s = document.createElement("script");
    s.id = scriptId;
    s.src = "https://platform.twitter.com/widgets.js";
    s.async = true;
    s.onload = () => resolve(window.twttr);
    s.onerror = (e) => reject(e);
    document.body.appendChild(s);
  });
}

function XTimeline({ screenName, height = 700, limit = 3 }) {
  const ref = useRef(null);
  useEffect(() => {
    let mounted = true;
    loadTwitterScript()
      .then((twttr) => {
        if (!mounted || !ref.current || !twttr || !twttr.widgets) return;
        // Limpia contenedor para recrear el timeline si cambia screenName
        ref.current.innerHTML = "";
        twttr.widgets.createTimeline(
          { sourceType: "profile", screenName },
          ref.current,
          {
            height: String(height),
            chrome: "noheader nofooter noborders transparent",
            dnt: false,
            lang: "es",
            theme: "light",
            tweetLimit: limit, // 🔹 mostrar solo los últimos N tweets
          }
        );
      })
      .catch(() => {
        // Fallback: link al perfil si el script no carga
        if (ref.current) {
          ref.current.innerHTML = `<a href="https://x.com/${screenName}" target="_blank" rel="noreferrer noopener" style="text-decoration:underline">Ver publicaciones de @${screenName} en X</a>`;
        }
      });
    return () => { mounted = false; if (ref.current) ref.current.innerHTML = ""; };
  }, [screenName, height, limit]);
  return <div ref={ref} className="w-full" />;
}

// ===================
// UI principal con pestañas
// ===================
const TABS = [
  { id: "home", label: "Inicio" },
  { id: "participants", label: "Participantes" },
  { id: "news", label: "Noticias" },
  { id: "relations", label: "Parejas" },
  { id: "metrics", label: "Métricas" },
];

export default function App() {
  const { votes, vote, reset, total, addVotes, setVotesFor, importVotes, exportVotes } = useLocalVotes();
  const [tab, setTab] = useState("home");
  const { items: newsItems } = useNewsDemo();

  useEffect(() => { if (typeof window !== "undefined") runDevTests(); }, []);

  const sorted = useMemo(() => [...PARTICIPANTS].sort((a, b) => (votes[b.id] || 0) - (votes[a.id] || 0)), [votes]);
  const duration = diffNow(CONFIG.STREAM_START_ISO);
  const ytId = useMemo(() => parseYouTubeIdFromUrl(CONFIG.LIVE_URL), []);
  const leaderboard = useMemo(() => computeLeaderboard(votes), [votes]);

  // Estado del panel de administración de votos
  const [adminOpen, setAdminOpen] = useState(false);
  const [manualPid, setManualPid] = useState(PARTICIPANTS[0].id);
  const [manualQty, setManualQty] = useState(1);
  const [importText, setImportText] = useState("");
  const [importMsg, setImportMsg] = useState("");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur bg-white/70 border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Alofoke logo" className="h-8 w-auto rounded-sm border border-slate-200 bg-white" />
            <span className="text-2xl font-black">Casa Alofoke • Fan Tracker</span>
            <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300">NO OFICIAL</span>
          </div>
          <nav className="flex items-center gap-1">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} className={`px-3 py-1.5 rounded-xl text-sm border ${tab===t.id?"bg-slate-900 text-white border-slate-900":"border-slate-300 hover:bg-slate-100"}`}>{t.label}</button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {tab === "home" && (
          <section className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 p-4 rounded-2xl border bg-white shadow-sm">
              <h2 className="text-lg font-semibold mb-2">Resumen</h2>
              <p className="text-sm text-slate-600 mb-3">Live único activo por 30 días, noticias, métricas y ranking de votos (no oficiales).</p>

              {/* Ganando ahora */}
              <div className="mb-4 p-4 rounded-xl border bg-amber-50 border-amber-200">
                <div className="text-xs text-amber-700 font-semibold mb-1">GANANDO AHORA</div>
                {leaderboard.total > 0 ? (
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <img src={getAvatar(leaderboard.winner)} alt={leaderboard.winner.name} className="h-12 w-12 rounded-lg object-cover border" />
                      <div>
                        <div className="font-semibold leading-tight">{leaderboard.winner.name}</div>
                        <div className="text-xs text-slate-600">{leaderboard.winner.score} votos · {leaderboard.winner.pct}%</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      {leaderboard.list.slice(0,3).map((p, idx) => (
                        <span key={p.id} className={`px-2 py-1 rounded-lg border ${idx===0?"bg-amber-100 border-amber-300":"bg-white border-slate-200"}`}>#{p.rank} {p.name.split(" ")[0]} · {p.pct}%</span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-600">Aún no hay votos. ¡Sé el primero en participar en la pestaña Participantes!</div>
                )}
              </div>

              {/* Player embebido si es YouTube; si no, mostramos botón */}
              {ytId ? (
                <div className="aspect-video w-full overflow-hidden rounded-xl border mb-3">
                  <iframe
                    title="Player del Live"
                    className="w-full h-full"
                    src={buildYouTubeEmbedUrl(ytId)}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
              ) : (
                <a href={CONFIG.LIVE_URL} target="_blank" rel="noreferrer noopener" className="inline-flex items-center justify-center w-full px-4 py-3 mb-3 rounded-xl bg-slate-900 text-white hover:bg-slate-700">
                  Ver Live 24/7
                </a>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="p-3 rounded-xl border">
                  <div className="text-xs text-slate-500">Live viewers (embed)</div>
                  <div className="aspect-video w-full overflow-hidden rounded-lg border">
                    {ytId ? (
                      <iframe title="Live Viewers" className="w-full h-full" frameBorder="0" src={buildLiveCounterUrl(ytId)} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-sm text-slate-500 p-4">Provee un enlace de YouTube para ver viewers.</div>
                    )}
                  </div>
                </div>
                <div className="p-3 rounded-xl border">
                  <div className="text-xs text-slate-500">Total views del live (embed)</div>
                  <div className="aspect-video w-full overflow-hidden rounded-lg border">
                    {ytId ? (
                      <iframe title="Total Views" className="w-full h-full" frameBorder="0" src={buildViewsCounterUrl(ytId)} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-sm text-slate-500 p-4">Provee un enlace de YouTube para ver vistas.</div>
                    )}
                  </div>
                </div>
                <div className="p-3 rounded-xl border">
                  <div className="text-xs text-slate-500">Horas online desde inicio</div>
                  <div className="text-3xl font-black">{duration.totalHours}</div>
                  <div className="text-xs text-slate-500">≈ {formatDuration(duration)} (desde {new Date(CONFIG.STREAM_START_ISO).toLocaleString()})</div>
                </div>
                <div className="p-3 rounded-xl border">
                  <div className="text-xs text-slate-500">Votos acumulados (demo local)</div>
                  <div className="text-3xl font-black">{total}</div>
                  <button onClick={reset} className="mt-2 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-sm">Reiniciar demo</button>
                </div>
              </div>
            </div>
            <div className="p-4 rounded-2xl border bg-white shadow-sm">
              <h3 className="text-lg font-semibold mb-1">Últimos titulares</h3>
              <ul className="space-y-2">
                {newsItems.map((n, idx) => (
                  <li key={idx} className="text-sm">
                    <a href={n.url} className="font-medium hover:underline">{n.title}</a>
                    <div className="text-xs text-slate-500">{n.source} · {new Date(n.ts).toLocaleTimeString()}</div>
                  </li>
                ))}
              </ul>
              <div className="text-xs text-slate-500 mt-2">Fuentes: {CONFIG.NEWS_SOURCES.map(s=>s.name).join(", ")}</div>
            </div>
          </section>
        )}

        {tab === "participants" && (
          <section className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-bold">Participantes (votos NO oficiales)</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => setAdminOpen(!adminOpen)} className="px-3 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-sm">
                  {adminOpen ? "Ocultar votos manuales" : "Votos manuales"}
                </button>
                <div className="text-sm">
                  {leaderboard.total > 0 ? (
                    <div className="hidden md:inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200">
                      <span className="text-xs font-semibold text-amber-700">GANANDO</span>
                      <span className="font-semibold">{leaderboard.winner.name}</span>
                      <span className="text-xs text-slate-600">{leaderboard.winner.score} votos · {leaderboard.winner.pct}%</span>
                      <span className="hidden lg:inline text-xs text-slate-500">| Top 3: {leaderboard.list.slice(0,3).map(p=>`#${p.rank} ${p.name.split(" ")[0]} (${p.pct}%)`).join(" · ")}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500">Aún no hay votos</span>
                  )}
                </div>
              </div>
            </div>

            {/* Panel de administración de votos */}
            {adminOpen && (
              <div className="mb-4 p-4 rounded-2xl border bg-white shadow-sm">
                <h3 className="font-semibold mb-3">Ajustar votos manualmente</h3>
                <div className="grid md:grid-cols-[1fr,160px,auto,auto,auto] gap-2 items-end">
                  <label className="text-sm">
                    <span className="block text-slate-600 mb-1">Participante</span>
                    <select value={manualPid} onChange={(e)=>setManualPid(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white">
                      {PARTICIPANTS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </label>
                  <label className="text-sm">
                    <span className="block text-slate-600 mb-1">Cantidad</span>
                    <input type="number" inputMode="numeric" value={manualQty} onChange={(e)=>setManualQty(parseInt(e.target.value,10) || 0)} className="w-full px-3 py-2 rounded-lg border border-slate-300" />
                  </label>
                  <button onClick={()=>addVotes(manualPid, Math.abs(manualQty))} className="px-3 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-700">+ Añadir</button>
                  <button onClick={()=>addVotes(manualPid, -Math.abs(manualQty))} className="px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-100">− Restar</button>
                  <button onClick={()=>setVotesFor(manualPid, manualQty)} className="px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-100">Establecer</button>
                </div>
                <div className="mt-4 grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm block mb-1 text-slate-600">Importar votos (JSON)</label>
                    <textarea value={importText} onChange={(e)=>setImportText(e.target.value)} rows={5} className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs" placeholder='{"lapeki": 120, "giuseppe": 75}' />
                    <div className="mt-2 flex items-center gap-2">
                      <button onClick={()=>{ const ok = importVotes(importText); setImportMsg(ok?"Importado ✔":"JSON inválido ✗"); }} className="px-3 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-700">Importar</button>
                      <button onClick={()=>{ setImportText(exportVotes()); setImportMsg("Exportado a la caja ✔"); }} className="px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-100">Exportar</button>
                      <button onClick={reset} className="px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-100">Reiniciar</button>
                      {importMsg && <span className="text-xs text-slate-500">{importMsg}</span>}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm block mb-1 text-slate-600">Totales actuales</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {PARTICIPANTS.map(p => (
                        <div key={p.id} className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between text-sm">
                          <span className="truncate mr-2">{p.name}</span>
                          <span className="font-semibold">{votes[p.id] || 0}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-xs text-slate-500">Nota: nunca permitimos totales negativos; las restas se bloquean en 0.</div>
              </div>
            )}

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sorted.map((p, i) => {
                const isWinner = leaderboard.winner && p.id === leaderboard.winner.id;
                return (
                  <article key={p.id} className={`rounded-2xl border bg-white shadow-sm overflow-hidden ${isWinner?"border-amber-400 ring-2 ring-amber-200": ""}`}>
                    <div className="relative">
                      <img src={getAvatar(p)} alt={p.name} className="h-44 w-full object-cover" loading="lazy" onError={(e) => { e.currentTarget.src = placeholderFor(p.name); e.currentTarget.onerror = null; }} />
                      <div className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-white/85 text-xs font-bold">#{i + 1}</div>
                      {isWinner ? (
                        <div className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-amber-100 text-amber-800 text-xs font-bold">GANANDO</div>
                      ) : null}
                    </div>
                    <div className="p-4 flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-lg">{p.name}</h3>
                        {p.ig ? (
                          <a href={`https://instagram.com/${p.ig}`} target="_blank" rel="noreferrer noopener" className="text-xs text-slate-500 hover:underline" title="Instagram">@{p.ig}</a>
                        ) : null}
                        <div className="text-sm text-slate-600">{votes[p.id] || 0} votos (demo)</div>
                      </div>
                      <div className="flex flex-col gap-2 items-end">
                        <button onClick={() => vote(p.id)} className="px-3 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-700 active:scale-[0.98]">Votar</button>
                        {adminOpen && (
                          <div className="flex items-center gap-2 text-xs">
                            <button onClick={()=>addVotes(p.id, 10)} className="px-2 py-1 rounded-lg border border-slate-300 hover:bg-slate-100">+10</button>
                            <button onClick={()=>addVotes(p.id, -10)} className="px-2 py-1 rounded-lg border border-slate-300 hover:bg-slate-100">−10</button>
                            <button onClick={()=>setVotesFor(p.id, 0)} className="px-2 py-1 rounded-lg border border-slate-300 hover:bg-slate-100">=0</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {tab === "news" && (
          <section className="mb-6">
            <h2 className="text-xl font-bold mb-2">Noticias</h2>
            <p className="text-sm text-slate-600 mb-4">Timeline de X (Twitter) de <strong>@{CONFIG.X_HANDLE}</strong>, mostrando los <strong>3 más recientes</strong>. Abajo queda un bloque de titulares como respaldo.</p>

            {/* Timeline de X - últimos 3 */}
            <div className="p-3 rounded-2xl border bg-white shadow-sm mb-4">
              <h3 className="text-base font-semibold mb-2">Publicaciones de @{CONFIG.X_HANDLE}</h3>
              <XTimeline screenName={CONFIG.X_HANDLE} height={740} limit={3} />
            </div>

            {/* Backup: titulares mock (por si X falla o está bloqueado) */}
            <div className="grid md:grid-cols-2 gap-4">
              {newsItems.map((n, idx) => (
                <article key={idx} className="p-4 rounded-2xl border bg-white shadow-sm">
                  <a href={n.url} className="text-base font-semibold hover:underline">{n.title}</a>
                  <div className="text-xs text-slate-500 mt-1">{n.source} · {new Date(n.ts).toLocaleString()}</div>
                </article>
              ))}
            </div>
            <div className="text-xs text-slate-500 mt-3">Fuentes configuradas: {CONFIG.NEWS_SOURCES.map(s=>s.name).join(", ")}</div>
          </section>
        )}

        {tab === "relations" && (
          <section className="mb-6">
            <h2 className="text-xl font-bold mb-3">Parejas y relaciones</h2>
            <p className="text-sm text-slate-600 mb-3">Seguimiento a lo que publican las parejas/relaciones de los participantes. (Demo: enlaces; en prod: feed por API)</p>
            <div className="grid sm:grid-cols-2 gap-4">
              {RELATIONS.map((r, idx) => {
                const person = PARTICIPANTS.find(p => p.id === r.of);
                return (
                  <article key={idx} className="p-4 rounded-2xl border bg-white shadow-sm">
                    <h3 className="font-semibold">{r.name}{person?` — (${person.name})`:""}</h3>
                    <div className="flex gap-3 text-sm mt-1">
                      {r.ig ? <a className="hover:underline" href={`https://instagram.com/${r.ig}`} target="_blank" rel="noreferrer noopener">IG: @{r.ig}</a> : <span className="text-slate-400">IG: (pendiente)</span>}
                      {r.x ? <a className="hover:underline" href={`https://x.com/${r.x}`} target="_blank" rel="noreferrer noopener">X: @{r.x}</a> : <span className="text-slate-400">X: (pendiente)</span>}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {tab === "metrics" && (
          <section className="mb-6">
            <h2 className="text-xl font-bold mb-3">Métricas del Live</h2>
            <a href={CONFIG.LIVE_URL} target="_blank" rel="noreferrer noopener" className="inline-flex items-center justify-center w-full px-4 py-3 mb-4 rounded-xl bg-slate-900 text-white hover:bg-slate-700">
              Abrir Live 24/7 (YouTube)
            </a>
            <div className="grid lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 p-4 rounded-2xl border bg-white shadow-sm">
                <h3 className="text-base font-semibold mb-2">Live viewers ahora</h3>
                <div className="aspect-video w-full overflow-hidden rounded-xl border">
                  {ytId ? (
                    <iframe title="Live Viewers" className="w-full h-full" frameBorder="0" src={buildLiveCounterUrl(ytId)} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm text-slate-500 p-4">Provee un enlace de YouTube para ver viewers.</div>
                  )}
                </div>
              </div>
              <div className="p-4 rounded-2xl border bg-white shadow-sm">
                <h3 className="text-base font-semibold mb-2">Vistas totales del live</h3>
                <div className="aspect-video w-full overflow-hidden rounded-xl border">
                  {ytId ? (
                    <iframe title="Total Views" className="w-full h-full" frameBorder="0" src={buildViewsCounterUrl(ytId)} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm text-slate-500 p-4">Provee un enlace de YouTube para ver vistas.</div>
                  )}
                </div>
              </div>
              <div className="p-4 rounded-2xl border bg-white shadow-sm">
                <h3 className="text-base font-semibold mb-2">Horas online</h3>
                <div className="text-3xl font-black">{duration.totalHours}</div>
                <div className="text-xs text-slate-500">≈ {formatDuration(duration)} (desde {new Date(CONFIG.STREAM_START_ISO).toLocaleString()})</div>
              </div>
            </div>
            <div className="text-xs text-slate-500 mt-3">Este sitio usa un **enlace único** al live. Si el enlace cambia, actualiza CONFIG.LIVE_URL.</div>
          </section>
        )}

        {/* Aviso */}
        <section id="como-funciona" className="p-4 rounded-2xl border bg-white shadow-sm mt-6">
          <h2 className="text-xl font-bold mb-2">Cómo funcionará en producción</h2>
          <ol className="list-decimal pl-6 space-y-1 text-slate-700 text-sm">
            <li>Este sitio es NO OFICIAL y no representa a Alofoke.</li>
            <li>Usamos un <strong>enlace único</strong> al live por 30 días.</li>
            <li>Las métricas (viewers/vistas) se muestran si el enlace es de YouTube (ID detectable).</li>
            <li>Los votos son encuestas de fans en esta web; no son los oficiales del programa.</li>
            <li>Anti-abuso: IP + cookie + Turnstile/recaptcha, límite por tiempo.</li>
          </ol>
        </section>
      </main>

      <footer className="max-w-6xl mx-auto px-4 py-8 text-xs text-slate-500">
        © {new Date().getFullYear()} Fan Tracker no oficial. Hecho por la comunidad. — Fuentes configurables.
      </footer>
    </div>
  );
}
