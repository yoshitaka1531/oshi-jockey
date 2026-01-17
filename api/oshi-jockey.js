<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>今日の推しジョッキー</title>

  <!-- 筆文字っぽい和風フォント（Google Fonts） -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Yuji+Syuku&family=Yuji+Boku&display=swap" rel="stylesheet">

  <style>
    :root{
      --ink:#1a1a1a;
      --paper:#fbf7ee;
      --paper2:#f4eddc;
      --line:#d9cdb5;
      --accent:#b00020;
    }
    *{box-sizing:border-box}
    body{
      margin:0;
      padding:24px;
      color:var(--ink);
      background:
        radial-gradient(1200px 800px at 20% 10%, rgba(0,0,0,.04), transparent 60%),
        radial-gradient(900px 700px at 80% 0%, rgba(0,0,0,.03), transparent 55%),
        linear-gradient(180deg, var(--paper), var(--paper2));
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans JP", sans-serif;
    }
    .wrap{max-width:760px;margin:0 auto}
    .title{
      font-family: "Yuji Syuku", "Yuji Boku", serif;
      font-size:40px;
      letter-spacing:.06em;
      margin:0 0 14px;
    }
    .sub{
      margin:0 0 18px;
      color:#444;
      font-size:13px;
    }

    .panel{
      border:1px solid var(--line);
      background:rgba(255,255,255,.55);
      border-radius:18px;
      padding:18px;
      box-shadow: 0 10px 30px rgba(0,0,0,.06);
      position:relative;
      overflow:hidden;
    }
    .panel:before{
      content:"";
      position:absolute;
      inset:-80px -120px auto auto;
      width:280px;height:280px;
      border-radius:999px;
      background:radial-gradient(circle at 30% 30%, rgba(176,0,32,.12), transparent 60%);
      transform:rotate(18deg);
      pointer-events:none;
    }

    .btnrow{
      display:flex;
      gap:12px;
      flex-wrap:wrap;
      align-items:center;
      margin-top:10px;
    }

    /* 和風 “札” っぽいボタン */
    .btn{
      border:1px solid #cbbd9f;
      background:linear-gradient(180deg, #fffdf7, #f3ead6);
      color:var(--ink);
      border-radius:14px;
      padding:12px 18px;
      cursor:pointer;
      box-shadow: 0 6px 16px rgba(0,0,0,.08);
      transition: transform .08s ease, box-shadow .08s ease;
      font-size:16px;
    }
    .btn:active{transform:translateY(1px);box-shadow: 0 4px 12px rgba(0,0,0,.08)}
    .btn[disabled]{opacity:.6;cursor:not-allowed}

    .btn.main{
      font-family: "Yuji Syuku", "Yuji Boku", serif;
      font-size:22px;
      letter-spacing:.18em;
      padding:14px 22px;
      border-color:#b9a27a;
    }
    .btn.share{
      font-family: "Yuji Syuku", "Yuji Boku", serif;
      letter-spacing:.08em;
    }

    .result{
      margin-top:16px;
      padding:18px;
      border:1px solid var(--line);
      border-radius:18px;
      background:rgba(255,255,255,.62);
    }
    .name{
      font-family: "Yuji Syuku", "Yuji Boku", serif;
      font-size:28px;
      letter-spacing:.08em;
      margin:0 0 12px;
    }
    .link{
      display:inline-block;
      font-size:16px;
      color:#1a4aa5;
      text-decoration:underline;
      text-underline-offset:3px;
    }
    .link:hover{opacity:.85}

    .err{
      margin-top:12px;
      white-space:pre-wrap;
      color:var(--accent);
      font-size:13px;
      display:none;
    }

    .footer{
      margin-top:18px;
      padding:14px 16px;
      border:1px dashed #cbbd9f;
      border-radius:16px;
      background:rgba(255,255,255,.45);
    }
    .footer h2{
      margin:0 0 8px;
      font-family:"Yuji Syuku","Yuji Boku",serif;
      font-size:18px;
      letter-spacing:.08em;
    }
    .footlink{
      color:#1a4aa5;
      text-decoration:underline;
      text-underline-offset:3px;
      word-break:break-all;
    }
  </style>
</head>

<body>
  <div class="wrap">
    <h1 class="title">今日の推しジョッキー</h1>
    <p class="sub">ボタンを押すと、UMAJO掲載のジョッキーが1名選ばれます。</p>

    <div class="panel">
      <div class="btnrow">
        <!-- 「おみくじを引く」→「勝負！」 -->
        <button id="drawBtn" class="btn main" type="button">勝負！</button>
        <button id="shareBtn" class="btn share" type="button" disabled>シェア</button>
      </div>

      <div class="result" id="result" style="display:none;">
        <div class="name" id="name"></div>

        <a id="profileLink" class="link" href="#" target="_blank" rel="noopener noreferrer">
          プロフィールを見る
        </a>

        <!-- 「候補数56/」などの表示は消すので meta は表示しない -->
        <div id="meta" style="display:none;"></div>

        <div class="err" id="err"></div>
      </div>
    </div>

    <!-- TOPページ最下部：おすすめサイト -->
    <div class="footer">
      <h2>おすすめサイト</h2>
      <a class="footlink"
         href="https://c-lemaire.co.jp/?srsltid=AfmBOop6TBukVoj2Y2Cs9SYRuY_8TsMUwtuXH3sUJPnIAXSxN-VKYrgq"
         target="_blank" rel="noopener noreferrer">
        https://c-lemaire.co.jp/
      </a>
    </div>
  </div>

  <script>
    const drawBtn  = document.getElementById("drawBtn");
    const shareBtn = document.getElementById("shareBtn");
    const resultEl = document.getElementById("result");
    const nameEl   = document.getElementById("name");
    const linkEl   = document.getElementById("profileLink");
    const errEl    = document.getElementById("err");

    let lastPicked = null;

    function showError(msg){
      resultEl.style.display = "block";
      errEl.style.display = "block";
      errEl.textContent = msg;
    }

    function clearError(){
      errEl.style.display = "none";
      errEl.textContent = "";
    }

    async function draw(){
      drawBtn.disabled = true;
      shareBtn.disabled = true;
      drawBtn.textContent = "参戦中…";
      clearError();
      resultEl.style.display = "none";

      try{
        const res = await fetch("/api/oshi-jockey", { cache: "no-store" });
        const data = await res.json();

        if(!res.ok || data.error){
          throw new Error(data.message || `API error: ${res.status}`);
        }

        const picked = data.picked || {};
        const name = picked.name || "(ジョッキー)";
        const profileUrl = picked.profileUrl;

        if(!profileUrl){
          throw new Error("APIの返却に profileUrl がありません。");
        }

        lastPicked = { name, profileUrl };

        nameEl.textContent = name;

        // ✅ リンク先は picked.profileUrl
        linkEl.href = profileUrl;
        linkEl.target = "_blank";
        linkEl.rel = "noopener noreferrer";

        resultEl.style.display = "block";
        shareBtn.disabled = false;

      }catch(e){
        console.error(e);
        showError("取得に失敗しました。\n\n" + String(e.message || e));
        lastPicked = null;
      }finally{
        drawBtn.disabled = false;
        drawBtn.textContent = "勝負！";
      }
    }

    async function share(){
      if(!lastPicked) return;

      const text = `今日の推しジョッキーは「${lastPicked.name}」！`;
      const url  = lastPicked.profileUrl;

      // 1) スマホ：共有シート
      if(navigator.share){
        try{
          await navigator.share({ title:"今日の推しジョッキー", text, url });
          return;
        }catch(_){}
      }

      // 2) PC：X共有
      const xUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
      window.open(xUrl, "_blank", "noopener,noreferrer");
    }

    drawBtn.addEventListener("click", draw);
    shareBtn.addEventListener("click", share);
  </script>
</body>
</html>
