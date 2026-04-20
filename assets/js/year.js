(function () {
  const M = window.ULLHMetrics;
  const C = window.ULLHCharts;
  const CFG = window.ULLH_CONFIG;
  const U = window.ULLHUi;

  function el(tag, attrs = {}) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else e.setAttribute(k, v);
    }
    return e;
  }

  function kpi({ label, value, unit, sub }) {
    const subHtml = sub ? `<div class="kpi__sub">${sub}</div>` : '';
    return el('div', { class: 'kpi', html: `
      <div class="kpi__label">${label}</div>
      <div class="kpi__value">${value}${unit ? `<span class="kpi__unit">${unit}</span>` : ''}</div>
      ${subHtml}
    ` });
  }

  function cumulativeGrowth(data) {
    const byAccount = new Map();
    for (const r of data.accounts) {
      if (!r.team) continue;
      const key = `${r.platformKey}|${r.carlAccountId}`;
      if (!byAccount.has(key)) byAccount.set(key, new Map());
      const m = byAccount.get(key);
      const prev = m.get(r.day);
      if (!prev || prev.date < r.date) m.set(r.day, r);
    }
    const allDays = new Set();
    for (const m of byAccount.values()) for (const d of m.keys()) allDays.add(d);
    const sortedDays = [...allDays].sort();
    const results = sortedDays.map((day) => {
      let sum = 0;
      for (const m of byAccount.values()) {
        let latest = null;
        for (const [d, r] of m) {
          if (d <= day && (!latest || latest.day < d)) latest = r;
        }
        if (latest) sum += latest.subs;
      }
      return [day, sum];
    });
    return results;
  }

  function monthlyPosts(data) {
    const buckets = new Map();
    for (const p of data.posts) {
      if (!p.team) continue;
      const key = `${p.date.getFullYear()}-${String(p.date.getMonth() + 1).padStart(2, '0')}`;
      if (!buckets.has(key)) buckets.set(key, { ig: 0, fb: 0, tt: 0, yt: 0 });
      const row = buckets.get(key);
      if (p.platform && row[p.platform] !== undefined) row[p.platform] += 1;
    }
    const months = [...buckets.keys()].sort();
    return { months, data: months.map((m) => buckets.get(m)) };
  }

  function totalReachAllAccounts(data) {
    return M.reachLatestPerAccount(data.accounts, { kind: 'all' });
  }

  function totalSubsAllAccounts(data) {
    const md = M.maxDate(data.accounts);
    let total = 0;
    for (const t of CFG.teams) total += M.subsSumOnDay(data.accounts, t.slug, md);
    return total;
  }

  function earliestSubsAllAccounts(data) {
    const byAccount = new Map();
    for (const r of data.accounts) {
      if (!r.team) continue;
      const key = `${r.platformKey}|${r.carlAccountId}`;
      const prev = byAccount.get(key);
      if (!prev || prev.date > r.date) byAccount.set(key, r);
    }
    let total = 0;
    for (const r of byAccount.values()) total += r.subs;
    return total;
  }

  function renderKpis(data) {
    const grid = document.getElementById('year-kpis');
    grid.innerHTML = '';

    const totalSubs = totalSubsAllAccounts(data);
    const earliestSubs = earliestSubsAllAccounts(data);
    const cumulativeGrowthValue = totalSubs - earliestSubs;

    const teamPostsAll = data.posts.filter((p) => p.team);
    const totalPosts = teamPostsAll.length;
    const totalViews = M.sumViews(teamPostsAll);
    const totalEngagement = M.sumEngagement(teamPostsAll);
    const totalStoriesViews = M.sumStoriesViews(teamPostsAll);
    const totalReach = totalReachAllAccounts(data);
    const avgPostsPerDay = (() => {
      const dates = teamPostsAll.map((p) => p.day);
      const unique = new Set(dates);
      return unique.size ? totalPosts / unique.size : 0;
    })();

    grid.appendChild(kpi({
      label: 'Celkem followers (poslední snapshot)',
      value: M.formatNumber(totalSubs, { compact: true }),
      sub: `${CFG.teams.length} účtů napříč IG, FB, TikTok (a YT až bude)`,
    }));
    grid.appendChild(kpi({
      label: 'Přírůstek followerů (za období)',
      value: '+ ' + M.formatNumber(cumulativeGrowthValue, { compact: true }),
      sub: `Ze ${M.formatNumber(earliestSubs, { compact: true })} na ${M.formatNumber(totalSubs, { compact: true })}`,
    }));
    grid.appendChild(kpi({
      label: 'Celkem zhlédnutí',
      value: M.formatNumber(totalViews, { compact: true }),
      sub: `Z toho stories: ${M.formatNumber(totalStoriesViews, { compact: true })}`,
    }));
    grid.appendChild(kpi({
      label: 'Celkem engagement',
      value: M.formatNumber(totalEngagement, { compact: true }),
      sub: 'Likes + komentáře + sdílení',
    }));
    grid.appendChild(kpi({
      label: 'Celkem dosah (reach)',
      value: M.formatNumber(totalReach, { compact: true }),
      sub: 'Součet posledních reach snapshotů všech účtů',
    }));
    grid.appendChild(kpi({
      label: 'Celkem publikováno',
      value: M.formatNumber(totalPosts),
      sub: `Ø ${new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(avgPostsPerDay)} postů / den v období`,
    }));
  }

  function renderCumulative(data) {
    const series = cumulativeGrowth(data);
    C.init(document.getElementById('chart-cumulative'), {
      xAxis: { type: 'category', data: series.map((s) => s[0]), axisLabel: { interval: Math.max(1, Math.floor(series.length / 10)) } },
      yAxis: { type: 'value', name: 'Followers' },
      tooltip: { trigger: 'axis' },
      grid: { top: 24, left: 56, right: 16, bottom: 36 },
      series: [{
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: series.map((s) => s[1]),
        areaStyle: { color: 'rgba(0,212,255,0.18)' },
        lineStyle: { color: '#00D4FF', width: 2 },
        itemStyle: { color: '#00D4FF' },
        name: 'Celkem followers',
      }],
    });
  }

  function renderAudienceSplit(data) {
    const platforms = ['ig', 'fb', 'tt', 'yt'];
    const totals = { ig: 0, fb: 0, tt: 0, yt: 0 };
    for (const team of CFG.teams) {
      for (const p of platforms) {
        const latest = M.latestSubs(data.accounts, team.slug, p);
        if (latest) totals[p] += latest.subs;
      }
    }
    const data2 = platforms.map((p) => ({
      name: Object.values(CFG.platforms).find((x) => x.key === p)?.label || p,
      value: totals[p],
      itemStyle: { color: Object.values(CFG.platforms).find((x) => x.key === p)?.color },
    })).filter((x) => x.value > 0);
    C.init(document.getElementById('chart-audience-split'), {
      tooltip: { trigger: 'item', formatter: '{b}: <b>{c}</b> ({d}%)' },
      legend: { bottom: 0, textStyle: { color: '#9CA3AF' } },
      series: [{
        type: 'pie',
        radius: ['50%', '78%'],
        center: ['50%', '46%'],
        data: data2,
        label: { color: '#fff', formatter: '{b}\n{d}%', fontSize: 11 },
        labelLine: { length: 6, length2: 6 },
      }],
    });
  }

  function renderMonthlyPosts(data) {
    const { months, data: rows } = monthlyPosts(data);
    const platformKeys = ['ig', 'fb', 'tt', 'yt'];
    const series = platformKeys.map((p) => {
      const platformMeta = Object.values(CFG.platforms).find((x) => x.key === p);
      return {
        name: platformMeta?.label || p,
        type: 'bar',
        stack: 'total',
        data: rows.map((r) => r[p]),
        itemStyle: { color: platformMeta?.color },
        barMaxWidth: 36,
      };
    }).filter((s) => s.data.some((v) => v > 0));
    C.init(document.getElementById('chart-monthly-posts'), {
      xAxis: { type: 'category', data: months },
      yAxis: { type: 'value', name: 'Postů' },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { top: 0, itemWidth: 10, itemHeight: 8 },
      grid: { top: 32, left: 40, right: 16, bottom: 20 },
      series,
    });
  }

  function renderTopAccounts(data) {
    const rows = [];
    for (const team of CFG.teams) {
      for (const [platformName, platformMeta] of Object.entries(CFG.platforms)) {
        const latest = M.latestSubs(data.accounts, team.slug, platformMeta.key);
        if (latest && latest.subs > 0) {
          rows.push({ team, platform: platformMeta, subs: latest.subs });
        }
      }
    }
    rows.sort((a, b) => b.subs - a.subs);
    const top = rows.slice(0, 5);
    const container = document.getElementById('top-accounts');
    container.innerHTML = `<table class="leaderboard"><thead><tr>
      <th>#</th><th>Účet</th><th>Platforma</th><th style="text-align:right">Followers</th>
    </tr></thead><tbody>${top.map((r, i) => `<tr>
      <td><span class="rank">${i + 1}</span></td>
      <td><div class="team">${U.teamBadge(r.team)}${r.team.name}</div></td>
      <td><span class="badge ${r.platform.key}">${r.platform.label}</span></td>
      <td style="text-align:right"><strong>${M.formatNumber(r.subs, { compact: true })}</strong></td>
    </tr>`).join('')}</tbody></table>`;
  }

  function renderTopYearPosts(data) {
    const top = data.posts
      .filter((p) => p.team && (p.views > 0))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);
    const fmt = new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });
    document.getElementById('top-year-posts').innerHTML = `<table class="table"><thead><tr>
      <th>#</th><th>Tým</th><th>Platforma</th><th>Formát</th><th>Datum</th><th>Post</th>
      <th style="text-align:right">Zhlédnutí</th><th style="text-align:right">Engagement</th>
    </tr></thead><tbody>${top.map((p, i) => {
      const team = CFG.teams.find((t) => t.slug === p.team);
      return `<tr>
        <td><strong>${i + 1}</strong></td>
        <td><div class="team">${U.teamBadge(team)}${team?.name || p.accountName}</div></td>
        <td><span class="badge ${p.platform}">${Object.values(CFG.platforms).find((x) => x.key === p.platform)?.label || p.platform}</span></td>
        <td>${CFG.formatLabels[p.format] || p.format || '—'}</td>
        <td>${fmt.format(p.date)}</td>
        <td class="caption-cell"><a href="${p.permalink}" target="_blank" rel="noopener">${(p.caption || '(bez popisku)').slice(0, 120).replace(/</g, '&lt;')}</a></td>
        <td style="text-align:right"><strong>${M.formatNumber(p.views, { compact: true })}</strong></td>
        <td style="text-align:right">${M.formatNumber(p.engagement, { compact: true })}</td>
      </tr>`;
    }).join('')}</tbody></table>`;
  }

  function renderMeta(data) {
    const dates = [...data.accounts, ...data.posts].map((r) => r.date);
    const min = new Date(Math.min(...dates));
    const max = new Date(Math.max(...dates));
    const fmt = new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
    document.getElementById('date-range').textContent = `${fmt.format(min)} – ${fmt.format(max)}`;
    document.getElementById('meta').innerHTML = `Data ke dni <strong>${fmt.format(max)}</strong>${data.fromCache ? ' · z cache' : ''}`;
    const year = max.getFullYear();
    document.getElementById('year-title').textContent = `Celoroční bilance ${year}`;
  }

  async function init() {
    try {
      const data = await window.ULLHData.load();
      renderMeta(data);
      renderKpis(data);
      renderCumulative(data);
      renderAudienceSplit(data);
      renderMonthlyPosts(data);
      renderTopAccounts(data);
      renderTopYearPosts(data);
    } catch (err) {
      console.error(err);
      document.getElementById('year-kpis').innerHTML = `<div class="panel" style="grid-column: 1 / -1"><div class="panel__note" style="border-color: var(--bad); color: var(--bad)">${String(err && err.message || err)}</div></div>`;
    }
  }

  init();
})();
