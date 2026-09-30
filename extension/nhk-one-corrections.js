// NHK ONE 訂正一覧（拡張機能・ブックマークレット共通）
// 見逃し配信の番組ページで開くと、その回の映像に重ねて出る「訂正・お断り」を一覧にする。
// 「この日の一覧」で、その日の総合・Eテレの全番組（総合は全国の地方局も）の訂正を一覧にできる。
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
  const normArea = a => (['110', '120', '140'].includes(a) ? '130' : a);
  const CODES = Object.keys(AREA).sort().filter(c => !['110', '120', '140'].includes(c));
  // ご利用確認で選んだ地域（Cookie の area_permanent）。わからなければ東京
  const myArea = normArea(((document.cookie.match(/(?:^|;\s*)area_permanent=(\d{3})/) || [])[1]) || '130');
  const KINDS = ['訂正', '補足', '修正済み', 'お知らせ'];
  const WD = '日月火水木金土';

  // ---- 小さな道具
  const p2 = n => String(n).padStart(2, '0');
  // "00065200" → 412 秒。先頭6桁が時・分・秒（末尾2桁は使わない）
  const toSec = s => {
    const m = /^(\d\d)(\d\d)(\d\d)/.exec(s || '');
    return m ? (+m[1] * 60 + +m[2]) * 60 + +m[3] : null;
  };
  const hms = sec => {
    const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60;
    return h ? `${h}:${p2(m)}:${p2(s)}` : `${p2(m)}:${p2(s)}`;
  };
  const clock = (iso, plusSec) => {
    const t = new Date(new Date(iso).getTime() + (plusSec || 0) * 1000 + 9 * 3600 * 1000);
    return `${p2(t.getUTCHours())}:${p2(t.getUTCMinutes())}` + (plusSec !== undefined ? `:${p2(t.getUTCSeconds())}` : '');
  };
  const dateOf = d => new Date(Date.UTC(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8)));
  const dayLabel = d => `${+d.slice(4, 6)}月${+d.slice(6, 8)}日（${WD[dateOf(d).getUTCDay()]}）`;
  const shiftDay = (d, n) => {
    const t = dateOf(d);
    t.setUTCDate(t.getUTCDate() + n);
    return `${t.getUTCFullYear()}${p2(t.getUTCMonth() + 1)}${p2(t.getUTCDate())}`;
  };
  const jst = new Date(Date.now() + 9 * 3600 * 1000);
  const today = `${jst.getUTCFullYear()}${p2(jst.getUTCMonth() + 1)}${p2(jst.getUTCDate())}`;
  const when = t => {
    const d = new Date(t + 9 * 3600 * 1000);
    return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`;
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
  // ブラウザに残すもの（使えない環境では残さないだけ）
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 残せない */ } },
  };
  const PREFS_KEY = 'nhk-one-corrections:prefs:v2';
  const CACHE_KEY = 'nhk-one-corrections:days:v2';
  try { localStorage.removeItem('nhk-one-corrections:days:v1'); } catch (e) { /* 古い形式の後始末 */ }

  // ---- 読む
  // NHK ONE のページに埋め込まれた番組データから、見逃し配信の動画を取り出す
  const pageVideos = async (path, signal) => {
    const html = await (await fetch(path, { credentials: 'include', signal })).text();
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
  const fetchItems = async (v, signal) => itemsOf(await (await fetch(v.desc, { signal })).json());
  // n 本ずつ並べて処理する（中止されたら新しく始めない）
  const pool = async (jobs, n, fn, signal) => {
    const q = [...jobs];
    const worker = async () => {
      while (q.length && !signal.aborted) await fn(q.shift());
    };
    await Promise.all(Array.from({ length: n }, worker));
  };
  const listPath = (svc, area, day) => `/tv/pl/schedule-tep-${svc}-${area}-${day}/list`;

  // ---- 状態
  const prefs = store.get(PREFS_KEY, {});
  const epMatch = location.pathname.match(/\/ep\/([A-Z0-9]{10})/);
  const dayMatch = location.pathname.match(/^\/tv\/pl\/schedule-tep-([a-z0-9]+)-(\d+)-(\d{8})/);
  const S = {
    view: epMatch ? 'episode' : 'day',
    epId: epMatch ? epMatch[1] : null,
    ep: null,                                                            // この回の結果
    svc: dayMatch && SVC[dayMatch[1]] ? dayMatch[1] : (prefs.svc || 'g1'),
    area: dayMatch ? normArea(dayMatch[2]) : (prefs.area || myArea),     // 総合の地域。'all' は全国
    day: dayMatch ? dayMatch[3] : today,
    kinds: new Set(prefs.kinds && prefs.kinds.length ? prefs.kinds : KINDS),
    dayData: null,                                                       // その日の結果
    loading: null,                                                       // { text, n, all }
    ctrl: null,
    mini: false,
  };
  const savePrefs = () => store.set(PREFS_KEY, { svc: S.svc, area: S.area, kinds: [...S.kinds] });
  // Eテレは全国共通なので東京で見る
  const scopeArea = () => (S.svc === 'g1' ? S.area : '130');
  const dayKey = d => `${S.svc}-${scopeArea()}-${d || S.day}`;
  const cachedDays = () => store.get(CACHE_KEY, {});
  const saveDay = (key, entry) => {
    const c = cachedDays();
    c[key] = entry;
    // 新しいものから80件（チャンネル・地域・日ごと）まで残す
    for (const k of Object.keys(c).sort((x, y) => c[y].at - c[x].at).slice(80)) delete c[k];
    store.set(CACHE_KEY, c);
  };
  const begin = text => {
    if (S.ctrl) S.ctrl.abort();
    S.ctrl = new AbortController();
    S.loading = { text };
    return S.ctrl;
  };
  const stop = () => { if (S.ctrl) S.ctrl.abort(); S.ctrl = null; S.loading = null; };
  const isCurrent = c => c === S.ctrl && !c.signal.aborted;

  // ---- この回
  const loadEpisode = async () => {
    const c = begin('この回の動画情報を読んでいます…');
    S.ep = null;
    draw();
    try {
      let vids = (await pageVideos(location.pathname, c.signal)).filter(v => v.url.includes('/ep/' + S.epId));
      if (!vids.length) {
        // ページのデータに無いときは、ページがすでに読み込んだ動画情報を使う（ページを開き直した直後だけ）
        const nav = performance.getEntriesByType('navigation')[0];
        const moved = nav && new URL(nav.name).pathname !== location.pathname;
        const vi = performance.getEntriesByType('resource').map(e => e.name).filter(n => /\/videoinfo-[^/?]+\.json(\?|$)/.test(n));
        if (!moved && vi.length) {
          vids = [{ id: '', name: document.title.replace(/\s*[|｜]\s*NHK(\s*ONE)?\s*$/, ''), url: location.href, start: '', desc: vi[vi.length - 1] }];
        }
      }
      const progs = [];
      for (const v of vids) progs.push({ ...v, items: await fetchItems(v, c.signal) });
      const m = /hskOriginal-([a-z0-9]+)-(\d+)-(\d{8})/.exec((vids[0] || {}).id || '');
      S.ep = { progs, svc: m ? m[1] : null, day: m ? m[3] : null };
      if (m && SVC[m[1]]) { S.svc = m[1]; S.day = m[3]; }
    } catch (e) {
      if (!isCurrent(c)) return;
      S.ep = { progs: [], error: true };
    }
    if (!isCurrent(c)) return;
    stop();
    draw();
  };

  // ---- その日の一覧
  // 全国は、まず自分の地域の結果を出し、地方局の番組を読めたところから足していく
  const loadDay = async (reload = false) => {
    const key = dayKey();
    const cached = !reload && cachedDays()[key];
    if (cached) {
      stop();
      S.dayData = { ...cached, fromCache: true, done: true };
      draw();
      return;
    }
    const area = scopeArea();
    const all = area === 'all';
    const base = all ? myArea : area;
    const c = begin('番組の一覧を読んでいます…');
    const d = { videos: new Map(), errors: 0, all, base, areasDone: 0, areasAll: all ? CODES.length - 1 : 0, done: false };
    S.dayData = d;
    draw();
    const fill = async list => pool(list, 4, async v => {
      try { v.items = await fetchItems(v, c.signal); }
      catch (e) { if (!c.signal.aborted) { v.items = []; d.errors++; } }
      if (isCurrent(c) && !all) S.loading = { text: '動画情報を確認しています', n: [...d.videos.values()].filter(x => x.items).length, all: d.videos.size };
      later();
    }, c.signal);
    try {
      for (const v of await pageVideos(listPath(S.svc, base, S.day), c.signal)) d.videos.set(v.desc, { ...v, areas: [base] });
      if (!isCurrent(c)) return;
      S.loading = { text: '動画情報を確認しています', n: 0, all: d.videos.size };
      drawStatus();
      await fill([...d.videos.values()]);
      if (!isCurrent(c)) return;
      if (all) {
        S.loading = { text: '地方局の番組を確認しています', n: 0, all: d.areasAll };
        draw();
        await pool(CODES.filter(x => x !== base), 4, async code => {
          let list = [];
          try { list = await pageVideos(listPath(S.svc, code, S.day), c.signal); } catch (e) { if (!c.signal.aborted) d.errors++; }
          const fresh = [];
          for (const v of list) {
            const known = d.videos.get(v.desc);
            if (known) known.areas.push(code);
            else { const nv = { ...v, areas: [code] }; d.videos.set(v.desc, nv); fresh.push(nv); }
          }
          await fill(fresh);
          d.areasDone++;
          if (isCurrent(c)) S.loading = { text: '地方局の番組を確認しています', n: d.areasDone, all: d.areasAll };
          later();
        }, c.signal);
      }
    } catch (e) {
      if (!isCurrent(c)) return;
      d.errors++;
    }
    if (!isCurrent(c)) return;
    d.done = true;
    const entry = { at: Date.now(), count: d.videos.size, errors: d.errors, hits: hitsOf(d) };
    if (!d.errors && d.videos.size) saveDay(key, entry);
    S.dayData = { ...entry, fromCache: false, done: true };
    stop();
    draw();
  };
  // 全国では、一部の地域にしか出てこない回に局名を付ける（全国放送の回は付けない）
  const labelOf = (v, d) => {
    if (!d.all) return '';
    const origin = (/hskOriginal-[a-z0-9]+-(\d+)-/.exec(v.id) || [])[1];
    const isBase = v.areas[0] === d.base;
    if (isBase && (!d.done || v.areas.length >= CODES.length / 2)) return '';
    return AREA[origin] && v.areas.includes(origin) ? AREA[origin] : [...new Set(v.areas.map(a => AREA[a]))].join('・');
  };
  const hitsOf = d => {
    if (d.hits) return d.hits;
    return [...d.videos.values()]
      .filter(v => v.items && v.items.length)
      .sort((a, b) => a.start.localeCompare(b.start))
      .map(v => {
        const where = labelOf(v, d);
        return { name: where ? `［${where}］${v.name}` : v.name, url: v.url, start: v.start, items: v.items };
      });
  };

  // ---- 表示（ページの CSS の影響を受けないよう Shadow DOM の中に作る）
  const host = document.createElement('div');
  host.id = PANEL_ID;
  host.style.cssText = 'position:fixed;inset:16px 16px auto auto;margin:0;padding:0;border:0;background:none;overflow:visible;z-index:2147483647';
  const root = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = `
    :host{all:initial}
    .p{width:min(480px,calc(100vw - 32px));max-height:calc(100vh - 32px);display:flex;flex-direction:column;box-sizing:border-box;
       background:#12181f;color:#eef2f6;border:1px solid #2c3642;border-radius:12px;overflow:hidden;outline:none;
       font:14px/1.6 "Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic",system-ui,sans-serif;box-shadow:0 10px 32px rgba(0,0,0,.5)}
    .top{flex:none;padding:10px 14px 8px;border-bottom:1px solid #26303b;display:flex;flex-direction:column;gap:8px}
    .bar{display:flex;align-items:center;gap:8px}
    .logo{flex:none;width:22px;height:22px;border-radius:6px;background:#b3261e;color:#fff;font-weight:800;font-size:13px;
       display:grid;place-items:center}
    .ttl{font-weight:800;font-size:14px;white-space:nowrap}
    .sum{flex:1;min-width:0;color:#9aa6b3;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    button,select{font:inherit;font-size:12.5px;font-weight:700;color:#eef2f6;background:#1d2631;border:1px solid #34404e;
       border-radius:7px;padding:4px 10px;cursor:pointer;white-space:nowrap}
    button:hover,select:hover{background:#27323f}
    button:focus-visible,select:focus-visible,a:focus-visible{outline:2px solid #86b6ec;outline-offset:1px}
    .icon{padding:2px 8px;font-size:14px;line-height:1.2;background:none;border-color:transparent;color:#9aa6b3}
    .icon:hover{color:#eef2f6;background:#27323f}
    .tabs{display:flex;gap:4px;background:#0c1116;border-radius:9px;padding:3px}
    .tabs button{flex:1;border:0;background:none;color:#9aa6b3;padding:5px 8px}
    .tabs button[aria-selected="true"]{background:#27323f;color:#eef2f6}
    .row{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
    .seg{display:inline-flex;border:1px solid #34404e;border-radius:7px;overflow:hidden}
    .seg button{border:0;border-radius:0;background:#1d2631}
    .seg button+button{border-left:1px solid #34404e}
    .seg button[aria-pressed="true"],.days button[aria-pressed="true"]{background:#eef2f6;color:#12181f}
    select{max-width:190px;padding-right:6px}
    .note{color:#9aa6b3;font-size:12px}
    .grow{flex:1}
    .days{display:flex;gap:4px;overflow-x:auto;scrollbar-width:none}
    .days button{flex:none;display:flex;flex-direction:column;align-items:center;gap:0;padding:3px 7px;min-width:44px;line-height:1.25}
    .days .w{font-size:10.5px;font-weight:500;opacity:.8}
    .days .dot{width:4px;height:4px;border-radius:50%;background:#6fcf97;margin-top:2px}
    .days .nodot{width:4px;height:4px;margin-top:2px}
    .ep{display:flex;flex-direction:column;gap:2px}
    .ep a{color:#eef2f6;font-weight:700;text-decoration:none;overflow-wrap:anywhere}
    .ep a:hover{text-decoration:underline}
    .status{display:flex;flex-direction:column;gap:4px;font-size:12.5px;color:#9aa6b3;min-height:18px}
    .prog{height:3px;background:#26303b;border-radius:2px;overflow:hidden}
    .prog i{display:block;height:100%;background:#86b6ec;transition:width .2s}
    .kinds{display:flex;flex-wrap:wrap;gap:5px}
    .kinds button{font-size:12px;padding:2px 9px;border-radius:999px;display:inline-flex;gap:5px;align-items:center;opacity:.55}
    .kinds button[aria-pressed="true"]{opacity:1}
    .kinds .n{font-weight:500;color:#9aa6b3;font-variant-numeric:tabular-nums}
    .k{font-weight:700;border-radius:4px;padding:0 7px;font-size:12px}
    [data-k="訂正"] .k,.k[data-k="訂正"]{background:#4a1f1d;color:#ffb1aa}
    [data-k="補足"] .k,.k[data-k="補足"]{background:#43330f;color:#f3cd7d}
    [data-k="修正済み"] .k,.k[data-k="修正済み"]{background:#15372f;color:#8fdcc6}
    [data-k="お知らせ"] .k,.k[data-k="お知らせ"]{background:#2a323d;color:#c3ccd6}
    .list{flex:1;min-height:0;overflow:auto;padding:4px 14px 10px}
    .pg{padding:10px 0;border-bottom:1px solid #1f2832}
    .pg:last-child{border-bottom:0}
    .pn{font-weight:700;overflow-wrap:anywhere}
    .pn a{color:#9cc6f5;text-decoration:none}
    .pn a:hover{text-decoration:underline}
    .pt{color:#9aa6b3;font-weight:500;font-variant-numeric:tabular-nums;margin-right:6px}
    ol{list-style:none;margin:6px 0 0;padding:0;display:flex;flex-direction:column;gap:8px}
    .m{display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center;font-size:12.5px;color:#9aa6b3}
    .tc{font-family:ui-monospace,Menlo,monospace;color:#eef2f6}
    .msg{margin-top:2px;overflow-wrap:anywhere}
    .empty{color:#9aa6b3;padding:16px 0}
    .foot{flex:none;display:flex;align-items:center;gap:8px;padding:8px 14px;border-top:1px solid #26303b;font-size:11.5px;color:#7d8996}
    .warn{background:#3a2a0c;color:#f3cd7d;border-radius:7px;padding:6px 10px;font-size:12px}
    .mini .top{border-bottom:0;padding-bottom:10px}
    .mini .top>:not(.bar),.mini .list,.mini .foot{display:none}`;
  const el = (tag, cls, text) => {
    const x = document.createElement(tag);
    if (cls) x.className = cls;
    if (text !== undefined) x.textContent = text;
    return x;
  };
  const btn = (label, onclick, attrs = {}) => {
    const b = el('button', attrs.cls || '', label);
    b.type = 'button';
    b.onclick = onclick;
    for (const [k, v] of Object.entries(attrs)) if (k !== 'cls') b.setAttribute(k, v);
    return b;
  };
  const panel = el('div', 'p');
  panel.tabIndex = -1;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'NHK ONE 訂正一覧');
  const top = el('div', 'top');
  const list = el('div', 'list');
  const foot = el('div', 'foot');
  panel.append(top, list, foot);
  root.append(style, panel);
  document.body.append(host);
  // ページのお知らせ窓（最前面のダイアログ）より上に出す。あとからお知らせ窓が開いたときだけ出し直す
  if (host.showPopover) host.popover = 'manual';
  const raise = () => {
    if (!host.showPopover) return;
    if (!host.matches(':popover-open')) { host.showPopover(); return; }
    if (!document.querySelector('dialog[open]')) return;
    const hadFocus = !!root.activeElement;
    host.hidePopover();
    host.showPopover();
    if (hadFocus) panel.focus({ preventScroll: true });
  };
  // NHK ONE の案内（モーダル）が開いているあいだは、ページのほかの部分と同じくこのパネルも操作できない
  const modalOpen = () => [...document.querySelectorAll('dialog[open]')].some(d => { try { return d.matches(':modal'); } catch (e) { return false; } });
  let modalWas = modalOpen();
  const watch = setInterval(() => {
    if (!host.isConnected) { clearInterval(watch); return; }
    const m = modalOpen();
    if (m === modalWas) return;
    modalWas = m;
    raise();
    drawTop();
    if (!m) panel.focus({ preventScroll: true });
  }, 800);
  const close = () => { stop(); clearInterval(watch); host.remove(); };

  // いま表示している番組（種類の絞り込みの前）
  const programs = () => {
    if (S.view === 'episode') return (S.ep && S.ep.progs) || [];
    return S.dayData ? hitsOf(S.dayData) : [];
  };
  const filtered = () => programs()
    .map(g => ({ ...g, items: g.items.filter(i => S.kinds.has(i.kind)) }))
    .filter(g => g.items.length);
  const heading = () => {
    if (S.view === 'episode') return 'この回';
    const where = S.svc === 'g1' ? (S.area === 'all' ? '全国' : AREA[S.area]) : '全国共通';
    return `${+S.day.slice(4, 6)}/${+S.day.slice(6, 8)} ${SVC[S.svc]}・${where}`;
  };

  const drawTop = () => {
    top.replaceChildren();
    const count = programs().reduce((s, g) => s + g.items.length, 0);
    const bar = el('div', 'bar');
    bar.append(el('span', 'logo', '訂'), el('span', 'ttl', 'NHK ONE 訂正一覧'),
      el('span', 'sum', S.mini ? `${heading()}・${count}件` : ''),
      btn(S.mini ? '▢' : '—', () => { S.mini = !S.mini; draw(); }, { cls: 'icon', title: S.mini ? '元に戻す' : '小さくする', 'aria-label': S.mini ? '元に戻す' : '小さくする' }),
      btn('×', close, { cls: 'icon', title: '閉じる（Esc）', 'aria-label': '閉じる' }));
    top.append(bar);
    if (modalOpen()) top.append(el('div', 'warn', 'NHK ONE の案内が開いています。案内を閉じると、このパネルを操作できます。'));
    if (S.epId) {
      const tabs = el('div', 'tabs');
      tabs.setAttribute('role', 'tablist');
      const tab = (label, view) => btn(label, () => {
        if (S.view === view) return;
        S.view = view;
        if (view === 'episode') { if (!S.ep) loadEpisode(); else { stop(); draw(); } }
        else loadDay();
      }, { role: 'tab', 'aria-selected': String(S.view === view) });
      tabs.append(tab('この回', 'episode'), tab('この日の一覧', 'day'));
      top.append(tabs);
    }
    if (S.view === 'episode') {
      const box = el('div', 'ep');
      const g = S.ep && S.ep.progs && S.ep.progs[0];
      if (g) {
        const a = el('a', '', g.name);
        a.href = g.url;
        a.target = '_blank';
        a.rel = 'noopener';
        box.append(a);
        if (g.start) box.append(el('div', 'note', `${dayLabel(S.ep.day || S.day)} ${clock(g.start)}〜 ${SVC[S.ep.svc] || ''}`));
      }
      top.append(box);
    } else {
      const row = el('div', 'row');
      const seg = el('div', 'seg');
      for (const s of Object.keys(SVC)) {
        seg.append(btn(SVC[s], () => { if (S.svc === s) return; S.svc = s; savePrefs(); loadDay(); }, { 'aria-pressed': String(S.svc === s) }));
      }
      row.append(seg);
      if (S.svc === 'g1') {
        const pick = el('select');
        pick.setAttribute('aria-label', '地域');
        const opt = (value, label) => { const o = el('option', '', label); o.value = value; o.selected = value === S.area; return o; };
        pick.append(opt('all', '全国（地方局も）'));
        const group = el('optgroup');
        group.label = '地域';
        for (const code of CODES) group.append(opt(code, code === myArea ? `${AREA[code]}（あなたの地域）` : AREA[code]));
        pick.append(group);
        pick.onchange = () => { S.area = pick.value; savePrefs(); loadDay(); };
        row.append(pick);
      } else {
        row.append(el('span', 'note', 'Eテレは全国共通'));
      }
      row.append(el('span', 'grow'), btn('↻', () => loadDay(true), { cls: 'icon', title: '読み込み直す', 'aria-label': '読み込み直す' }));
      top.append(row);
      // 直近8日（見逃し配信の期間）。読み込み済みの日には点を付ける
      const days = el('div', 'days');
      const range = Array.from({ length: 8 }, (_, i) => shiftDay(today, i - 7));
      if (!range.includes(S.day)) range.unshift(S.day);
      const have = cachedDays();
      for (const d of range) {
        const b = btn('', () => { if (S.day === d) return; S.day = d; loadDay(); },
          { 'aria-pressed': String(S.day === d), title: dayLabel(d) + (have[dayKey(d)] ? '（読み込み済み）' : '') });
        b.append(el('span', '', `${+d.slice(4, 6)}/${+d.slice(6, 8)}`), el('span', 'w', d === today ? '今日' : WD[dateOf(d).getUTCDay()]),
          el('span', have[dayKey(d)] ? 'dot' : 'nodot'));
        days.append(b);
      }
      top.append(days);
      requestAnimationFrame(() => { const cur = days.querySelector('[aria-pressed="true"]'); if (cur) cur.scrollIntoView({ block: 'nearest', inline: 'nearest' }); });
    }
    const status = el('div', 'status');
    status.setAttribute('aria-live', 'polite');
    top.append(status);
    // 種類の絞り込み（件数つき）
    const kinds = el('div', 'kinds');
    const counts = Object.fromEntries(KINDS.map(k => [k, 0]));
    for (const g of programs()) for (const i of g.items) counts[i.kind]++;
    for (const k of KINDS) {
      const b = btn('', () => {
        if (S.kinds.has(k)) S.kinds.delete(k); else S.kinds.add(k);
        savePrefs();
        draw();
      }, { 'aria-pressed': String(S.kinds.has(k)), title: `${k}を${S.kinds.has(k) ? '隠す' : '出す'}` });
      b.dataset.k = k;
      b.append(el('span', 'k', k), el('span', 'n', String(counts[k])));
      kinds.append(b);
    }
    top.append(kinds);
    drawStatus();
  };

  const drawStatus = () => {
    const status = top.querySelector('.status');
    if (!status) return;
    status.replaceChildren();
    if (S.loading) {
      const { text, n, all } = S.loading;
      status.append(el('span', '', all ? `${text}（${n}/${all}）` : text));
      const bar = el('div', 'prog');
      const fill = el('i');
      fill.style.width = all ? `${Math.round((n / all) * 100)}%` : '8%';
      bar.append(fill);
      status.append(bar);
      return;
    }
    if (S.view === 'episode') {
      if (S.ep) status.append(el('span', '', S.ep.error ? '読み込めませんでした。↻ でやり直してください' : `この回の訂正・お断り ${programs().reduce((s, g) => s + g.items.length, 0)}件`));
      return;
    }
    const d = S.dayData;
    if (!d) return;
    const hits = hitsOf(d);
    const n = hits.reduce((s, g) => s + g.items.length, 0);
    const count = d.count !== undefined ? d.count : d.videos.size;
    let t = `見逃し配信 ${count}本を確認・${hits.length}番組に${n}件`;
    if (d.errors) t += `（読めなかったもの ${d.errors}件）`;
    if (d.fromCache) t += `・${when(d.at)} に読み込み`;
    status.append(el('span', '', t));
  };

  const drawList = () => {
    const keep = list.scrollTop;
    list.replaceChildren();
    const progs = filtered();
    if (!progs.length) {
      let msg = '';
      if (S.loading && !programs().length) msg = '読み込んでいます…';
      else if (S.view === 'episode' && S.ep && !S.ep.progs.length && !S.ep.error) msg = 'この回の動画情報が見つかりませんでした。見逃し配信が終わった回か、ご利用確認がまだかもしれません（番組を見るのにご利用確認が求められたときは、先に済ませてください）。';
      else if (S.view === 'day' && S.dayData && S.dayData.done && (S.dayData.count === 0)) msg = '見逃し配信の番組が見つかりませんでした。配信期間（おおむね1週間）を過ぎた日か、ご利用確認がまだかもしれません。';
      else if (programs().length) msg = '選んだ種類のものはありません。上のボタンで種類を選んでください。';
      else if (!S.loading) msg = S.view === 'episode' ? 'この回には、訂正・お断りの文言はありませんでした。' : 'この日の番組には、訂正・お断りの文言はありませんでした。';
      list.append(el('div', 'empty', msg));
      return;
    }
    // この回の表示では番組名は上に出ているので、一覧には繰り返さない
    const showName = !(S.view === 'episode' && progs.length === 1);
    for (const g of progs) {
      const box = el('div', 'pg');
      const pn = el('div', 'pn');
      if (!showName) pn.style.display = 'none';
      if (S.view === 'day' && g.start) pn.append(el('span', 'pt', clock(g.start)));
      const a = el('a', '', g.name);
      a.href = g.url;
      a.target = '_blank';
      a.rel = 'noopener';
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
      list.append(box);
    }
    list.scrollTop = keep;
  };

  const drawFoot = () => {
    foot.replaceChildren();
    const copy = btn('テキストでコピー', async () => {
      const lines = [`NHK ONE 訂正一覧 ${S.view === 'episode' ? '' : dayLabel(S.day) + ' '}${heading()}`];
      for (const g of filtered()) {
        lines.push('', `${S.view === 'day' && g.start ? clock(g.start) + ' ' : ''}${g.name}`, g.url,
          ...g.items.map(d => `[▶${hms(d.sec)}〜 ${d.dur}秒${g.start ? '・放送 ' + clock(g.start, d.sec) : ''}]〔${d.kind}〕${d.message}`));
      }
      lines.push('', '出典: NHK ONE 見逃し配信（映像に重ねて表示される文言）');
      const text = lines.join('\n');
      try { await navigator.clipboard.writeText(text); copy.textContent = 'コピーしました'; }
      catch (e) { prompt('コピーしてください', text); }
    });
    foot.append(copy, el('span', '', S.view === 'day' ? '▶ は配信動画の頭からの時間・← → で日付を移動' : '▶ は配信動画の頭からの時間'));
  };

  let timer = null;
  const later = () => {
    if (timer) return;
    timer = setTimeout(() => { timer = null; if (!host.isConnected) return; drawStatus(); drawList(); }, 250);
  };
  const draw = () => {
    panel.classList.toggle('mini', S.mini);
    drawTop();
    drawList();
    drawFoot();
    raise();
  };

  // キー操作: Esc で閉じる、← → で日付を移動（パネルの中にいるとき）。ページ側へは渡さない
  host.addEventListener('keydown', e => {
    const tag = (e.composedPath()[0] || {}).tagName;
    if (e.key === 'Escape') { close(); e.stopPropagation(); return; }
    if (S.view === 'day' && tag !== 'SELECT' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      const next = shiftDay(S.day, e.key === 'ArrowLeft' ? -1 : 1);
      if (next <= today) { S.day = next; loadDay(); }
      e.preventDefault();
    }
    e.stopPropagation();
  });

  draw();
  panel.focus({ preventScroll: true });
  if (S.view === 'episode') await loadEpisode();
  else await loadDay();
})();
