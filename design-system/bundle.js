/* Ya-Da — sample data, crayon icons and HTML renderers for every component and screen. Classic script, no network. */
(function () {
  // Load the hosted Hebrew faces if the page has not.
  try {
    if (!document.querySelector('link[data-yd-font]')) {
      var l = document.createElement('link');
      l.rel = 'stylesheet'; l.setAttribute('data-yd-font', '1');
      l.href = 'https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700&family=Varela+Round&display=swap';
      document.head.appendChild(l);
    }
  } catch (e) {}

  /* ---------------- icons: hand-drawn, slightly wobbly strokes ---------------- */
  var P = {
    home: 'M4 11.2 12.1 4.4l7.8 6.9M6.2 9.6v9.6c0 .5.3.8.8.8h3.6v-5.4h2.9V20h3.5c.5 0 .8-.3.8-.8V9.5',
    year: 'M4.2 6.3c0-.9.7-1.5 1.5-1.5h12.6c.9 0 1.5.7 1.5 1.5v12.2c0 .9-.6 1.5-1.5 1.5H5.7c-.8 0-1.5-.6-1.5-1.5zM4.3 9.6h15.4M9.4 9.7V20M14.6 9.6v10.3M4.3 14.8h15.3M8.2 3.3v3M15.9 3.2v3.1',
    family: 'M8.9 10.6a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3.6 19.6c.3-3.2 2.4-5.3 5.3-5.3s5 2.1 5.3 5.3M16.4 11.8a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8zM15.3 14.4c2.7-.4 4.8 1.3 5.1 4.6',
    palette: 'M12 3.6c-4.8 0-8.5 3.5-8.5 8 0 4.4 3.6 8.4 8 8.4 1.4 0 1.9-.9 1.6-2-.4-1.4.2-2.6 1.8-2.6h1.6c2.3 0 4-1.6 4-4 0-4.3-3.9-7.8-8.5-7.8zM7.8 12.4h.1M9.6 8.3h.1M14.2 7.6h.1M17 11h.1',
    plus: 'M12.1 5.2v13.7M5.3 12h13.5',
    chat: 'M5.2 18.9 6 15.6C5 14.4 4.4 13 4.4 11.4 4.4 7.5 7.8 4.4 12 4.4s7.6 3.1 7.6 7S16.2 18.4 12 18.4c-1.3 0-2.5-.3-3.5-.8zM9 10.4c.2 1.6 1.9 3.4 3.9 4l1.2-1.1-1.3-.9-.7.6c-.8-.3-1.6-1.1-1.9-1.9l.6-.7-.8-1.3z',
    check: 'M5.2 12.6 9.8 17l9-9.8',
    checkc: 'M12 20.2a8.2 8.2 0 1 0 0-16.4 8.2 8.2 0 0 0 0 16.4zM8.3 12.3l2.6 2.5 4.9-5.3',
    bell: 'M6.4 16.6V11c0-3.2 2.4-5.8 5.6-5.8s5.6 2.6 5.6 5.8v5.6l1.4 1.6H5zM10.2 20.3c.4.6 1 .9 1.8.9s1.4-.3 1.8-.9',
    receipt: 'M6.2 3.8h11.6v16.4l-2-1.3-1.9 1.3-1.9-1.3-1.9 1.3-1.9-1.3-2 1.3zM9 8.4h6M9 11.7h6M9 15h3.4',
    phone: 'M8.2 3.6h7.6c.8 0 1.4.6 1.4 1.4v14c0 .8-.6 1.4-1.4 1.4H8.2c-.8 0-1.4-.6-1.4-1.4V5c0-.8.6-1.4 1.4-1.4zM11 17.4h2',
    bolt: 'M13.2 3.6 6.6 13.2h5l-1 7.2 6.8-9.8h-5z',
    bank: 'M3.8 9.4 12 4.3l8.2 5.1zM5.8 10.4v7M10 10.4v7M14 10.4v7M18.2 10.4v7M3.7 19.8h16.6',
    cash: 'M3.6 7.2h16.8v9.8H3.6zM12 14.6a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM6.3 9.9v.1M17.7 14.2v.1',
    clock: 'M12 20.2a8.2 8.2 0 1 0 0-16.4 8.2 8.2 0 0 0 0 16.4zM12 7.6V12l3 1.9',
    search: 'M10.8 17.4a6.6 6.6 0 1 0 0-13.2 6.6 6.6 0 0 0 0 13.2zM15.8 15.9l4.3 4.2',
    chevR: 'M9.4 5.4 15.8 12l-6.4 6.6',
    chevL: 'M14.6 5.4 8.2 12l6.4 6.6',
    chevD: 'M6 9.3l6 6 6-6',
    x: 'M6.3 6.2l11.4 11.6M17.7 6.2 6.3 17.8',
    mail: 'M4 6.4h16v11.2H4zM4.3 6.8l7.7 6 7.7-6',
    user: 'M12 11.4a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2zM5 20.2c.4-3.8 3.3-6.1 7-6.1s6.6 2.3 7 6.1',
    alert: 'M12 4.1 3.3 19.4h17.4zM12 10v4.4M12 17.1v.1',
    cal: 'M4.3 6.4h15.4v13.4H4.3zM4.4 10.2h15.2M8.4 3.6v4M15.7 3.6v4',
    out: 'M14.4 5.2h3.8c.8 0 1.4.6 1.4 1.4v10.8c0 .8-.6 1.4-1.4 1.4h-3.8M9.6 8 5.4 12l4.2 4M5.6 12h9.2',
    edit: 'M4.6 19.4l1-4.4L15.8 4.8l3.4 3.4L9 18.4zM13.6 7l3.4 3.4',
    brush: 'M14.2 4.6c1.6-1.2 4.1-1 5.2.1s1.3 3.6.1 5.2l-6.3 6.1-5-5zM7.6 11.6c-2 .2-3.4 1.6-3.5 3.6-.1 1.6-.9 3-1.6 4 3.4.6 6.6-.6 8-3.1',
    lock: 'M6.2 10.6h11.6v9.2H6.2zM8.6 10.4V8c0-2 1.5-3.6 3.4-3.6s3.4 1.6 3.4 3.6v2.4',
    sparkle: 'M12 3.8c.6 3.9 2.3 5.6 6.2 6.2-3.9.6-5.6 2.3-6.2 6.2-.6-3.9-2.3-5.6-6.2-6.2 3.9-.6 5.6-2.3 6.2-6.2zM18.4 15.6c.3 1.6.9 2.2 2.4 2.4-1.5.3-2.1.9-2.4 2.4-.3-1.5-.9-2.1-2.4-2.4 1.5-.2 2.1-.8 2.4-2.4z',
    link: 'M10.2 13.8a3.6 3.6 0 0 0 5.2.2l2.6-2.6a3.6 3.6 0 0 0-5.1-5.1l-1.2 1.2M13.8 10.2a3.6 3.6 0 0 0-5.2-.2L6 12.6a3.6 3.6 0 0 0 5.1 5.1l1.2-1.2',
    dots: 'M6.5 12h.1M12 12h.1M17.5 12h.1'
  };
  function ic(n, cls) {
    return '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + P[n] + '"/></svg>';
  }

  /* hand-drawn bits */
  var brush = '<svg class="yd-brush" viewBox="0 0 200 10" preserveAspectRatio="none" aria-hidden="true"><path d="M2 6.2C30 3.4 62 4.6 96 4.1s70-1.2 102 .9c1.4.4 1 2.8-.6 3-32 1.6-70 .7-104 1.3S28 9.8 3.4 8.9C1.4 8.8.6 6.6 2 6.2z"/></svg>';
  function mark(size) {
    size = size || 40;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 48 48" aria-hidden="true">' +
      '<path d="M24.6 5.2c9.4.4 17.6 7.2 18 16.8.5 10.6-7.3 20.2-18.2 20.6C13.6 43 5 35.4 5.4 24.8 5.8 14 14.4 4.8 24.6 5.2z" fill="var(--terracotta)"/>' +
      '<path d="M15.6 30.4c3.6 3.4 11.6 4 16.6-.6" stroke="var(--on-fill)" stroke-width="3.2" fill="none" stroke-linecap="round"/>' +
      '<circle cx="18.6" cy="20.4" r="2.6" fill="var(--on-fill)"/><circle cx="29.6" cy="19.6" r="2.6" fill="var(--on-fill)"/>' +
      '<path d="M39.4 6.4c2.4-.4 4.4 1.4 4.2 3.6-.2 2.4-2.6 3.6-4.6 2.8-2.2-.8-2.4-6-.4-6.4z" fill="var(--mustard)"/>' +
      '<circle cx="7.6" cy="41.2" r="2.4" fill="var(--sage)"/></svg>';
  }
  function logo(sub) {
    return '<div class="yd-logo">' + mark(42) + '<div><div class="word">Ya-Da</div>' + (sub === false ? '' : '<div class="sub">סטודיו ידיים</div>') + '</div></div>';
  }
  function illustration(w) {
    w = w || 220;
    return '<svg width="' + w + '" viewBox="0 0 220 150" aria-hidden="true">' +
      '<ellipse cx="110" cy="138" rx="86" ry="7" fill="var(--paper-sunk)"/>' +
      '<path d="M48 84c-6-34 26-62 66-60 40 1 70 26 66 56-3 22-24 30-38 24-10-4-16 2-14 12 2 12-8 20-26 18-30-3-50-22-54-50z" fill="var(--card)" stroke="var(--line-strong)" stroke-width="2.2"/>' +
      '<path d="M124 96c-7-1-12 5-9 12" stroke="var(--line-strong)" stroke-width="2.2" fill="none"/>' +
      '<path d="M80 50c7-1 12 4 11 10s-8 9-14 6-5-15 3-16z" fill="var(--terracotta)"/>' +
      '<path d="M112 40c7 0 11 5 10 11s-9 8-14 5-4-16 4-16z" fill="var(--mustard)"/>' +
      '<path d="M145 54c6 1 9 6 7 12s-9 7-13 3-2-16 6-15z" fill="var(--teal)"/>' +
      '<path d="M70 82c6 0 10 5 9 10s-8 8-13 5-4-15 4-15z" fill="var(--sage)"/>' +
      '<path d="M178 18 136 76" stroke="var(--clay)" stroke-width="6" stroke-linecap="round"/>' +
      '<path d="M140 70c-6 4-10 10-12 18 7-1 13-5 17-11z" fill="var(--terracotta)"/>' +
      '<path d="M138 74l5 4" stroke="var(--ink-muted)" stroke-width="2.4" stroke-linecap="round"/>' +
      '<path d="M22 40c3-1 5 1 5 3s-3 4-5 3-3-5 0-6z" fill="var(--mustard)"/>' +
      '<path d="M196 106c3 0 5 2 4 5s-4 3-6 2-1-7 2-7z" fill="var(--terracotta)"/>' +
      '<path d="M30 120c2-1 4 0 4 2s-2 3-4 2-2-4 0-4z" fill="var(--teal)"/>' +
      '<path d="M20 70c10-6 16 2 26-3" stroke="var(--sage)" stroke-width="3" fill="none" stroke-linecap="round"/>' +
      '</svg>';
  }

  /* ---------------- sample data: November 2026 ---------------- */
  var CLASSES = [
    { id: 'a', name: 'חוג אומנות', day: 'ראשון', time: '16:00', color: 'terracotta' },
    { id: 'b', name: 'חוג אומנות', day: 'ראשון', time: '17:30', color: 'mustard' },
    { id: 'c', name: 'חוג אומנות', day: 'שני', time: '16:30', color: 'teal' },
    { id: 'd', name: 'חוג אומנות', day: 'חמישי', time: '16:00', color: 'sage' }
  ];
  function slot(c) { return c.day + ' ' + c.time; }
  function cls(id) { for (var i = 0; i < CLASSES.length; i++) if (CLASSES[i].id === id) return CLASSES[i]; }

  // kid: [name, class, isNew, girl, paidThisMonth]
  var FAMILIES = [
    { id: 'cohen', name: 'כהן', mom: ['מיכל', '052-7714410'], dad: ['אבי', '054-6620183'], pref: 'mom', kids: [['נועה', 'a', 0, 1, 1], ['איתי', 'c', 1, 0, 1]] },
    { id: 'levi', name: 'לוי', mom: ['רונית', '050-3341276'], dad: ['דני', '052-8806412'], pref: 'mom', kids: [['מאיה', 'd', 0, 1, 1]] },
    { id: 'mizrahi', name: 'מזרחי', mom: ['אורית', '054-2290871'], dad: ['יוסי', '053-7712096'], pref: 'mom', kids: [['יונתן', 'b', 0, 0, 0]], reminder: '02112026' },
    { id: 'peretz', name: 'פרץ', mom: ['הילה', '052-4418237'], dad: ['משה', '050-9931485'], pref: 'dad', kids: [['שירה', 'a', 0, 1, 1], ['עומר', 'b', 1, 0, 1]] },
    { id: 'biton', name: 'ביטון', mom: ['סיגל', '054-8823317'], dad: ['שלומי', '052-1170954'], pref: 'mom', kids: [['תמר', 'c', 0, 1, 0]], reminder: '01112026', debt: 300 },
    { id: 'avraham', name: 'אברהם', mom: ['ענבל', '050-6627731'], dad: ['רועי', '054-3315820'], pref: 'mom', kids: [['אורי', 'd', 1, 0, 1]] },
    { id: 'friedman', name: 'פרידמן', mom: ['דנה', '052-6613247'], dad: ['אלון', '054-3398120'], pref: 'mom', kids: [['ליה', 'b', 0, 1, 1], ['גיא', 'd', 0, 0, 0]] },
    { id: 'dahan', name: 'דהן', mom: ['מורן', '053-4402619'], dad: ['אליה', '052-2276630'], pref: 'mom', kids: [['רוני', 'a', 0, 1, 0]] },
    { id: 'shapira', name: 'שפירא', mom: ['גליה', '054-7730418'], dad: ['עידו', '050-2219063'], pref: 'dad', kids: [['אלה', 'c', 1, 1, 1], ['יואב', 'a', 1, 0, 1]] },
    { id: 'golan', name: 'גולן', mom: ['קרן', '052-4418820'], dad: ['ניר', '054-9902371'], pref: 'mom', kids: [['עדי', 'b', 0, 1, 0]], reminder: '03112026', debt: 300 },
    { id: 'ohayon', name: 'אוחיון', mom: ['ליאת', '050-8812244'], dad: ['גיל', '052-6650193'], pref: 'mom', kids: [['אביגיל', 'c', 1, 1, 1]] },
    { id: 'rozen', name: 'רוזן', mom: ['נעמה', '054-1176620'], dad: ['יובל', '053-3390418'], pref: 'dad', kids: [['דניאל', 'd', 1, 0, 1]] }
  ];
  function price(k) { return k[2] ? 330 : 300; }
  function famTotal(f) { return f.kids.reduce(function (s, k) { return s + price(k); }, 0); }
  function famPaid(f) { return f.kids.reduce(function (s, k) { return s + (k[4] ? price(k) : 0); }, 0); }
  function fam(id) { for (var i = 0; i < FAMILIES.length; i++) if (FAMILIES[i].id === id) return FAMILIES[i]; }

  var PAYMENTS = [
    { f: 'rozen', amt: 330, m: 'transfer', by: 'אבא', d: '04112026', r: '40187' },
    { f: 'friedman', amt: 300, m: 'bit', by: 'אמא', d: '03112026', r: '40186' },
    { f: 'ohayon', amt: 330, m: 'bit', by: 'אמא', d: '03112026', r: '40185' },
    { f: 'shapira', amt: 660, m: 'bit', by: 'אבא', d: '02112026', r: '40184' },
    { f: 'avraham', amt: 330, m: 'cash', by: 'אמא', d: '02112026', r: '40183' },
    { f: 'peretz', amt: 630, m: 'transfer', by: 'אבא', d: '01112026', r: '40182' },
    { f: 'levi', amt: 300, m: 'paybox', by: 'אמא', d: '01112026', r: '40181' },
    { f: 'cohen', amt: 630, m: 'bit', by: 'אמא', d: '01112026', r: '40180' },
    { f: 'mizrahi', amt: 300, m: 'paybox', by: 'אבא', d: '29102026', r: '40179', old: 'אוקטובר' },
    { f: 'dahan', amt: 300, m: 'bit', by: 'אמא', d: '27102026', r: '40178', old: 'אוקטובר' }
  ];
  var METHODS = {
    bit: { label: 'ביט', icon: 'bolt', color: 'var(--teal)' },
    paybox: { label: 'פייבוקס', icon: 'phone', color: 'var(--mustard)' },
    transfer: { label: 'העברה בנקאית', icon: 'bank', color: 'var(--sage)' },
    cash: { label: 'מזומן', icon: 'cash', color: 'var(--clay)' }
  };
  var RECEIPTS = [
    { who: 'קרן ג.', phone: '052-4418820', amt: 300, m: 'bit', d: '04112026', r: '40188', hint: 'golan' },
    { who: null, phone: '054-7720931', amt: 300, m: 'paybox', d: '03112026', r: '40189', hint: null }
  ];

  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function ils(n) { return '<span class="tnum">' + fmt(n) + ' ₪</span>'; }

  function totals(allPaid) {
    var exp = 0, got = 0, kids = 0, kidsPaid = 0, unpaidFam = 0;
    FAMILIES.forEach(function (f) {
      exp += famTotal(f);
      got += allPaid ? famTotal(f) : famPaid(f);
      kids += f.kids.length;
      kidsPaid += allPaid ? f.kids.length : f.kids.filter(function (k) { return k[4]; }).length;
      if (!allPaid && famPaid(f) < famTotal(f)) unpaidFam++;
    });
    return { exp: exp, got: got, miss: exp - got, pct: Math.round(got / exp * 100), kids: kids, kidsPaid: kidsPaid, unpaidFam: unpaidFam };
  }
  function unpaidFamilies() {
    var u = FAMILIES.filter(function (f) { return famPaid(f) < famTotal(f); });
    u.sort(function (a, b) { return (b.debt || 0) - (a.debt || 0) || (b.reminder ? 1 : 0) - (a.reminder ? 1 : 0); });
    return u;
  }

  /* ---------------- components ---------------- */
  var C = {};
  C.title = function (t) { return '<h1 class="yd-title">' + t + brush + '</h1>'; };
  C.heading = function (t, count, dab) { return '<h2 class="yd-heading"><span class="yd-dab ' + (dab || '') + '"></span>' + t + (count != null ? ' <span class="yd-count">' + count + '</span>' : '') + '</h2>'; };
  C.button = function (label, kind, opts) {
    opts = opts || {};
    return '<button class="yd-btn ' + (kind || 'secondary') + ' ' + (opts.size || '') + (opts.block ? ' block' : '') + '"' + (opts.disabled ? ' disabled' : '') + '>' + (opts.icon ? ic(opts.icon, 'sm') : '') + (label || '') + '</button>';
  };
  C.status = function (s, text) {
    var t = text || { paid: 'שולם', partial: 'שולם חלקית', missing: 'לא שולם' }[s];
    return '<span class="yd-chip ' + s + '"><span class="dot"></span>' + t + '</span>';
  };
  C.method = function (m) { var x = METHODS[m]; return '<span class="yd-chip ' + m + '">' + ic(x.icon) + x.label + '</span>'; };
  C.monthPicker = function (label) {
    // RTL: the right arrow (pointing right) goes back to the previous month; the left arrow (pointing left) goes forward.
    return '<div class="yd-month"><button class="arrow" aria-label="חודש קודם — אוקטובר">' + ic('chevR') + '</button>' +
      '<div class="name">' + C.title(label || 'נובמבר 2026') + '</div>' +
      '<button class="arrow" aria-label="חודש הבא — דצמבר">' + ic('chevL') + '</button></div>';
  };
  C.alert = function (allPaid) {
    if (allPaid) return '';
    var t = totals(); var debtFams = FAMILIES.filter(function (f) { return f.debt; });
    var debtSum = debtFams.reduce(function (s, f) { return s + f.debt; }, 0);
    return '<div class="yd-alert" role="status">' +
      '<div class="line warn">' + ic('bell') + '<span><b>' + t.unpaidFam + ' משפחות</b> עוד לא שילמו על נובמבר · חסרים <b>' + ils(t.miss) + '</b></span><span class="go">לרשימה</span></div>' +
      '<div class="line debt">' + ic('alert') + '<span><b>' + debtFams.length + ' משפחות</b> עם חוב מאוקטובר · ' + ils(debtSum) + '</span><span class="go">לתצוגה שנתית</span></div></div>';
  };
  C.summary = function (allPaid) {
    var t = totals(allPaid);
    return '<div class="yd-summary">' +
      '<div class="yd-card yd-stat"><span class="label">' + ic('cal', 'sm') + 'צפוי החודש</span><span class="value">' + fmt(t.exp) + '<small>₪</small></span><span class="sub">' + t.kids + ' ילדים · ' + FAMILIES.length + ' משפחות</span></div>' +
      '<div class="yd-card yd-stat collected"><span class="label">' + ic('checkc', 'sm') + 'נגבה</span><span class="value">' + fmt(t.got) + '<small>₪</small></span><span class="sub">' + (FAMILIES.length - t.unpaidFam) + ' משפחות שילמו</span></div>' +
      '<div class="yd-card yd-stat' + (t.miss ? ' missing' : '') + '"><span class="label">' + ic('clock', 'sm') + 'חסר</span><span class="value">' + fmt(t.miss) + '<small>₪</small></span><span class="sub">' + (t.miss ? t.unpaidFam + ' משפחות ממתינות' : 'אין חובות החודש') + '</span></div>' +
      '<div class="yd-card yd-stat"><span class="label">' + ic('sparkle', 'sm') + 'אחוז ששולם</span><span class="value">' + t.pct + '<small>%</small></span><div class="yd-bar"><i style="width:' + t.pct + '%"></i></div></div>' +
      '</div>';
  };
  function kidLine(k) { return '<span>' + k[0] + ' <em>· ' + slot(cls(k[1])) + '</em>' + (k[4] ? ' <span class="yd-chip paid" style="height:18px;padding:0 6px;font-size:11px">' + ic('check') + 'שולם</span>' : '') + '</span>'; }
  function famOwed(f) { return famTotal(f) - famPaid(f); }
  function reminderText(f) { return f.reminder ? ic('chat', 'sm') + 'תזכורת אחרונה <span class="tnum">' + f.reminder + '</span>' : ic('bell', 'sm') + 'לא נשלחה תזכורת'; }
  C.unpaidRow = function (f) {
    var partial = famPaid(f) > 0;
    return '<div class="yd-urow">' +
      '<div class="fam">משפחת ' + f.name + (f.debt ? '<span class="yd-debt">' + ic('alert', 'sm') + 'חוב אוקטובר ' + ils(f.debt) + '</span>' : '') + '</div>' +
      '<div class="kids">' + f.kids.map(kidLine).join('') + '</div>' +
      '<div class="amt ' + (partial ? 'partial' : '') + '">' + ils(famOwed(f)) + (partial ? '<small>שולמו ' + famPaid(f) + ' מתוך ' + famTotal(f) + '</small>' : '<small>נובמבר</small>') + '</div>' +
      '<div class="rem ' + (f.reminder ? '' : 'none') + '">' + reminderText(f) + '</div>' +
      '<div class="acts">' + C.button('שליחת WhatsApp', 'whatsapp', { size: 'sm', icon: 'chat' }) + C.button('סימון כשולם', 'secondary', { size: 'sm', icon: 'check' }) + '</div></div>';
  };
  C.unpaidCard = function (f) {
    var partial = famPaid(f) > 0;
    return '<div class="yd-card yd-ucard"><div class="top"><div style="display:flex;flex-direction:column;gap:4px"><b style="font-weight:500">משפחת ' + f.name + '</b>' + (f.debt ? '<span class="yd-debt">' + ic('alert', 'sm') + 'חוב אוקטובר ' + ils(f.debt) + '</span>' : '') + '</div>' +
      '<div style="text-align:left"><div class="amt ' + (partial ? 'partial' : '') + '">' + ils(famOwed(f)) + '</div>' + (partial ? '<div class="small muted">' + C.status('partial') + '</div>' : '') + '</div></div>' +
      '<div class="kids">' + f.kids.map(kidLine).join('') + '</div>' +
      '<div class="small ' + (f.reminder ? 'muted' : '') + '" style="display:flex;gap:6px;align-items:center;' + (f.reminder ? '' : 'color:var(--partial-ink)') + '">' + reminderText(f) + '</div>' +
      '<div class="acts">' + C.button('שליחת WhatsApp', 'whatsapp', { block: true, icon: 'chat' }) + C.button('סימון כשולם', 'secondary', { block: true, icon: 'check' }) + '</div></div>';
  };
  C.unpaidList = function (limit) {
    var u = unpaidFamilies(); if (limit) u = u.slice(0, limit);
    return '<div class="yd-card yd-unpaid"><div class="yd-urow head label"><span>משפחה</span><span>ילדים וקבוצה</span><span>סכום חסר</span><span>תזכורת</span><span></span></div>' + u.map(C.unpaidRow).join('') + '</div>';
  };
  C.ring = function (paid, total, size) {
    var r = 22, c = 2 * Math.PI * r, p = total ? paid / total : 0;
    return '<div class="yd-ring ' + (p < .6 ? 'low' : '') + '"><svg viewBox="0 0 56 56"><circle class="track" cx="28" cy="28" r="' + r + '" fill="none" stroke-width="7"/><circle class="fill" cx="28" cy="28" r="' + r + '" fill="none" stroke-width="7" stroke-dasharray="' + (c * p).toFixed(1) + ' ' + c.toFixed(1) + '"/></svg><span class="pct">' + Math.round(p * 100) + '%</span></div>';
  };
  function classStats(id, allPaid) {
    var t = 0, p = 0;
    FAMILIES.forEach(function (f) { f.kids.forEach(function (k) { if (k[1] === id) { t++; if (k[4] || allPaid) p++; } }); });
    return { t: t, p: p };
  }
  C.classCard = function (c, allPaid) {
    var s = classStats(c.id, allPaid), behind = s.p / s.t < .6;
    return '<div class="yd-card yd-class ' + (behind ? 'behind' : '') + '">' + (behind ? '<span class="flag yd-chip partial"><span class="dot"></span>מפגר בתשלום</span>' : '') +
      C.ring(s.p, s.t) + '<div class="info"><span class="name">יום ' + c.day + ' · <span class="tnum">' + c.time + '</span></span><span class="when">' + ic('palette', 'sm') + c.name + '</span>' +
      '<span class="stat"><b>' + s.p + '/' + s.t + '</b> שילמו</span></div></div>';
  };
  C.classCards = function (allPaid) { return '<div class="yd-classes">' + CLASSES.map(function (c) { return C.classCard(c, allPaid); }).join('') + '</div>'; };
  C.paymentRow = function (p) {
    return '<div class="yd-pay ' + (p.old ? 'old' : '') + '"><span class="fam">משפחת ' + fam(p.f).name + (p.old ? ' <span class="small muted">· על ' + p.old + '</span>' : '') + '</span>' +
      '<span class="amt">' + ils(p.amt) + '</span><span>' + C.method(p.m) + '</span><span class="meta">' + p.by + '</span><span class="meta">' + p.d + '</span><span class="rcpt">#' + p.r + '</span></div>';
  };
  C.payments = function (n) {
    return '<div class="yd-card"><div class="yd-pay head label"><span>משפחה</span><span>סכום</span><span>אמצעי</span><span>שילם/ה</span><span>תאריך</span><span>קבלה</span></div>' + PAYMENTS.slice(0, n || 10).map(C.paymentRow).join('') + '</div>';
  };
  C.receipt = function (r, open) {
    var sug = r.hint ? fam(r.hint) : null;
    return '<div class="yd-receipt"><span class="ico">' + ic('receipt') + '</span>' +
      '<div><div class="who">' + (r.who ? r.who + ' · ' : '') + '<span class="ltr tnum">' + r.phone + '</span></div><div class="meta">קבלת Morning <span class="tnum">#' + r.r + '</span> · ' + METHODS[r.m].label + ' · <span class="tnum">' + r.d + '</span></div>' +
      (sug ? '<div class="hint" style="font-size:12px;color:var(--teal-ink);margin-top:2px">' + ic('link', 'sm') + ' הטלפון תואם לקרן, אמא במשפחת ' + sug.name + '</div>' : '') + '</div>' +
      '<div class="side"><span class="amt">' + ils(r.amt) + '</span><div style="position:relative"><span class="yd-select">' + (sug ? 'משפחת ' + sug.name + '?' : 'שיוך למשפחה') + '</span>' +
      (open ? '<div class="yd-menu"><div class="search">' + ic('search', 'sm') + 'חיפוש משפחה…</div>' + unpaidFamilies().map(function (f) { return '<div class="opt"><span>משפחת ' + f.name + '</span><span class="muted tnum">חסר ' + famOwed(f) + ' ₪</span></div>'; }).join('') + '</div>' : '') +
      '</div></div></div>';
  };
  C.receipts = function (openSecond) {
    return '<div class="yd-card">' + RECEIPTS.map(function (r, i) { return C.receipt(r, openSecond && i === 1); }).join('') + '</div>';
  };
  C.breakdown = function () {
    var sums = {}; Object.keys(METHODS).forEach(function (k) { sums[k] = 0; });
    PAYMENTS.forEach(function (p) { if (!p.old) sums[p.m] += p.amt; });
    var total = 0; for (var k in sums) total += sums[k];
    var r = 56, c = 2 * Math.PI * r, off = 0, segs = '', leg = '';
    Object.keys(METHODS).forEach(function (k) {
      var len = sums[k] / total * c, gap = 3;
      segs += '<circle cx="75" cy="75" r="' + r + '" fill="none" stroke="' + METHODS[k].color + '" stroke-width="18" stroke-dasharray="' + Math.max(len - gap, 0).toFixed(1) + ' ' + c.toFixed(1) + '" stroke-dashoffset="' + (-off).toFixed(1) + '"/>';
      off += len;
      leg += '<div class="item"><span class="sw" style="background:' + METHODS[k].color + '"></span><span>' + METHODS[k].label + '</span><span class="v">' + ils(sums[k]) + '</span><span class="p">' + Math.round(sums[k] / total * 100) + '%</span></div>';
    });
    return '<div class="yd-card yd-donutwrap"><div class="yd-donut"><svg viewBox="0 0 150 150">' + segs + '</svg><div class="center"><b>' + fmt(total) + ' ₪</b><span class="small muted">נגבו בנובמבר</span></div></div><div class="yd-legend">' + leg + '</div></div>';
  };
  C.celebrate = function () {
    return '<div class="yd-card yd-empty">' + illustration(170) + '<h3>כולם שילמו! 🎨</h3><p>כל 12 המשפחות סגרו את נובמבר. אין למי לשלוח תזכורת — זמן לחזור לצבעים.</p></div>';
  };

  /* ---------------- shells ---------------- */
  var NAV = [['home', 'לוח בקרה'], ['year', 'תצוגה שנתית'], ['family', 'משפחות'], ['palette', 'חוגים']];
  function shell(active, main) {
    return '<div class="yd yd-app"><aside class="yd-side">' + logo() +
      NAV.map(function (n, i) { return '<div class="yd-nav ' + (i === active ? 'on' : '') + '">' + ic(n[0]) + n[1] + '</div>'; }).join('') +
      '<div style="margin-top:14px">' + C.button('רישום תשלום', 'primary', { block: true, icon: 'plus' }) + '</div>' +
      '<div class="spacer"></div><div class="yd-user"><span class="yd-avatar">גד</span><div style="flex:1"><div style="font-weight:500">דליה</div><div class="small muted">dalia@yada.co.il</div></div>' + ic('out', 'sm') + '</div></aside>' +
      '<main class="yd-main">' + main + '</main></div>';
  }
  function phone(body, tab, overlay) {
    var tabs = [['home', 'בית'], ['year', 'שנתי'], ['plus', 'תשלום'], ['family', 'משפחות'], ['palette', 'חוגים']];
    return '<div class="yd yd-phone"><div class="status"><span>9:41</span><span>●●● ▮</span></div>' + body +
      '<nav class="yd-tabbar">' + tabs.map(function (t, i) { return i === 2 ? '<div class="yd-tab fab"><span>' + ic('plus') + '</span>' + t[1] + '</div>' : '<div class="yd-tab ' + (i === tab ? 'on' : '') + '">' + ic(t[0]) + t[1] + '</div>'; }).join('') + '</nav>' + (overlay || '') + '</div>';
  }

  /* ---------------- screens ---------------- */
  var S = {};
  S.login = function () {
    var dabs = '<span class="yd-dab" style="position:absolute;top:90px;right:140px;width:26px;height:22px"></span><span class="yd-dab mustard" style="position:absolute;top:220px;left:160px;width:34px;height:28px"></span><span class="yd-dab sage" style="position:absolute;bottom:120px;right:260px;width:20px;height:18px"></span><span class="yd-dab teal" style="position:absolute;bottom:80px;left:300px;width:14px;height:12px"></span>';
    return '<div class="yd" style="min-height:820px;display:grid;place-items:center;position:relative;overflow:hidden">' + dabs +
      '<div class="yd-card" style="width:420px;padding:32px 36px 28px;display:flex;flex-direction:column;gap:18px;position:relative">' +
      '<div style="display:flex;flex-direction:column;align-items:center;gap:6px">' + illustration(200) + '<div style="display:flex;align-items:center;gap:10px;margin-top:4px">' + mark(36) + '<span style="font-family:var(--font-display);font-size:32px;line-height:38px">Ya-Da</span></div><span class="muted small">מעקב תשלומים לסטודיו של דליה</span></div>' +
      '<div class="yd-field"><label>אימייל</label><div class="yd-input focus">' + ic('mail', 'sm') + '<span class="ltr">dalia@yada.co.il</span></div></div>' +
      '<div class="yd-field"><label>סיסמה</label><div class="yd-input">' + ic('lock', 'sm') + '<span class="tnum" style="letter-spacing:3px">••••••••</span><span class="suffix small" style="color:var(--teal-ink)">הצגה</span></div></div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center" class="small"><label style="display:flex;gap:8px;align-items:center"><span class="yd-choice on" style="height:auto;padding:0;border:0;background:none"><span class="tick">' + ic('check', 'sm') + '</span></span>לזכור אותי</label><span style="color:var(--terracotta-ink)">שכחתי סיסמה</span></div>' +
      C.button('כניסה', 'primary', { size: 'lg', block: true }) + '</div></div>';
  };
  S.dashboard = function (allPaid) {
    var t = totals(allPaid);
    var main = '<div class="yd-topbar"><div><div class="muted small">יום רביעי · <span class="tnum">04112026</span></div><div style="font-size:15px">בוקר טוב, דליה</div></div>' + C.monthPicker() + '<div style="display:flex;gap:8px">' + C.button('', 'secondary', { icon: 'search' }).replace('yd-btn secondary', 'yd-btn secondary icon') + C.button('רישום תשלום', 'primary', { icon: 'plus' }) + '</div></div>' +
      C.alert(allPaid) + C.summary(allPaid) +
      '<section class="yd-section"><div class="yd-section-head">' + C.heading('ממתינים לתשלום', allPaid ? 0 : t.unpaidFam, '') + (allPaid ? '' : '<div style="display:flex;gap:8px">' + C.button('תזכורת לכולם', 'ghost', { size: 'sm', icon: 'chat' }) + '</div>') + '</div>' + (allPaid ? C.celebrate() : C.unpaidList()) + '</section>' +
      '<section class="yd-section"><div class="yd-section-head">' + C.heading('החוגים שלי', null, 'mustard') + '<span class="small muted">' + t.kidsPaid + ' מתוך ' + t.kids + ' ילדים שילמו</span></div>' + C.classCards(allPaid) + '</section>' +
      '<section class="yd-section"><div class="yd-section-head">' + C.heading('תשלומים אחרונים', null, 'teal') + C.button('לכל התשלומים', 'ghost', { size: 'sm' }) + '</div>' + C.payments(10) + '</section>' +
      '<div class="yd-grid2"><section class="yd-section"><div class="yd-section-head">' + C.heading('קבלות לבדיקה', allPaid ? 0 : RECEIPTS.length, 'sage') + '<span class="small muted">מ-Morning</span></div>' +
      (allPaid ? '<div class="yd-card" style="padding:20px;display:flex;gap:12px;align-items:center;color:var(--ink-muted)">' + ic('checkc') + 'כל הקבלות שויכו למשפחות</div>' : C.receipts(false)) + '</section>' +
      '<section class="yd-section"><div class="yd-section-head">' + C.heading('לפי אמצעי תשלום', null, 'teal') + '</div>' + C.breakdown() + '</section></div>';
    return shell(0, main);
  };
  S.mobileBody = function (allPaid) {
    var t = totals(allPaid);
    return '<div class="yd-mtop">' + mark(32) + '<div class="yd-month" style="gap:6px"><button class="arrow" style="width:32px;height:32px">' + ic('chevR', 'sm') + '</button><span style="font-family:var(--font-display);font-size:20px">נובמבר 2026</span><button class="arrow" style="width:32px;height:32px">' + ic('chevL', 'sm') + '</button></div><span class="yd-avatar">ד</span></div>' +
      '<div class="yd-mbody">' + C.alert(allPaid).replace(/<span class="go">[^<]*<\/span>/g, '') + C.summary(allPaid) +
      '<section class="yd-section">' + C.heading('ממתינים לתשלום', allPaid ? 0 : t.unpaidFam) + (allPaid ? C.celebrate() : unpaidFamilies().slice(0, 3).map(C.unpaidCard).join('') + '<div style="text-align:center">' + C.button('עוד 2 משפחות', 'ghost', { size: 'sm' }) + '</div>') + '</section>' +
      '<section class="yd-section">' + C.heading('החוגים שלי', null, 'mustard') + C.classCards(allPaid) + '</section></div>';
  };
  S.dashboardMobile = function () {
    return '<div class="yd" style="display:flex;gap:40px;padding:32px;justify-content:center;align-items:flex-start;background:var(--paper-sunk)">' +
      '<div style="display:flex;flex-direction:column;gap:12px;align-items:center"><span class="label">יש חובות</span>' + phone(S.mobileBody(false), 0) + '</div>' +
      '<div style="display:flex;flex-direction:column;gap:12px;align-items:center"><span class="label">כולם שילמו — בלי רצועת התראה</span>' + phone(S.mobileBody(true), 0) + '</div></div>';
  };
  S.year = function () {
    var months = ['ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳', 'ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני'];
    var colTotals = [0, 0, 0];
    var rows = FAMILIES.map(function (f) {
      var tot = famTotal(f), cells = '';
      for (var i = 0; i < 10; i++) {
        var st, txt;
        if (i === 0) { st = 'paid'; txt = fmt(tot) + ' ₪'; colTotals[0] += tot; }
        else if (i === 1) { if (f.debt) { st = 'missing'; txt = 'חסר ' + tot; } else { st = 'paid'; txt = fmt(tot) + ' ₪'; colTotals[1] += tot; } }
        else if (i === 2) { var p = famPaid(f); colTotals[2] += p; if (p === tot) { st = 'paid'; txt = fmt(tot) + ' ₪'; } else if (p) { st = 'partial'; txt = p + ' מ-' + tot; } else { st = 'missing'; txt = 'חסר ' + tot; } }
        else { st = 'future'; txt = '—'; }
        cells += '<td><div class="yd-ycell ' + st + (f.id === 'friedman' && i === 2 ? ' sel' : '') + '">' + txt + '</div></td>';
      }
      return '<tr><td class="fam"><b>משפחת ' + f.name + '</b><span>' + f.kids.map(function (k) { return k[0]; }).join(', ') + ' · ' + fmt(tot) + ' ₪ לחודש</span></td>' + cells + '</tr>';
    }).join('');
    var foot = '<tr><td class="fam">נגבה בחודש</td>' + months.map(function (m, i) { return '<td>' + (i < 3 ? fmt(colTotals[i]) + ' ₪' : '') + '</td>'; }).join('') + '</tr>';
    var main = '<div class="yd-topbar"><div>' + C.title('שנת הלימודים 2026–2027') + '<div class="muted small" style="margin-top:6px">ספטמבר עד יוני · לחיצה על משבצת פותחת רישום תשלום</div></div>' +
      '<div style="display:flex;gap:10px;align-items:center">' + C.status('paid') + C.status('partial') + C.status('missing') + '<span class="yd-chip neutral" style="border:1.5px dashed var(--line-strong);background:none">עתידי</span></div></div>' +
      '<div class="yd-yearwrap"><table class="yd-year"><thead><tr><th class="fam">משפחה</th>' + months.map(function (m, i) { return '<th class="' + (i === 2 ? 'cur' : '') + '"><span>' + m + '</span></th>'; }).join('') + '</tr></thead><tbody>' + rows + '</tbody><tfoot>' + foot + '</tfoot></table></div>' +
      '<div class="small muted" style="display:flex;gap:6px;align-items:center">' + ic('chevL', 'sm') + 'גלילה הצידה — עמודת המשפחות נשארת במקום</div>';
    return shell(1, main);
  };
  S.families = function () {
    var f = fam('friedman');
    var list = FAMILIES.map(function (x) {
      var st = famPaid(x) === famTotal(x) ? 'paid' : famPaid(x) ? 'partial' : 'missing';
      return '<div class="yd-famitem ' + (x.id === f.id ? 'on' : '') + '"><span class="yd-avatar" style="background:var(--paper-sunk);color:var(--ink-muted)">' + x.name[0] + '</span><div class="t"><b>משפחת ' + x.name + '</b><span>' + x.kids.map(function (k) { return k[0]; }).join(', ') + '</span></div><span class="yd-chip ' + st + '" style="padding:0 7px"><span class="dot"></span></span></div>';
    }).join('');
    function parent(role, p, email, pref) {
      return '<div class="yd-card yd-parent ' + (pref ? 'pref' : '') + '"><div style="display:flex;justify-content:space-between;align-items:center"><span class="label">' + role + '</span>' + (pref ? '<span class="yd-chip bit">' + ic('chat') + 'מקבלת תזכורות</span>' : '') + '</div>' +
        '<div style="font-weight:500;font-size:16px">' + p[0] + ' פרידמן</div><div class="row">' + ic('phone', 'sm') + '<span class="ltr tnum">' + p[1] + '</span></div><div class="row">' + ic('mail', 'sm') + '<span class="ltr">' + email + '</span></div></div>';
    }
    var kids = [['ליה', 'חוג אומנות · ראשון 17:30', 'ממשיכה', 300, true], ['גיא', 'חוג אומנות · חמישי 16:00', 'ממשיך', 300, true], ['נגה', 'חוג אומנות · שני 16:30', 'ממשיכה', 300, false]];
    var kidRows = kids.map(function (k) {
      return '<div class="yd-kid ' + (k[4] ? '' : 'inactive') + '"><div style="display:flex;gap:10px;align-items:center"><span class="yd-avatar" style="width:30px;height:30px;font-size:13px">' + k[0][0] + '</span><div><div style="font-weight:500">' + k[0] + ' <span class="yd-chip cont" style="height:20px;margin-inline-start:4px">' + k[2] + '</span></div><div class="small muted">' + k[1] + '</div></div></div>' +
        '<div><div class="small muted">מחיר חודשי</div><div class="num">' + k[3] + ' ₪ <span class="small muted" style="font-weight:400">· ללא שינוי</span></div></div>' +
        '<div class="yd-input" style="height:36px;font-size:13px"><span class="ph">מחיר מותאם</span><span class="suffix">₪</span></div>' +
        '<div style="display:flex;gap:8px;align-items:center" class="small"><span class="yd-toggle ' + (k[4] ? 'on' : '') + '"></span>' + (k[4] ? 'פעיל/ה' : 'לא פעילה') + '</div></div>';
    }).join('');
    var hist = [['נובמבר 2026', 300, 600, 'bit', 'אמא', '03112026', '40186', 'partial'], ['אוקטובר 2026', 600, 600, 'bit', 'אמא', '02102026', '40102', 'paid'], ['ספטמבר 2026', 600, 600, 'transfer', 'אבא', '01092026', '39950', 'paid']];
    var histRows = hist.map(function (h) {
      return '<div class="yd-pay" style="grid-template-columns:1.2fr 120px 140px 60px 100px 80px"><span class="fam">' + h[0] + '</span><span class="amt">' + (h[1] === h[2] ? h[1] + ' ₪' : h[1] + ' ₪ <span class="small muted" style="font-weight:400">מתוך ' + h[2] + '</span>') + '</span><span>' + C.method(h[3]) + '</span><span class="meta">' + h[4] + '</span><span class="meta">' + h[5] + '</span><span class="rcpt">#' + h[6] + '</span></div>';
    }).join('');
    var main = '<div class="yd-topbar">' + C.title('משפחות') + C.button('משפחה חדשה', 'primary', { icon: 'plus' }) + '</div>' +
      '<div style="display:grid;grid-template-columns:300px 1fr;gap:24px;align-items:start">' +
      '<div class="yd-card" style="overflow:hidden"><div style="padding:12px"><div class="yd-input" style="height:40px">' + ic('search', 'sm') + '<span class="ph">חיפוש לפי שם, ילד או טלפון</span></div></div><div class="yd-famlist" style="border-top:1px solid var(--line)">' + list + '</div></div>' +
      '<div style="display:flex;flex-direction:column;gap:24px">' +
      '<div class="yd-card" style="padding:20px 24px;display:flex;justify-content:space-between;align-items:center"><div><h2 style="font-family:var(--font-display);font-weight:400;font-size:24px;margin:0">משפחת פרידמן</h2><div class="small muted">2 ילדים פעילים · 600 ₪ לחודש</div></div><div style="display:flex;gap:10px;align-items:center">' + C.status('partial', 'נובמבר: חסרים 300 ₪') + C.button('עריכה', 'secondary', { icon: 'edit', size: 'sm' }) + '</div></div>' +
      '<section class="yd-section"><div class="yd-section-head">' + C.heading('הורים') + '<div style="display:flex;gap:10px;align-items:center"><span class="small muted">תזכורות נשלחות אל</span><div class="yd-seg"><span class="on">אמא</span><span>אבא</span><span>שניהם</span></div></div></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">' + parent('אמא', f.mom, 'dana.f@gmail.com', true) + parent('אבא', f.dad, 'alon.friedman@walla.co.il', false) + '</div></section>' +
      '<section class="yd-section"><div class="yd-section-head">' + C.heading('ילדים', 3, 'mustard') + C.button('הוספת ילד/ה', 'ghost', { size: 'sm', icon: 'plus' }) + '</div><div class="yd-card">' + kidRows + '</div></section>' +
      '<section class="yd-section"><div class="yd-section-head">' + C.heading('היסטוריית תשלומים', null, 'teal') + '</div><div class="yd-card">' + histRows + '</div></section>' +
      '</div></div>';
    return shell(2, main);
  };
  S.recordPayment = function () {
    var months = ['ספטמבר', 'אוקטובר', 'נובמבר'];
    var grid = '<div class="yd-cover"><span></span>' + months.map(function (m) { return '<span class="h">' + m + '</span>'; }).join('') +
      '<span class="k">ליה<em>ראשון 17:30</em></span><span class="yd-cell done">' + ic('check', 'sm') + '</span><span class="yd-cell done">' + ic('check', 'sm') + '</span><span class="yd-cell done">' + ic('check', 'sm') + '</span>' +
      '<span class="k">גיא<em>חמישי 16:00</em></span><span class="yd-cell done">' + ic('check', 'sm') + '</span><span class="yd-cell done">' + ic('check', 'sm') + '</span><span class="yd-cell on">300 ₪</span></div>';
    var modal = '<div class="yd-modal" role="dialog"><div class="hd"><h2 class="yd-heading" style="font-size:20px"><span class="yd-dab"></span>רישום תשלום</h2><button class="yd-btn ghost icon" style="color:var(--ink-muted)">' + ic('x') + '</button></div><div class="bd">' +
      '<div class="yd-field"><label>משפחה</label><div class="yd-input">' + ic('family', 'sm') + '<b style="font-weight:500">משפחת פרידמן</b><span class="small muted">· דנה ואלון</span><span class="suffix">' + ic('chevD', 'sm') + '</span></div></div>' +
      '<div class="yd-field"><label>על מה התשלום? <span style="font-weight:400">· אפשר לסמן כמה ילדים וחודשים</span></label>' + grid + '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px"><div class="yd-field"><label>סכום</label><div class="yd-input"><b class="num" style="font-size:18px">300</b><span class="suffix">₪</span></div></div><div class="yd-field"><label>תאריך</label><div class="yd-input">' + ic('cal', 'sm') + '<span class="tnum">04112026</span></div></div></div>' +
      '<div class="yd-field"><label>אמצעי תשלום</label><div class="yd-row">' + ['bit', 'paybox', 'transfer', 'cash'].map(function (m, i) { return '<span class="yd-choice ' + (i === 0 ? 'on' : '') + '">' + ic(METHODS[m].icon, 'sm') + METHODS[m].label + '</span>'; }).join('') + '</div></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px"><div class="yd-field"><label>מי שילם</label><div class="yd-row"><span class="yd-choice on">אמא · דנה</span><span class="yd-choice">אבא · אלון</span></div></div>' +
      '<div class="yd-field"><label>מספר קבלה ב-Morning</label><div class="yd-input">' + ic('receipt', 'sm') + '<span class="tnum">40190</span></div></div></div>' +
      '</div><div class="ft"><span class="small muted">אחרי השמירה: נובמבר של פרידמן יסומן <b style="color:var(--paid-ink)">שולם</b></span><div style="display:flex;gap:8px">' + C.button('ביטול', 'secondary') + C.button('שמירת תשלום', 'primary', { icon: 'check' }) + '</div></div></div>';
    return '<div class="yd" style="position:relative;min-height:860px"><div style="position:absolute;inset:0;overflow:hidden;filter:saturate(.9)">' + S.dashboard(false) + '</div><div class="yd-scrim" style="position:absolute;inset:0;padding-top:60px;align-items:start">' + modal + '</div></div>';
  };
  S.classes = function () {
    var rows = CLASSES.map(function (c) {
      var s = classStats(c.id);
      return '<div class="yd-classrow"><span class="sw" style="background:var(--' + c.color + ')"></span>' +
        '<div class="yd-input" style="height:40px"><span>יום ' + c.day + '</span><span class="suffix">' + ic('chevD', 'sm') + '</span></div>' +
        '<div class="yd-input" style="height:40px">' + ic('clock', 'sm') + '<span class="tnum">' + c.time + '</span></div><span class="small muted">' + s.t + ' ילדים</span>' +
        '<button class="yd-btn ghost icon" style="color:var(--ink-muted)">' + ic('dots') + '</button></div>';
    }).join('');
    var main = '<div class="yd-topbar">' + C.title('חוגים') + '<div style="display:flex;gap:8px">' + C.button('הוספת קבוצה', 'secondary', { icon: 'plus' }) + C.button('שמירה', 'primary', { icon: 'check' }) + '</div></div>' +
      '<div class="small muted" style="margin-top:-18px">חוג אומנות · 4 קבוצות בשבוע</div><div class="yd-card" style="max-width:920px"><div class="yd-classrow head label"><span></span><span>יום</span><span>שעה</span><span>רשומים</span><span></span></div>' + rows + '</div>' +
      '<div class="yd-card" style="max-width:920px;padding:18px 22px;display:flex;gap:28px;align-items:center"><div style="display:flex;flex-direction:column;gap:2px"><span class="label">מחיר לילד חדש</span><span class="num" style="font-size:20px">330 ₪</span></div><div style="display:flex;flex-direction:column;gap:2px"><span class="label">מחיר לילד ממשיך</span><span class="num" style="font-size:20px">300 ₪</span></div><span class="small muted" style="flex:1">אפשר לקבוע מחיר מותאם לכל ילד בעמוד המשפחה.</span></div>';
    return shell(3, main);
  };
  S.whatsapp = function () {
    var f = fam('mizrahi');
    var msg = 'שלום אורית,\nתזכורת לתשלום חוג לחודש נובמבר: 300 ₪ עבור יונתן (חוג אומנות, ימי ראשון 17:30).\nאפשר לשלם בביט, בפייבוקס או בהעברה בנקאית.\nתודה רבה! דליה 🎨';
    var sheet = '<div class="yd-sheet"><div class="grab"></div><div style="display:flex;justify-content:space-between;align-items:center"><h2 class="yd-heading" style="font-size:19px"><span class="yd-dab"></span>תזכורת למשפחת ' + f.name + '</h2>' + ic('x') + '</div>' +
      '<div class="yd-field"><label>נשלח אל</label><div class="yd-row"><span class="yd-choice on" style="flex:1">' + ic('user', 'sm') + 'אורית · אמא<span class="ltr tnum small muted" style="margin-inline-start:auto">' + f.mom[1] + '</span></span></div><span class="small muted">איש הקשר המועדף לתזכורות · <span style="color:var(--teal-ink)">החלפה לאבא</span></span></div>' +
      '<div class="yd-chatbg"><div class="yd-bubble">' + msg + '</div></div>' +
      '<div class="small muted" style="display:flex;gap:6px;align-items:center">' + ic('clock', 'sm') + 'תזכורת קודמת נשלחה ב-<span class="tnum">' + f.reminder + '</span></div>' +
      C.button('פתיחה ב-WhatsApp', 'whatsapp', { size: 'lg', block: true, icon: 'chat' }) + C.button('עריכת ההודעה', 'ghost', { block: true, icon: 'edit' }) + '</div>';
    var overlay = '<div style="position:absolute;inset:0;background:var(--scrim);display:flex;align-items:flex-end;justify-content:center">' + sheet.replace('class="yd-sheet"', 'class="yd-sheet" style="width:100%"') + '</div>';
    return '<div class="yd" style="display:flex;gap:40px;padding:32px;justify-content:center;background:var(--paper-sunk)">' + phone(S.mobileBody(false), 0, overlay).replace('class="yd yd-phone"', 'class="yd yd-phone" style="height:844px"') + '</div>';
  };

  window.YaDa = {
    icons: P, ic: ic, mark: mark, logo: logo, illustration: illustration, brush: brush,
    data: { classes: CLASSES, families: FAMILIES, payments: PAYMENTS, receipts: RECEIPTS, methods: METHODS, totals: totals, unpaid: unpaidFamilies },
    c: C, screens: S,
    mount: function (id, html, wrapClass) {
      var el = document.getElementById(id);
      document.documentElement.setAttribute('dir', 'rtl'); document.documentElement.setAttribute('lang', 'he');
      el.innerHTML = '<div class="yd ' + (wrapClass || '') + '">' + html + '</div>';
    }
  };
})();
