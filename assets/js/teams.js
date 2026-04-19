(function () {
  const M = window.ULLHMetrics;
  const C = window.ULLHCharts;
  const CFG = window.ULLH_CONFIG;

  function qs(name) {
    return new URL(location.href).searchParams.get(name);
  }

  function getTeam() {
    const slug = qs('team') || CFG.teamsOnly[0].slug;
    return CFG.teamsOnly.find((t) => t.slug === slug) || CFG.teamsOnly[0];
  }

  function populateSelector(current) {
    const sel = document.getElementById('team-select');
    sel.innerHTML = CFG.teamsOnly.map((t) => `<option value="${t.slug}" ${t.slug === current.slug ? 'selected' : ''}>${t.name}</option>`).join('');
    sel.addEventListener('change', (e) => {
      location.href = `teams.html?team=${e.target.value}`;
    });
  }

  function renderHero(team, snapshot) {
    document.getElementById('team-mark').style.background = `linear-gradient(135deg, ${team.color}88, ${team.color})`;
    document.getElementById('team-mark').textContent = team.short;
    document.getElementById('team-name').textContent = team.name;
    const deltaPct = M.formatDelta(snapshot.subsDeltaPct, true);
    document.getElementById('team-meta').innerHTML = `
      <strong>${M.formatNumber(snapshot.subs, { compact: true })}</strong> followers &middot;
      <span class="delta ${deltaPct.klass}">${deltaPct.text}</span> za 7 d &middot;
      <strong>${snapshot.posts}</strong> postů za 7 d`;
    document.getElementById('all-posts-link').href = `posts.html?team=${team.slug}`;
  }

  function platformCard(platformKey, platformMeta, subs, subsDelta, posts, er) {
    const d = M.formatDelta(subsDelta);
    return `
      <div class="kpi">
        <div class="kpi__label"><span class="badge ${platformKey}">${platformMeta.label}</span></div>
        <div class="kpi__value">${M.formatNumber(subs, { compact: true })}<span class="kpi__unit">followers</span></div>
        <div class="kpi__delta ${d.klass}">${d.text} za 7 d</div>
        <div class="kpi__sub">${posts} postů · Ø ER ${(er * 100).toFixed(2)}%</div>
      </div>`;
  }

  function renderPlatforms(team, data) {
    const grid = document.getElementById('platform-cards');
    const md = M.maxDate([...data.accounts, ...data.posts]);
    const from = M.addDays(md, -7);
    const entries = Object.entries(CFG.platforms).sort((a, b) => a[1].order - b[1].order);
    const html = entries.map(([platformName, meta]) => {
      const latestNow = M.latestSubs(data.accounts, team.slug, meta.key);
      if (!latestNow) {
        return `<div class="kpi" style="opacity: 0.5">
          <div class="kpi__label"><span class="badge ${meta.key}">${meta.label}</span></div>
          <div class="kpi__value" style="font-size: 18px; color: var(--muted)">Bez účtu</div>
          <div class="kpi__sub">Tým nemá na ${meta.label} profil v datech</div>
        </div>`;
      }
      const subs = latestNow.subs;
      const rowsBeforeAll = data.accounts.filter((r) => r.team === team.slug && r.platform === meta.key);
      const earliestBefore = rowsBeforeAll.filter((r) => r.day <= from.toISOString().slice(0, 10));
      const before = earliestBefore.length
        ? earliestBefore.reduce((a, b) => a.date > b.date ? a : b).subs
        : (rowsBeforeAll.length ? rowsBeforeAll.reduce((a, b) => a.date < b.date ? a : b).subs : subs);
      const subsDelta = subs - before;
      const windowPosts = data.posts.filter((p) => p.team === team.slug && p.platform === meta.key && p.date >= from);
      const er = M.avgEr(windowPosts);
      return platformCard(meta.key, meta, subs, subsDelta, windowPosts.length, er);
    }).join('');
    grid.innerHTML = html;
  }

  function renderSubsChart(team, data) {
    const series = [];
    const entries = Object.entries(CFG.platforms).sort((a, b) => a[1].order - b[1].order);
    for (const [platformName, meta] of entries) {
      const points = M.subsByDate(data.accounts, team.slug, meta.key).map((r) => [r.day, r.subs]);
      if (points.length) series.push({ name: meta.label, color: meta.color, points });
    }
    if (!series.length) {
      document.getElementById('chart-subs').innerHTML = '<div class="empty">Pro tento tým zatím nejsou v datech žádné snapshoty.</div>';
      return;
    }
    C.teamSubsTrend(document.getElementById('chart-subs'), series);
  }

  function renderTopPosts(team, data) {
    const md = M.maxDate(data.posts);
    const from = M.addDays(md, -28);
    const posts = data.posts
      .filter((p) => p.team === team.slug && p.date >= from && (p.impressions >= 50 || p.views >= 50))
      .sort((a, b) => b.er - a.er)
      .slice(0, 10);
    const container = document.getElementById('top-posts');
    if (!posts.length) {
      container.innerHTML = '<div class="empty">Žádné posty s dostatečným dosahem.</div>';
      return;
    }
    const fmt = new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'numeric' });
    container.innerHTML = `<table class="table"><thead><tr>
      <th>Datum</th><th>Formát</th><th>Post</th><th style="text-align:right">ER</th><th style="text-align:right">Eng.</th>
    </tr></thead><tbody>
    ${posts.map((p) => `<tr>
      <td>${fmt.format(p.date)}</td>
      <td><span class="badge ${p.platform}">${CFG.formatLabels[p.format] || p.format || '—'}</span></td>
      <td class="caption-cell"><a href="${p.permalink}" target="_blank" rel="noopener">${(p.caption || '(bez popisku)').slice(0, 100).replace(/</g,'&lt;')}</a></td>
      <td style="text-align:right"><strong>${(p.er * 100).toFixed(2)}%</strong></td>
      <td style="text-align:right">${M.formatNumber(p.engagement)}</td>
    </tr>`).join('')}
    </tbody></table>`;
  }

  function renderActivityChart(team, data) {
    const md = M.maxDate(data.posts);
    const from = M.addDays(md, -28);
    const posts = data.posts.filter((p) => p.team === team.slug && p.date >= from);
    const formats = ['photo', 'reel', 'video', 'story', 'carousel', 'short', 'text'];
    const platformKeys = ['ig', 'fb', 'tt', 'yt'];
    const series = formats.map((fmt) => ({
      name: CFG.formatLabels[fmt] || fmt,
      type: 'bar',
      stack: 'total',
      data: platformKeys.map((pk) => posts.filter((p) => p.platform === pk && p.format === fmt).length),
      emphasis: { focus: 'series' },
    })).filter((s) => s.data.some((v) => v > 0));
    C.init(document.getElementById('chart-activity'), {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { top: 0, itemWidth: 10, itemHeight: 8 },
      grid: { top: 32, left: 48, right: 16, bottom: 20 },
      xAxis: { type: 'value' },
      yAxis: { type: 'category', data: platformKeys.map((pk) => Object.values(CFG.platforms).find((p) => p.key === pk)?.label || pk).reverse() },
      series: series.map((s) => ({ ...s, data: s.data.slice().reverse(), barMaxWidth: 24 })),
    });
  }

  function renderMeta(data) {
    const md = M.maxDate([...data.accounts, ...data.posts]);
    const fmt = new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' }).format(md);
    document.getElementById('meta').innerHTML = `Data ke dni <strong>${fmt}</strong>${data.fromCache ? ' · z cache' : ''}`;
  }

  async function init() {
    const team = getTeam();
    populateSelector(team);
    try {
      const data = await window.ULLHData.load();
      renderMeta(data);
      const snapshot = M.teamSnapshot(data, team.slug, 7);
      renderHero(team, snapshot);
      renderPlatforms(team, data);
      renderSubsChart(team, data);
      renderTopPosts(team, data);
      renderActivityChart(team, data);
    } catch (err) {
      console.error(err);
      document.getElementById('platform-cards').innerHTML = `<div class="panel" style="grid-column: 1 / -1"><div class="panel__note" style="border-color: var(--bad); color: var(--bad)">${String(err && err.message || err)}</div></div>`;
    }
  }

  init();
})();
