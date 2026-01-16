// api/oshi-jockey.js
// UMAJOの一覧がJS描画でリンク抽出できない場合があるため、個別ページURL(SEEDS)を起点にランダム抽選します。
// さらに、各ページの<title>等から名前を抽出して表示精度を上げます。

const BASE = "https://umajo.jra.jp";
const SEEDS = [
  `${BASE}/jockey/yuga_kawada.html`,
  `${BASE}/jockey/christophe_lemaire.html`,
  `${BASE}/jockey/keita_tosaki.html`,
  `${BASE}/jockey/kohei_matsuyama.html`,
  `${BASE}/jockey/kazuki_kikuzawa.html`,
  `${BASE}/jockey/ryota_sameshima.html`,
];

const MAX_PAGES = 80;   // 収集上限（増やすならここ）
const MAX_FETCH = 120;  // 取得回数上限（保険）
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6時間キャッシュ

let cache = { at: 0, pages: [] };

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      "user-agent": "oshi-jockey-vercel/1.0",
      "accept": "text/html,*/*",
    },
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${url}`);
  return await res.text();
}

function extractName(html) {
  // titleから拾う（例: "C.ルメール | UMAJO" のような形式を想定）
  const t = html.match(/<title[^>]*>\s*([^<]+?)\s*<\/title>/i);
  if (t) {
    const title = t[1].replace(/\s+/g, " ").trim();
    const name = title.split("|")[0].trim();
    if (name && name.length >= 2) return name;
  }

  // h1から拾う（構造がある場合）
  const h1 = html.match(/<h1[^>]*>\s*([^<]+?)\s*<\/h1>/i);
  if (h1) {
    const name = h1[1].replace(/\s+/g, " ").trim();
    if (name && name.length >= 2) return name;
  }

  return null;
}

function extractJockeyLinks(html) {
  // /jockey/xxxx.html を拾う（あれば拾う、無ければSEEDSだけでも成立）
  const re = /href\s*=\s*["'](\/jockey\/[^"']+?\.html)["']/g;
  const out = new Set();
  let m;
  while ((m = re.exec(html)) !== null) {
    out.add(`${BASE}${m[1]}`);
  }
  return [...out];
}

async function buildUmajoJockeyList() {
  // キャッシュが生きていれば使う
  if (cache.pages.length > 0 && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.pages;
  }

  const visited = new Set();
  const queue = [...SEEDS];
  const pages = [];
  let fetchCount = 0;

  while (queue.length > 0 && pages.length < MAX_PAGES && fetchCount < MAX_FETCH) {
    const url = queue.shift();
    if (!url || visited.has(url)) continue;
    visited.add(url);

    let html;
    try {
      html = await fetchText(url);
      fetchCount++;
    } catch {
      continue; // 1ページ落ちても全体を止めない
    }

    const name = extractName(html) || "(ジョッキー)";
    pages.push({ name, profileUrl: url });

    // ページ内に他ジョッキーへのリンクがあれば拾って増やす
    const links = extractJockeyLinks(html);
    for (const link of links) {
      if (!visited.has(link)) queue.push(link);
    }
  }

  // 最低限、SEEDS分は揃うはず。万一0なら保険。
  if (pages.length === 0) {
    const fallback = SEEDS.map((u) => ({ name: "(ジョッキー)", profileUrl: u }));
    cache = { at: Date.now(), pages: fallback };
    return fallback;
  }

  cache = { at: Date.now(), pages };
  return pages;
}

export default async function handler(req, res) {
  try {
    const candidates = await buildUmajoJockeyList();
    const picked = pickRandom(candidates);

    res.status(200).json({
      error: false,
      source: "UMAJO (seed + optional crawl)",
      totalCandidates: candidates.length,
      picked,
    });
  } catch (e) {
    res.status(200).json({
      error: true,
      message: e?.message || "Unknown error",
    });
  }
}
