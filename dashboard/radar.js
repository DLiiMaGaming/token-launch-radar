(function () {
  'use strict';

  var D = window.RADAR || null;
  var entries = (D && D.rows) || [];
  var liveRows = (D && D.live) || [];
  var multRows = (D && D.multiples) || [];
  var summary = (D && D.stats) || {};
  var tuning = (D && D.tuning) || {};

  /* ---------------- formatting ---------------- */
  function escHtml(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function trimZeros(s) { return s.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1'); }
  function money(n) {
    if (n == null || !isFinite(n)) return '—';
    var a = Math.abs(n), text;
    if (a >= 1e9) text = (n / 1e9).toFixed(2) + 'B';
    else if (a >= 1e6) text = trimZeros((n / 1e6).toFixed(1)) + 'M';
    else if (a >= 1e3) text = trimZeros((n / 1e3).toFixed(1)) + 'K';
    else text = String(Math.round(n));
    return '$' + text;
  }
  function moneyFull(n) {
    if (n == null || !isFinite(n)) return '—';
    return '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function pctHtml(n) {
    if (n == null || !isFinite(n)) return '<span class="dim">—</span>';
    var cls = n > 0 ? 'up' : (n < 0 ? 'down' : 'dim');
    return '<span class="' + cls + '">' + (n > 0 ? '+' : '') + n.toFixed(1) + '%</span>';
  }
  function ageLabel(days) {
    if (days == null || !isFinite(days)) return '—';
    if (days < 365) return days + ' d';
    return (days / 365).toFixed(1) + ' y';
  }
  function multLabel(n) {
    if (n == null || !isFinite(n)) return '—';
    return '×' + Number(n).toFixed(2);
  }
  function chainsLabel(chains) {
    if (!chains || !chains.length) return '—';
    if (chains.length === 1) return escHtml(chains[0]);
    return escHtml(chains[0]) + ' <span class="dim">+' + (chains.length - 1) + '</span>';
  }
  function constLabel(v) {
    if (typeof v === 'number') return trimZeros(String(Math.round(v * 10000) / 10000));
    return escHtml(v);
  }
  function prettyName(k) { return String(k).replace(/_/g, ' '); }

  /* ---------------- state ---------------- */
  var view = {
    pane: 'board', query: '', category: '', chain: '', floor: 0, watchOnly: false,
    sortBy: 'rank', sortAsc: true, detail: null
  };

  var COLUMNS = [
    { key: 'rank', head: '#', num: true, val: function (r) { return r.rank; } },
    { key: 'name', head: 'Protocol', num: false, val: function (r) { return (r.name || '').toLowerCase(); } },
    { key: 'category', head: 'Category', num: false, val: function (r) { return (r.category || '').toLowerCase(); } },
    { key: 'tvlUsd', head: 'TVL', num: true, val: function (r) { return r.tvlUsd; } },
    { key: 'change7d', head: '7d %', num: true, val: function (r) { return r.change7d == null ? -Infinity : r.change7d; } },
    { key: 'ageDays', head: 'Age', num: true, val: function (r) { return r.ageDays == null ? -Infinity : r.ageDays; } },
    { key: 'multiple', head: 'Multiple', num: true, val: function (r) { return r.multiple == null ? -Infinity : r.multiple; } },
    { key: 'impliedUsd', head: 'Implied value', num: true, val: function (r) { return r.impliedUsd; } },
    { key: 'chains', head: 'Chains', num: false, val: function (r) { return (r.chains && r.chains[0] || '').toLowerCase(); } }
  ];

  function byId(id) { return document.getElementById(id); }

  /* ---------------- header ---------------- */
  function drawHeader() {
    if (!D) return;
    byId('tagline').textContent = 'Pre-token protocols ranked by implied launch value · data as of ' +
      (D.asOf || '—') + ' · DefiLlama snapshot';
    byId('formula-line').innerHTML = '<strong>How to read this:</strong> Implied value = TVL &times; category multiple ' +
      '(from tokenized peers) &times; growth &times; maturity &times; reach — full method in the Method tab.';
    var covered = summary.watchlistCovered != null ? summary.watchlistCovered : entries.filter(function (r) { return r.onWatchlist; }).length;
    var total = summary.watchlistSize != null ? summary.watchlistSize : covered;
    var tiles = [
      { v: summary.protocols != null ? summary.protocols : '—', l: 'Protocols scanned' },
      { v: summary.boardRows != null ? summary.boardRows : entries.length, l: 'Pre-token ranked' },
      { v: covered + '/' + total, l: 'Watchlist covered', hot: true },
      { v: summary.liveRows != null ? summary.liveRows : liveRows.length, l: 'Live tokens tracked' },
      { v: D.modelVersion || '—', l: 'Model' }
    ];
    byId('tiles').innerHTML = tiles.map(function (t) {
      return '<div class="tile' + (t.hot ? ' hot' : '') + '"><div class="tv">' + escHtml(t.v) +
        '</div><div class="tl">' + escHtml(t.l) + '</div></div>';
    }).join('');
  }

  /* ---------------- filters ---------------- */
  function fillOptions(sel, values, allText) {
    var html = '<option value="">' + escHtml(allText) + '</option>';
    values.forEach(function (v) { html += '<option value="' + escHtml(v) + '">' + escHtml(v) + '</option>'; });
    sel.innerHTML = html;
  }
  function wireFilters() {
    var cats = {}, chains = {};
    entries.forEach(function (r) {
      if (r.category) cats[r.category] = true;
      (r.chains || []).forEach(function (c) { chains[c] = true; });
    });
    fillOptions(byId('catSel'), Object.keys(cats).sort(), 'All categories');
    fillOptions(byId('chainSel'), Object.keys(chains).sort(), 'All chains');
    byId('q').addEventListener('input', function (e) { view.query = e.target.value.trim().toLowerCase(); drawBoard(); });
    byId('catSel').addEventListener('change', function (e) { view.category = e.target.value; drawBoard(); });
    byId('chainSel').addEventListener('change', function (e) { view.chain = e.target.value; drawBoard(); });
    byId('tvlSel').addEventListener('change', function (e) { view.floor = Number(e.target.value) || 0; drawBoard(); });
    byId('wlOnly').addEventListener('change', function (e) { view.watchOnly = e.target.checked; drawBoard(); });
  }
  function matching() {
    return entries.filter(function (r) {
      if (view.watchOnly && !r.onWatchlist) return false;
      if (view.category && r.category !== view.category) return false;
      if (view.chain && (r.chains || []).indexOf(view.chain) === -1) return false;
      if (view.floor && !(r.tvlUsd >= view.floor)) return false;
      if (view.query) {
        var hay = ((r.name || '') + ' ' + (r.slug || '')).toLowerCase();
        if (hay.indexOf(view.query) === -1) return false;
      }
      return true;
    });
  }

  /* ---------------- board ---------------- */
  function drawHead() {
    byId('boardHead').innerHTML = '<tr>' + COLUMNS.map(function (c) {
      var mark = '';
      if (view.sortBy === c.key) mark = ' <span>' + (view.sortAsc ? '▲' : '▼') + '</span>';
      return '<th class="sortable' + (c.num ? ' num' : '') + '" data-key="' + escHtml(c.key) + '">' + escHtml(c.head) + mark + '</th>';
    }).join('') + '</tr>';
    Array.prototype.forEach.call(byId('boardHead').querySelectorAll('th'), function (th) {
      th.addEventListener('click', function () {
        var k = th.getAttribute('data-key');
        if (view.sortBy === k) view.sortAsc = !view.sortAsc;
        else { view.sortBy = k; view.sortAsc = true; }
        drawBoard();
      });
    });
  }
  function drawBoard() {
    drawHead();
    var list = matching();
    var col = COLUMNS.filter(function (c) { return c.key === view.sortBy; })[0] || COLUMNS[0];
    list.sort(function (a, b) {
      var va = col.val(a), vb = col.val(b);
      if (va < vb) return view.sortAsc ? -1 : 1;
      if (va > vb) return view.sortAsc ? 1 : -1;
      return (a.rank || 0) - (b.rank || 0);
    });
    byId('countLine').textContent = 'Showing ' + list.length + ' of ' + entries.length + ' protocols';
    if (!list.length) {
      byId('boardRows').innerHTML = '<tr class="static"><td colspan="' + COLUMNS.length + '">' +
        '<div class="empty">No protocols match these filters.</div></td></tr>';
      return;
    }
    byId('boardRows').innerHTML = list.map(function (r) {
      return '<tr data-slug="' + escHtml(r.slug) + '">' +
        '<td class="num dim">' + escHtml(r.rank) + '</td>' +
        '<td><span class="pname">' + escHtml(r.name) + '</span>' +
          (r.onWatchlist ? '<span class="tag tag-wl">WL</span>' : '') +
          '<span class="pslug">' + escHtml(r.slug) + '</span></td>' +
        '<td>' + (r.category ? escHtml(r.category) : '<span class="dim">—</span>') + '</td>' +
        '<td class="num">' + money(r.tvlUsd) + '</td>' +
        '<td class="num">' + pctHtml(r.change7d) + '</td>' +
        '<td class="num">' + ageLabel(r.ageDays) + '</td>' +
        '<td class="num">' + multLabel(r.multiple) + '</td>' +
        '<td class="num implied">' + money(r.impliedUsd) + '</td>' +
        '<td>' + chainsLabel(r.chains) + '</td>' +
        '</tr>';
    }).join('');
    Array.prototype.forEach.call(byId('boardRows').querySelectorAll('tr[data-slug]'), function (tr) {
      tr.addEventListener('click', function () { openDetail(tr.getAttribute('data-slug')); });
    });
  }

  /* ---------------- detail ---------------- */
  function waterfall(label, note, value, top) {
    var pct = top > 0 ? Math.max(2, Math.min(100, (value / top) * 100)) : 0;
    return '<div class="water-row"><span class="wr-label">' + label +
      ' <span class="muted">' + note + '</span></span>' +
      '<span class="wr-val">' + moneyFull(value) + '</span>' +
      '<span class="wr-bar"><i style="width:' + pct.toFixed(1) + '%"></i></span></div>';
  }
  function statCell(label, valueHtml) {
    return '<div class="stat"><div class="flab">' + escHtml(label) + '</div><div class="sv">' + valueHtml + '</div></div>';
  }
  function openDetail(slug) {
    var r = null;
    entries.forEach(function (x) { if (x.slug === slug) r = x; });
    if (!r) return;
    view.detail = slug;
    var base = (r.tvlUsd || 0) * (r.multiple || 0);
    var grown = base * (r.growthMult || 1);
    var aged = grown * (r.ageMult || 1);
    var implied = r.impliedUsd || aged * (r.reachMult || 1);
    var top = Math.max(implied, base, grown, aged, 1);
    var badges = '';
    if (r.onWatchlist) badges += '<span class="tag tag-wl">WL · Watchlist</span> ';
    if (r.category) badges += '<span class="tag tag-cat">' + escHtml(r.category) + '</span> ';
    badges += '<span class="tag tag-plain">Pre-token</span>';
    var plan = (r.farmSteps || []).map(function (s, i) {
      return '<li><span class="n">' + (i + 1) + '</span><span>' + escHtml(s) + '</span></li>';
    }).join('');
    var peerText = r.peers === 1 ? '1 tokenized peer' : escHtml(r.peers != null ? r.peers : '—') + ' tokenized peers';
    byId('detailOut').innerHTML =
      '<div class="detail-head"><h2>' + escHtml(r.name) + '</h2>' + badges + '</div>' +
      '<p class="detail-sub">' + escHtml(r.slug) + ' · board rank #' + escHtml(r.rank) + '</p>' +
      '<div class="big-value"><div class="bl">Implied launch value</div><div class="bv">' + moneyFull(implied) + '</div></div>' +
      '<div class="stat-grid">' +
        statCell('TVL', moneyFull(r.tvlUsd)) +
        statCell('7d change', r.change7d == null ? '—' : (r.change7d > 0 ? '+' : '') + Number(r.change7d).toFixed(1) + '%') +
        statCell('Age', ageLabel(r.ageDays)) +
        statCell('Listed', r.listedAt ? escHtml(r.listedAt) : '—') +
        statCell('Chains', (r.chains && r.chains.length) ? escHtml(r.chains.join(', ')) : '—') +
        statCell('Category multiple', multLabel(r.multiple)) +
      '</div>' +
      '<div class="panel"><h3>How the model gets there</h3>' +
        waterfall('Base', 'TVL ' + money(r.tvlUsd) + ' × category multiple ' + multLabel(r.multiple) +
          ' (from ' + peerText + ')', base, top) +
        waterfall('Growth', '× growth multiplier ' + multLabel(r.growthMult) + ' from the 7-day TVL change', grown, top) +
        waterfall('Maturity', '× maturity multiplier ' + multLabel(r.ageMult) + ' from protocol age', aged, top) +
        waterfall('Reach', '× reach multiplier ' + multLabel(r.reachMult) + ' from chain footprint', implied, top) +
        '<div class="total-row"><span>Implied value</span><span class="tv">' + moneyFull(implied) + '</span></div>' +
      '</div>' +
      (plan ? '<div class="panel"><h3>Farm plan</h3><ol class="farm">' + plan + '</ol></div>' : '') +
      '<p class="note">Implied value is this model&rsquo;s claim from snapshot figures, not a promise of a launch or an airdrop.</p>';
    switchPane('detail');
    window.scrollTo(0, 0);
  }

  /* ---------------- live ---------------- */
  function drawLive() {
    if (!liveRows.length) {
      byId('liveRows').innerHTML = '<tr class="static"><td colspan="6"><div class="empty">No live tokens in this snapshot.</div></td></tr>';
      return;
    }
    byId('liveRows').innerHTML = liveRows.map(function (r) {
      var ratio = r.ratio != null ? r.ratio : (r.mcapUsd != null && r.tvlUsd ? r.mcapUsd / r.tvlUsd : null);
      return '<tr class="static">' +
        '<td><span class="pname">' + escHtml(r.name) + '</span><span class="pslug">' + escHtml(r.slug) + '</span></td>' +
        '<td>' + (r.category ? escHtml(r.category) : '<span class="dim">—</span>') + '</td>' +
        '<td class="num">' + money(r.tvlUsd) + '</td>' +
        '<td class="num">' + money(r.mcapUsd) + '</td>' +
        '<td class="num">' + multLabel(ratio) + '</td>' +
        '<td class="num">' + pctHtml(r.change7d) + '</td></tr>';
    }).join('');
  }

  /* ---------------- method ---------------- */
  function drawMethod() {
    var consts = Object.keys(tuning).map(function (k) {
      return '<dt>' + escHtml(prettyName(k)) + '</dt><dd>' + constLabel(tuning[k]) + '</dd>';
    }).join('');
    var catRows = multRows.map(function (c) {
      return '<tr class="static"><td>' + escHtml(c.category) + '</td><td class="num">' + escHtml(c.peers) +
        '</td><td class="num">' + multLabel(c.multiple) + '</td></tr>';
    }).join('');
    byId('methodOut').innerHTML =
      '<div class="panel"><h3>The formula</h3>' +
      '<div class="formula">implied value = <b>TVL</b> &times; <b>category multiple</b> &times; <b>growth</b> &times; <b>maturity</b> &times; <b>reach</b></div>' +
      '<p class="note" style="margin:0">The category multiple is the median market-cap-to-TVL ratio of tokenized ' +
      'protocols in the same category, shrunk toward the overall median when a category has few peers. Growth, maturity and reach ' +
      'then adjust that base for momentum, age and chain footprint, each bounded by the constants below.</p></div>' +
      '<div class="cols2">' +
      '<div class="panel"><h3>Model constants · ' + escHtml(D.modelVersion || '') + '</h3>' +
        (consts ? '<dl class="consts">' + consts + '</dl>' : '<p class="note">No constants published in this snapshot.</p>') + '</div>' +
      '<div class="panel"><h3>Category multiples</h3>' +
        '<div class="scroll" style="max-height:none"><table class="grid"><thead><tr>' +
        '<th>Category</th><th class="num">Tokenized peers</th><th class="num">Multiple</th></tr></thead>' +
        '<tbody>' + (catRows || '<tr class="static"><td colspan="3"><div class="empty">No categories in this snapshot.</div></td></tr>') +
        '</tbody></table></div></div>' +
      '</div>' +
      '<div class="panel"><h3>Methodology</h3><ul class="bullets">' +
      '<li><strong>Comparables come from the snapshot itself.</strong> Every multiple is derived from protocols in this same frozen DefiLlama snapshot that already have a token — no outside price feed is used.</li>' +
      '<li><strong>Shrinkage for thin categories.</strong> When a category has only a handful of tokenized peers, its multiple is pulled toward the global median so one outlier cannot set the price of a whole board.</li>' +
      '<li><strong>Growth, maturity and reach adjustments.</strong> Recent TVL momentum, time since listing and the number of chains a protocol runs on each nudge the base value up or down, within fixed floors and caps.</li>' +
      '<li><strong>Derivatives are excluded.</strong> Wrapped, staked and bridged versions of assets that already trade are not ranked — they would double-count a token that already exists.</li>' +
      '<li><strong>The watchlist is covered in full.</strong> Every watchlist protocol above the floor appears on the board; the board then extends below the floor to surface smaller pre-token protocols early.</li>' +
      '<li><strong>One model for every row.</strong> No protocol is special-cased by name — the same formula and constants score the whole board, so ranks move only when the figures do.</li>' +
      '</ul></div>';
  }

  /* ---------------- panes / tabs ---------------- */
  function switchPane(name) {
    view.pane = name;
    var panes = { board: 'pane-board', live: 'pane-live', method: 'pane-method', detail: 'pane-detail' };
    Object.keys(panes).forEach(function (k) { byId(panes[k]).hidden = k !== name; });
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
      t.classList.toggle('on', t.getAttribute('data-tab') === name || (name === 'detail' && t.getAttribute('data-tab') === 'board'));
    });
  }
  function wireTabs() {
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
      t.addEventListener('click', function () { switchPane(t.getAttribute('data-tab')); });
    });
    byId('backBtn').addEventListener('click', function () { switchPane('board'); });
  }

  /* ---------------- boot ---------------- */
  if (!D) {
    document.querySelector('main').innerHTML = '<p class="fatal">Snapshot data did not load, so the radar has nothing to rank.</p>';
    return;
  }
  drawHeader();
  wireFilters();
  wireTabs();
  drawBoard();
  drawLive();
  drawMethod();
  switchPane('board');
})();
