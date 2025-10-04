// POST /api/create-damage
// Body: { baseId, table, vehicle, note, photoUrl, view, xPct, yPct }

const ALLOWED_ORIGINS = [
  // Put your Softr domain(s) here:
  "https://trailmed.app",
  "https://trailed.co.uk"
];

function setCors(req, res) {
  const origin = req.headers.origin || "";
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  try {
    const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
    if (!AIRTABLE_PAT) return res.status(500).json({ error: "Missing AIRTABLE_PAT" });

    const { baseId, table, vehicle, note, photoUrl, view, xPct, yPct } = req.body || {};
    if (!baseId || !table) return res.status(400).json({ error: "Missing baseId or table" });

    const fields = {
      Vehicle: vehicle || "UNKNOWN",
      Status: "Open",
      Note: note || ""
    };
    if (photoUrl) fields.Photo = [{ url: photoUrl }]; // Airtable Attachment via URL
    if (view) fields.View = view;
    if (typeof xPct === "number") fields.XPct = xPct;
    if (typeof yPct === "number") fields.YPct = yPct;

    const r = await fetch(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AIRTABLE_PAT}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ fields })
    });

    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).json({ error: "Airtable error", detail: text });
    }

    const data = await r.json();
    res.status(200).json({ id: data.id, fields: data.fields });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
}
