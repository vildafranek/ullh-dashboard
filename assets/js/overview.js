(function () {
  const M = window.ULLHMetrics;
  const C = window.ULLHCharts;
  const CFG = window.ULLH_CONFIG;

  function el(tag, attrs = {}, children = []) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    }
    for (const c of [].concat(children)) {
      if (c == null) continue;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return e;
  }

  function kpiCard({ label, value, unit, delta, sub }) {
    const deltaHtml = delta ? `<div class="kpi__delta ${delta.klass}">${delta.text}</div>` : '';
    const subHtml = sub ? `<div class="kpi__sub">${sub}</div>` : '';
    return el('div', { class: 'kpi', html: `
      <div class="kpi__label">${label}</div>
      <div class="kpi__value">${value}${unit ? `<span class="kpi__unit">${unit}</span>` : ''}</div>
      ${deltaHtml}${subHtml}
    ` });
  }

  const teamBadge = window.ULLHUi.teamBadge;

  function renderKpis(totals) {
    const grid = document.getElementById('kpi-grid');
    grid.innerHTML = '';
    const subsDelta = M.formatDelta(totals.subsDelta);
    const subsPct = M.formatDelta(totals.subsDeltaPct, true);
    const engDeltaPct = totals.engagementPrev > 0
      ? M.formatDelta((totals.engagement - totals.engagementPrev) / totals.engagementPrev, true)
      : { text: '—', klass: 'flat' };
    const viewsDeltaPct = totals.viewsPrev > 0
      ? M.formatDelta((totals.views - totals.viewsPrev) / totals.viewsPrev, true)
      : { text: '—', klass: 'flat' };
    const postsDelta = M.formatDelta(totals.posts - totals.postsPrev);

    const reachDeltaPct = totals.reachPrev > 0
      ? M.formatDelta((totals.reach - totals.reachPrev) / totals.reachPrev, true)
      : { text: '—', klass: 'flat' };

    grid.appendChild(kpiCard({
      label: 'Celkem followers',
      value: M.formatNumber(totals.subs, { compact: true }),
      delta: subsDelta,
      sub: `${subsPct.text} za ${totals.windowDays} d &middot; 11 týmů + 8 ligových účtů`,
    }));
    grid.appendChild(kpiCard({
      label: 'Dosah (reach, 28 d)',
      value: M.formatNumber(totals.reach, { compact: true }),
      delta: reachDeltaPct,
      sub: 'Unikátní účty zasažené obsahem &middot; klouzavé okno 28 dní, poslední snapshot. Δ vs. stav před 7 dny.',
    }));
    grid.appendChild(kpiCard({
      label: `Zhlédnutí za ${totals.windowDays} dní`,
      value: M.formatNumber(totals.views, { compact: true }),
      delta: viewsDeltaPct,
      sub: `Z toho stories ${totals.windowDays} d: ${M.formatNumber(totals.storiesViews, { compact: true })} · týmy + ligové účty`,
    }));
    grid.appendChild(kpiCard({
      label: `Engagement ${totals.windowDays} d`,
      value: M.formatNumber(totals.engagement, { compact: true }),
      delta: engDeltaPct,
      sub: 'Likes + komentáře + sdílení',
    }));
    grid.appendChild(kpiCard({
      label: `Publikováno ${totals.windowDays} d`,
      value: M.formatNumber(totals.posts),
      delta: postsDelta,
      sub: `Napříč ${totals.teamCount} účty`,
    }));
    const fg = totals.fastestGrowing;
    grid.appendChild(kpiCard({
      label: 'Nejrychlejší růst',
      value: fg && fg.team ? (fg.team.short || fg.team.name) : '—',
      sub: fg ? `${fg.team.name} &middot; ${M.formatDelta(fg.subsDelta).text} followers (${M.formatDelta(fg.subsDeltaPct, true).text})` : '',
    }));
  }

  // Stav řazení per leaderboard wrapper
  const sortStates = new WeakMap();

  function leaderboardTable(rows, { showScore = true, wrapEl = null } = {}) {
    const columns = [
      { key: 'rank',      label: '#',        align: 'left',  sortable: false, width: '48px' },
      { key: 'team',      label: 'Účet',     align: 'left',  sortable: true,  get: (r) => r.team.name.toLowerCase() },
      { key: 'subs',      label: 'Followers',  align: 'right', sortable: true, get: (r) => r.subs,        cell: (r) => M.formatNumber(r.subs, { compact: true }) },
      { key: 'subsDelta', label: 'Δ 28 d',     align: 'right', sortable: true, get: (r) => r.subsDelta,   cell: (r) => { const d = M.formatDelta(r.subsDelta); return `<span class="delta ${d.klass}">${d.text}</span>`; } },
      { key: 'posts',     label: 'Postů',      align: 'right', sortable: true, get: (r) => r.posts,       cell: (r) => r.posts },
      { key: 'views',     label: 'Zhlédnutí',  align: 'right', sortable: true, get: (r) => r.views,       cell: (r) => M.formatNumber(r.views, { compact: true }) },
      { key: 'engagement',label: 'Engagement', align: 'right', sortable: true, get: (r) => r.engagement,  cell: (r) => M.formatNumber(r.engagement, { compact: true }) },
      { key: 'er',        label: 'Ø ER',       align: 'right', sortable: true, get: (r) => r.er,          cell: (r) => M.formatNumber(r.er, { percent: true, digits: 2 }) },
    ];
    if (showScore) {
      columns.push({ key: 'score', label: 'Skóre', align: 'right', sortable: true, get: (r) => r.score, cell: (r) => {
        const tip = `Velikost ${(r.sizeScore*100).toFixed(0)} · Aktivita ${(r.activityScore*100).toFixed(0)} · Engagement ${(r.engagementScore*100).toFixed(0)} · Růst ${(r.growthScore*100).toFixed(0)} | Složené ${(r.scoreComposite*100).toFixed(0)} · Síla ${(r.scoreStrength*100).toFixed(0)} · Aktuální ${(r.scoreCurrent*100).toFixed(0)}`;
        return `<strong title="${tip}">${(r.score * 100).toFixed(0)}</strong>`;
      } });
    }

    const stateKey = wrapEl || rows;
    let state = sortStates.get(stateKey);
    if (!state) {
      state = { col: showScore ? 'score' : 'subs', dir: 'desc' };
      sortStates.set(stateKey, state);
    }

    const table = el('table', { class: 'leaderboard' });
    const sorted = rows.slice().sort((a, b) => {
      const col = columns.find((c) => c.key === state.col) || columns[2];
      const av = col.get ? col.get(a) : 0;
      const bv = col.get ? col.get(b) : 0;
      const cmp = (av > bv ? 1 : av < bv ? -1 : 0);
      return state.dir === 'asc' ? cmp : -cmp;
    });

    const ths = columns.map((c) => {
      const cls = c.sortable ? (c.key === state.col ? `sortable sorted-${state.dir}` : 'sortable') : '';
      const styleW = c.width ? `width: ${c.width};` : '';
      const style = `${styleW} text-align: ${c.align};`;
      return `<th class="${cls}" data-col="${c.key}" style="${style}">${c.label}</th>`;
    }).join('');
    const trs = sorted.map((r, i) => {
      const isTop = i === 0 && state.col === 'score' && state.dir === 'desc' && showScore;
      const cells = columns.map((c) => {
        if (c.key === 'rank') return `<td><span class="rank">${i + 1}</span></td>`;
        if (c.key === 'team') return `<td><div class="team">${teamBadge(r.team)}<span>${r.team.name}</span></div></td>`;
        const style = `text-align: ${c.align};`;
        return `<td style="${style}">${c.cell(r)}</td>`;
      }).join('');
      return `<tr class="${isTop ? 'top1' : ''}" data-team="${r.team.slug}" data-team-kind="${r.team.kind || 'team'}">${cells}</tr>`;
    }).join('');
    table.innerHTML = `<thead><tr>${ths}</tr></thead><tbody>${trs}</tbody>`;

    // Sort interaction
    table.querySelectorAll('th.sortable').forEach((th) => {
      th.style.cursor = 'pointer';
      th.addEventListener('click', () => {
        const col = th.dataset.col;
        if (state.col === col) state.dir = state.dir === 'asc' ? 'desc' : 'asc';
        else { state.col = col; state.dir = 'desc'; }
        const newTable = leaderboardTable(rows, { showScore, wrapEl });
        th.closest('table').replaceWith(newTable);
      });
    });

    // Row click → drill-down
    table.querySelectorAll('tbody tr').forEach((tr) => {
      const slug = tr.dataset.team;
      const kind = tr.dataset.teamKind;
      if (kind === 'team') {
        tr.style.cursor = 'pointer';
        tr.addEventListener('click', () => { location.href = `teams.html?team=${slug}`; });
      }
    });
    return table;
  }

  let currentScoreVariant = 'composite';
  let cachedData = null;

  function renderLeaderboards(data) {
    cachedData = data;
    const rowsTeam = M.leaderboard(data, { kind: 'team', windowDays: 28, scoreVariant: currentScoreVariant });
    const wrapT = document.getElementById('leaderboard-wrap');
    wrapT.innerHTML = '';
    wrapT.appendChild(leaderboardTable(rowsTeam, { showScore: true, wrapEl: wrapT }));

    const rowsLiga = M.leaderboard(data, { kind: 'liga', windowDays: 28, scoreVariant: currentScoreVariant });
    const wrapL = document.getElementById('liga-wrap');
    if (wrapL) {
      wrapL.innerHTML = '';
      if (rowsLiga.length) wrapL.appendChild(leaderboardTable(rowsLiga, { showScore: false, wrapEl: wrapL }));
      else wrapL.innerHTML = '<div class="empty">Žádná data pro ligové/event stránky.</div>';
    }
  }

  function setupScoreVariant() {
    const buttons = document.querySelectorAll('#score-variant .platform-btn');
    if (!buttons.length) return;
    buttons.forEach((b) => b.addEventListener('click', () => {
      buttons.forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      currentScoreVariant = b.dataset.variant;
      // Reset sort state for both leaderboards (now want default by new score)
      const wrapT = document.getElementById('leaderboard-wrap');
      const wrapL = document.getElementById('liga-wrap');
      sortStates.delete(wrapT);
      sortStates.delete(wrapL);
      if (cachedData) renderLeaderboards(cachedData);
    }));
  }

  function renderCharts(data) {
    C.platformMix(document.getElementById('chart-platform-mix'), M.platformMixByTeam(data, { kind: 'team' }));
    const ligaMixEl = document.getElementById('chart-platform-mix-liga');
    if (ligaMixEl) C.platformMix(ligaMixEl, M.platformMixByTeam(data, { kind: 'liga' }));
    C.teamActivityHeat(document.getElementById('chart-heatmap'), data);
    C.growthTrend(document.getElementById('chart-growth'), M.weeklyTrendByTeam(data));
  }

  function renderMeta(data) {
    const md = M.maxDate([...data.accounts, ...data.posts]);
    const fmt = new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' }).format(md);
    document.getElementById('meta').innerHTML = `Data ke dni <strong>${fmt}</strong>${data.fromCache ? ' · z cache' : ''}`;
    const fetched = new Date(data.fetchedAt || Date.now());
    document.getElementById('fetched-at').textContent = 'Načteno ' + new Intl.DateTimeFormat('cs-CZ', {
      day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit',
    }).format(fetched);
  }

  function renderError(err) {
    document.getElementById('kpi-grid').innerHTML = `
      <div class="panel" style="grid-column: 1 / -1">
        <div class="panel__title" style="color: var(--bad)">Nepodařilo se načíst data</div>
        <div class="panel__note">${String(err && err.message || err)}</div>
        <div class="panel__note">Ověř, že Sheet je publikován na web (Soubor → Sdílet → Publikovat na web → CSV) a že URL v <code>assets/js/config.js</code> jsou aktuální.</div>
      </div>`;
  }

  async function init() {
    try {
      const data = await window.ULLHData.load();
      renderMeta(data);
      renderKpis(M.leagueTotals(data, 7, { kind: 'all' }));
      renderLeaderboards(data);
      setupScoreVariant();
      renderCharts(data);
    } catch (err) {
      console.error(err);
      renderError(err);
    }
  }

  document.getElementById('refresh').addEventListener('click', async (e) => {
    e.preventDefault();
    window.ULLHData.clearCache();
    location.reload();
  });

  init();
})();
