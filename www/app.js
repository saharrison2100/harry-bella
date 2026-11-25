/* Harry Bella Fashion - app logic. Data stays on the device (localStorage). */
(function () {
  'use strict';

  const KEY = 'hb.db.v1';
  const STAGES = ['Enquiry', 'Design', 'Cutting', 'Sewing', 'Finishing', 'Ready', 'Delivered'];
  const $ = (s) => document.querySelector(s);
  const uid = (p) => p + '-' + Math.random().toString(36).slice(2, 9);

  const DEFAULTS = {
    settings: {
      business: 'Harry Bella Fashion', phone: '', whatsapp: '', email: '',
      address: 'Kubwa, FCT Abuja', bankName: 'FirstBank Nigeria PLC', accountName: 'Nkiru Jacinta Ugbor', accountNumber: '3083502430',
      depositPct: 60, paystackKey: '', aiProvider: 'openai', aiKey: '', currency: 'NGN',
      tagline: 'We Sew • We Train • We Create Excellence'
    },
    clients: [], jobs: [], payments: [], deliveries: [], designs: [],
    trainings: [], trainees: [], chats: []
  };

  let db = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return structuredClone(DEFAULTS);
      const d = JSON.parse(raw);
      return Object.assign(structuredClone(DEFAULTS), d, {
        settings: Object.assign(structuredClone(DEFAULTS.settings), d.settings || {})
      });
    } catch (e) { return structuredClone(DEFAULTS); }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { toast('Could not save on this device'); } }

  const money = (n) => '₦' + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 });
  const today = () => new Date().toISOString().slice(0, 10);
  const daysTo = (d) => d ? Math.ceil((new Date(d + 'T00:00:00') - new Date(today() + 'T00:00:00')) / 86400000) : null;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const initials = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), 2400);
  }

  /* ---------- derived ---------- */
  const clientById = (id) => db.clients.find((c) => c.id === id);
  const jobById = (id) => db.jobs.find((j) => j.id === id);
  const paidFor = (jobId) => db.payments.filter((p) => p.jobId === jobId).reduce((s, p) => s + Number(p.amount || 0), 0);
  const balanceOf = (job) => Math.max(0, Number(job.price || 0) - paidFor(job.id));
  const activeJobs = () => db.jobs.filter((j) => j.stage !== 'Delivered');
  const outstanding = () => activeJobs().reduce((s, j) => s + balanceOf(j), 0);
  function collectedThisMonth() {
    const m = today().slice(0, 7);
    return db.payments.filter((p) => (p.date || '').slice(0, 7) === m).reduce((s, p) => s + Number(p.amount || 0), 0);
  }
  function stagePill(j) {
    if (j.stage === 'Delivered') return '<span class="pill p-ready">Delivered</span>';
    const d = daysTo(j.due);
    if (d !== null && d < 0) return '<span class="pill p-late">' + Math.abs(d) + 'd late</span>';
    if (j.stage === 'Ready') return '<span class="pill p-ready">Ready</span>';
    if (d !== null && d <= 3) return '<span class="pill p-active">' + (d === 0 ? 'Due today' : d + 'd left') + '</span>';
    return '<span class="pill p-new">' + esc(j.stage) + '</span>';
  }
  const payPill = (job) => balanceOf(job) === 0
    ? '<span class="pill p-paid">Paid</span>'
    : '<span class="pill p-due">' + money(balanceOf(job)) + ' due</span>';

  function normPhone(p) {
    let d = String(p || '').replace(/[^\d+]/g, '').replace(/^\+/, '');
    if (d.startsWith('0')) d = '234' + d.slice(1);
    if (d.length === 10) d = '234' + d;
    return d;
  }
  function waLink(phone, text) {
    const n = normPhone(phone);
    return 'https://wa.me/' + n + '?text=' + encodeURIComponent(text || '');
  }
  function openWA(phone, text) {
    const url = waLink(phone, text);
    if (!normPhone(phone)) { copy(text); toast('No phone saved - message copied instead'); return; }
    window.open(url, '_blank');
  }
  function copy(text) {
    if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
  }
  function csv(rows, name) {
    const body = rows.map((r) => r.map((c) => '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"').join(',')).join('\n');
    const blob = new Blob([body], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }

  /* ---------- sheet ---------- */
  function openSheet(title, html, after) {
    $('#sheetTitle').textContent = title;
    $('#sheetBody').innerHTML = html;
    $('#sheetBg').classList.add('on');
    $('#sheet').classList.add('on');
    wireSheet();
    if (after) after();
  }
  function wireSheet() {
    document.querySelectorAll('#sheetBody [data-act]').forEach((b) => {
      b.onclick = () => { const fn = A[b.dataset.act]; if (fn) fn(b); };
    });
  }
  function closeSheet() {
    $('#sheetBg').classList.remove('on');
    $('#sheet').classList.remove('on');
  }
  $('#sheetBg').onclick = closeSheet;
  $('#sheetX').onclick = closeSheet;

  /* ---------- router ---------- */
  const TABS = [
    ['home', 'Home', 'M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5'],
    ['jobs', 'Jobs', 'M4 7h16v13H4zM9 7V5h6v2M4 12h16'],
    ['clients', 'Clients', 'M16 19v-1a4 4 0 0 0-8 0v1M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7'],
    ['money', 'Money', 'M12 3v18M8 7h5.5a3 3 0 0 1 0 6H8h6a3 3 0 0 1 0 6H8'],
    ['more', 'More', 'M4 7h16M4 12h16M4 17h16']
  ];
  let route = 'home';
  function go(r) { route = r; render(); window.scrollTo(0, 0); }
  window.go = go;

  function renderNav() {
    $('#nav').innerHTML = TABS.map(([r, label, d]) =>
      '<button data-r="' + r + '" class="' + (route === r ? 'on' : '') + '"><svg viewBox="0 0 24 24"><path d="' + d + '"/></svg>' + label + '</button>'
    ).join('');
    $('#nav').querySelectorAll('button').forEach((b) => { b.onclick = () => go(b.dataset.r); });
  }

  function render() {
    renderNav();
    const v = { home: viewHome, jobs: viewJobs, clients: viewClients, money: viewMoney, more: viewMore }[route] || viewHome;
    $('#app').innerHTML = v();
    wire();
  }

  /* ---------- views ---------- */
  function viewHome() {
    const ready = db.jobs.filter((j) => j.stage === 'Ready').length;
    const soon = activeJobs().filter((j) => { const d = daysTo(j.due); return d !== null && d <= 7; })
      .sort((a, b) => (a.due > b.due ? 1 : -1)).slice(0, 5);
    const name = db.settings.business.split(' ')[0];
    return '<div class="wrap">' +
      '<h2>Good day</h2><p class="sub">' + esc(name) + ' at a glance</p>' +
      '<div class="grid g2">' +
        tile('Outstanding', money(outstanding()), activeJobs().length + ' active jobs') +
        tile('Collected this month', money(collectedThisMonth()), db.payments.length + ' payments logged') +
        tile('Ready for pickup', String(ready), ready ? 'message the clients' : 'nothing waiting') +
        tile('Clients', String(db.clients.length), db.trainings.length ? db.trainings.length + ' training batches' : 'add your first') +
      '</div>' +
      '<div class="card"><div class="between" style="margin-bottom:6px"><b style="font-size:14px">Due this week</b><span class="sub" style="margin:0">' + soon.length + '</span></div>' +
        (soon.length ? soon.map(jobRow).join('') : '<div class="empty" style="padding:18px 0"><div class="big">Nothing due</div>No jobs falling due in the next seven days.</div>') +
      '</div>' +
      '<div class="card"><b style="font-size:14px">Quick actions</b><div class="grid" style="margin-top:10px">' +
        '<button class="btn gold" data-act="new-job">New job</button>' +
        '<div class="row"><button class="btn ghost" data-act="new-client">New client</button><button class="btn ghost" data-act="new-payment">Collect payment</button></div>' +
        '<button class="btn ghost" data-act="share-request">Send a client request link</button>' +
      '</div></div>' +
      '</div>';
  }
  function tile(k, v, n) {
    return '<div class="tile"><div class="k">' + k + '</div><div class="v' + (String(v).length > 9 ? ' sm' : '') + '">' + v + '</div><div class="n">' + n + '</div></div>';
  }
  function jobRow(j) {
    const c = clientById(j.clientId) || {};
    return '<div class="list-item" data-job="' + j.id + '">' +
      '<div class="avatar">' + initials(c.name) + '</div>' +
      '<div class="li-main"><div class="li-title">' + esc(j.title || j.garment) + '</div>' +
      '<div class="li-sub">' + esc(c.name || 'Walk-in') + ' &middot; ' + esc(j.due || 'no date') + '</div></div>' +
      '<div style="text-align:right">' + stagePill(j) + '<div style="margin-top:4px">' + payPill(j) + '</div></div></div>';
  }

  let jobFilter = 'All';
  function viewJobs() {
    const list = db.jobs.slice().sort((a, b) => (a.due || '9999') > (b.due || '9999') ? 1 : -1);
    const filtered = jobFilter === 'All' ? list : list.filter((j) => j.stage === jobFilter);
    return '<div class="wrap"><div class="between"><div><h2>Jobs</h2><p class="sub">' + db.jobs.length + ' total &middot; ' + activeJobs().length + ' open</p></div>' +
      '<button class="btn sm gold" data-act="new-job">+ New</button></div>' +
      '<div class="chips">' + ['All'].concat(STAGES).map((s) => '<button class="chip ' + (jobFilter === s ? 'on' : '') + '" data-filter="' + s + '">' + s + '</button>').join('') + '</div>' +
      '<div class="card">' + (filtered.length ? filtered.map(jobRow).join('') : emptyBox('No jobs here yet', 'Tap New to record a job, or change the filter.')) + '</div></div>';
  }

  let clientQuery = '';
  function viewClients() {
    const q = clientQuery.toLowerCase();
    const list = db.clients.filter((c) => !q || (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(q));
    return '<div class="wrap"><div class="between"><div><h2>Clients</h2><p class="sub">' + db.clients.length + ' saved</p></div>' +
      '<button class="btn sm gold" data-act="new-client">+ New</button></div>' +
      '<input id="clientSearch" placeholder="Search name or phone" value="' + esc(clientQuery) + '">' +
      '<div class="card" style="margin-top:12px">' + (list.length ? list.map((c) => {
        const jobs = db.jobs.filter((j) => j.clientId === c.id);
        const owed = jobs.reduce((s, j) => s + balanceOf(j), 0);
        return '<div class="list-item" data-client="' + c.id + '"><div class="avatar">' + initials(c.name) + '</div>' +
          '<div class="li-main"><div class="li-title">' + esc(c.name) + '</div><div class="li-sub">' + esc(c.phone || 'no phone') + ' &middot; ' + jobs.length + ' job' + (jobs.length === 1 ? '' : 's') + '</div></div>' +
          (owed > 0 ? '<span class="pill p-due">' + money(owed) + '</span>' : '<span class="pill p-paid">Clear</span>') + '</div>';
      }).join('') : emptyBox('No clients yet', 'Add a client to start taking measurements and jobs.')) + '</div></div>';
  }

  function viewMoney() {
    const pays = db.payments.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 40);
    const debts = activeJobs().filter((j) => balanceOf(j) > 0).sort((a, b) => balanceOf(b) - balanceOf(a));
    return '<div class="wrap"><h2>Money</h2><p class="sub">Who has paid, who still owes</p>' +
      '<div class="grid g2">' +
        tile('Collected this month', money(collectedThisMonth()), 'all methods') +
        tile('Outstanding', money(outstanding()), debts.length + ' jobs owing') +
      '</div>' +
      '<div class="card"><div class="between"><b style="font-size:14px">Balances to collect</b><button class="btn sm ghost" data-act="new-payment">+ Payment</button></div>' +
        (debts.length ? debts.slice(0, 8).map((j) => {
          const c = clientById(j.clientId) || {};
          return '<div class="list-item" data-job="' + j.id + '"><div class="li-main"><div class="li-title">' + esc(c.name || 'Walk-in') + '</div>' +
            '<div class="li-sub">' + esc(j.title || j.garment) + ' &middot; paid ' + money(paidFor(j.id)) + ' of ' + money(j.price) + '</div></div>' +
            '<span class="pill p-due">' + money(balanceOf(j)) + '</span></div>';
        }).join('') : emptyBox('Nothing owing', 'Every open job is fully paid.')) + '</div>' +
      '<div class="card"><div class="between"><b style="font-size:14px">Recent payments</b><button class="btn sm ghost" data-act="export-payments">CSV</button></div>' +
        (pays.length ? pays.map((p) => {
          const c = clientById(p.clientId) || {};
          return '<div class="kv"><span>' + esc(c.name || 'Client') + '<br><small style="color:var(--muted)">' + esc(p.date) + ' &middot; ' + esc(p.method) + '</small></span><b>' + money(p.amount) + '</b></div>';
        }).join('') : emptyBox('No payments yet', 'Record a deposit when a client pays.')) + '</div></div>';
  }

  function viewMore() {
    const items = [
      ['designs', 'Designs', 'Concepts, references and AI drafts', db.designs.length],
      ['deliveries', 'Deliveries', 'Pickups and rider drops', db.deliveries.length],
      ['training', 'Training', 'Corps member batches and fees', db.trainings.length],
      ['requests', 'Requests', 'Collect a brief from a client', ''],
      ['settings', 'Settings', 'Business, bank, payments, backup', '']
    ];
    return '<div class="wrap"><h2>More</h2><p class="sub">Everything else</p><div class="card">' +
      items.map(([r, t, s, n]) => '<div class="list-item" data-go="' + r + '"><div class="li-main"><div class="li-title">' + t + '</div><div class="li-sub">' + s + '</div></div>' +
        (n !== '' ? '<span class="pill p-new">' + n + '</span>' : '') + '</div>').join('') + '</div></div>';
  }

  function emptyBox(t, s) { return '<div class="empty"><div class="big">' + t + '</div>' + s + '</div>'; }

  /* ---------- sub views ---------- */
  let galFilter = 'all';

  function viewDesigns() {
    const all = db.designs;
    const counts = { all: all.length, studio: 0, client: 0, ai: 0 };
    all.forEach((d) => { const k = d.source || 'studio'; if (counts[k] !== undefined) counts[k] += 1; });
    const list = galFilter === 'all' ? all : all.filter((d) => (d.source || 'studio') === galFilter);
    const chips = [['all', 'All'], ['studio', 'Studio'], ['client', 'Client refs'], ['ai', 'AI drafts']]
      .map(([k, l]) => '<button class="chip ' + (galFilter === k ? 'on' : '') + '" data-galf="' + k + '">' + l + ' ' + counts[k] + '</button>').join('');

    return '<div class="wrap"><div class="between"><div><h2>Gallery</h2><p class="sub">' + all.length + ' looks, references and AI drafts</p></div>' +
      '<button class="btn sm gold" data-act="new-design">+ Add</button></div>' +
      '<div class="chips">' + chips + '</div>' +
      '<div class="row" style="margin-bottom:12px">' +
        '<button class="btn sm ghost" data-act="upload-design">Upload photo</button>' +
        '<button class="btn sm ghost" data-act="ai-design">AI design</button>' +
      '</div>' +
      (list.length ? '<div class="gal">' + list.map((d) => {
        const c = d.clientId ? clientById(d.clientId) : null;
        return '<div class="gcard" data-design="' + d.id + '">' +
          (d.imageUrl ? '<img src="' + esc(d.imageUrl) + '" alt="' + esc(d.title) + '">'
            : '<div class="gph"><span>' + esc((d.title || 'Look').slice(0, 14)) + '</span></div>') +
          '<div class="gmeta"><div class="gt">' + esc(d.title || 'Untitled') + '</div>' +
          '<div class="gs">' + (c ? esc(c.name.split(' ')[0]) : esc(d.source === 'ai' ? 'AI draft' : 'Studio')) + '</div></div></div>';
      }).join('') + '</div>'
        : '<div class="card">' + emptyBox('Nothing here yet', 'Upload a photo of a finished outfit, save a client reference, or generate an AI draft.') + '</div>') +
      '</div>';
  }

  /* ---------- image upload, compressed for storage ---------- */
  function pickImage(max) {
    return new Promise((resolve) => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'image/*';
      inp.onchange = () => {
        const f = inp.files && inp.files[0]; if (!f) return resolve(null);
        const rd = new FileReader();
        rd.onload = () => {
          const img = new Image();
          img.onload = () => {
            const lim = max || 900;
            const scale = Math.min(1, lim / Math.max(img.width, img.height));
            const cv = document.createElement('canvas');
            cv.width = Math.round(img.width * scale); cv.height = Math.round(img.height * scale);
            cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
            resolve(cv.toDataURL('image/jpeg', 0.72));
          };
          img.onerror = () => resolve(null);
          img.src = rd.result;
        };
        rd.readAsDataURL(f);
      };
      inp.click();
    });
  }

  /* ---------- tailoring knowledge base ---------- */
  const GARMENTS = {
    gown:    { label: 'Gown / bridal', fabric: 5.5, lining: 2.0, pieces: ['Bodice front (on fold)', 'Bodice back x2', 'Princess panels x4', 'Skirt front (on fold)', 'Skirt back x2', 'Sleeves x2', 'Neck facing', 'Invisible zip'], steps: ['Interface the bodice panels before joining.', 'Stay-stitch the neckline to stop it stretching.', 'Join princess seams, press open, then clip curves.', 'Attach sleeves flat, then close the side seams in one pass.', 'Baste the skirt to the bodice and check the waistline drop.', 'Insert an invisible zip in the centre back before the final seam.', 'Hang the gown for 24 hours, then level the hem on the client.', 'Hand-finish the hem and add a hook and eye at the zip top.'] },
    kaftan:  { label: 'Kaftan / agbada', fabric: 4.0, lining: 0.5, pieces: ['Front panel (on fold)', 'Back panel (on fold)', 'Sleeves x2', 'Neck facing', 'Side slits facing'], steps: ['Cut the front and back on the fold to keep the drape even.', 'Interface the neck facing and clip it before turning.', 'Attach the sleeves flat, then sew the side seams from sleeve to hem.', 'Reinforce the slit tops with a small stay before cutting them open.', 'Finish the hem with a narrow rolled hem or bias binding.', 'Press the whole garment with a cloth to protect embroidery.'] },
    dress:   { label: 'Dress', fabric: 3.5, lining: 1.0, pieces: ['Bodice front x2', 'Bodice back x2', 'Sleeves x2', 'Skirt front x2', 'Skirt back x2', 'Neck facing', 'Zip'], steps: ['Join the shoulder seams and check the neckline depth.', 'Set in the sleeves, easing any fullness at the cap.', 'Close the side seams and press them open.', 'Baste the skirt to the bodice and balance the waist seam.', 'Insert the zip, then finish the armholes and neckline.', 'Hem last, after the client tries it on.'] },
    skirt:   { label: 'Skirt', fabric: 2.0, lining: 0.8, pieces: ['Skirt front (on fold)', 'Skirt back x2', 'Waistband', 'Zip', 'Hem facing'], steps: ['Cut the waistband on the straight grain with interfacing.', 'Stay-stitch the waist edge before attaching the band.', 'Insert the zip before closing the back seam.', 'Understitch the waistband so it sits flat.', 'Let the skirt hang overnight, then level the hem.'] },
    blouse:  { label: 'Blouse / top', fabric: 1.5, lining: 0.5, pieces: ['Front x2', 'Back (on fold)', 'Sleeves x2', 'Collar / neck facing', 'Cuff x2'], steps: ['Interface the collar and cuffs before construction.', 'Sew the darts first and press them towards the centre.', 'Attach the collar to the neckline with a stay-stitch.', 'Set the sleeves in flat, then close the side seams.', 'Topstitch the cuffs and check the button spacing.'] },
    trousers:{ label: 'Trousers', fabric: 2.5, lining: 0.5, pieces: ['Front leg x2', 'Back leg x2', 'Waistband', 'Pockets x4', 'Zip fly', 'Belt loops'], steps: ['Sew the front pockets and fly shield before joining the legs.', 'Join the inside and outside leg seams separately.', 'Match the crotch curves carefully and clip them.', 'Attach the waistband and interface it fully.', 'Baste the hem and fit the client seated before finishing.', 'Finish with a blind hem to keep the drape.'] },
    shirt:   { label: 'Shirt', fabric: 2.0, lining: 0.3, pieces: ['Front x2', 'Back (on fold)', 'Yoke', 'Sleeves x2', 'Collar x2', 'Cuffs x2', 'Pocket'], steps: ['Cut the yoke on the straight grain and interface the collar.', 'Attach the yoke to the back, then the fronts.', 'Set the sleeves flat before closing the side seams.', 'Attach the collar stand, then the collar.', 'Add cuffs and buttonholes, testing spacing on scrap first.', 'Topstitch the front placket evenly.'] },
    jacket:  { label: 'Jacket / blazer', fabric: 3.0, lining: 1.5, pieces: ['Front x2', 'Side panel x2', 'Back x2', 'Sleeves x2', 'Lapel facing x2', 'Pocket bags x4', 'Lining set'], steps: ['Interface the fronts and lapels; this decides the shape.', 'Sew the darts and press them towards the centre.', 'Join the shoulders and set the sleeves with a sleeve head.', 'Build the lining separately, then bag it out at the hem.', 'Press the lapel roll over a ham, never flat.', 'Check the balance on the client with the jacket closed.'] }
  };

  function detectGarment(d) {
    const t = ((d.title || '') + ' ' + (d.prompt || '') + ' ' + (d.tags || '')).toLowerCase();
    if (/bridal|wedding|gown/.test(t)) return 'gown';
    if (/kaftan|caftan|agbada|boubou/.test(t)) return 'kaftan';
    if (/trouser|pant|suit|short/.test(t)) return 'trousers';
    if (/skirt/.test(t)) return 'skirt';
    if (/blouse|top|crop/.test(t)) return 'blouse';
    if (/shirt/.test(t)) return 'shirt';
    if (/jacket|blazer|coat/.test(t)) return 'jacket';
    return 'dress';
  }

  function buildGuide(d, c) {
    const g = GARMENTS[detectGarment(d)] || GARMENTS.dress;
    const m = (c && c.measurements) || {};
    const num = (k) => { const v = parseFloat(String(m[k] || '').replace(/[^0-9.]/g, '')); return isNaN(v) ? 0 : v; };
    const bust = num('Bust'), hips = num('Hips'), height = num('Height');
    let fabric = g.fabric;
    const why = [];
    if (bust > 105) { fabric += 0.5; why.push('bust over 105cm'); }
    if (hips > 110) { fabric += 0.5; why.push('hips over 110cm'); }
    if (height > 175) { fabric += 0.5; why.push('height over 175cm'); }
    const isBridal = /bridal|lace|beaded/.test(((d.title || '') + (d.prompt || '')).toLowerCase());
    const lining = isBridal ? g.lining : (g.lining >= 1 ? g.lining : 0);
    fabric = Math.ceil(fabric * 2) / 2;
    return {
      garment: g.label, fabric, lining, pieces: g.pieces, steps: g.steps, why,
      measureLine: ['Bust', 'Waist', 'Hips', 'Shoulder', 'Sleeve', 'Top length', 'Skirt length']
        .filter((k) => m[k]).map((k) => k + ' ' + m[k]).join(' · ')
    };
  }

  function guideHTML(d, c) {
    const g = buildGuide(d, c);
    return '<div class="note" style="background:#F4F8F5;border-color:#CFE3D6;color:#1F4A38">' +
      '<b>' + esc(g.garment) + '</b>' + (g.why.length ? ' &middot; allowance for ' + esc(g.why.join(', ')) : '') + '</div>' +
      '<div class="card"><div class="between"><b style="font-size:13.5px">Fabric needed</b><span class="pill p-new">' + g.fabric + ' m</span></div>' +
      (g.lining ? '<p class="sub" style="margin:6px 0 0">Plus ' + g.lining + ' m lining.</p>' : '') +
      (g.measureLine ? '<p class="sub" style="margin:6px 0 0">Working from: ' + esc(g.measureLine) + '</p>' : '<p class="sub" style="margin:6px 0 0">No measurements on file, so this is a standard estimate. Add her measurements for a tighter figure.</p>') + '</div>' +
      '<div class="card"><b style="font-size:13.5px">Cut list</b><ul class="cl">' + g.pieces.map((p) => '<li>' + esc(p) + '</li>').join('') + '</ul></div>' +
      '<div class="card"><b style="font-size:13.5px">How to make it</b><ol class="cl">' + g.steps.map((p) => '<li>' + esc(p) + '</li>').join('') + '</ol></div>';
  }

  function designSheet(id) {
    const d = db.designs.find((x) => x.id === id); if (!d) return;
    const c = d.clientId ? clientById(d.clientId) : null;
    openSheet(d.title || 'Design',
      (d.imageUrl ? '<img src="' + esc(d.imageUrl) + '" alt="" style="width:100%;border-radius:12px;margin-bottom:10px">' : '') +
      '<div class="row" style="margin-bottom:10px"><span class="pill p-new">' + esc(d.source || 'studio') + '</span>' +
      (c ? '<span class="pill p-active">' + esc(c.name) + '</span>' : '<span class="pill p-due">No client</span>') + '</div>' +
      (d.prompt ? '<p class="sub" style="margin:0 0 12px">' + esc(d.prompt) + '</p>' : '') +
      '<div class="row" style="margin-bottom:12px"><button class="btn sm gold" data-guide="' + d.id + '">How to make it</button>' +
      '<button class="btn sm ghost" data-assign="' + d.id + '">Assign to client</button>' +
      '<button class="btn sm ghost" data-share-d="' + d.id + '">Share</button></div>' +
      '<div id="guideBox"></div>' +
      '<div class="card" style="margin-top:12px"><button class="btn sm danger" data-del-d="' + d.id + '">Delete design</button></div>',
      () => {
        const box = $('#guideBox');
        $('#sheetBody').querySelector('[data-guide]').onclick = () => { box.innerHTML = guideHTML(d, c); };
        $('#sheetBody').querySelector('[data-assign]').onclick = () => assignDesignSheet(d.id);
        $('#sheetBody').querySelector('[data-share-d]').onclick = () => {
          const msg = db.settings.business + ': ' + (d.title || 'a new design') + (d.prompt ? '. ' + d.prompt : '') + '. Let us know what you think and we will start on it.';
          if (c && c.phone) openWA(c.phone, msg); else { copyText(msg); toast('Copied. Paste it to the client.'); }
        };
        $('#sheetBody').querySelector('[data-del-d]').onclick = () => {
          if (!confirm('Delete this design?')) return;
          db.designs = db.designs.filter((x) => x.id !== d.id); save(); closeSheet(); render(); toast('Design deleted');
        };
      });
  }

  function assignDesignSheet(id) {
    const d = db.designs.find((x) => x.id === id); if (!d) return;
    openSheet('Assign to client',
      '<label>Client</label><select id="a-client">' + db.clients.map((c) => '<option value="' + c.id + '"' + (d.clientId === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('') + '</select>' +
      '<button class="btn gold" style="margin-top:14px" data-act="do-assign" data-id="' + d.id + '">Save</button>');
  }
  function viewDeliveries() {
    const list = db.deliveries.slice().sort((a, b) => (a.date || '') > (b.date || '') ? 1 : -1);
    return '<div class="wrap"><div class="between"><div><h2>Deliveries</h2><p class="sub">Pickups and drops</p></div>' +
      '<button class="btn sm gold" data-act="new-delivery">+ New</button></div><div class="card">' +
      (list.length ? list.map((d) => {
        const j = jobById(d.jobId) || {}; const c = clientById(j.clientId) || {};
        const st = d.status === 'Delivered' ? 'p-ready' : d.status === 'Out' ? 'p-active' : 'p-new';
        return '<div class="list-item" data-delivery="' + d.id + '"><div class="li-main"><div class="li-title">' + esc(c.name || 'Client') + '</div>' +
          '<div class="li-sub">' + esc(d.mode) + ' &middot; ' + esc(d.date || 'no date') + (d.rider ? ' &middot; ' + esc(d.rider) : '') + '</div></div>' +
          '<span class="pill ' + st + '">' + esc(d.status) + '</span></div>';
      }).join('') : emptyBox('No deliveries yet', 'Schedule a pickup when a job is ready.')) + '</div></div>';
  }

  function viewTraining() {
    const rows = db.trainings.map((t) => {
      const tr = db.trainees.filter((x) => x.trainingId === t.id);
      const paid = tr.reduce((s, x) => s + Number(x.paid || 0), 0);
      const due = tr.reduce((s, x) => s + Math.max(0, Number(t.fee || 0) - Number(x.paid || 0)), 0);
      return '<div class="card"><div class="between"><div><b>' + esc(t.batch) + '</b><div class="li-sub">' + esc(t.camp || '') + ' &middot; ' + esc(t.startDate || '') + '</div></div>' +
        '<span class="pill p-new">' + tr.length + ' trainees</span></div>' +
        '<div class="kv"><span>Fees collected</span><b>' + money(paid) + '</b></div>' +
        '<div class="kv"><span>Still to collect</span><b style="color:' + (due ? 'var(--bad)' : 'var(--ok)') + '">' + money(due) + '</b></div>' +
        '<div class="row" style="margin-top:9px"><button class="btn sm ghost" data-trainee="' + t.id + '">+ Trainee</button>' +
        '<button class="btn sm ghost" data-tlist="' + t.id + '">View list</button></div></div>';
    }).join('');
    return '<div class="wrap"><div class="between"><div><h2>Training</h2><p class="sub">NTSC camp batches</p></div>' +
      '<button class="btn sm gold" data-act="new-training">+ Batch</button></div>' + (rows || '<div class="card">' + emptyBox('No batches yet', 'Add a corps member batch and track fees.') + '</div>') + '</div>';
  }

  function viewRequests() {
    return '<div class="wrap"><h2>Client requests</h2><p class="sub">Get the brief before you sew</p>' +
      '<div class="card"><b style="font-size:14px">Send a request</b>' +
      '<p class="sub" style="margin:6px 0 10px">Opens WhatsApp with a short brief your client fills in. No internet form, no app for them to install.</p>' +
      '<button class="btn gold" data-act="share-request">Send request on WhatsApp</button></div>' +
      '<div class="card"><b style="font-size:14px">Your client form link</b>' +
      '<p class="sub" style="margin:6px 0 10px">Clients fill a short form and it arrives on your WhatsApp ready to read. Host request.html once, paste its address in Settings, then send the link.</p>' +
      '<button class="btn gold" data-act="copy-form-link">Copy form link</button></div>' +
      '<div class="card"><b style="font-size:14px">Turn a request into a client</b>' +
      '<p class="sub" style="margin:6px 0 8px">Paste the message you received.</p>' +
      '<textarea id="rq-text" placeholder="Paste the WhatsApp request here"></textarea>' +
      '<button class="btn ghost" style="margin-top:10px" data-act="paste-request">Create client from request</button></div>' +
      '<div class="card"><b style="font-size:14px">What the client sees</b><pre style="white-space:pre-wrap;font-family:inherit;font-size:12.5px;color:var(--muted);margin:8px 0 0">' + esc(requestTemplate()) + '</pre></div>' +
      '<div class="card"><b style="font-size:14px">When the reply comes in</b>' +
      '<p class="sub" style="margin:6px 0 0">Record it as a client and a job. Measurements go on the client, the brief on the job.</p>' +
      '<div class="row" style="margin-top:10px"><button class="btn sm ghost" data-act="new-client">+ Client</button><button class="btn sm ghost" data-act="new-job">+ Job</button></div></div></div>';
  }

  function requestTemplate() {
    const s = db.settings;
    return 'Hello ' + (s.business || 'Harry Bella') + ', I would like to sew:\n' +
      '1. Outfit:\n2. Fabric (mine / yours):\n3. Event date:\n4. Budget:\n' +
      '5. My measurements (bust, waist, hips, height):\n6. Delivery or pickup:\nThank you.';
  }

  function viewSettings() {
    const s = db.settings;
    return '<div class="wrap"><h2>Settings</h2><p class="sub">Business details and money</p>' +
      '<div class="card"><b style="font-size:14px">Business</b>' +
      field('Business name', 's-business', s.business) +
      field('Phone', 's-phone', s.phone, 'tel') +
      field('WhatsApp number', 's-whatsapp', s.whatsapp, 'tel') +
      field('Address', 's-address', s.address) +
      field('Client form address (request.html)', 's-formUrl', s.formUrl || '') +
      '<button class="btn" style="margin-top:14px" data-act="save-settings">Save</button></div>' +
      '<div class="card"><b style="font-size:14px">Bank transfer</b>' +
      '<p class="sub" style="margin:6px 0 0">Shown to clients when they pay.</p>' +
      field('Bank', 's-bankName', s.bankName) +
      field('Account name', 's-accountName', s.accountName) +
      field('Account number', 's-accountNumber', s.accountNumber, 'tel') +
      field('Deposit %', 's-depositPct', s.depositPct, 'number') +
      '<button class="btn" style="margin-top:14px" data-act="save-settings">Save</button></div>' +
      '<div class="card"><b style="font-size:14px">Online payments</b>' +
      '<p class="sub" style="margin:6px 0 0">Paste a Paystack public key to let clients pay a deposit in-app. Only the public key goes here, never the secret key.</p>' +
      field('Paystack public key', 's-paystackKey', s.paystackKey) +
      '<div class="note" style="margin-top:12px">A payment started this way is recorded only after the gateway confirms it. Check your Paystack dashboard before marking a job paid.</div>' +
      '<button class="btn" style="margin-top:4px" data-act="save-settings">Save</button></div>' +
      '<div class="card"><b style="font-size:14px">AI design concepts</b>' +
      field('AI API key', 's-aiKey', s.aiKey) +
      '<p class="sub" style="margin:6px 0 0">Stored on this device only. Without a key you can still save design notes and photos.</p>' +
      '<button class="btn" style="margin-top:12px" data-act="save-settings">Save</button></div>' +
      '<div class="card"><b style="font-size:14px">Login and access</b>' +
      '<p class="sub" style="margin:6px 0 10px">Your owner PIN opens everything. A staff PIN opens a limited view: jobs, clients, designs and deliveries, with no money screens and no settings.</p>' +
      field('New owner PIN (4 to 6 digits)', 'sec-new', '', 'password') +
      field('Staff PIN (leave blank to keep)', 'sec-staff', '', 'password') +
      '<label class="chk" style="display:flex;gap:9px;align-items:center;font-size:13px;margin:4px 0 10px"><input type="checkbox" id="sec-clear-staff"> Remove the staff PIN</label>' +
      '<button class="btn" data-act="save-pins">Save PINs</button>' +
      '<button class="btn ghost" style="margin-top:8px" data-act="lock-now">Lock app now</button></div>' +
      '<div class="card"><b style="font-size:14px">Data</b>' +
      '<p class="sub" style="margin:6px 0 10px">Everything lives on this phone. Export a backup before changing device.</p>' +
      '<div class="grid"><button class="btn ghost" data-act="export-json">Download backup (JSON)</button>' +
      '<button class="btn ghost" data-act="export-clients">Clients (CSV)</button>' +
      '<button class="btn ghost" data-act="export-jobs">Jobs (CSV)</button>' +
      '<button class="btn ghost" data-act="demo">Load demo data</button>' +
      '<button class="btn danger" data-act="wipe">Erase all data</button></div></div></div>';
  }
  function field(label, id, val, type) {
    return '<label>' + label + '</label><input id="' + id + '" type="' + (type || 'text') + '" value="' + esc(val == null ? '' : val) + '">';
  }

  /* ---------- sheets: forms ---------- */
  function newJobSheet(preset) {
    const opts = db.clients.map((c) => '<option value="' + c.id + '"' + (preset && preset.clientId === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('');
    openSheet('New job',
      '<label>Client</label><select id="j-client"><option value="">Walk-in (no client)</option>' + opts + '</select>' +
      '<label>Outfit</label><input id="j-title" placeholder="e.g. Ankara two-piece">' +
      '<label>Garment type</label><select id="j-garment">' + ['Dress', 'Two-piece', 'Native / Agbada', 'Bridal', 'Bridal party', 'Corporate', 'Kaftan', 'Alteration', 'Other']
        .map((g) => '<option>' + g + '</option>').join('') + '</select>' +
      '<label>Fabric</label><input id="j-fabric" placeholder="Client brings / shop">' +
      '<div class="mgrid"><div><label>Price (₦)</label><input id="j-price" type="number" inputmode="numeric" placeholder="0"></div>' +
      '<div><label>Deposit paid (₦)</label><input id="j-deposit" type="number" inputmode="numeric" placeholder="0"></div></div>' +
      '<div class="mgrid"><div><label>Due date</label><input id="j-due" type="date"></div>' +
      '<div><label>Stage</label><select id="j-stage">' + STAGES.map((s) => '<option>' + s + '</option>').join('') + '</select></div></div>' +
      '<label>Notes</label><textarea id="j-notes" placeholder="Style details, fabric quantity, fitting notes"></textarea>' +
      '<button class="btn gold" style="margin-top:16px" data-act="save-job">Save job</button>',
      () => {
        const d = new Date(); d.setDate(d.getDate() + 14);
        $('#j-due').value = d.toISOString().slice(0, 10);
        if (db.clients.length === 1) $('#j-client').value = db.clients[0].id;
      });
  }

  function newClientSheet() {
    openSheet('New client',
      '<label>Full name</label><input id="c-name" placeholder="Client name">' +
      '<label>Phone</label><input id="c-phone" type="tel" placeholder="0803 000 0000">' +
      '<label>Email (for online receipts)</label><input id="c-email" type="email" placeholder="optional">' +
      '<label>Address</label><input id="c-address" placeholder="Area, city">' +
      '<label>Type</label><select id="c-type"><option value="client">Client</option><option value="trainee">Trainee</option></select>' +
      '<label>Measurements</label>' +
      '<div class="mgrid">' + ['Bust', 'Waist', 'Hips', 'Shoulder', 'Sleeve', 'Top length', 'Skirt length', 'Thigh', 'Height'].map((m) =>
        '<div><label style="margin:0 0 3px">' + m + '</label><input id="m-' + m.replace(/\s/g, '') + '" placeholder="in"></div>').join('') + '</div>' +
      '<label>Notes</label><textarea id="c-notes" placeholder="Preference, style, allergies to fabric"></textarea>' +
      '<button class="btn gold" style="margin-top:16px" data-act="save-client">Save client</button>');
  }

  function clientSheet(id) {
    const c = clientById(id); if (!c) return;
    const jobs = db.jobs.filter((j) => j.clientId === c.id);
    const owed = jobs.reduce((s, j) => s + balanceOf(j), 0);
    const m = c.measurements || {};
    const mkeys = Object.keys(m).filter((k) => m[k]);
    openSheet(c.name,
      '<div class="row" style="margin-bottom:10px"><div class="avatar">' + initials(c.name) + '</div>' +
      '<div><div style="font-weight:600">' + esc(c.phone || 'no phone') + '</div><div class="li-sub">' + esc(c.address || '') + '</div></div></div>' +
      '<div class="row"><button class="btn sm gold" data-wa="' + c.id + '">WhatsApp</button>' +
      '<button class="btn sm ghost" data-chat="' + c.id + '">Chat notes</button>' +
      '<button class="btn sm ghost" data-job-for="' + c.id + '">+ Job</button></div>' +
      '<div class="card" style="margin-top:12px"><b style="font-size:13.5px">Measurements</b>' +
      (mkeys.length ? '<div class="mgrid" style="margin-top:8px">' + mkeys.map((k) => '<div class="mcell"><div class="mk">' + esc(k) + '</div><div class="mv">' + esc(m[k]) + '</div></div>').join('') + '</div>'
        : '<p class="sub" style="margin:6px 0 0">No measurements saved yet.</p>') + '</div>' +
      '<div class="card"><div class="between"><b style="font-size:13.5px">Jobs</b>' + (owed ? '<span class="pill p-due">' + money(owed) + ' owing</span>' : '') + '</div>' +
      (jobs.length ? jobs.map(jobRow).join('') : '<p class="sub" style="margin:6px 0 0">No jobs yet.</p>') + '</div>' +
      '<div class="card"><div class="between"><b style="font-size:13.5px">Her designs</b>'
      + '<button class="btn sm ghost" data-design-for="' + c.id + '">+ Add</button></div>'
      + (db.designs.filter((x) => x.clientId === c.id).length
        ? '<div class="gal" style="margin-top:8px">' + db.designs.filter((x) => x.clientId === c.id).map((x) => '<div class="gcard" data-design="' + x.id + '">' + (x.imageUrl ? '<img src="' + esc(x.imageUrl) + '" alt="">' : '<div class="gph"><span>' + esc((x.title || 'Look').slice(0, 12)) + '</span></div>') + '<div class="gmeta"><div class="gt">' + esc(x.title || 'Untitled') + '</div></div></div>').join('') + '</div>'
        : '<p class="sub" style="margin:6px 0 0">No designs linked yet.</p>') + '</div>'
      + '<div class="card"><div class="between"><b style="font-size:13.5px">Remove client</b><button class="btn sm danger" data-del-client="' + c.id + '">Delete</button></div></div>',
      () => {
        $('#sheetBody').querySelectorAll('[data-wa]').forEach((b) => b.onclick = () => openWA(c.phone, 'Hello ' + c.name.split(' ')[0] + ', this is ' + db.settings.business + '.'));
        $('#sheetBody').querySelectorAll('[data-chat]').forEach((b) => b.onclick = () => chatSheet(c.id));
        $('#sheetBody').querySelectorAll('[data-job-for]').forEach((b) => b.onclick = () => newJobSheet({ clientId: c.id }));
        $('#sheetBody').querySelectorAll('[data-design-for]').forEach((b) => b.onclick = () => newDesignSheet());
        $('#sheetBody').querySelectorAll('[data-design]').forEach((b) => b.onclick = () => designSheet(b.dataset.design));
        $('#sheetBody').querySelectorAll('[data-job]').forEach((b) => b.onclick = () => jobSheet(b.dataset.job));
        const del = $('#sheetBody').querySelector('[data-del-client]');
        if (del) del.onclick = () => {
          if (!confirm('Delete ' + c.name + '?')) return;
          db.clients = db.clients.filter((x) => x.id !== c.id); save(); closeSheet(); render(); toast('Client deleted');
        };
      });
  }

  function jobSheet(id) {
    const j = jobById(id); if (!j) return;
    const c = clientById(j.clientId) || {};
    const paid = paidFor(j.id), bal = balanceOf(j);
    const pays = db.payments.filter((p) => p.jobId === j.id);
    const pct = j.price ? Math.min(100, Math.round(paid / j.price * 100)) : 0;
    openSheet(j.title || j.garment,
      '<div class="between" style="margin-bottom:8px"><div><div style="font-weight:600">' + esc(c.name || 'Walk-in') + '</div>' +
      '<div class="li-sub">' + esc(j.garment) + ' &middot; due ' + esc(j.due || 'unset') + '</div></div>' + stagePill(j) + '</div>' +
      '<div class="card" style="margin:0 0 12px"><div class="between"><span class="sub" style="margin:0">Paid ' + money(paid) + ' of ' + money(j.price) + '</span><b>' + money(bal) + ' left</b></div>' +
      '<div class="bar"><span style="width:' + pct + '%"></span></div></div>' +
      '<div class="row" style="flex-wrap:wrap"><button class="btn sm gold" data-pay="' + j.id + '">Collect payment</button>' +
      '<button class="btn sm ghost" data-stage="' + j.id + '">Move stage</button>' +
      '<button class="btn sm ghost" data-remind="' + j.id + '">Remind</button>' +
      '<button class="btn sm ghost" data-ready="' + j.id + '">Ready message</button></div>' +
      '<div class="card" style="margin-top:12px"><b style="font-size:13.5px">Details</b>' +
      '<div class="kv"><span>Fabric</span><b>' + esc(j.fabric || '—') + '</b></div>' +
      '<div class="kv"><span>Price</span><b>' + money(j.price) + '</b></div>' +
      '<div class="kv"><span>Stage</span><b>' + esc(j.stage) + '</b></div>' +
      (j.notes ? '<div style="margin-top:8px;font-size:13px;color:var(--muted)">' + esc(j.notes) + '</div>' : '') + '</div>' +
      '<div class="card"><b style="font-size:13.5px">Payments</b>' +
      (pays.length ? pays.map((p) => '<div class="kv"><span>' + esc(p.date) + ' &middot; ' + esc(p.method) + '</span><b>' + money(p.amount) + '</b></div>').join('') : '<p class="sub" style="margin:6px 0 0">Nothing recorded yet.</p>') + '</div>' +
      '<div class="card"><div class="between"><b style="font-size:13.5px">Delete job</b><button class="btn sm danger" data-del-job="' + j.id + '">Delete</button></div></div>',
      () => {
        const q = (s) => $('#sheetBody').querySelector(s);
        q('[data-pay]').onclick = () => paymentSheet(j.id);
        q('[data-stage]').onclick = () => {
          const i = STAGES.indexOf(j.stage);
          j.stage = STAGES[(i + 1) % STAGES.length];
          if (j.stage === 'Delivered') j.deliveredAt = today();
          save(); closeSheet(); render(); toast('Stage: ' + j.stage);
        };
        q('[data-remind]').onclick = () => openWA(c.phone, 'Hello ' + (c.name || '').split(' ')[0] + ', a gentle reminder that ' + money(bal) + ' is outstanding on your ' + (j.title || j.garment) + '. Thank you. — ' + db.settings.business);
        q('[data-ready]').onclick = () => openWA(c.phone, 'Hello ' + (c.name || '').split(' ')[0] + ', your ' + (j.title || j.garment) + ' is ready for collection at ' + (db.settings.address || 'our studio') + '. ' + (bal > 0 ? 'Balance on collection is ' + money(bal) + '. ' : '') + 'Thank you. — ' + db.settings.business);
        q('[data-del-job]').onclick = () => {
          if (!confirm('Delete this job and its payments?')) return;
          db.jobs = db.jobs.filter((x) => x.id !== j.id);
          db.payments = db.payments.filter((p) => p.jobId !== j.id);
          save(); closeSheet(); render(); toast('Job deleted');
        };
      });
  }

  function paymentSheet(jobId) {
    const j = jobId ? jobById(jobId) : null;
    const jobOpts = db.jobs.filter((x) => x.stage !== 'Delivered' || balanceOf(x) > 0)
      .map((x) => { const c = clientById(x.clientId) || {}; return '<option value="' + x.id + '"' + (jobId === x.id ? ' selected' : '') + '>' + esc(c.name || 'Walk-in') + ' - ' + esc(x.title || x.garment) + ' (' + money(balanceOf(x)) + ' due)</option>'; }).join('');
    openSheet('Collect payment',
      '<label>Job</label><select id="p-job"><option value="">No job (advance)</option>' + jobOpts + '</select>' +
      '<div class="mgrid"><div><label>Amount (₦)</label><input id="p-amount" type="number" inputmode="numeric"></div>' +
      '<div><label>Date</label><input id="p-date" type="date"></div></div>' +
      '<label>Method</label><select id="p-method"><option>Cash</option><option>Bank transfer</option><option>POS</option><option>Paystack</option></select>' +
      '<label>Note</label><input id="p-note" placeholder="Deposit, balance, advance">' +
      '<button class="btn gold" style="margin-top:16px" data-act="save-payment">Record payment</button>' +
      '<div class="row" style="margin-top:8px"><button class="btn ghost sm" data-act="copy-bank">Copy bank details</button><button class="btn ghost sm" data-act="wa-bank">Send on WhatsApp</button></div>' +
      (db.settings.paystackKey ? '<button class="btn ghost" style="margin-top:8px" data-act="pay-online">Pay online (card, transfer, USSD)</button>' : ''),
      () => {
        $('#p-date').value = today();
        if (jobId) { const b = balanceOf(j); if (b > 0) $('#p-amount').value = b; }
        $('#p-job').onchange = function () {
          const jj = this.value ? jobById(this.value) : null;
          $('#p-amount').value = jj && balanceOf(jj) > 0 ? balanceOf(jj) : '';
        };
      });
  }

  function chatSheet(clientId) {
    const c = clientById(clientId) || {};
    let th = db.chats.find((x) => x.clientId === clientId);
    if (!th) { th = { id: uid('ch'), clientId, messages: [] }; db.chats.push(th); save(); }
    const draw = () => {
      $('#sheetBody').innerHTML = '<div class="note">Notes you keep about this client. Messages sent from here stay on this device; use WhatsApp to actually reach them.</div>' +
        '<div id="chatLog" style="min-height:120px;margin-bottom:10px">' + (th.messages.length ? th.messages.map((m) =>
          '<div class="msg ' + (m.from === 'me' ? 'me' : 'them') + '">' + esc(m.text) + '<span class="t">' + esc(m.at) + '</span></div>').join('')
          : '<p class="sub">No notes yet.</p>') + '</div>' +
        '<div class="row"><input id="chatIn" placeholder="Write a note"><button class="btn sm gold" id="chatSend">Add</button></div>' +
        '<button class="btn ghost" style="margin-top:10px" id="chatWA">Open WhatsApp chat</button>';
      $('#chatSend').onclick = () => {
        const t = $('#chatIn').value.trim(); if (!t) return;
        th.messages.push({ from: 'me', text: t, at: new Date().toLocaleString() }); save(); draw();
      };
      $('#chatWA').onclick = () => openWA(c.phone, '');
      wireSheet();
    };
    openSheet('Chat - ' + (c.name || 'client'), '', draw);
  }

  function newDesignSheet() {
    const copts = '<option value="">No client yet</option>' + db.clients.map((c) => '<option value="' + c.id + '">' + esc(c.name) + '</option>').join('');
    openSheet('Add to gallery',
      '<label>Title</label><input id="d-title" placeholder="e.g. Gold lace bridal, A-line">' +
      '<label>Client (optional)</label><select id="d-client">' + copts + '</select>' +
      '<label>Where did it come from</label><select id="d-source">' +
        '<option value="studio">Studio - we made it</option>' +
        '<option value="client">Client reference - she sent it</option>' +
        '<option value="ai">AI draft</option></select>' +
      '<label>Notes or prompt</label><textarea id="d-prompt" placeholder="Fabric, neckline, sleeves, occasion"></textarea>' +
      '<label>Tags</label><input id="d-tags" placeholder="bridal, lace, aso-ebi">' +
      '<div id="d-prev" style="margin-top:12px"></div>' +
      '<button class="btn ghost" style="margin-top:10px" data-act="pick-design">Attach a photo</button>' +
      '<button class="btn gold" style="margin-top:10px" data-act="save-design">Save to gallery</button>' +
      (db.settings.aiKey ? '<button class="btn ghost" style="margin-top:8px" data-act="gen-design">Generate with AI instead</button>'
        : '<p class="sub" style="margin-top:10px">Add an AI key in Settings and Sollab can draft concepts from your prompt.</p>'));
  }
  function newDeliverySheet() {
    const opts = db.jobs.filter((j) => j.stage !== 'Delivered').map((j) => {
      const c = clientById(j.clientId) || {};
      return '<option value="' + j.id + '">' + esc(c.name || 'Walk-in') + ' - ' + esc(j.title || j.garment) + '</option>';
    }).join('');
    openSheet('New delivery',
      '<label>Job</label><select id="d-job">' + opts + '</select>' +
      '<div class="mgrid"><div><label>Date</label><input id="dv-date" type="date"></div>' +
      '<div><label>Mode</label><select id="dv-mode"><option>Pickup</option><option>Delivery</option></select></div></div>' +
      '<label>Address / rider</label><input id="dv-rider" placeholder="Rider name or drop address">' +
      '<label>Fee (₦)</label><input id="dv-fee" type="number" inputmode="numeric" placeholder="0">' +
      '<button class="btn gold" style="margin-top:16px" data-act="save-delivery">Save</button>',
      () => { $('#dv-date').value = today(); });
  }

  function newTrainingSheet() {
    openSheet('New batch',
      '<label>Batch name</label><input id="t-batch" placeholder="e.g. 2026 Batch A">' +
      '<label>Camp / location</label><input id="t-camp" value="NTSC Camp, Kubwa, Abuja">' +
      '<div class="mgrid"><div><label>Start</label><input id="t-start" type="date"></div>' +
      '<div><label>End</label><input id="t-end" type="date"></div></div>' +
      '<label>Fee per trainee (₦)</label><input id="t-fee" type="number" inputmode="numeric" placeholder="0">' +
      '<button class="btn gold" style="margin-top:16px" data-act="save-training">Save batch</button>',
      () => { $('#t-start').value = today(); });
  }

  function traineeSheet(trainingId) {
    openSheet('Add trainee',
      '<label>Name</label><input id="tr-name" placeholder="Corps member name">' +
      '<label>Phone</label><input id="tr-phone" type="tel">' +
      '<label>Paid so far (₦)</label><input id="tr-paid" type="number" inputmode="numeric" placeholder="0">' +
      '<button class="btn gold" style="margin-top:16px" data-act="save-trainee" data-tid="' + trainingId + '">Save trainee</button>');
  }

  /* ---------- actions ---------- */
  let pendingDesignImg = '';

  const A = {
    'new-job': () => newJobSheet(),
    'new-client': () => newClientSheet(),
    'new-payment': () => paymentSheet(),
    'new-design': () => newDesignSheet(),
    'new-delivery': () => newDeliverySheet(),
    'new-training': () => newTrainingSheet(),
    'share-request': () => openWA('', requestTemplate()),
    'copy-form-link': () => {
      const w = normPhone(db.settings.whatsapp || db.settings.phone);
      if (!w) { toast('Add your WhatsApp number in Settings first'); return; }
      const base = (db.settings.formUrl || '').trim();
      if (!base) { toast('Paste your hosted form address in Settings first'); return; }
      const link = base.replace(/\/$/, '') + (base.indexOf('?') > -1 ? '&' : '?') + 'w=' + w;
      copy(link); toast('Form link copied. Send it to your client.');
    },
    'paste-request': () => {
      const t = ($('#rq-text') || {}).value || '';
      if (!t.trim()) { toast('Paste the client message first'); return; }
      const g = (k) => { const m = t.match(new RegExp(k + '\\s*:\\s*(.+)', 'i')); return m ? m[1].trim() : ''; };
      closeSheet(); newClientSheet();
      setTimeout(() => {
        if ($('#c-name')) $('#c-name').value = g('Name');
        if ($('#c-phone')) $('#c-phone').value = g('Phone');
        if ($('#c-notes')) $('#c-notes').value = ['Outfit: ' + g('Outfit'), 'Style: ' + g('Style'), 'Fabric: ' + g('Fabric'), 'Event: ' + g('Event date'), 'Budget: ' + g('Budget'), 'Measurements: ' + g('Measurements'), 'Delivery: ' + g('Delivery')].filter((x) => !/:\s*$/.test(x) && !/: -$/.test(x)).join('\n');
        toast('Review the client, then save and add a job');
      }, 120);
    },

    'save-job': () => {
      const clientId = $('#j-client').value;
      const title = $('#j-title').value.trim();
      if (!title) { toast('Give the outfit a name'); return; }
      const job = {
        id: uid('job'), ref: 'HB-' + new Date().getFullYear() + '-' + String(db.jobs.length + 1).padStart(3, '0'),
        clientId, title, garment: $('#j-garment').value, fabric: $('#j-fabric').value.trim(),
        price: Number($('#j-price').value || 0), due: $('#j-due').value, stage: $('#j-stage').value,
        notes: $('#j-notes').value.trim(), created: today()
      };
      db.jobs.push(job);
      const dep = Number($('#j-deposit').value || 0);
      if (dep > 0) db.payments.push({ id: uid('pay'), jobId: job.id, clientId, amount: dep, method: 'Cash', date: today(), note: 'Deposit' });
      save(); closeSheet(); render(); toast('Job saved');
    },
    'save-client': () => {
      const name = $('#c-name').value.trim();
      if (!name) { toast('Name is required'); return; }
      const measurements = {};
      [['Bust','Bust'],['Waist','Waist'],['Hips','Hips'],['Shoulder','Shoulder'],['Sleeve','Sleeve'],['Toplength','Top length'],['Skirtlength','Skirt length'],['Thigh','Thigh'],['Height','Height']].forEach(function(pair){
        var el = $('#m-' + pair[0]); if (el && el.value.trim()) measurements[pair[1]] = el.value.trim();
      });
      db.clients.push({
        id: uid('cl'), name, phone: $('#c-phone').value.trim(), email: ($('#c-email')||{value:''}).value.trim(), address: $('#c-address').value.trim(),
        type: $('#c-type').value, notes: $('#c-notes').value.trim(), measurements, created: today()
      });
      save(); closeSheet(); render(); toast('Client saved');
    },
    'save-payment': () => {
      const jobId = $('#p-job').value;
      const amount = Number($('#p-amount').value || 0);
      if (!amount) { toast('Enter an amount'); return; }
      const job = jobId ? jobById(jobId) : null;
      db.payments.push({
        id: uid('pay'), jobId, clientId: job ? job.clientId : '', amount,
        method: $('#p-method').value, date: $('#p-date').value || today(), note: $('#p-note').value.trim()
      });
      save(); closeSheet(); render(); toast('Payment recorded');
    },
    'pick-design': async () => {
      const img = await pickImage(900);
      if (!img) return;
      pendingDesignImg = img;
      const prev = $('#d-prev');
      if (prev) prev.innerHTML = '<img src="' + img + '" style="width:100%;border-radius:12px">';
      toast('Photo attached');
    },
    'upload-design': async () => {
      const img = await pickImage(900);
      if (!img) return;
      db.designs.unshift({ id: uid('dz'), title: 'Uploaded look', prompt: '', tags: '', source: 'studio', clientId: '', imageUrl: img, created: today() });
      save(); go('designs'); toast('Photo added to gallery');
    },
    'ai-design': () => newDesignSheet(),
    'do-assign': (b) => {
      const d = db.designs.find((x) => x.id === b.dataset.id); if (!d) return;
      d.clientId = $('#a-client').value; save(); closeSheet(); render(); toast('Assigned');
    },
    'save-design': () => {
      const title = $('#d-title').value.trim();
      if (!title) { toast('Give the design a title'); return; }
      var img=$('#d-img').value.trim()||(window.__lastAI&&window.__lastAI.length<900000?window.__lastAI:''); window.__lastAI=null;
      const cl = $('#d-client'); const sc = $('#d-source');
      db.designs.unshift({ id: uid('dz'), title, prompt: $('#d-prompt').value.trim(), tags: $('#d-tags').value.trim(), imageUrl: img || pendingDesignImg || '', clientId: cl ? cl.value : '', source: sc ? sc.value : 'studio', created: today() });
      pendingDesignImg = '';
      save(); closeSheet(); go('designs'); toast('Design saved');
    },
    'save-delivery': () => {
      const jobId = $('#d-job').value;
      if (!jobId) { toast('Pick a job first'); return; }
      db.deliveries.push({ id: uid('dv'), jobId, date: $('#dv-date').value, mode: $('#dv-mode').value, rider: $('#dv-rider').value.trim(), fee: Number($('#dv-fee').value || 0), status: 'Scheduled' });
      save(); closeSheet(); go('deliveries'); toast('Delivery scheduled');
    },
    'save-training': () => {
      const batch = $('#t-batch').value.trim();
      if (!batch) { toast('Name the batch'); return; }
      db.trainings.push({ id: uid('tr'), batch, camp: $('#t-camp').value.trim(), startDate: $('#t-start').value, endDate: $('#t-end').value, fee: Number($('#t-fee').value || 0) });
      save(); closeSheet(); go('training'); toast('Batch added');
    },
    'save-trainee': (el) => {
      const name = $('#tr-name').value.trim();
      if (!name) { toast('Name is required'); return; }
      db.trainees.push({ id: uid('te'), trainingId: el.dataset.tid, name, phone: $('#tr-phone').value.trim(), paid: Number($('#tr-paid').value || 0) });
      save(); closeSheet(); go('training'); toast('Trainee added');
    },
    'save-settings': () => {
      const s = db.settings;
      const get = (id, def) => { const el = $('#' + id); return el ? el.value.trim() : def; };
      s.business = get('s-business', s.business) || s.business;
      s.phone = get('s-phone', s.phone); s.whatsapp = get('s-whatsapp', s.whatsapp);
      s.address = get('s-address', s.address); s.formUrl = get('s-formUrl', s.formUrl || '');
      s.bankName = get('s-bankName', s.bankName); s.accountName = get('s-accountName', s.accountName);
      s.accountNumber = get('s-accountNumber', s.accountNumber);
      s.depositPct = Number(get('s-depositPct', s.depositPct) || 60);
      s.paystackKey = get('s-paystackKey', s.paystackKey);
      s.aiKey = get('s-aiKey', s.aiKey);
      save(); toast('Settings saved'); render();
    },
    'export-json': () => {
      const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = 'harrybella-backup-' + today() + '.json'; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    },
    'export-clients': () => csv([['Name', 'Phone', 'Address', 'Type', 'Notes']].concat(db.clients.map((c) => [c.name, c.phone, c.address, c.type, c.notes])), 'harrybella-clients.csv'),
    'export-jobs': () => csv([['Ref', 'Client', 'Outfit', 'Garment', 'Price', 'Paid', 'Balance', 'Due', 'Stage']].concat(db.jobs.map((j) => {
      const c = clientById(j.clientId) || {};
      return [j.ref, c.name || 'Walk-in', j.title, j.garment, j.price, paidFor(j.id), balanceOf(j), j.due, j.stage];
    })), 'harrybella-jobs.csv'),
    'export-payments': () => csv([['Date', 'Client', 'Amount', 'Method', 'Note']].concat(db.payments.map((p) => {
      const c = clientById(p.clientId) || {};
      return [p.date, c.name || 'Advance', p.amount, p.method, p.note];
    })), 'harrybella-payments.csv'),
    'demo': () => {
      const c1 = { id: uid('cl'), name: 'Adaeze Okafor', phone: '08031234567', address: 'Kubwa, Abuja', type: 'client', measurements: { Bust: '38', Waist: '31', Hips: '41', Shoulder: '15', Sleeve: '22', 'Top length': '26' }, created: today() };
      const c2 = { id: uid('cl'), name: 'Fatima Bello', phone: '08127654321', address: 'Gwarinpa, Abuja', type: 'client', measurements: { Bust: '36', Waist: '29', Hips: '39', Height: '64' }, created: today() };
      const c3 = { id: uid('cl'), name: 'Grace Musa', phone: '09098887766', address: 'NTSC Camp, Kubwa', type: 'trainee', measurements: {}, created: today() };
      db.clients.push(c1, c2, c3);
      const d1 = new Date(); d1.setDate(d1.getDate() + 4);
      const d2 = new Date(); d2.setDate(d2.getDate() - 2);
      const j1 = { id: uid('job'), ref: 'HB-2026-001', clientId: c1.id, title: 'Gold lace two-piece', garment: 'Two-piece', fabric: 'Client brings', price: 85000, due: d1.toISOString().slice(0, 10), stage: 'Sewing', notes: 'Bridal shower, satin lining', created: today() };
      const j2 = { id: uid('job'), ref: 'HB-2026-002', clientId: c2.id, title: 'Ankara kaftan', garment: 'Kaftan', fabric: 'Shop', price: 45000, due: d2.toISOString().slice(0, 10), stage: 'Ready', notes: 'Slim fit', created: today() };
      db.jobs.push(j1, j2);
      db.payments.push({ id: uid('pay'), jobId: j1.id, clientId: c1.id, amount: 50000, method: 'Bank transfer', date: today(), note: 'Deposit' });
      db.payments.push({ id: uid('pay'), jobId: j2.id, clientId: c2.id, amount: 45000, method: 'Cash', date: today(), note: 'Paid in full' });
      const t1 = { id: uid('tr'), batch: '2026 Batch A', camp: 'NTSC Camp, Kubwa, Abuja', startDate: today(), endDate: '', fee: 25000 };
      db.trainings.push(t1);
      db.trainees.push({ id: uid('te'), trainingId: t1.id, name: 'Grace Musa', phone: '09098887766', paid: 25000 });
      db.designs = db.designs.concat([
        { id: uid('dz'), title: 'Gold lace bridal, A-line', prompt: 'Bridal gown, gold lace over champagne satin, sweetheart neckline, chapel train', tags: 'bridal, lace', source: 'studio', clientId: c1.id, imageUrl: '', created: today() },
        { id: uid('dz'), title: 'Ankara two-piece, client ref', prompt: 'Client reference: peplum top with pencil skirt in bold Ankara print', tags: 'ankara, aso-ebi', source: 'client', clientId: c1.id, imageUrl: '', created: today() },
        { id: uid('dz'), title: 'Kaftan with cutwork', prompt: 'Flowing kaftan, cutwork neckline, side slits, chiffon', tags: 'kaftan', source: 'studio', clientId: '', imageUrl: '', created: today() },
        { id: uid('dz'), title: 'AI draft: structured blazer', prompt: 'Structured navy blazer, gold buttons, nipped waist', tags: 'ai, blazer', source: 'ai', clientId: '', imageUrl: '', created: today() }
      ]);
      save(); toast('Demo data loaded'); render();
    },
    'wipe': () => {
      if (!confirm('Erase all Harry Bella data on this device? This cannot be undone.')) return;
      db = structuredClone(DEFAULTS); save(); render(); toast('All data erased');
    },
    'gen-design': async (btn) => {
      const p = ($('#d-prompt').value.trim() || $('#d-title').value.trim());
      if (!p) { toast('Describe the design first'); return; }
      const key = db.settings.aiKey;
      if (!key) { toast('Add an AI key in Settings'); return; }
      btn.disabled = true; const label = btn.textContent; btn.textContent = 'Designing...';
      try {
        const r = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
          body: JSON.stringify({ model: 'gpt-image-1', size: '1024x1024',
            prompt: 'Fashion design concept sketch, clean studio presentation, full outfit visible: ' + p })
        });
        const j = await r.json();
        if (!r.ok) throw new Error((j.error && j.error.message) || 'Request failed');
        const d0 = j.data && j.data[0];
        const url = d0 && (d0.url || (d0.b64_json ? 'data:image/png;base64,' + d0.b64_json : ''));
        if (!url) throw new Error('No image returned');
        $('#d-img').value = url.startsWith('data:') ? '' : url;
        window.__lastAI = url;
        const prev = document.getElementById('aiPrev');
        if (prev) prev.innerHTML = '<img src="' + url + '" style="width:100%;border-radius:12px;margin-top:10px" alt="concept">';
        toast('Concept ready. Tap Save design to keep it.');
      } catch (e) {
        toast('AI failed: ' + String(e.message || e).slice(0, 80));
      } finally { btn.disabled = false; btn.textContent = label; }
    },
    'pay-online': () => {
      const amt = Number($('#p-amount').value || 0);
      if (!amt) { toast('Enter the amount first'); return; }
      const key = db.settings.paystackKey;
      if (!key) { toast('Add your Paystack public key in Settings'); return; }
      const jobId = $('#p-job').value; const job = jobId ? jobById(jobId) : null;
      const cl = job ? (clientById(job.clientId) || {}) : {};
      const email = cl.email || (db.settings.email) || 'client@harrybella.app';
      const go = function () {
        const ref = 'HB' + Date.now();
        const h = window.PaystackPop.setup({
          key: key, email: email, amount: Math.round(amt * 100), currency: 'NGN', ref: ref,
          metadata: { job: job ? job.ref : '', client: cl.name || '' },
          callback: function (res) {
            db.payments.push({ id: uid('pay'), jobId: jobId, clientId: job ? job.clientId : '', amount: amt,
              method: 'Paystack', date: $('#p-date') ? ($('#p-date').value || today()) : today(),
              note: 'Paystack ref ' + res.reference + ' (verify on dashboard)', unverified: true });
            save(); closeSheet(); render(); toast('Recorded. Confirm on your Paystack dashboard.');
          },
          onClose: function () { toast('Payment window closed'); }
        });
        h.openIframe();
      };
      if (window.PaystackPop) { go(); return; }
      const sc = document.createElement('script');
      sc.src = 'https://js.paystack.co/v1/inline.js'; sc.onload = go;
      sc.onerror = function () { toast('Needs internet to open Paystack'); };
      document.head.appendChild(sc);
    },
    'copy-bank': () => {
      const s = db.settings;
      if (!s.accountNumber) { toast('Add your bank details in Settings first'); return; }
      const t = 'Pay to: ' + s.accountName + '\n' + s.bankName + ' ' + s.accountNumber + '\nReference: your name + outfit';
      copy(t); toast('Bank details copied');
    },
    'wa-bank': () => {
      const s = db.settings; const jobId = $('#p-job') ? $('#p-job').value : ''; const j = jobId ? jobById(jobId) : null;
      const c = j ? (clientById(j.clientId) || {}) : {};
      const bal = j ? balanceOf(j) : 0;
      openWA(c.phone, 'Hello' + (c.name ? ' ' + c.name.split(' ')[0] : '') + ', here are the details for payment' + (bal ? ' of ' + money(bal) : '') + ':\n' +
        s.accountName + '\n' + s.bankName + ' ' + s.accountNumber + '\nPlease send proof of transfer. Thank you. - ' + s.business);
    }
  };

  /* ---------- wiring ---------- */
  function wire() {
    document.querySelectorAll('[data-act]').forEach((b) => {
      b.onclick = () => { const fn = A[b.dataset.act]; if (fn) fn(b); };
    });
    document.querySelectorAll('[data-job]').forEach((b) => { b.onclick = () => jobSheet(b.dataset.job); });
    document.querySelectorAll('[data-client]').forEach((b) => { b.onclick = () => clientSheet(b.dataset.client); });
    document.querySelectorAll('[data-go]').forEach((b) => { b.onclick = () => go(b.dataset.go); });
    document.querySelectorAll('[data-design]').forEach((b) => { b.onclick = () => designSheet(b.dataset.design); });
    document.querySelectorAll('[data-galf]').forEach((b) => { b.onclick = () => { galFilter = b.dataset.galf; render(); }; });
    document.querySelectorAll('[data-filter]').forEach((b) => { b.onclick = () => { jobFilter = b.dataset.filter; render(); }; });
    document.querySelectorAll('[data-trainee]').forEach((b) => { b.onclick = () => traineeSheet(b.dataset.trainee); });
    const cs = $('#clientSearch');
    if (cs) cs.oninput = () => { clientQuery = cs.value; const p = cs.selectionStart; render(); const n = $('#clientSearch'); if (n) { n.focus(); n.setSelectionRange(p, p); } };
  }

  /* sub routes that are not tabs */
  const SUB = { designs: viewDesigns, deliveries: viewDeliveries, training: viewTraining, requests: viewRequests, settings: viewSettings };
  const baseRender = render;
  render = function () {
    renderNav();
    const fn = SUB[route] || { home: viewHome, jobs: viewJobs, clients: viewClients, money: viewMoney, more: viewMore }[route] || viewHome;
    $('#app').innerHTML = fn();
    wire();
  };

  /* ---------------- owner login ---------------- */
  let role = null;              // null = locked, 'owner' | 'staff'
  let lastActive = Date.now();

  function b64(buf) { let s = ''; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s); }

  async function hashPin(pin, salt) {
    const raw = salt + ':' + pin;
    if (window.crypto && crypto.subtle) {
      try {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
        return 'sha256:' + b64(buf);
      } catch (e) { /* fall through */ }
    }
    let h = 5381;
    for (let i = 0; i < raw.length; i++) h = ((h << 5) + h + raw.charCodeAt(i)) | 0;
    return 'weak:' + (h >>> 0).toString(36);
  }

  function newSalt() {
    if (window.crypto && crypto.getRandomValues) {
      const a = new Uint8Array(12); crypto.getRandomValues(a);
      return b64(a.buffer);
    }
    return String(Date.now());
  }

  function ensureSec() { if (!db.security) db.security = { pinHash: '', salt: '', staffHash: '', staffSalt: '', autolockMin: 5 }; return db.security; }

  const L = () => $('#lock');
  function lockErr(msg) { const e = $('#lockErr'); if (e) e.textContent = msg || ''; }

  function showLock(mode) {
    const sc = ensureSec();
    const setup = !sc.pinHash;
    $('#lockTitle').textContent = setup ? 'Welcome to Harry Bella' : 'Harry Bella';
    $('#lockSub').textContent = setup ? 'Create your owner PIN. It keeps clients out of your books when they use the phone.' : 'Enter your PIN to open the studio';
    $('#lockFields').innerHTML = setup
      ? '<input id="pin1" type="password" inputmode="numeric" autocomplete="new-password" placeholder="New PIN (4 to 6 digits)" maxlength="6">' +
        '<input id="pin2" type="password" inputmode="numeric" autocomplete="new-password" placeholder="Repeat PIN" maxlength="6">'
      : '<input id="pin1" type="password" inputmode="numeric" autocomplete="current-password" placeholder="PIN" maxlength="6">';
    $('#lockGo').textContent = setup ? 'Create PIN and open' : 'Unlock';
    $('#lockFoot').textContent = setup ? 'Use Settings later to add a staff PIN for your apprentices.' : 'Staff PIN opens a limited view without money or settings.';
    lockErr('');
    L().classList.add('on');
    setTimeout(() => { const p = $('#pin1'); if (p) p.focus(); }, 120);
  }

  function hideLock() { L().classList.remove('on'); }

  async function submitLock() {
    const sc = ensureSec();
    const p1 = ($('#pin1') || {}).value || '';
    if (!sc.pinHash) {
      const p2 = ($('#pin2') || {}).value || '';
      if (!/^\d{4,6}$/.test(p1)) return lockErr('Use 4 to 6 digits.');
      if (p1 !== p2) return lockErr('The two PINs do not match.');
      sc.salt = newSalt();
      sc.pinHash = await hashPin(p1, sc.salt);
      save(); role = 'owner'; hideLock(); render(); toast('PIN set. You are signed in as owner.');
      return;
    }
    if (!/^\d{4,6}$/.test(p1)) return lockErr('Enter your PIN.');
    const h = await hashPin(p1, sc.salt);
    if (h === sc.pinHash) { role = 'owner'; hideLock(); render(); return; }
    if (sc.staffHash && sc.staffSalt) {
      const hs = await hashPin(p1, sc.staffSalt);
      if (hs === sc.staffHash) { role = 'staff'; hideLock(); route = 'home'; render(); return; }
    }
    lockErr('Wrong PIN. Try again.');
    const f = $('#pin1'); if (f) { f.value = ''; f.focus(); }
  }

  function lockNow() { role = null; showLock(); }
  function isStaff() { return role === 'staff'; }

  async function setStaffPin(pin) {
    const sc = ensureSec();
    if (!pin) { sc.staffHash = ''; sc.staffSalt = ''; save(); return true; }
    if (!/^\d{4,6}$/.test(pin)) return false;
    sc.staffSalt = newSalt();
    sc.staffHash = await hashPin(pin, sc.staffSalt);
    save(); return true;
  }

  async function setOwnerPin(pin) {
    const sc = ensureSec();
    if (!/^\d{4,6}$/.test(pin)) return false;
    sc.salt = newSalt();
    sc.pinHash = await hashPin(pin, sc.salt);
    save(); return true;
  }

  /* gate: staff cannot reach money or settings, and the tab bar hides them */
  const innerRender = render;
  render = function () {
    if (!role) { showLock(); return; }
    if (isStaff() && (route === 'money' || route === 'settings')) route = 'home';
    innerRender();
    if (isStaff()) {
      document.querySelectorAll("nav button[data-r='money']").forEach((b) => b.remove());
      document.querySelectorAll("[data-go='settings']").forEach((b) => b.remove());
    }
    const lk = $('.lockbtn');
    if (lk) lk.title = isStaff() ? 'Signed in as staff' : 'Lock';
  };

  /* auto lock after idle */
  ['click', 'keydown', 'touchstart'].forEach((ev) => document.addEventListener(ev, () => { lastActive = Date.now(); }, { passive: true }));
  setInterval(() => {
    const mins = (ensureSec().autolockMin || 5);
    if (role && Date.now() - lastActive > mins * 60000) lockNow();
  }, 20000);

  document.addEventListener('DOMContentLoaded', () => {
    const go2 = $('#lockGo');
    if (go2) go2.onclick = submitLock;
    ['pin1', 'pin2'].forEach((id) => document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target && e.target.id === id) submitLock();
    }));
  });
  if (document.readyState !== 'loading') {
    const go3 = $('#lockGo'); if (go3) go3.onclick = submitLock;
    document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target && e.target.id && e.target.id.indexOf('pin') === 0) submitLock(); });
  }

  A['lock-now'] = () => { lockNow(); };
  A['save-pins'] = async () => {
    const np = ($('#sec-new') || {}).value || '';
    const sp = ($('#sec-staff') || {}).value || '';
    let ok = true;
    if (np) { ok = await setOwnerPin(np); if (!ok) { toast('Owner PIN must be 4 to 6 digits'); return; } }
    if (sp !== '') { const r = await setStaffPin(sp); if (!r) { toast('Staff PIN must be 4 to 6 digits'); return; } }
    if (($('#sec-clear-staff') || {}).checked) await setStaffPin('');
    toast(np ? 'Owner PIN changed' : 'Security updated');
  };

  window.HB = {
    db: () => db, save, render, role: () => role,
    unlock: async (pin) => { const sc = ensureSec(); if (!sc.pinHash) return 'no-pin'; const h = await hashPin(pin, sc.salt); if (h === sc.pinHash) { role = 'owner'; hideLock(); render(); return 'owner'; } if (sc.staffHash && (await hashPin(pin, sc.staffSalt)) === sc.staffHash) { role = 'staff'; hideLock(); render(); return 'staff'; } return false; },
    lock: () => lockNow(),
    reset: () => { db = structuredClone(DEFAULTS); save(); role = null; showLock(); render(); }
  };
  render();
})();
