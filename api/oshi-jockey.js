import * as cheerio from "cheerio";

const UMAJO_LIST_URL = "https://umajo.jra.jp/jockey/";

// インスタンス内キャッシュ（頻繁に取りに行かない）
let cache = { fetchedAt: 0, list: null };
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6時間

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "oshi-jockey-app/1.0 (+https://vercel.com/)" }
  });
  if (!res.ok) throw new Error(`Failed to fetch: ${url} (${res.status} ${res.statusText})`);
  return await res.text(); // UMAJOは通常UTF-8なので text() でOK
}

function extractUmanjoJockeyLinks(html, baseUrl) {
  const $ = cheerio.load(html);
  const items = [];
  const seen = new Set();

  $("a[href]").each((_, a) => {
    const hrefRaw = ($(a).attr("href") || "").trim();
    if (!hrefRaw) return;

    let url;
    try {
      url = new URL(hrefRaw, baseUrl).toString();
    } catch {
      return;
    }

    // UMAJOの個別ジョッキーページだけ拾う（/jockey/xxxx.html）
    if (!url.startsWith("https://umajo.jra.jp/jockey/")) return;
    if (!url.toLowerCase().endsWith(".html")) return;
    if (url === UMAJO_LIST_URL) return;

    if (seen.has(url)) return;
    seen.add(url);

    // 一覧カードには氏名が載っていることが多いので、取れれば入れる（無くてもOK）
    const name = $(a).text().replace(/\s+/g, " ").trim();

    items.push({
      name: name || "（ジョッキー名取得中）",
      profileUrl: url
    });
  });

  return items;
}

async function fetchUmanjoList() {
  const now = Date.now();
  if (cache.list && now - cache.fetchedAt < CACHE_TTL_MS) return cache.list;

  const html = await fetchHtml(UMAJO_LIST_URL);
  const list = extractUmanjoJockeyLinks(html, UMAJO_LIST_URL);

  if (!list.length) throw new Error("No UMAJO jockey pages found. Page structure may have changed.");

  cache = { fetchedAt: now, list };
  return list;
}

function pickOne(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default async function handler(req, res) {
  try {
    const list = await fetchUmanjoList();
    const picked = pickOne(list);

    res.setHeader("Cache-Control", "s-maxage=21600, stale-while-revalidate=86400");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.status(200).send(
      JSON.stringify({
        source: UMAJO_LIST_URL,
        picked,
        totalCandidates: list.length,
        generatedAt: new Date().toISOString()
      })
    );
  } catch (e) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.status(500).send(JSON.stringify({ error: true, message: e?.message || String(e) }));
  }
}
