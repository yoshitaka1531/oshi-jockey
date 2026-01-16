// api/oshi-jockey.js
// UMAJOの掲載ジョッキーURL（SEEDS）からランダム抽選する方式。
// ※UMAJOは一覧/内部リンクがJS生成の可能性があり、クロールが安定しないため。

const SEEDS = [
  "https://umajo.jra.jp/jockey/yuga_kawada.html",
  "https://umajo.jra.jp/jockey/christophe_lemaire.html",
  "https://umajo.jra.jp/jockey/keita_tosaki.html",
  "https://umajo.jra.jp/jockey/kohei_matsuyama.html",
  "https://umajo.jra.jp/jockey/kazuki_kikuzawa.html",
  "https://umajo.jra.jp/jockey/ryota_sameshima.html",
];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      "user-agent": "oshi-jockey-vercel/1.0",
      accept: "text/html,*/*",
      "accept-language": "ja,en;q=0.8",
    },
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${url}`);
  return await res.text();
}

function extractName(html) {
  const t = html.match(/<title[^>]*>\s*([^<]+?)\s*<\/title>/i);
  if (t) {
    const title = t[1].replace(/\s+/g, " ").trim();
    const name = title.split("|")[0].trim();
    if (name) return name;
  }
  const h1 = html.match(/<h1[^>]*>\s*([^<]+?)\s*<\/h1>/i);
  if (h1) return h1[1].replace(/\s+/g, " ").trim();
  return "(ジョッキー)";
}

export default async function handler(req, res) {
  try {
    const profileUrl = pickRandom(SEEDS);
    const html = await fetchText(profileUrl);
    const name = extractName(html);

    res.status(200).json({
      error: false,
      source: "UMAJO (seed list)",
      totalCandidates: SEEDS.length,
      picked: { name, profileUrl },
    });
  } catch (e) {
    res.status(200).json({ error: true, message: e?.message || "Unknown error" });
  }
}
