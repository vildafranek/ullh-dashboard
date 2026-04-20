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

  function leaderboardTable(rows, { showScore = true } = {}) {
    const table = el('table', { class: 'leaderboard' });
    const extraScore = showScore ? '<th style="text-align:right">Skóre</th>' : '';
    table.innerHTML = `
      <thead>
        <tr>
          <th style="width: 48px">#</th>
          <th>Účet</th>
          <th style="text-align:right">Followers</th>
          <th style="text-align:right">Δ 28 d</th>
          <th style="text-align:right">Postů</th>
          <th style="text-align:right">Zhlédnutí</th>
          <th style="text-align:right">Engagement</th>
          <th style="text-align:right">Ø ER</th>
          ${extraScore}
        </tr>
      </thead>
      <tbody></tbody>`;
    const tbody = table.querySelector('tbody');
    rows.forEach((r, i) => {
      const tr = el('tr', { class: i === 0 && showScore ? 'top1' : '' });
      const subsDelta = M.formatDelta(r.subsDelta);
      const scoreCell = showScore ? `<td style="text-align:right"><strong>${(r.score * 100).toFixed(0)}</strong></td>` : '';
      tr.innerHTML = `
        <td><span class="rank">${i + 1}</span></td>
        <td><div class="team">${teamBadge(r.team)}<span>${r.team.name}</span></div></td>
        <td style="text-align:right">${M.formatNumber(r.subs, { compact: true })}</td>
        <td style="text-align:right"><span class="delta ${subsDelta.klass}">${subsDelta.text}</span></td>
        <td style="text-align:right">${r.posts}</td>
        <td style="text-align:right">${M.formatNumber(r.views, { compact: true })}</td>
        <td style="text-align:right">${M.formatNumber(r.engagement, { compact: true })}</td>
        <td style="text-align:right">${M.formatNumber(r.er, { percent: true, digits: 2 })}</td>
        ${scoreCell}`;
      if (r.team.kind === 'team') {
        tr.addEventListener('click', () => { location.href = `teams.html?team=${r.team.slug}`; });
      } else {
        tr.style.cursor = 'default';
      }
      tbody.appendChild(tr);
    });
    return table;
  }

  function renderLeaderboards(data) {
    const rowsTeam = M.leaderboard(data, { kind: 'team', windowDays: 28 });
    const wrapT = document.getElementById('leaderboard-wrap');
    wrapT.innerHTML = '';
    wrapT.appendChild(leaderboardTable(rowsTeam, { showScore: true }));

    const rowsLiga = M.leaderboard(data, { kind: 'liga', windowDays: 28 });
    const wrapL = document.getElementById('liga-wrap');
    if (wrapL) {
      wrapL.innerHTML = '';
      if (rowsLiga.length) wrapL.appendChild(leaderboardTable(rowsLiga, { showScore: false }));
      else wrapL.innerHTML = '<div class="empty">Žádná data pro ligové/event stránky.</div>';
    }
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
