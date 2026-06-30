// /api/dialog?code=XXXX
// Kapı: x-access-key (veya izinli referer) yoksa 401.
// Link haritası, PRIVATE GitHub repo'daki links.json'dan okunur (token sunucuda).
// code -> o koda kayıtlı hedef JSON linki -> sunucu çekip döndürür.
//
// Vercel Environment Variables:
//   ACCESS_KEY        uygulamanın gönderdiği gizli anahtar
//   GH_OWNER          github kullanıcı adın
//   GH_REPO           repo adı (private)
//   GH_PATH           dosya yolu (varsayılan: links.json)
//   GH_TOKEN          ghp_... token (sadece sunucuda, asla uygulamada değil)
//   ALLOWED_REFERER   (opsiyonel)

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

  // --- Link haritasını private repodan oku ---
  const { GH_OWNER, GH_REPO, GH_TOKEN } = process.env;
  const GH_PATH = process.env.GH_PATH || 'links.json';
  let map;
  try {
    const r = await fetch(
      `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${GH_PATH}`,
      { headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: 'application/vnd.github.raw+json' }, cache: 'no-store' }
    );
    if (!r.ok) return res.status(502).json({ error: 'map_error', status: r.status });
    map = JSON.parse(await r.text());
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