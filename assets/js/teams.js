(function () {
  const M = window.ULLHMetrics;
  const C = window.ULLHCharts;
  const CFG = window.ULLH_CONFIG;

  // State
  const state = {
    team: null,
    data: null,
    period: { mode: 'days', days: 30 }, // 'days' | 'custom' | 'all'
    customFrom: null,
    customTo: null,
    platformFilter: '', // '', 'ig', 'fb', 'tt', 'yt'
    postSort: { col: 'er', dir: 'desc' },
  };

  function qs(name) { return new URL(location.href).searchParams.get(name); }

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

  function getPeriodRange() {
    const md = M.maxDate([...state.data.accounts, ...state.data.posts]);
    if (state.period.mode === 'custom' && state.customFrom && state.customTo) {
      return { from: state.customFrom, to: state.customTo, label: `${fmtDate(state.customFrom)} – ${fmtDate(state.customTo)}` };
    }
    if (state.period.mode === 'all') {
      const rows = [...state.data.accounts, ...state.data.posts];
      let min = new Date();
      for (const r of rows) if (r.date < min) min = r.date;
      return { from: min, to: md, label: 'Vše (od ' + fmtDate(min) + ')' };
    }
    const days = state.period.days;
    return { from: M.addDays(md, -days), to: md, label: `posledních ${days} dní (k ${fmtDate(md)})` };
  }

  function fmtDate(d) {
    if (!d) return '—';
    return new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }).format(d);
  }

  function teamPostsInRange() {
    const { from, to } = getPeriodRange();
    return state.data.posts.filter((p) => p.team === state.team.slug && p.date >= from && p.date <= to);
  }

  function teamPrevPostsInRange() {
    const { from, to } = getPeriodRange();
    const span = to - from;
    return state.data.posts.filter((p) => p.team === state.team.slug && p.date >= new Date(from - span) && p.date < from);
  }

  function renderHero() {
    const team = state.team;
    const mark = document.getElementById('team-mark');
    const logoSrc = (window.ULLHUi && window.ULLHUi.teamLogoSrc) ? window.ULLHUi.teamLogoSrc(team) : null;
    if (logoSrc) {
      mark.innerHTML = '';
      const img = document.createElement('img');
      img.src = logoSrc; img.alt = team.name;
      img.style.width = '100%'; img.style.height = '100%'; img.style.objectFit = 'contain';
      img.onerror = () => { mark.style.background = `linear-gradient(135deg, ${team.color}88, ${team.color})`; mark.textContent = team.short; };
      mark.appendChild(img);
      mark.style.background = 'transparent';
      mark.style.padding = '6px';
    } else {
      mark.style.background = `linear-gradient(135deg, ${team.color}88, ${team.color})`;
      mark.textContent = team.short;
    }
    document.getElementById('team-name').textContent = team.name;

    const { from, to } = getPeriodRange();
    const subsNow = M.subsSumOnDay(state.data.accounts, team.slug, to);
    const subsBefore = M.subsSumOnDay(state.data.accounts, team.slug, from);
    const delta = subsNow - subsBefore;
    const dPct = subsBefore > 0 ? delta / subsBefore : 0;
    const dPctFmt = M.formatDelta(dPct, true);
    const posts = teamPostsInRange();
    document.getElementById('team-meta').innerHTML = `
      <strong>${M.formatNumber(subsNow, { compact: true })}</strong> followers &middot;
      <span class="delta ${dPctFmt.klass}">${dPctFmt.text}</span> za vybrané období &middot;
      <strong>${posts.length}</strong> publikovaných postů`;
    document.getElementById('all-posts-link').href = `posts.html?team=${team.slug}`;
  }

  function renderSummaryKpis() {
    const grid = document.getElementById('summary-kpis');
    grid.innerHTML = '';
    const { from, to } = getPeriodRange();
    const posts = teamPostsInRange();
    const prev = teamPrevPostsInRange();

    const subsNow = M.subsSumOnDay(state.data.accounts, state.team.slug, to);
    const subsBefore = M.subsSumOnDay(state.data.accounts, state.team.slug, from);
    const subsDelta = subsNow - subsBefore;

    const sumViews = posts.reduce((s, p) => s + (p.views || 0), 0);
    const prevViews = prev.reduce((s, p) => s + (p.views || 0), 0);
    const sumEng = posts.reduce((s, p) => s + p.engagement, 0);
    const prevEng = prev.reduce((s, p) => s + p.engagement, 0);
    const sumReach = posts.reduce((s, p) => s + (p.reach || p.impressions || 0), 0);
    const prevReach = prev.reduce((s, p) => s + (p.reach || p.impressions || 0), 0);

    const card = ({ label, value, delta, sub }) => {
      const div = document.createElement('div');
      div.className = 'kpi';
      const dHtml = delta ? `<div class="kpi__delta ${delta.klass}">${delta.text}</div>` : '';
      const sHtml = sub ? `<div class="kpi__sub">${sub}</div>` : '';
      div.innerHTML = `<div class="kpi__label">${label}</div><div class="kpi__value">${value}</div>${dHtml}${sHtml}`;
      return div;
    };
    const pctDelta = (now, before) => before > 0 ? M.formatDelta((now - before) / before, true) : { text: '—', klass: 'flat' };

    grid.appendChild(card({
      label: 'Růst followerů',
      value: M.formatDelta(subsDelta).text,
      sub: `${M.formatNumber(subsNow, { compact: true })} celkem · ${pctDelta(subsNow, subsBefore).text}`,
    }));
    grid.appendChild(card({
      label: 'Zhlédnutí',
      value: M.formatNumber(sumViews, { compact: true }),
      delta: pctDelta(sumViews, prevViews),
      sub: 'vs. předchozí stejné období',
    }));
    grid.appendChild(card({
      label: 'Engagement',
      value: M.formatNumber(sumEng, { compact: true }),
      delta: pctDelta(sumEng, prevEng),
      sub: 'Likes + komentáře + sdílení',
    }));
    grid.appendChild(card({
      label: 'Dosah',
      value: M.formatNumber(sumReach, { compact: true }),
      delta: pctDelta(sumReach, prevReach),
      sub: 'Sum reach z postů',
    }));
    grid.appendChild(card({
      label: 'Publikováno',
      value: posts.length,
      delta: M.formatDelta(posts.length - prev.length),
      sub: 'počet postů',
    }));
    const er = posts.filter((p) => p.er > 0);
    const avgEr = er.length ? er.reduce((s, p) => s + p.er, 0) / er.length : 0;
    grid.appendChild(card({
      label: 'Ø Engagement rate',
      value: M.formatNumber(avgEr, { percent: true, digits: 2 }),
      sub: er.length ? `${er.length} postů s dosahem` : '—',
    }));
  }

  function renderPlatformCards() {
    const grid = document.getElementById('platform-cards');
    grid.innerHTML = '';
    const { from, to } = getPeriodRange();
    const entries = Object.entries(CFG.platforms).sort((a, b) => a[1].order - b[1].order);
    grid.innerHTML = entries.map(([_, meta]) => {
      const latest = M.latestSubs(state.data.accounts, state.team.slug, meta.key);
      if (!latest) {
        return `<div class="kpi" style="opacity: 0.5">
          <div class="kpi__label"><span class="badge ${meta.key}">${meta.label}</span></div>
          <div class="kpi__value" style="font-size: 18px; color: var(--muted)">Bez účtu</div>
          <div class="kpi__sub">Tým nemá na ${meta.label} profil v datech</div>
        </div>`;
      }
      const subs = latest.subs;
      const rowsAll = state.data.accounts.filter((r) => r.team === state.team.slug && r.platform === meta.key);
      const rowsBefore = rowsAll.filter((r) => r.day <= from.toISOString().slice(0, 10));
      const before = rowsBefore.length
        ? rowsBefore.reduce((a, b) => a.date > b.date ? a : b).subs
        : (rowsAll.length ? rowsAll.reduce((a, b) => a.date < b.date ? a : b).subs : subs);
      const subsDelta = subs - before;
      const platformPosts = state.data.posts.filter((p) => p.team === state.team.slug && p.platform === meta.key && p.date >= from && p.date <= to);
      const erList = platformPosts.filter((p) => p.er > 0);
      const er = erList.length ? erList.reduce((s, p) => s + p.er, 0) / erList.length : 0;
      const d = M.formatDelta(subsDelta);
      return `
        <div class="kpi">
          <div class="kpi__label"><span class="badge ${meta.key}">${meta.label}</span></div>
          <div class="kpi__value">${M.formatNumber(subs, { compact: true })}<span class="kpi__unit">followers</span></div>
          <div class="kpi__delta ${d.klass}">${d.text} za období</div>
          <div class="kpi__sub">${platformPosts.length} postů · Ø ER ${(er * 100).toFixed(2)}%</div>
        </div>`;
    }).join('');
  }

  function renderFollowerCharts() {
    const wrap = document.getElementById('follower-charts');
    wrap.innerHTML = '';
    const { from, to } = getPeriodRange();
    const entries = Object.entries(CFG.platforms).sort((a, b) => a[1].order - b[1].order);
    let rendered = 0;
    for (const [_, meta] of entries) {
      const points = M.subsByDate(state.data.accounts, state.team.slug, meta.key)
        .filter((r) => r.date >= from && r.date <= to)
        .map((r) => [r.day, r.subs]);
      if (!points.length) continue;
      const div = document.createElement('div');
      div.innerHTML = `<h4 style="font-size: 12px; color: var(--silver); margin-bottom: 6px; letter-spacing: 0.5px; text-transform: uppercase">${meta.label}</h4><div class="chart short" id="fchart-${meta.key}"></div>`;
      wrap.appendChild(div);
      const elChart = div.querySelector(`#fchart-${meta.key}`);
      // Dynamic Y axis
      const ys = points.map((p) => p[1]);
      const min = Math.min(...ys);
      const max = Math.max(...ys);
      const padding = Math.max(1, (max - min) * 0.1);
      C.init(elChart, {
        tooltip: { trigger: 'axis' },
        grid: { top: 16, left: 56, right: 16, bottom: 30 },
        xAxis: { type: 'category', data: points.map((p) => p[0]), boundaryGap: false, axisLabel: { interval: Math.max(0, Math.floor(points.length / 6) - 1) } },
        yAxis: {
          type: 'value',
          min: Math.floor(min - padding),
          max: Math.ceil(max + padding),
          scale: true,
          axisLabel: { formatter: (v) => new Intl.NumberFormat('cs-CZ').format(v) },
        },
        series: [{
          name: meta.label,
          type: 'line',
          data: points.map((p) => p[1]),
          smooth: true,
          showSymbol: points.length < 30,
          lineStyle: { width: 2, color: meta.color },
          itemStyle: { color: meta.color },
          areaStyle: { color: meta.color, opacity: 0.1 },
        }],
      });
      rendered++;
    }
    if (!rendered) wrap.innerHTML = '<div class="empty">Pro tento tým zatím nejsou v datech žádné snapshoty.</div>';
  }

  function getFilteredPosts() {
    const { from, to } = getPeriodRange();
    let posts = state.data.posts.filter((p) => p.team === state.team.slug && p.date >= from && p.date <= to);
    if (state.platformFilter) posts = posts.filter((p) => p.platform === state.platformFilter);
    return posts;
  }

  function renderTopPosts() {
    const container = document.getElementById('top-posts');
    let posts = getFilteredPosts().filter((p) => p.impressions >= 50 || p.views >= 50);
    if (!posts.length) {
      container.innerHTML = '<div class="empty">Žádné posty s dostatečným dosahem v tomto období.</div>';
      return;
    }
    const cols = [
      { key: 'date',     label: 'Datum',    align: 'left',  get: (p) => p.date,    cell: (p) => new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'numeric', year: '2-digit' }).format(p.date) },
      { key: 'platform', label: 'Platf.',   align: 'left',  get: (p) => p.platform || '', cell: (p) => p.platform ? `<span class="badge ${p.platform}">${(Object.values(CFG.platforms).find(x=>x.key===p.platform)||{}).label || p.platform}</span>` : '—' },
      { key: 'format',   label: 'Formát',   align: 'left',  get: (p) => p.format || '',   cell: (p) => CFG.formatLabels[p.format] || p.format || '—' },
      { key: 'caption',  label: 'Post',     align: 'left',  get: (p) => (p.caption||'').toLowerCase(), cell: (p) => `<a href="${p.permalink}" target="_blank" rel="noopener">${(p.caption || '(bez popisku)').slice(0,100).replace(/</g,'&lt;')}</a>` },
      { key: 'views',    label: 'Views',    align: 'right', get: (p) => p.views || 0, cell: (p) => M.formatNumber(p.views) },
      { key: 'reach',    label: 'Reach',    align: 'right', get: (p) => p.reach || p.impressions || 0, cell: (p) => M.formatNumber(p.reach || p.impressions || 0) },
      { key: 'engagement', label: 'Eng.',   align: 'right', get: (p) => p.engagement,                  cell: (p) => M.formatNumber(p.engagement) },
      { key: 'er',       label: 'ER',       align: 'right', get: (p) => p.er,         cell: (p) => `<strong>${(p.er*100).toFixed(2)}%</strong>` },
    ];

    const sorted = posts.slice().sort((a, b) => {
      const col = cols.find((c) => c.key === state.postSort.col) || cols[0];
      const av = col.get(a), bv = col.get(b);
      const cmp = (av > bv ? 1 : av < bv ? -1 : 0);
      return state.postSort.dir === 'asc' ? cmp : -cmp;
    });
    const top = sorted.slice(0, 25);

    const ths = cols.map((c) => {
      const cls = c.key === state.postSort.col ? `sortable sorted-${state.postSort.dir}` : 'sortable';
      return `<th class="${cls}" data-col="${c.key}" style="text-align: ${c.align}">${c.label}</th>`;
    }).join('');
    const trs = top.map((p) => `<tr>${cols.map((c) => `<td style="text-align: ${c.align}" ${c.key === 'caption' ? 'class="caption-cell"' : ''}>${c.cell(p)}</td>`).join('')}</tr>`).join('');
    container.innerHTML = `<div style="max-height: 480px; overflow: auto"><table class="table">
      <thead><tr>${ths}</tr></thead><tbody>${trs}</tbody>
    </table></div><div style="margin-top: 8px; color: var(--muted); font-size: 11px">Zobrazuji ${top.length} z ${posts.length} postů (ER ≥ 50 dosah). Klikni na hlavičku pro řazení.</div>`;

    container.querySelectorAll('th.sortable').forEach((th) => {
      th.style.cursor = 'pointer';
      th.addEventListener('click', () => {
        const col = th.dataset.col;
        if (state.postSort.col === col) state.postSort.dir = state.postSort.dir === 'asc' ? 'desc' : 'asc';
        else { state.postSort.col = col; state.postSort.dir = 'desc'; }
        renderTopPosts();
      });
    });
  }

  function renderPie() {
    const el = document.getElementById('chart-pie');
    if (!el) return;
    const entries = Object.entries(CFG.platforms).sort((a, b) => a[1].order - b[1].order);
    const data = entries.map(([_, meta]) => {
      const latest = M.latestSubs(state.data.accounts, state.team.slug, meta.key);
      return { name: meta.label, value: latest ? latest.subs : 0, color: meta.color };
    });
    if (!data.some((d) => d.value > 0)) {
      el.innerHTML = '<div class="empty">Tým nemá followers v datech.</div>';
      return;
    }
    C.platformPie(el, data);
  }

  function renderInspire() {
    const container = document.getElementById('inspire-content');
    if (!container) return;
    const mode = (document.querySelector('#inspire-mode .platform-btn.active') || {}).dataset?.mode || 'similar-size';
    const team = state.team;
    const md = M.maxDate(state.data.accounts);

    // Compute current team subs total
    const myTotal = CFG.teamsOnly.reduce((acc, t) => {
      if (t.slug !== team.slug) return acc;
      return Object.values(CFG.platforms).reduce((s, p) => {
        const r = M.latestSubs(state.data.accounts, t.slug, p.key);
        return s + (r ? r.subs : 0);
      }, 0);
    }, 0);

    // Compute total subs + activity (posts last 28 d) for all teams
    const from28 = M.addDays(md, -28);
    const teamStats = CFG.teamsOnly.map((t) => {
      const total = Object.values(CFG.platforms).reduce((s, p) => {
        const r = M.latestSubs(state.data.accounts, t.slug, p.key);
        return s + (r ? r.subs : 0);
      }, 0);
      const posts = state.data.posts.filter((p) => p.team === t.slug && p.date >= from28).length;
      return { team: t, total, posts };
    });

    let candidates = [];
    if (mode === 'similar-size') {
      const others = teamStats.filter((x) => x.team.slug !== team.slug);
      candidates = others.slice().sort((a, b) => Math.abs(a.total - myTotal) - Math.abs(b.total - myTotal)).slice(0, 3);
    } else if (mode === 'similar-activity') {
      const myPosts = teamStats.find((x) => x.team.slug === team.slug)?.posts || 0;
      const others = teamStats.filter((x) => x.team.slug !== team.slug);
      candidates = others.slice().sort((a, b) => Math.abs(a.posts - myPosts) - Math.abs(b.posts - myPosts)).slice(0, 3);
    } else if (mode === 'top') {
      const lb = M.leaderboard(state.data, { kind: 'team', windowDays: 28 });
      candidates = lb.filter((r) => r.team.slug !== team.slug).slice(0, 3).map((r) => {
        const ts = teamStats.find((x) => x.team.slug === r.team.slug);
        return ts || { team: r.team, total: r.subs, posts: r.posts };
      });
    }

    if (!candidates.length) {
      container.innerHTML = '<div class="empty">Nedostatek dat pro inspiraci.</div>';
      return;
    }

    // Get top 1 post (by ER) per candidate team in last 60 days
    const from60 = M.addDays(md, -60);
    const candidateBlocks = candidates.map(({ team: cand, total, posts }) => {
      const candPosts = state.data.posts.filter((p) => p.team === cand.slug && p.date >= from60 && (p.impressions >= 50 || p.views >= 50));
      const topPost = candPosts.slice().sort((a, b) => b.er - a.er)[0];
      const formatLabel = topPost ? (CFG.formatLabels[topPost.format] || topPost.format || '—') : '—';
      const platformLabel = topPost ? (Object.values(CFG.platforms).find(x => x.key === topPost.platform)?.label || topPost.platform) : '';
      const dt = topPost ? new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'numeric' }).format(topPost.date) : '';
      const dow = topPost ? ['ne','po','út','st','čt','pá','so'][topPost.date.getDay()] : '';
      const hour = topPost ? `${topPost.date.getHours()}:${String(topPost.date.getMinutes()).padStart(2,'0')}` : '';
      const teamLogo = (window.ULLHUi && window.ULLHUi.teamBadge) ? window.ULLHUi.teamBadge(cand) : `<span class="team-logo" style="background: linear-gradient(135deg, ${cand.color}88, ${cand.color})">${cand.short}</span>`;
      return `
        <div style="border: 1px solid var(--card-border); border-radius: 10px; padding: 12px; margin-bottom: 10px;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
            ${teamLogo}
            <strong>${cand.name}</strong>
            <span style="margin-left: auto; color: var(--silver); font-size: 12px">${M.formatNumber(total, { compact: true })} followers · ${posts} postů 28 d</span>
          </div>
          ${topPost ? `
            <div style="font-size: 12px; color: var(--silver); margin-bottom: 6px">
              Nejlepší post (60 d): <span class="badge ${topPost.platform}">${platformLabel}</span>
              · ${formatLabel} · ${dow} ${dt} ${hour} · <strong style="color: var(--cyan)">ER ${(topPost.er * 100).toFixed(2)}%</strong>
            </div>
            <div class="caption-cell" style="font-size: 12px; max-width: 100%">
              <a href="${topPost.permalink}" target="_blank" rel="noopener">${(topPost.caption || '(bez popisku)').slice(0, 140).replace(/</g,'&lt;')}</a>
            </div>
          ` : `<div style="font-size: 12px; color: var(--muted)">Žádný kvalifikovaný post v posledních 60 dnech.</div>`}
        </div>`;
    }).join('');

    const intro = {
      'similar-size': 'Týmy s nejpodobnější velikostí publika — co u nich teď zabíralo:',
      'similar-activity': 'Týmy s podobným tempem publikace — jejich top obsah:',
      'top': 'Top 3 týmy ligy (podle skóre 28 d) — jejich top obsah:',
    }[mode];

    container.innerHTML = `<div style="font-size: 12px; color: var(--silver); margin-bottom: 10px">${intro}</div>${candidateBlocks}`;
  }

  function setupInspireControls() {
    const buttons = document.querySelectorAll('#inspire-mode .platform-btn');
    buttons.forEach((b) => b.addEventListener('click', () => {
      buttons.forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      renderInspire();
    }));
  }

  function renderActivityChart() {
    const { from, to } = getPeriodRange();
    const posts = state.data.posts.filter((p) => p.team === state.team.slug && p.date >= from && p.date <= to);
    const formats = ['photo', 'reel', 'video', 'story', 'carousel', 'short', 'text'];
    const platformKeys = ['ig', 'fb', 'tt', 'yt'];
    const series = formats.map((fmtKey) => ({
      name: CFG.formatLabels[fmtKey] || fmtKey,
      type: 'bar', stack: 'total',
      data: platformKeys.map((pk) => posts.filter((p) => p.platform === pk && p.format === fmtKey).length),
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

  function renderMeta() {
    const md = M.maxDate([...state.data.accounts, ...state.data.posts]);
    const fmt = new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' }).format(md);
    document.getElementById('meta').innerHTML = `Data ke dni <strong>${fmt}</strong>${state.data.fromCache ? ' · z cache' : ''}`;
    const range = getPeriodRange();
    document.getElementById('period-info').textContent = range.label;
  }

  function rerenderAll() {
    renderMeta();
    renderHero();
    renderSummaryKpis();
    renderPlatformCards();
    renderFollowerCharts();
    renderTopPosts();
    renderActivityChart();
    renderPie();
    renderInspire();
  }

  function csvDownload(rows, filename) {
    const csv = rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  function exportPosts() {
    const posts = getFilteredPosts();
    const rows = [['Datum', 'Platforma', 'Formát', 'Caption', 'Views', 'Reach', 'Likes', 'Comments', 'Shares', 'Engagement', 'ER %', 'URL']];
    for (const p of posts) {
      rows.push([
        p.date.toISOString(), p.platform || '', p.format || '',
        (p.caption || '').replace(/\s+/g, ' '),
        p.views, p.reach || p.impressions || 0, p.likes, p.comments, p.shares, p.engagement,
        (p.er * 100).toFixed(2), p.permalink || '',
      ]);
    }
    csvDownload(rows, `posty-${state.team.slug}-${new Date().toISOString().slice(0,10)}.csv`);
  }

  function exportSummary() {
    const { from, to } = getPeriodRange();
    const posts = teamPostsInRange();
    const subsNow = M.subsSumOnDay(state.data.accounts, state.team.slug, to);
    const subsBefore = M.subsSumOnDay(state.data.accounts, state.team.slug, from);
    const sumViews = posts.reduce((s, p) => s + (p.views || 0), 0);
    const sumEng = posts.reduce((s, p) => s + p.engagement, 0);
    const sumReach = posts.reduce((s, p) => s + (p.reach || p.impressions || 0), 0);
    const erList = posts.filter((p) => p.er > 0);
    const avgEr = erList.length ? erList.reduce((s, p) => s + p.er, 0) / erList.length : 0;
    const rows = [
      ['Tým', state.team.name],
      ['Období', `${fmtDate(from)} – ${fmtDate(to)}`],
      ['Celkem followers (k datu)', subsNow],
      ['Růst followerů za období', subsNow - subsBefore],
      ['Zhlédnutí (sum)', sumViews],
      ['Reach (sum)', sumReach],
      ['Engagement (sum)', sumEng],
      ['Publikováno (počet)', posts.length],
      ['Ø Engagement rate', (avgEr * 100).toFixed(2) + '%'],
    ];
    for (const [_, meta] of Object.entries(CFG.platforms).sort((a, b) => a[1].order - b[1].order)) {
      const latest = M.latestSubs(state.data.accounts, state.team.slug, meta.key);
      const platformPosts = posts.filter((p) => p.platform === meta.key);
      rows.push([`${meta.label} — followers`, latest ? latest.subs : 0]);
      rows.push([`${meta.label} — počet postů`, platformPosts.length]);
    }
    csvDownload(rows, `prehled-${state.team.slug}-${new Date().toISOString().slice(0,10)}.csv`);
  }

  function setupPeriodControls() {
    const buttons = document.querySelectorAll('.period-btn');
    buttons.forEach((b) => b.addEventListener('click', () => {
      buttons.forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      const dv = b.dataset.days;
      if (dv === 'all') state.period = { mode: 'all' };
      else state.period = { mode: 'days', days: Number(dv) };
      state.customFrom = state.customTo = null;
      document.getElementById('period-from').value = '';
      document.getElementById('period-to').value = '';
      rerenderAll();
    }));
    document.getElementById('apply-custom').addEventListener('click', () => {
      const f = document.getElementById('period-from').value;
      const t = document.getElementById('period-to').value;
      if (!f || !t) return;
      state.customFrom = new Date(f);
      state.customTo = new Date(t + 'T23:59:59');
      state.period = { mode: 'custom' };
      buttons.forEach((x) => x.classList.remove('active'));
      rerenderAll();
    });
  }

  function setupPlatformControls() {
    const buttons = document.querySelectorAll('.platform-btn');
    buttons.forEach((b) => b.addEventListener('click', () => {
      buttons.forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      state.platformFilter = b.dataset.pf || '';
      renderTopPosts();
    }));
  }

  async function init() {
    state.team = getTeam();
    populateSelector(state.team);
    try {
      state.data = await window.ULLHData.load();
      // Initialize date inputs hint
      const md = M.maxDate([...state.data.accounts, ...state.data.posts]);
      document.getElementById('period-from').max = md.toISOString().slice(0, 10);
      document.getElementById('period-to').max = md.toISOString().slice(0, 10);
      setupPeriodControls();
      setupPlatformControls();
      setupInspireControls();
      document.getElementById('export-posts').addEventListener('click', exportPosts);
      document.getElementById('export-summary').addEventListener('click', exportSummary);
      rerenderAll();
    } catch (err) {
      console.error(err);
      document.getElementById('platform-cards').innerHTML = `<div class="panel" style="grid-column: 1 / -1"><div class="panel__note" style="border-color: var(--bad); color: var(--bad)">${String(err && err.message || err)}</div></div>`;
    }
  }

  init();
})();
