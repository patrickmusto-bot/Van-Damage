// api/create-damage.js  (ESM)
// ------------------------------------------------------------
// POST JSON:
// {
//   "baseId": "appXXXXXXXXXXXXXX",
//   "table": "Damage",
//   "vehicle": "REG-123",
//   "note": "Scratch on right door",
//   "photoUrl": "https://public-host/img.jpg",   // optional
//   "view": "Right",                             // optional
//   "xPct": 61.2,                                // optional
//   "yPct": 47.9                                 // optional
// }
//
// Env var required on Vercel:
//   AIRTABLE_PAT = <your Airtable Personal Access Token>
// Scopes: data.records:read, data.records:write
// ------------------------------------------------------------

const ALLOWED_ORIGINS = [
  // Put your Softr domain(s) or custom domains here:
  "https://yourapp.softr.app",
  "https://your-custom-domain.com"
];

// --- CORS helpers ---
function setCors(req, res) {
  const origin = req.headers.origin || "";
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

// --- tiny JSON reader for Node serverless (no body parser by default) ---
async function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function bad(res, code, msg, extra = {}) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ error: msg, ...extra }));
}

function ok(res, payload) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return bad(res, 405, "POST only");

  try {
    const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
    if (!AIRTABLE_PAT) return bad(res, 500, "Missing AIRTABLE_PAT");

    const body = await readJson(req);
    const { baseId, table } = body || {};
    if (!baseId || !table) return bad(res, 400, "Missing baseId or table");

    // Pull optional fields
    const vehicle = (body.vehicle || "UNKNOWN").trim();
    const note = (body.note || "").toString();
    const view = body.view ? String(body.view) : undefined;
    const xPct = typeof body.xPct === "number" ? body.xPct : undefined;
    const yPct = typeof body.yPct === "number" ? body.yPct : undefined;
    const photoUrl = (body.photoUrl || "").toString().trim();

    // Build Airtable fields
    const fields = {
      Vehicle: vehicle,
      Status: "Open",
      Note: note
    };
    if (view) fields.View = view;
    if (typeof xPct === "number") fields.XPct = xPct;
    if (typeof yPct === "number") fields.YPct = yPct;
    if (photoUrl) fields.Photo = [{ url: photoUrl }]; // Airtable attachment via URL

    // Call Airtable
    const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`;
    const atRes = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AIRTABLE_PAT}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ fields })
    });

    if (!atRes.ok) {
      const detail = await atRes.text();
      return bad(res, atRes.status, "Airtable error", { detail });
    }

    const data = await atRes.json(); // { id, fields }
    return ok(res, { id: data.id, fields: data.fields });
  } catch (e) {
    return bad(res, 500, e.message || String(e));
  }
}
