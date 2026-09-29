// NHK ONE 訂正一覧（ブックマークレット）
// 見逃し配信のページで押すと、この回の映像に重ねて出る「訂正・お断り」を一覧にする。
// ページがすでに読み込んだ動画情報（videoinfo-*.json）を読み直すだけで、ほかの場所にはアクセスしない。
void (async () => {
  const PANEL_ID = 'nhk-one-corrections-panel';
  const old = document.getElementById(PANEL_ID);
  if (old) { old.remove(); return; }

  // ページの中で別の回に移ったあとは、どの回の動画情報か確かめられないので読み込み直してもらう
  const nav = performance.getEntriesByType('navigation')[0];
  if (nav && new URL(nav.name).pathname !== location.pathname) {
    if (confirm('ページの中で別の回に移ったあとは、どの回の情報か確かめられません。\nページを読み込み直しますか？（読み込んだあと、もう一度押してください）')) location.reload();
    return;
  }

  // ページが読み込んだ動画情報を探す（プレーヤーが表示されたあとに読み込まれる）
  const url = performance.getEntriesByType('resource')
    .map(e => e.name)
    .reverse()
    .find(n => /\/videoinfo-[^/?]+\.json(\?|$)/.test(n));
  if (!url) {
    alert('この回の動画情報がまだ読み込まれていません。\nNHK ONE の見逃し配信のページで、プレーヤーが表示されてからもう一度押してください。\n（番組を見るのにご利用確認が求められたときは、先に済ませてください）');
    return;
  }
  let info;
  try {
    info = await (await fetch(url)).json();
  } catch (e) {
    alert('動画情報を読めませんでした: ' + e);
    return;
  }

  // "00065200" → 412 秒。先頭6桁が時・分・秒（末尾2桁は使わない）
  const toSec = s => {
    const m = /^(\d\d)(\d\d)(\d\d)/.exec(s || '');
    return m ? (+m[1] * 60 + +m[2]) * 60 + +m[3] : null;
  };
  const hms = sec => {
    const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60;
    const p = n => String(n).padStart(2, '0');
    return h ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
  };
  // 文言からのおおまかな分類（キーワードによる推定）
  const kindOf = msg => {
    if (/誤り|正しくは|正しい|訂正|ではなく/.test(msg)) return '訂正';
    if (msg.includes('修正しました')) return '修正済み';
    if (/ニュースが入|中断|休止|差し替え|お断り|お知らせ|放送はありません/.test(msg)) return 'お知らせ';
    return '補足';
  };

  const items = (info.disclaimer || [])
    .filter(d => d && d.message)
    .map(d => ({ sec: toSec(d.start), dur: toSec(d.duration), message: d.message.trim(), kind: kindOf(d.message) }))
    .filter(d => d.sec !== null)
    .sort((a, b) => a.sec - b.sec);

  const title = document.title.replace(/\s*[|｜]\s*NHK(\s*ONE)?\s*$/, '');
  const lines = items.map(d => `[${hms(d.sec)}〜 ${d.dur}秒]〔${d.kind}〕${d.message}`);
  const plain = [title, location.href, ...(lines.length ? lines : ['（訂正・お断りはありません）']),
    '出典: NHK ONE 見逃し配信（映像に重ねて表示される文言）'].join('\n');

  // 表示（ページの CSS の影響を受けないよう Shadow DOM の中に作る）
  const host = document.createElement('div');
  host.id = PANEL_ID;
  host.style.cssText = 'position:fixed;inset:16px 16px auto auto;margin:0;padding:0;border:0;background:none;overflow:visible;z-index:2147483647';
  const root = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = `
    .p{width:min(440px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto;box-sizing:border-box;
       background:#12181f;color:#eef2f6;border:1px solid #2c3642;border-radius:10px;padding:14px 16px;
       font:14px/1.6 "Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic",system-ui,sans-serif;
       box-shadow:0 8px 28px rgba(0,0,0,.45)}
    .h{display:flex;gap:8px;align-items:flex-start;justify-content:space-between}
    .t{font-weight:700;font-size:15px}
    .s{color:#9aa6b3;font-size:12.5px;margin-top:2px;overflow-wrap:anywhere}
    button{flex-shrink:0;white-space:nowrap;font:inherit;font-size:12.5px;font-weight:700;color:#eef2f6;background:#243040;border:1px solid #34404e;
       border-radius:6px;padding:3px 10px;cursor:pointer}
    button:hover{background:#2e3c4f}
    ol{list-style:none;margin:12px 0 0;padding:0;display:flex;flex-direction:column;gap:10px}
    li{border-top:1px solid #26303b;padding-top:10px}
    .m{display:flex;gap:8px;align-items:center;font-size:12.5px;color:#9aa6b3}
    .tc{font-family:ui-monospace,Menlo,monospace;color:#eef2f6}
    .k{font-weight:700;border-radius:4px;padding:0 7px;font-size:12px}
    .k[data-k="訂正"]{background:#4a1f1d;color:#ffb1aa}
    .k[data-k="補足"]{background:#43330f;color:#f3cd7d}
    .k[data-k="修正済み"]{background:#15372f;color:#8fdcc6}
    .k[data-k="お知らせ"]{background:#2a323d;color:#c3ccd6}
    .msg{margin-top:4px;overflow-wrap:anywhere}
    .e{margin-top:12px;color:#9aa6b3}
    .f{display:flex;gap:8px;margin-top:14px;align-items:center;font-size:12px;color:#7d8996}`;
  const el = (tag, cls, text) => {
    const x = document.createElement(tag);
    if (cls) x.className = cls;
    if (text !== undefined) x.textContent = text;
    return x;
  };
  const panel = el('div', 'p');
  const head = el('div', 'h');
  const hl = el('div');
  hl.append(el('div', 't', `この回の訂正・お断り（${items.length}件）`), el('div', 's', title));
  const close = el('button', '', '閉じる');
  close.onclick = () => host.remove();
  head.append(hl, close);
  panel.append(head);
  if (items.length) {
    const ol = el('ol');
    for (const d of items) {
      const li = el('li');
      const meta = el('div', 'm');
      const k = el('span', 'k', d.kind);
      k.dataset.k = d.kind;
      meta.append(k, el('span', 'tc', `${hms(d.sec)}〜`), el('span', '', `${d.dur}秒`));
      li.append(meta, el('div', 'msg', d.message));
      ol.append(li);
    }
    panel.append(ol);
  } else {
    panel.append(el('div', 'e', 'この回の動画情報には、訂正・お断りの文言はありませんでした。'));
  }
  const foot = el('div', 'f');
  const copy = el('button', '', 'テキストでコピー');
  copy.onclick = async () => {
    try { await navigator.clipboard.writeText(plain); copy.textContent = 'コピーしました'; }
    catch (e) { prompt('コピーしてください', plain); }
  };
  foot.append(copy, el('span', '', '時刻は配信動画の頭からの時間'));
  panel.append(foot);
  root.append(style, panel);
  document.body.append(host);
  // ページのお知らせ窓（最前面のダイアログ）より上に出す
  if (host.showPopover) { host.popover = 'manual'; host.showPopover(); }
})();
