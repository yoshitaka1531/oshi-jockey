// api/get-jockey.js
// UMAJOの騎手ページを「Next/Previous」を辿ってできるだけ多く集め、ランダム1名を返します。

const BASE = "https://umajo.jra.jp";

// 最初に辿り始めるページ（ここは既知の1枚でOK）
const START_URL = `${BASE}/jockey/yuga_kawada.html`;

// 安全のため上限（無限ループ防止）
const MAX_PAGES = 600;

function uniq(arr) {
  return [...new Set(arr)];
}

function absUrl(url) {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  if (url.startsWith("/")) return BASE + url;
  return BASE + "/" + url;
}

// HTMLから候補URLを拾う（aタグ / link rel=next,prev / 文字列中の /jockey/*.html）
function extractJockeyUrls(html) {
  const urls = [];

  // 1) <link rel="next" href="..."> / <link rel="prev" href="...">
  {
    const re = /<link[^>]+rel=["'](?:next|prev|previous)["'][^>]+href=["']([^"']+)["']/gi;
    let m;
    while ((m = re.exec(html))) {
      const u = absUrl(m[1]);
      if (u && u.includes("/jockey/") && u.endsWith(".html")) urls.push(u);
    }
  }

  // 2) <a href="/jockey/xxx.html">
  {
    const re = /<a[^>]+href=["']([^"']+\/jockey\/[^"']+\.html)["']/gi;
    let m;
    while ((m = re.exec(html))) {
      const u = absUrl(m[1]);
      if (u) urls.push(u);
    }
  }

  // 3) 文字列中に現れる /jockey/xxx.html（JSやJSONに埋まっているケース対策）
  {
    const re = /\/jockey\/[a-z0-9_]+\.html/gi;
    const matches = html.match(re) || [];
    for (const p of matches) urls.push(absUrl(p));
  }

  return uniq(urls);
}

// HTMLから騎手名を抜く（h1がない場合もあるので保険で複数パターン）
function extractName(html) {
  // よくある：<h1>戸崎 圭太</h1> みたいなもの（サイトにより構造差あり）
  let m = html.match(/<h1[^>]*>\s*([^<]+)\s*<\/h1>/i);
  if (m) return m[1].trim();

  // 画像altなどに "戸崎 圭太 Keita Tosaki" のように入っていることがある
  m = html.match(/<img[^>]+alt=["']([^"']+)["'][^>]*>/i);
  if (m) {
    const t = m[1].trim();
    // "戸崎 圭太 Keita Tosaki" → 日本語側だけ寄せたい場合の簡易処理
    return t.split("  ")[0].split(" ").slice(0, 2).join(" ").trim() || t;
  }

  // 最後の保険：タイトル
  m = html.match(/<title>\s*([^<]+)\s*<\/title>/i);
  if (m) return m[1].replace(/\s*\|.*$/, "").trim();

  return "(ジョッキー)";
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      // できるだけ素直なHTMLを返してもらう
      "User-Agent": "Mozilla/5.0",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "ja,en;q=0.8",
    },
  });
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${url}`);
  return await res.text();
}

async function crawlAllFromStart() {
  const visited = new Set();
  const queue = [START_URL];
  const jockeyPages = [];

  while (queue.length && visited.size < MAX_PAGES) {
    const url = queue.shift();
    if (!url || visited.has(url)) continue;
    visited.add(url);

    let html;
    try {
      html = await fetchHtml(url);
    } catch {
      continue;
    }

    // 騎手ページっぽいものだけ収集
    if (url.includes("/jockey/") && url.endsWith(".html")) {
      jockeyPages.push(url);
    }

    // 次のURL候補を抽出してキューへ
    const nextUrls = extractJockeyUrls(html);
    for (const u of nextUrls) {
      if (!visited.has(u)) queue.push(u);
    }
  }

  // 保険：重複排除
  return uniq(jockeyPages);
}

export default async function handler(req, res) {
  try {
    const pages = await crawlAllFromStart();

    if (!pages.length) {
      return res.status(200).json({
        error: true,
        message: "No UMAJO jockey pages found. Page structure may have changed.",
      });
    }

    // ランダムに1人選ぶ
    const profileUrl = pages[Math.floor(Math.random() * pages.length)];

    // 選ばれたページから名前を抽出
    const pickedHtml = await fetchHtml(profileUrl);
    const name = extractName(pickedHtml);

    return res.status(200).json({
      error: false,
      source: "UMAJO (crawl by next/prev/link discovery)",
      totalCandidates: pages.length,
      picked: { name, profileUrl },
    });
  } catch (e) {
    return res.status(200).json({ error: true, message: String(e?.message || e) });
  }
}
