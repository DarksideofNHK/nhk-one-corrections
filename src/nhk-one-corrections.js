// NHK ONE 訂正一覧（ブックマークレット）
// 見逃し配信の番組ページで押すと、その回の映像に重ねて出る「訂正・お断り」を一覧にする。
// パネルのボタンで、その日の総合・Eテレの全番組の訂正も一覧にできる。
// 読むのは NHK ONE のページ（ブラウザで開くのと同じもの）と、各回の動画情報（videoinfo-*.json）だけ。
void (async () => {
  const PANEL_ID = 'nhk-one-corrections-panel';
  const old = document.getElementById(PANEL_ID);
  if (old) { old.remove(); return; }
  if (location.hostname !== 'www.web.nhk') {
    alert('NHK ONE（www.web.nhk）のページで押してください。');
    return;
  }

  const SVC = { g1: '総合', e1: 'Eテレ' };
  // 地域の番号と名前（NHK ONE の日付ページの見出し「NHK総合・○○」から。さいたま・千葉・横浜は東京と同じ番組表）
  const AREA = {
    '010': '札幌', '011': '函館', '012': '旭川', '013': '帯広', '014': '釧路', '015': '北見', '016': '室蘭',
    '020': '青森', '030': '盛岡', '040': '仙台', '050': '秋田', '060': '山形', '070': '福島',
    '080': '水戸', '090': '宇都宮', '100': '前橋', '110': '東京', '120': '東京', '130': '東京', '140': '東京',
    '150': '新潟', '160': '富山', '170': '金沢', '180': '福井', '190': '甲府', '200': '長野', '210': '岐阜',
    '220': '静岡', '230': '名古屋', '240': '津', '250': '大津', '260': '京都', '270': '大阪', '280': '神戸',
    '290': '奈良', '300': '和歌山', '310': '鳥取', '320': '松江', '330': '岡山', '340': '広島', '350': '山口',
    '360': '徳島', '370': '高松', '380': '松山', '390': '高知', '400': '福岡', '401': '北九州', '410': '佐賀',
    '420': '長崎', '430': '熊本', '440': '大分', '450': '宮崎', '460': '鹿児島', '470': '沖縄',
  };
  // ご利用確認で選んだ地域（Cookie の area_permanent）。わからなければ東京
  const myArea = ((document.cookie.match(/(?:^|;\s*)area_permanent=(\d{3})/) || [])[1]) || '130';
  const WD = '日月火水木金土';

  // "00065200" → 412 秒。先頭6桁が時・分・秒（末尾2桁は使わない）
  const toSec = s => {
    const m = /^(\d\d)(\d\d)(\d\d)/.exec(s || '');
    return m ? (+m[1] * 60 + +m[2]) * 60 + +m[3] : null;
  };
  const p2 = n => String(n).padStart(2, '0');
  const hms = sec => {
    const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60;
    return h ? `${h}:${p2(m)}:${p2(s)}` : `${p2(m)}:${p2(s)}`;
  };
  const clock = (iso, plusSec) => {
    const t = new Date(new Date(iso).getTime() + (plusSec || 0) * 1000 + 9 * 3600 * 1000);
    return `${p2(t.getUTCHours())}:${p2(t.getUTCMinutes())}` + (plusSec !== undefined ? `:${p2(t.getUTCSeconds())}` : '');
  };
  const dayLabel = d => {
    const t = new Date(Date.UTC(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8)));
    return `${+d.slice(4, 6)}月${+d.slice(6, 8)}日（${WD[t.getUTCDay()]}）`;
  };
  const shiftDay = (d, n) => {
    const t = new Date(Date.UTC(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8) + n));
    return `${t.getUTCFullYear()}${p2(t.getUTCMonth() + 1)}${p2(t.getUTCDate())}`;
  };
  // 文言からのおおまかな分類（キーワードによる推定）
  const kindOf = msg => {
    if (/誤り|正しくは|正しい|訂正|ではなく/.test(msg)) return '訂正';
    if (msg.includes('修正しました')) return '修正済み';
    if (/ニュースが入|中断|休止|差し替え|お断り|お知らせ|放送はありません/.test(msg)) return 'お知らせ';
    return '補足';
  };
  const itemsOf = info => (info.disclaimer || [])
    .filter(d => d && d.message)
    .map(d => ({ sec: toSec(d.start), dur: toSec(d.duration), message: d.message.trim(), kind: kindOf(d.message) }))
    .filter(d => d.sec !== null)
    .sort((a, b) => a.sec - b.sec);

  // NHK ONE のページに埋め込まれた番組データから、見逃し配信の動画を取り出す
  const pageVideos = async path => {
    const html = await (await fetch(path, { credentials: 'include' })).text();
    const text = [...html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)]
      .map(m => { try { return JSON.parse(m[1]); } catch (e) { return ''; } })
      .join('');
    const starts = [...text.matchAll(/\{"id":"hskOriginal-/g)].map(m => m.index);
    const videos = new Map();
    starts.forEach((s, i) => {
      const chunk = text.slice(s, Math.min(starts[i + 1] || Infinity, s + 4000));
      const get = k => {
        const m = chunk.match(new RegExp('"' + k + '":"((?:[^"\\\\]|\\\\.)*)"'));
        try { return m ? JSON.parse('"' + m[1] + '"') : ''; } catch (e) { return ''; }
      };
      const desc = get('detailedVideoDescriptor');
      if (!/\/videoinfo-[^/]+\.json$/.test(desc) || get('streamType') !== 'vod' || get('contentStatus') !== 'ready') return;
      if (!videos.has(desc)) {
        videos.set(desc, { id: get('id'), name: get('name').normalize('NFKC'), url: get('url'), start: get('startDate'), desc });
      }
    });
    return [...videos.values()].sort((a, b) => a.start.localeCompare(b.start));
  };
  const withItems = async (videos, onProgress) => {
    let done = 0, errors = 0;
    const out = new Array(videos.length);
    const queue = videos.map((v, i) => [v, i]);
    const worker = async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        const [v, i] = job;
        try { out[i] = { ...v, items: itemsOf(await (await fetch(v.desc)).json()) }; }
        catch (e) { out[i] = { ...v, items: [], error: true }; errors++; }
        if (onProgress) onProgress(++done, videos.length);
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    return { list: out, errors };
  };

  // ---- 表示（ページの CSS の影響を受けないよう Shadow DOM の中に作る）
  const host = document.createElement('div');
  host.id = PANEL_ID;
  host.style.cssText = 'position:fixed;inset:16px 16px auto auto;margin:0;padding:0;border:0;background:none;overflow:visible;z-index:2147483647';
  const root = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = `
    .p{width:min(460px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto;box-sizing:border-box;
       background:#12181f;color:#eef2f6;border:1px solid #2c3642;border-radius:10px;padding:14px 16px;
       font:14px/1.6 "Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic",system-ui,sans-serif;
       box-shadow:0 8px 28px rgba(0,0,0,.45)}
    .h{display:flex;gap:8px;align-items:flex-start;justify-content:space-between}
    .t{font-weight:700;font-size:15px}
    .s{color:#9aa6b3;font-size:12.5px;margin-top:2px;overflow-wrap:anywhere}
    button{flex-shrink:0;white-space:nowrap;font:inherit;font-size:12.5px;font-weight:700;color:#eef2f6;background:#243040;
       border:1px solid #34404e;border-radius:6px;padding:3px 10px;cursor:pointer}
    button:hover{background:#2e3c4f}
    button[aria-pressed="true"]{background:#eef2f6;color:#12181f}
    select{font:inherit;font-size:12.5px;font-weight:700;color:#eef2f6;background:#243040;border:1px solid #34404e;
       border-radius:6px;padding:3px 6px;cursor:pointer}
    .prog{border-top:1px solid #26303b;margin-top:12px;padding-top:10px}
    .pn{font-weight:700;overflow-wrap:anywhere}
    .pn a{color:#9cc6f5;text-decoration:none}
    .pn a:hover{text-decoration:underline}
    .pt{color:#9aa6b3;font-size:12.5px}
    ol{list-style:none;margin:6px 0 0;padding:0;display:flex;flex-direction:column;gap:8px}
    .m{display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center;font-size:12.5px;color:#9aa6b3}
    .tc{font-family:ui-monospace,Menlo,monospace;color:#eef2f6}
    .k{font-weight:700;border-radius:4px;padding:0 7px;font-size:12px}
    .k[data-k="訂正"]{background:#4a1f1d;color:#ffb1aa}
    .k[data-k="補足"]{background:#43330f;color:#f3cd7d}
    .k[data-k="修正済み"]{background:#15372f;color:#8fdcc6}
    .k[data-k="お知らせ"]{background:#2a323d;color:#c3ccd6}
    .msg{margin-top:2px;overflow-wrap:anywhere}
    .e{margin-top:12px;color:#9aa6b3}
    .f{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px;align-items:center;font-size:12px;color:#7d8996}`;
  const el = (tag, cls, text) => {
    const x = document.createElement(tag);
    if (cls) x.className = cls;
    if (text !== undefined) x.textContent = text;
    return x;
  };
  const button = (label, onclick, pressed) => {
    const b = el('button', '', label);
    b.type = 'button';
    b.onclick = onclick;
    if (pressed !== undefined) b.setAttribute('aria-pressed', String(pressed));
    return b;
  };
  const panel = el('div', 'p');
  root.append(style, panel);
  document.body.append(host);
  // ページのお知らせ窓（最前面のダイアログ）より上に出す
  if (host.showPopover) { host.popover = 'manual'; host.showPopover(); }

  const copyButton = text => {
    const b = button('テキストでコピー', async () => {
      try { await navigator.clipboard.writeText(text); b.textContent = 'コピーしました'; }
      catch (e) { prompt('コピーしてください', text); }
    });
    return b;
  };
  // programs: [{name, url, start, items}]。showTime: 番組名の前に放送開始時刻を出す
  const render = ({ title, sub, programs, empty, showTime, footer, textHead }) => {
    // あとから開いたページのお知らせ窓に隠れないよう、描き直すたびに最前面へ出し直す
    if (host.showPopover && host.matches(':popover-open')) { host.hidePopover(); host.showPopover(); }
    panel.replaceChildren();
    const head = el('div', 'h');
    const hl = el('div');
    hl.append(el('div', 't', title), el('div', 's', sub));
    head.append(hl, button('閉じる', () => host.remove()));
    panel.append(head);
    const lines = [...textHead];
    for (const g of programs || []) {
      const box = el('div', 'prog');
      const pn = el('div', 'pn');
      if (showTime && g.start) pn.append(el('span', 'pt', clock(g.start) + ' '));
      const a = el('a', '', g.name);
      a.href = g.url;
      pn.append(a);
      box.append(pn);
      const ol = el('ol');
      for (const d of g.items) {
        const li = el('li');
        const meta = el('div', 'm');
        const k = el('span', 'k', d.kind);
        k.dataset.k = d.kind;
        meta.append(k, el('span', 'tc', `▶ ${hms(d.sec)}〜`), el('span', '', `${d.dur}秒`));
        if (g.start) meta.append(el('span', '', `放送 ${clock(g.start, d.sec)}`));
        li.append(meta, el('div', 'msg', d.message));
        ol.append(li);
      }
      box.append(ol);
      panel.append(box);
      lines.push('', `${showTime && g.start ? clock(g.start) + ' ' : ''}${g.name}`, g.url,
        ...g.items.map(d => `[▶${hms(d.sec)}〜 ${d.dur}秒${g.start ? '・放送 ' + clock(g.start, d.sec) : ''}]〔${d.kind}〕${d.message}`));
    }
    if (!programs || !programs.length) panel.append(el('div', 'e', empty));
    lines.push('', '出典: NHK ONE 見逃し配信（映像に重ねて表示される文言）');
    const foot = el('div', 'f');
    foot.append(copyButton(lines.join('\n')), ...(footer || []));
    panel.append(foot);
  };
  const status = (title, sub) => render({ title, sub, programs: [], empty: '', textHead: [] });

  // ---- その日の全番組
  // 全国: その日の全地域の一覧を読み、同じ動画はまとめる。一部の地域にしか出ない回は、その地域の番組として印を付ける
  const CODES = Object.keys(AREA).sort().filter(c => !['110', '120', '140'].includes(c));
  const allAreaVideos = async (svc, day, onProgress) => {
    const seen = new Map();
    const queue = [...CODES];
    let done = 0;
    const worker = async () => {
      for (let code = queue.shift(); code; code = queue.shift()) {
        let vs = [];
        try { vs = await pageVideos(`/tv/pl/schedule-tep-${svc}-${code}-${day}/list`); } catch (e) { vs = []; }
        for (const v of vs) {
          if (!seen.has(v.desc)) seen.set(v.desc, { ...v, areas: [] });
          seen.get(v.desc).areas.push(code);
        }
        onProgress(++done, CODES.length);
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    return [...seen.values()].map(v => {
      const local = v.areas.length < CODES.length / 2;
      const origin = (/hskOriginal-[a-z0-9]+-(\d+)-/.exec(v.id) || [])[1];
      const where = local ? (AREA[origin] && v.areas.includes(origin) ? AREA[origin] : v.areas.map(c => AREA[c]).join('・')) : '';
      return { ...v, name: where ? `［${where}］${v.name}` : v.name };
    }).sort((a, b) => a.start.localeCompare(b.start));
  };

  // 一度読んだ日の結果はブラウザに残し、読み直すかどうかは利用者が選ぶ（前の日・次の日を行き来しても読み直さない）
  const CACHE_KEY = 'nhk-one-corrections:days:v1';
  const loadCache = () => { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch (e) { return {}; } };
  const saveDay = (key, entry) => {
    try {
      const c = loadCache();
      c[key] = entry;
      // 古いものから消して、最近の60日分（チャンネル・地域ごと）までにする
      const keys = Object.keys(c).sort((x, y) => c[y].at - c[x].at);
      for (const k of keys.slice(60)) delete c[k];
      localStorage.setItem(CACHE_KEY, JSON.stringify(c));
    } catch (e) { /* 保存できない環境では、毎回読むだけ */ }
  };
  const when = t => {
    const d = new Date(t + 9 * 3600 * 1000);
    return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`;
  };

  // opts.reload: 残してある結果を使わずに読み直す
  const showDay = async (svc, area, day, opts = {}) => {
    const label = `${dayLabel(day)} ${SVC[svc] || svc}（${area === 'all' ? '全国' : AREA[area] || area}）`;
    const title = `${label}の訂正・お断り`;
    const key = `${svc}-${area}-${day}`;
    const pick = el('select');
    pick.setAttribute('aria-label', '地域');
    const allOpt = el('option', '', '全国（時間がかかります）');
    allOpt.value = 'all';
    allOpt.selected = area === 'all';
    pick.append(allOpt);
    // 番号の順に並べる（'130' のような数字だけのキーは Object.entries で先に来てしまうため）
    for (const [code, name] of Object.keys(AREA).sort().map(c => [c, AREA[c]])) {
      if (['110', '120', '140'].includes(code)) continue;
      const o = el('option', '', name);
      o.value = code;
      o.selected = code === area || (AREA[area] === name && ['110', '120', '140'].includes(area));
      pick.append(o);
    }
    pick.onchange = () => showDay(svc, pick.value, day);
    const nav = [
      button('前の日', () => showDay(svc, area, shiftDay(day, -1))),
      button('次の日', () => showDay(svc, area, shiftDay(day, 1))),
      ...Object.keys(SVC).map(s => button(SVC[s], () => showDay(s, area, day), s === svc)),
      pick,
    ];
    const reloadButton = label2 => button(label2, () => showDay(svc, area, day, { reload: true }));

    const cached = !opts.reload && loadCache()[key];
    if (cached) {
      const sub = `${cached.sub}（${when(cached.at)} に読み込んだ結果）`;
      render({ title, sub, programs: cached.hits, showTime: true, footer: [reloadButton('読み込み直す'), ...nav],
        textHead: [title, sub], empty: cached.empty });
      return;
    }
    if (area === 'all' && !opts.reload) {
      // 全国は重いので、押されるまで読まない
      render({ title, sub: 'まだ読み込んでいません', programs: [], footer: [reloadButton('全国を読み込む（30〜40秒）'), ...nav], textHead: [title],
        empty: `全国${CODES.length}地域の番組の一覧を読みます。読んだ結果はこのブラウザに残るので、前の日・次の日を行き来しても読み直しません。` });
      return;
    }

    status(title, '番組の一覧を読んでいます…');
    let videos;
    if (area === 'all') {
      videos = await allAreaVideos(svc, day, (n, all) => status(title, `全国${all}地域の番組の一覧を読んでいます…（${n}/${all}）`));
    } else {
      try { videos = await pageVideos(`/tv/pl/schedule-tep-${svc}-${area}-${day}/list`); }
      catch (e) { videos = []; }
    }
    if (!videos.length) {
      render({ title, sub: '見逃し配信の番組が見つかりませんでした', programs: [], footer: nav, textHead: [title],
        empty: '配信期間（おおむね1週間）を過ぎた日か、ご利用確認がまだかもしれません。' });
      return;
    }
    const { list, errors } = await withItems(videos, (n, all) => status(title, `見逃し配信 ${all}本の動画情報を確認しています…（${n}/${all}）`));
    const hits = list.filter(v => v.items.length).map(({ name, url, start, items }) => ({ name, url, start, items }));
    const count = hits.reduce((s, v) => s + v.items.length, 0);
    const sub = `見逃し配信 ${videos.length}本を確認。${hits.length}番組に${count}件` + (errors ? `（読めなかった動画情報 ${errors}件）` : '');
    const empty = 'この日の番組には、訂正・お断りの文言はありませんでした。';
    if (!errors) saveDay(key, { at: Date.now(), sub, hits, empty });
    render({ title, sub, programs: hits, showTime: true, footer: nav, textHead: [title, sub], empty });
  };

  // ---- いま開いている回
  const showEpisode = async epId => {
    const title = 'この回の訂正・お断り';
    status(title, '読んでいます…');
    let videos = [];
    try { videos = (await pageVideos(location.pathname)).filter(v => v.url.includes('/ep/' + epId)); }
    catch (e) { videos = []; }
    if (!videos.length) {
      // ページのデータから見つからないときは、ページがすでに読み込んだ動画情報を使う（ページを開き直した直後だけ）
      const nav = performance.getEntriesByType('navigation')[0];
      const moved = nav && new URL(nav.name).pathname !== location.pathname;
      const vi = performance.getEntriesByType('resource').map(e => e.name).filter(n => /\/videoinfo-[^/?]+\.json(\?|$)/.test(n));
      if (!moved && vi.length) {
        videos = [{ name: document.title.replace(/\s*[|｜]\s*NHK(\s*ONE)?\s*$/, ''), url: location.href, start: '', desc: vi[vi.length - 1] }];
      }
    }
    if (!videos.length) {
      render({ title, sub: document.title, programs: [], textHead: [],
        empty: 'この回の動画情報が見つかりませんでした。見逃し配信が終わった回か、ご利用確認がまだかもしれません（番組を見るのにご利用確認が求められたときは、先に済ませてください）。' });
      return;
    }
    const { list } = await withItems(videos);
    const n = list.reduce((s, v) => s + v.items.length, 0);
    const m = /hskOriginal-([a-z0-9]+)-(\d+)-(\d{8})/.exec(list[0].id || '');
    // 全国放送の回の ID は東京（130）になっているので、一覧は自分の地域で出す
    const footer = m ? [button(`この日の${SVC[m[1]] || m[1]}の全番組`, () => showDay(m[1], myArea, m[3]))] : [];
    render({ title: `${title}（${n}件）`, sub: n ? '▶ は配信動画の頭からの時間' : list[0].name, programs: list.filter(v => v.items.length), footer,
      textHead: [], empty: 'この回の動画情報には、訂正・お断りの文言はありませんでした。' });
  };

  const day = location.pathname.match(/^\/tv\/pl\/schedule-tep-([a-z0-9]+)-(\d+)-(\d{8})/);
  const ep = location.pathname.match(/\/ep\/([A-Z0-9]{10})/);
  if (ep) await showEpisode(ep[1]);
  else if (day) await showDay(day[1], day[2], day[3]);
  else {
    const t = new Date(Date.now() + 9 * 3600 * 1000);
    await showDay('g1', myArea, `${t.getUTCFullYear()}${p2(t.getUTCMonth() + 1)}${p2(t.getUTCDate())}`);
  }
})();
