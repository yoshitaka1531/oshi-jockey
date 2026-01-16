import * as cheerio from "cheerio";
import iconv from "iconv-lite";

const JRA_LIST_URL = "https://www.jra.go.jp/datafile/meikan/jockey.html";

// 超軽量キャッシュ（Vercelの同一インスタンス内で有効）
let cache = {
  fetchedAt: 0,
  list: null
};

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6時間

function guessEncodingFromHeaders(contentType = "") {
  // 例: text/html; charset=Shift_JIS
  const m = /charset\s*=\s*([^\s;]+)/i.exec(contentType);
  return m?.[1] ?? null;
}

function normalizeEncodingName(enc) {
  if (!enc) return null;
  const e = enc.toLowerCase();
  if (e.includes("shift") || e.includes("sjis")) return "shift_jis";
  if (e.includes("euc")) return "euc-jp";
  if (e.includes("utf-8") || e.includes("utf8")) return "utf-8";
  return enc;
}

function extractJockeysFromHtml(html, baseUrl) {
  const $ = cheerio.load(html);

  // JRAの名鑑系は「騎手名のリンク」が多数ある想定。
  // とにかく a[href] を舐めて、騎手詳細らしきリンクだけ拾う。
  // ※もし将来HTML構造が変わっても、hrefパターン中心に追随しやすい。
  const items = [];
  const seen = new Set();

  $("a[href]").each((_, a) => {
    const hrefRaw = $(a).attr("href")?.trim();
    const name = $(a).text().replace(/\s+/g, " ").trim();

    if (!hrefRaw || !name) return;

    // 騎手詳細ページっぽいものを抽出（名鑑配下など）
    // 実ページ構造に依存しすぎないよう、広めに拾う
    const looksLikeJockey =
      hrefRaw.includes("/datafile/meikan/") &&
      (hrefRaw.includes("jockey") || hrefRaw.includes("Jockey") || hrefRaw.includes("meikan"));

    if (!looksLikeJockey) return;

    let url;
    try {
      url = new URL(hrefRaw, baseUrl).toString();
    } catch {
      return;
    }

    const key = `${name}__${url}`;
    if (seen.has(key)) return;
    seen.add(key);

    items.push({ name, url });
  });

  // 取り過ぎる可能性があるので、明らかに騎手名っぽくないものを軽く除外
  // （「あ行」「トップ」等のナビが混ざる場合対策）
  const filtered = items.filter((x) => {
    // 1文字だけ、記号だけ、"TOP"などを落とす
    if (x.name.length < 2) return false;
    if (/^(top|トップ|ホーム|戻る)$/i.test(x.name)) return false;
    if (/^[\u3040-\u309F]行$/.test(x.name)) return false; // あ行/か行等
    return true;
  });

  return filtered;
}

async function fetchJockeyList() {
  const now = Date.now();
  if (cache.list && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.list;
  }

  const res = await fetch(JRA_LIST_URL, {
    headers: {
      "User-Agent": "oshi-jockey-app/1.0 (+https://vercel.com/)"
    }
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch JRA page: ${res.status} ${res.statusText}`);
  }

  // 文字化け対策：ArrayBufferで受けてiconvでデコード
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") || "";
  const headerEnc = normalizeEncodingName(guessEncodingFromHeaders(contentType));

  // ヘッダから分からなければShift_JISを優先（JRAの国内ページで多い）
  const encCandidates = headerEnc ? [headerEnc, "shift_jis", "utf-8"] : ["shift_jis", "utf-8"];

  let html = null;
  let lastErr = null;

  for (const enc of encCandidates) {
    try {
      const decoded = iconv.decode(buf, enc);
      // ざっくり妥当性チェック：HTMLっぽいか
      if (decoded.includes("<html") || decoded.includes("<HTML") || decoded.includes("</")) {
        html = decoded;
        break;
      }
    } catch (e) {
      lastErr = e;
    }
  }

  if (!html) {
    throw new Error(`Failed to decode HTML. content-type=${contentType} err=${String(lastErr)}`);
  }

  const list = extractJockeysFromHtml(html, JRA_LIST_URL);

  if (!list.length) {
    // ここに来る場合：HTML構造が変わった / 抽出条件が厳しすぎる
    throw new Error("No jockey links found. JRA page structure may have changed.");
  }

  cache = { fetchedAt: now, list };
  return list;
}

function pickOne(arr) {
  const idx = Math.floor(Math.random() * arr.length);
  return arr[idx];
}

export default async function handler(req, res) {
  try {
    const list = await fetchJockeyList();
    const picked = pickOne(list);

    // VercelのCDNキャッシュ（同時アクセスが増えてもJRAへ行きすぎないように）
    res.setHeader("Cache-Control", "s-maxage=21600, stale-while-revalidate=86400"); // 6h 캐시

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.status(200).send(
      JSON.stringify({
        source: JRA_LIST_URL,
        picked,
        totalCandidates: list.length,
        generatedAt: new Date().toISOString()
      })
    );
  } catch (e) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.status(500).send(
      JSON.stringify({
        error: true,
        message: e?.message || String(e)
      })
    );
  }
}
