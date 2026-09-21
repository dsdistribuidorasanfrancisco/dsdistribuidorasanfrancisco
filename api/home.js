// api/home.js — Sirve la portada con meta tags Open Graph actualizados
// automáticamente desde Firebase (nombre, descripción y logo), para que
// al compartir el enlace siempre se muestre el logo/datos actuales,
// sin depender de la caché de Facebook/WhatsApp.

const fs = require("fs");
const path = require("path");

const STORE_NAME_DEFAULT = "DS Distribuidora San Francisco";
const FIREBASE_URL =
  "https://dsdistribuidorasfc-2e8ed-default-rtdb.firebaseio.com/settings.json";

// El HTML base se lee una sola vez por instancia de función (se reutiliza
// entre invocaciones "calientes"; en una nueva instancia se vuelve a leer).
let indexHtmlCache = null;
function loadIndexHtml() {
  if (indexHtmlCache) return indexHtmlCache;
  const filePath = path.join(process.cwd(), "public", "index.html");
  indexHtmlCache = fs.readFileSync(filePath, "utf8");
  return indexHtmlCache;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

module.exports = async (req, res) => {
  const baseUrl = "https://" + req.headers.host;
  const html = loadIndexHtml();

  let ogTitle = STORE_NAME_DEFAULT;
  let ogDesc = "Los mejores productos al mejor precio";
  // Logo de respaldo: el que ya viene fijo en index.html, por si Firebase
  // no responde o aún no hay logo configurado.
  let ogImage =
    "https://res.cloudinary.com/dxxlersgi/image/upload/v1780665475/logodsdistribuidirasanfrancisco_cr6amy.png";

  try {
    const fbRes = await fetch(FIREBASE_URL);
    if (fbRes.ok) {
      const settings = await fbRes.json();
      if (settings) {
        if (settings.name) ogTitle = settings.name;
        if (settings.desc) ogDesc = settings.desc;
        // Cada vez que se guarda un logo nuevo en Cloudinary, el enlace es
        // distinto al anterior, así que Facebook/WhatsApp lo detectan como
        // una imagen nueva automáticamente — sin necesidad de re-rastrear.
        if (settings.logo) ogImage = settings.logo;
      }
    }
  } catch (err) {
    console.error("Error consultando Firebase (home):", err);
  }

  const safeTitle = escapeHtml(ogTitle);
  const safeDesc = escapeHtml(ogDesc);
  const safeImage = escapeHtml(ogImage);

  const ogBlock = `<!-- OG_META_START -->
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${safeDesc}">
  <meta property="og:image" content="${safeImage}">
  <meta property="og:image:width" content="300">
  <meta property="og:image:height" content="300">
  <meta property="og:url" content="${baseUrl}/">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${safeTitle}">
  <meta name="twitter:description" content="${safeDesc}">
  <meta name="twitter:image" content="${safeImage}">
  <!-- OG_META_END -->`;

  let finalHtml = html.replace(
    /<!-- OG_META_START -->[\s\S]*?<!-- OG_META_END -->/,
    ogBlock
  );

  // También refresca el <title> de la pestaña.
  finalHtml = finalHtml.replace(
    /<title>[^<]*<\/title>/,
    `<title>${safeTitle}</title>`
  );

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  // Cache corta: suficiente para no saturar Firebase en visitas seguidas,
  // pero lo bastante corta para que el cambio de logo se refleje rápido.
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=30");
  res.status(200).send(finalHtml);
};
