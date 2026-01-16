// api/oshi-jockey.js
// UMAJOの「一覧ページ」はJS描画でリンクが取れないことがあるため、
// 個別騎手ページを起点にリンクを辿って収集する方式にしています。

const BASE = "https://umajo.jra.jp";
const SEED = `${BASE}/jockey/yuga_kawada.html`; // 起点（存在が確認できる個別ページ）
const MAX_PAGES = 120;  // 集める上限（増やしたければOK）
const MAX_FETCH = 160;  // 取得回数上限（保険）
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6時間キャッシュ

let cache = {
  at: 0,
  pages: [],
};

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function absUrl(href) {
  if (!href) return null;
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  if (href.startsWith("/")) return `${BASE}${href}`;
  return null;
}

function extractJockeyLinks(html) {
  // /jockey/xxxx.html を拾う（シンプルな正規表現）
  const re = /href\s*=\s*["'](\/jockey\/[^"']+?\.html)["']/g;
  const out = new Set();
  let m;
  while ((m = re.exec(html)) !== null) {
    out.add(`${BASE}${m[1]}`);
  }
  return [...out];
}

function extractName(html) {
  // 多くのページで「日本語名 + 改行 + 英語名」表示があるため、ざっくり拾います。
  // 取れなくてもURLだけで動くようにしてあります。
  const m = html.match(/<h1[^>]*>\s*([^<]+?)\s*<span[^>]*>/i)
        || html.match(/<h1[^>]*>\s*([^<]+?)\s*<\/h1>/i);
  if (!m) return null;
  return m[1].replace(/\s+/g, " ").trim();
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

async function buildUmajoJockeyList() {
  // キャッシュが生きていれば使う
  if (cache.pages.length > 0 && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.pages;
  }

  const visited = new Set();
  const queue = [SEED];
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
    } catch (e) {
      // 1ページ取れなくても全体を止めない
      continue;
    }

    const name = extractName(html);
    pages.push({
      name: name || "(ジョッキー)",
      profileUrl: url,
    });

    // このページ内の /jockey/*.html を収集してキューへ
    const links = extractJockeyLinks(html);
    for (const link of links) {
      if (!visited.has(link)) queue.push(link);
    }
  }

  // 収集結果が少なすぎる場合の最終フォールバック（最低限動かす）
  if (pages.length === 0) {
    // 代表的な数件だけ入れておく（「何も出ない」を回避）
    pages.push(
      { name: "川田 将雅", profileUrl: `${BASE}/jockey/yuga_kawada.html` },
      { name: "横山 典弘", profileUrl: `${BASE}/jockey/norihiro_yokoyama.html` },
      { name: "C.ルメール", profileUrl: `${BASE}/jockey/christophe_lemaire.html` }
    );
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
      source: "UMAJO (crawl from seed pages)",
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
