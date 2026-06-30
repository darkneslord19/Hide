// /api/dialog?code=XXXX
// Kapı: x-access-key (veya izinli referer) yoksa 401.
// links.json PUBLIC repodan token'sız okunur. code -> hedef JSON -> sunucu çekip döndürür.
//
// Vercel Environment Variables:
//   ACCESS_KEY       uygulamanın gönderdiği gizli anahtar (zorunlu)
//   LINKS_URL        links.json'un raw linki, örn:
//                    https://raw.githubusercontent.com/ADIN/REPO/main/links.json
//   ALLOWED_REFERER  (opsiyonel)

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'x-access-key, content-type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // --- Kapı kontrolü ---
  const ACCESS_KEY = process.env.ACCESS_KEY;
  const ALLOW_REF  = (process.env.ALLOWED_REFERER || '').trim();
  const key        = req.headers['x-access-key'] || '';
  const referer    = req.headers['referer'] || req.headers['origin'] || '';
  const keyOk = ACCESS_KEY && key === ACCESS_KEY;
  const refOk = ALLOW_REF && referer.startsWith(ALLOW_REF);
  if (!keyOk && !refOk) return res.status(401).json({ error: 'unauthorized' });

  const code = String(req.query.code || '').trim();
  if (!code) return res.status(400).json({ error: 'no_code' });

  // --- Link haritasını public repodan oku (token yok) ---
  const LINKS_URL = process.env.LINKS_URL;
  let map;
  try {
    const r = await fetch(LINKS_URL, { cache: 'no-store' });
    if (!r.ok) return res.status(502).json({ error: 'map_error', status: r.status });
    map = await r.json();
  } catch (e) {
    return res.status(502).json({ error: 'map_parse' });
  }

  const links = map.kapilar || map.links || map;
  const entry = links && links[code];
  if (!entry || !entry.url || entry.enabled === false) {
    return res.status(404).json({ error: 'notfound' });
  }

  // --- Hedef JSON'u çek ve döndür ---
  try {
    const r = await fetch(entry.url, { cache: 'no-store' });
    if (!r.ok) return res.status(502).json({ error: 'upstream', status: r.status });
    return res.status(200).json(await r.json());
  } catch (e) {
    return res.status(502).json({ error: 'fetch_failed' });
  }
};