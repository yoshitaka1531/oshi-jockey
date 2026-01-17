// api/oshi-jockey.js
// UMAJO掲載ジョッキーURL（SEEDS）からランダム抽選する方式（安定版）

const SEEDS = [
  // --- 既存（最低限） ---
  "https://umajo.jra.jp/jockey/yuga_kawada.html",
  "https://umajo.jra.jp/jockey/christophe_lemaire.html",
  "https://umajo.jra.jp/jockey/keita_tosaki.html",
  "https://umajo.jra.jp/jockey/kohei_matsuyama.html",
  "https://umajo.jra.jp/jockey/kazuki_kikuzawa.html",
  "https://umajo.jra.jp/jockey/ryota_sameshima.html",

  // --- 追加分（ユーザー提供） ---
  "https://umajo.jra.jp/jockey/masami_matsuoka.html",
  "https://umajo.jra.jp/jockey/suguru_hamanaka.html",
  "https://umajo.jra.jp/jockey/yutaro_nonaka.html",
  "https://umajo.jra.jp/jockey/hironobu_tanabe.html",
  "https://umajo.jra.jp/jockey/hatsuya_kowata.html",
  "https://umajo.jra.jp/jockey/shu_ishibashi.html",
  "https://umajo.jra.jp/jockey/yukito_ishikawa.html",
  "https://umajo.jra.jp/jockey/fuma_matsuwaka.html",
  "https://umajo.jra.jp/jockey/yuji_hishida.html",
  "https://umajo.jra.jp/jockey/mirco_demuro.html",
  "https://umajo.jra.jp/jockey/katsuma_sameshima.html",
  "https://umajo.jra.jp/jockey/shota_kato.html",
  "https://umajo.jra.jp/jockey/ryusei_sakai.html",
  "https://umajo.jra.jp/jockey/ryoya_kozaki.html",
  "https://umajo.jra.jp/jockey/kiwamu_ogino.html",
  "https://umajo.jra.jp/jockey/takuya_kowata.html",
  "https://umajo.jra.jp/jockey/hiroto_mayuzumi.html",
  "https://umajo.jra.jp/jockey/hayato_matoba.html",
  "https://umajo.jra.jp/jockey/makoto_sugihara.html",
  "https://umajo.jra.jp/jockey/yusaku_kokubun.html",
  "https://umajo.jra.jp/jockey/kyosuke_kokubun.html",
  "https://umajo.jra.jp/jockey/haruhiko_kawasu.html",
  "https://umajo.jra.jp/jockey/yutaka_yoshida.html",
  "https://umajo.jra.jp/jockey/hayato_yoshida.html",
  "https://umajo.jra.jp/jockey/yuichi_kitamura.html",
  "https://umajo.jra.jp/jockey/ryuji_wada.html",
  "https://umajo.jra.jp/jockey/yusuke_fujioka.html",
  "https://umajo.jra.jp/jockey/norihiro_yokoyama.html",
  "https://umajo.jra.jp/jockey/hideaki_miyuki.html",
  "https://umajo.jra.jp/jockey/akihide_tsumura.html",
  "https://umajo.jra.jp/jockey/takashi_fujikake.html",
  "https://umajo.jra.jp/jockey/kousei_miura.html",
  "https://umajo.jra.jp/jockey/kyosuke_maruta.html",
  "https://umajo.jra.jp/jockey/takeshi_yokoyama.html",
  "https://umajo.jra.jp/jockey/hiroshi_kitamura.html",
  "https://umajo.jra.jp/jockey/yuji_tannai.html",
  "https://umajo.jra.jp/jockey/ryuichi_sugahara.html",
  "https://umajo.jra.jp/jockey/yoshitomi_shibata.html",
  "https://umajo.jra.jp/jockey/takuya_ono.html",
  "https://umajo.jra.jp/jockey/ikuya_kowata.html",
  "https://umajo.jra.jp/jockey/hiroyuki_uchida.html",
  "https://umajo.jra.jp/jockey/yoshihiro_furukawa.html",
  "https://umajo.jra.jp/jockey/atsuya_nishimura.html",
  "https://umajo.jra.jp/jockey/akira_sugawara.html",
  "https://umajo.jra.jp/jockey/manabu_sakai.html",
  "https://umajo.jra.jp/jockey/mirai_iwata.html",
  "https://umajo.jra.jp/jockey/kenichi_ikezoe.html",
  "https://umajo.jra.jp/jockey/manami_nagashima.html",
  "https://umajo.jra.jp/jockey/yamato_tsunoda.html",
  "https://umajo.jra.jp/jockey/kanta_taguchi.html",
];

function unique(arr) {
  return [...new Set(arr)];
}

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
  // 安定：title から取る（例："戸崎 圭太 | UMAJO"）
  const t = html.match(/<title[^>]*>\s*([^<]+?)\s*<\/title>/i);
  if (t) {
    const title = t[1].replace(/\s+/g, " ").trim();
    const name = title.split("|")[0].trim();
    if (name) return name;
  }
  // 保険：h1
  const h1 = html.match(/<h1[^>]*>\s*([^<]+?)\s*<\/h1>/i);
  if (h1) return h1[1].replace(/\s+/g, " ").trim();

  return "(ジョッキー)";
}

export default async function handler(req, res) {
  try {
    const seeds = unique(SEEDS);
    const profileUrl = pickRandom(seeds);

    const html = await fetchText(profileUrl);
    const name = extractName(html);

    res.status(200).json({
      error: false,
      source: "UMAJO (seed list)",
      totalCandidates: seeds.length,
      picked: { name, profileUrl },
    });
  } catch (e) {
    res.status(200).json({ error: true, message: e?.message || "Unknown error" });
  }
}
