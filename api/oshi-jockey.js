import * as cheerio from "cheerio";
import iconv from "iconv-lite";

const JRA_LIST_URL = "https://www.jra.go.jp/datafile/meikan/jockey.html";

// インスタンス内キャッシュ（JRAへのアクセス頻度を下げる）
let cache = {
  fetchedAt: 0,
  list: null
};
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6時間

function guessEncodingFromHeaders(contentType = "") {
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

async function fetchHtmlDecoded(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "oshi-jockey-app/1.0 (+https://vercel.com/)" }
  });
  if (!res.ok) throw new Error(`Failed to fetch: ${url} (${res.status} ${res.statusText})`);

  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") || "";
  const headerEnc = normalizeEncodingName(guessEncodingFromHeaders(contentType));

  const encCandidates = headerEnc ? [headerEnc, "shift_jis", "utf-8"] : ["shift_jis", "utf-8"];

  for (const enc of encCandidates) {
    try {
      const decoded = iconv.decode(buf, enc);
      if (decoded.includes("<html") || decoded.includes("<HTML") || decoded.includes("</")) {
        return decoded;
      }
    } catch {
      // try next
    }
  }
  throw new Error(`Failed to decode HTML: ${url} content-type=${contentType}`);
}

function extractMeikanJockeyProfileLinks(html, baseUrl) {
  const $ = cheerio.load(html);
  const items = [];
  const seen = new Set();

  $("a[href]").each((_, a) => {
    const hrefRaw = $(a).attr("href")?.trim();
    const name = $(a).text().replace(/\s+/g, " ").trim();
    if (!hrefRaw || !name) return;

    // 一覧ページ自身や、他の一覧/説明ページを除外
    const deny = [
      "/datafile/meikan/jockey.html",
      "/datafile/meikan/young.html",
      "/datafile/meikan/agent.html",
      "/datafile/meikan/jretirement.html"
    ];
    if (deny.some((d) => hrefRaw.includes(d))) return;

    // PDF等を除外
    if (hrefRaw.toLowerCase().endsWith(".pdf")) return;

    // 名鑑配下の「個人ページっぽいHTML」だけを拾う
    const isMeikan = hrefRaw.includes("/datafile/meikan/");
    const isHtml = hrefRaw.toLowerCase().endsWith(".html") || hrefRaw.includes(".html?");
    if (!isMeikan || !isHtml) return;

    let url;
    try {
      url = new URL(hrefRaw, baseUrl).toString();
    } catch {
      return;
    }

    // 目次リンクっぽいもの（あ行/か行 等）を除外
    if (/^[\u3040-\u309F]行$/.test(name)) return;

    const key = `${name}__${url}`;
    if (seen.has(key)) return;
    seen.add(key);

    items.push({ name, meikanUrl: url });
  });

  // 念のため、短すぎ/明らかにナビっぽいものを落とす
  return items.filter((x) => x.name.length >= 2);
}

async function fetchJockeyList() {
  const now = Date.now();
  if (cache.list && now - cache.fetchedAt < CACHE_TTL_MS) return cache.list;

  const html = await fetchHtmlDecoded(JRA_LIST_URL);
  const list = extractMeikanJockeyProfileLinks(html, JRA_LIST_URL);

  if (!list.length) {
    throw new Error("No jockey profile links found. JRA page structure may have changed.");
  }

  cache = { fetchedAt: now, list };
  return list;
}

function pickOne(arr) {
  const idx = Math.floor(Math.random() * arr.length);
  return arr[idx];
}

// 名鑑の個人ページから「JRADB accessK」への“個人リンク（パラメータ付き）”を探す
async function findJradbProfileUrlFromMeikan(meikanUrl) {
  const html = await fetchHtmlDecoded(meikanUrl);
  const $ = cheerio.load(html);

  // accessK へのリンクを探索（パラメータ付きがあればそれを優先）
  const candidates = [];
  $("a[href]").each((_, a) => {
    const href = ($(a).attr("href") || "").trim();
    if (!href) return;
    if (!href.includes("/JRADB/accessK.html")) return;

    let abs;
    try {
      abs = new URL(href, meikanUrl).toString();
    } catch {
      return;
    }
    candidates.push(abs);
  });

  // パラメータ付き（? が付いている）を優先
  const withQuery = candidates.find((u) => u.includes("?"));
  return withQuery || candidates[0] || null;
}

export default async function handler(req, res) {
  try {
    const list = await fetchJockeyList();
    const picked = pickOne(list);

    // JRADBリンクを付与（取れなければ名鑑URLを返す）
    let jradbUrl = null;
    try {
      jradbUrl = await findJradbProfileUrlFromMeikan(picked.meikanUrl);
    } catch {
      // 取得失敗でもアプリが落ちないよう握りつぶし、保険で名鑑URLへ
      jradbUrl = null;
    }

    res.setHeader("Cache-Control", "s-maxage=21600, stale-while-revalidate=86400");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.status(200).send(
      JSON.stringify({
        source: JRA_LIST_URL,
        picked: {
          name: picked.name,
          meikanUrl: picked.meikanUrl,
          profileUrl: jradbUrl || picked.meikanUrl
        },
        totalCandidates: list.length,
        generatedAt: new Date().toISOString()
      })
    );
  } catch (e) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.status(500).send(JSON.stringify({ error: true, message: e?.message || String(e) }));
  }
}
