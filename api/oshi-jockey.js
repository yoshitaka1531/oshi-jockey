// api/oshi-jockey.js
// UMAJOの個別ページを巡回して「掲載されている全ジョッキー」を収集してからランダム抽選します。
// ※UMAJOの各ページには Previous/Next があり、これを辿ることで全ページを集められる前提です。:contentReference[oaicite:1]{index=1}

const BASE = "https://umajo.jra.jp";

// あなたがくれたURLを起点にします（複数あるほど安定）
const SEEDS = [
  `${BASE}/jockey/yuga_kawada.html`,
  `${BASE}/jockey/christophe_lemaire.html`,
  `${BASE}/jockey/keita_tosaki.html`,
  `${BASE}/jockey/kohei_matsuyama.html`,
  `${BASE}/jockey/kazuki_kikuzawa.html`,
  `${BASE}/jockey/ryota_sameshima.html`,
];

const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12時間キャッシュ
const MAX_FETCH = 500;   // 取得回数上限（暴走防止）
const MAX_PAGES = 400;   // 収集ページ上限（十分大きめ）

let cache = { at: 0, pages: [] };

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      "user-agent": "oshi-jockey-vercel/1.0",
      accept: "text/html,*/*",
    },
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${url}`);
  return await res.text();
}

// <title> から名前を拾う（安定しやすい）
function extractName(html) {
  const t = html.match(/<title[^>]*>\s*([^<]+?)\s*<\/title>/i);
  if (t) {
    const title = t[1].replace(/\s+/g, " ").trim();
    const name = title.split("|")[0].trim();
    if (name && name.length >= 2) return name;
  }
  // 保険（h1がある場合）
  const h1 = html.match(/<h1[^>]*>\s*([^<]+?)\s*<\/h1>/i);
  if (h1) {
    const name = h1[1].replace(/\s+/g, " ").trim();
    if (name && name.length >= 2) return name;
  }
  return null;
}

// 「/jockey/xxxx.html」をHTML内から片っ端から拾う（hrefだけでなく data-href 等も拾える）
function extractJockeyLinks(html) {
  const re = /\/jockey\/[a-z0-9_]+\.html/gi;
  const found = new Set();
  let m;
  while ((m = re.exec(html)) !== null) {
    found.add(`${BASE}${m[0]}`);
  }
  return [...found];
}

async function buildUmajoJockeyList() {
  // キャッシュ
  if (cache.pages.length > 0 && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.pages;
  }

  const visited = new Set();
  const queue = [...SEEDS];
  const pages = [];
  let fetchCount = 0;

  while (queue.length > 0 && fetchCount < MAX_FETCH && pages.length < MAX_PAGES) {
    const url = queue.shift();
    if (!url || visited.has(url)) continue;
    visited.add(url);

    let html;
    try {
      html = await fetchText(url);
      fetchCount++;
    } catch {
      continue; // 1ページ落ちても継続
    }

    const name = extractName(html) || "(ジョッキー)";
    pages.push({ name, profileUrl: url });

    // 次候補リンクを追加（Previous/Next含め、HTML内の/jockey/*.htmlを全部拾う）
    const links = extractJockeyLinks(html);
    for (const link of links) {
      if (!visited.has(link)) queue.push(link);
    }
  }

  // 最低限（万一巡回できない場合でもSEEDS分は返す）
  const uniq = new Map();
  for (const p of pages) uniq.set(p.profileUrl, p);
  const result = [...uniq.values()];

  cache = { at: Date.now(), pages: result.length ? result : SEEDS.map(u => ({ name: "(ジョッキー)", profileUrl: u })) };
  return cache.pages;
}

export default async function handler(req, res) {
  try {
    const candidates = await buildUmajoJockeyList();
    const picked = pickRandom(candidates);

    res.setHeader("Cache-Control", "s-maxage=43200, stale-while-revalidate=86400"); // 12h
    res.status(200).json({
      error: false,
      source: "UMAJO (crawl all jockey pages)",
      totalCandidates: candidates.length,
      picked,
    });
  } catch (e) {
    res.status(200).json({ error: true, message: e?.message || "Unknown error" });
  }
}
