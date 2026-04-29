(function () {
  const CFG = window.ULLH_CONFIG;

  // Hokejová sezóna: 1.9. – 30.4. Sezóna 24/25 = 1.9.2024 – 30.4.2025.
  function seasonOf(date) {
    if (!date) return null;
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return null;
    const m = d.getMonth() + 1; // 1-12
    const y = d.getFullYear();
    // září–prosinec → sezóna začíná tímto rokem
    // leden–duben → sezóna začala předchozím rokem
    // květen–srpen → mimosezóna, přiřadíme předchozí sezóně (zápasy se občas vysílají v srpnu jako repríza)
    const startYear = m >= 9 ? y : (m <= 4 ? y - 1 : y - 1);
    const endYear = startYear + 1;
    const key = `${String(startYear).slice(-2)}/${String(endYear).slice(-2)}`;
    return { key, label: `Sezóna ${key}`, startYear, endYear };
  }

  function maxDate(rows) {
    let m = 0;
    for (const r of rows) { if (r.date > m) m = r.date; }
    return new Date(m || Date.now());
  }

  function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }

  function inRange(date, from, to) { return date >= from && date <= to; }

  function formatNumber(n, opts = {}) {
    if (!Number.isFinite(n)) return '—';
    const abs = Math.abs(n);
    if (opts.percent) {
      const digits = opts.digits ?? 1;
      return new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n * 100) + ' %';
    }
    if (opts.compact && abs >= 1000) {
      const nf = new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 1 });
      if (abs >= 1e6) return nf.format(n / 1e6) + ' M';
      if (abs >= 1e3) return nf.format(n / 1e3) + ' k';
    }
    return new Intl.NumberFormat('cs-CZ').format(Math.round(n));
  }

  function formatDelta(n, asPercent = false) {
    if (!Number.isFinite(n) || n === 0) return { text: '→ 0', klass: 'flat', arrow: '→', raw: 0 };
    const arrow = n > 0 ? '↑' : '↓';
    const klass = n > 0 ? 'up' : 'down';
    const abs = Math.abs(n);
    const num = asPercent
      ? new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(abs * 100) + ' %'
      : formatNumber(abs);
    return { text: `${arrow} ${num}`, klass, arrow, raw: n };
  }

  function latestSubs(accounts, teamSlug, platformKey) {
    let latest = null;
    for (const r of accounts) {
      if (teamSlug && r.team !== teamSlug) continue;
      if (platformKey && r.platform !== platformKey) continue;
      if (!latest || r.date > latest.date) latest = r;
    }
    return latest;
  }

  function subsByDate(accounts, teamSlug, platformKey) {
    const map = new Map();
    for (const r of accounts) {
      if (teamSlug && r.team !== teamSlug) continue;
      if (platformKey && r.platform !== platformKey) continue;
      const prev = map.get(r.day);
      if (!prev || prev.date < r.date) map.set(r.day, r);
    }
    return [...map.values()].sort((a, b) => a.date - b.date);
  }

  function currentSubsSumByTeam(accounts, teamSlug) {
    const byPlatform = new Map();
    for (const r of accounts) {
      if (r.team !== teamSlug) continue;
      const key = `${r.platformKey}|${r.carlAccountId}`;
      const prev = byPlatform.get(key);
      if (!prev || prev.date < r.date) byPlatform.set(key, r);
    }
    let sum = 0;
    for (const r of byPlatform.values()) sum += r.subs;
    return sum;
  }

  function subsSumOnDay(accounts, teamSlug, targetDate) {
    const tKey = targetDate.toISOString().slice(0, 10);
    const byAccountAt = new Map();
    const earliestPerAccount = new Map();
    for (const r of accounts) {
      if (teamSlug && r.team !== teamSlug) continue;
      const key = `${r.platformKey}|${r.carlAccountId}`;
      if (r.day <= tKey) {
        const prev = byAccountAt.get(key);
        if (!prev || prev.date < r.date) byAccountAt.set(key, r);
      }
      const earliest = earliestPerAccount.get(key);
      if (!earliest || earliest.date > r.date) earliestPerAccount.set(key, r);
    }
    let sum = 0;
    for (const [key, earliest] of earliestPerAccount) {
      const onDay = byAccountAt.get(key);
      sum += (onDay ? onDay.subs : earliest.subs);
    }
    return sum;
  }

  function subsGrowth(accounts, teamSlug, days) {
    const md = maxDate(accounts);
    const now = subsSumOnDay(accounts, teamSlug, md);
    const before = subsSumOnDay(accounts, teamSlug, addDays(md, -days));
    return { now, before, delta: now - before, pct: before > 0 ? (now - before) / before : 0 };
  }

  function postsInWindow(posts, { team, platform, from, to }) {
    return posts.filter((p) => {
      if (team && p.team !== team) return false;
      if (platform && p.platform !== platform) return false;
      if (from && p.date < from) return false;
      if (to && p.date > to) return false;
      return true;
    });
  }

  function avgEr(posts) {
    const list = posts.filter((p) => p.impressions > 0 || p.views > 0);
    if (!list.length) return 0;
    return list.reduce((s, p) => s + p.er, 0) / list.length;
  }

  function sumEngagement(posts) {
    return posts.reduce((s, p) => s + p.engagement, 0);
  }

  function sumImpressions(posts) {
    return posts.reduce((s, p) => s + (p.impressions || p.views || 0), 0);
  }

  function sumViews(posts) {
    return posts.reduce((s, p) => s + (p.views || 0), 0);
  }

  function reachLatestPerAccount(accounts, { kind = 'all', onDate = null } = {}) {
    const source = kind === 'liga' ? CFG.ligaOnly : (kind === 'team' ? CFG.teamsOnly : CFG.teams);
    const slugs = new Set(source.map((t) => t.slug));
    const tKey = onDate ? onDate.toISOString().slice(0, 10) : null;
    const byAccount = new Map();
    for (const r of accounts) {
      if (!r.team || !slugs.has(r.team)) continue;
      if (tKey && r.day > tKey) continue;
      if (!r.reach) continue;
      const key = `${r.platformKey}|${r.carlAccountId}`;
      const prev = byAccount.get(key);
      if (!prev || prev.date < r.date) byAccount.set(key, r);
    }
    let sum = 0;
    for (const r of byAccount.values()) sum += r.reach;
    return sum;
  }

  function sumStoriesViews(posts) {
    return posts.filter((p) => (p.postType || '').includes('Story')).reduce((s, p) => s + (p.views || 0), 0);
  }

  function teamSnapshot(data, teamSlug, windowDays = 7) {
    const md = maxDate([...data.accounts, ...data.posts]);
    const from = addDays(md, -windowDays);
    const prevFrom = addDays(md, -windowDays * 2);
    const windowPosts = postsInWindow(data.posts, { team: teamSlug, from, to: md });
    const prevPosts = postsInWindow(data.posts, { team: teamSlug, from: prevFrom, to: from });
    const subs = subsSumOnDay(data.accounts, teamSlug, md);
    const subsPrev = subsSumOnDay(data.accounts, teamSlug, from);
    return {
      team: CFG.teams.find((t) => t.slug === teamSlug),
      subs,
      subsDelta: subs - subsPrev,
      subsDeltaPct: subsPrev > 0 ? (subs - subsPrev) / subsPrev : 0,
      posts: windowPosts.length,
      postsDelta: windowPosts.length - prevPosts.length,
      engagement: sumEngagement(windowPosts),
      engagementPrev: sumEngagement(prevPosts),
      views: sumViews(windowPosts),
      viewsPrev: sumViews(prevPosts),
      er: avgEr(windowPosts),
      erPrev: avgEr(prevPosts),
    };
  }

  function leaderboard(data, { kind = 'team', windowDays = 28 } = {}) {
    const source = kind === 'liga' ? CFG.ligaOnly : (kind === 'all' ? CFG.teams : CFG.teamsOnly);
    const rows = source.map((t) => teamSnapshot(data, t.slug, windowDays));
    const maxSubs = Math.max(1, ...rows.map((t) => t.subs));
    const maxPosts = Math.max(1, ...rows.map((t) => t.posts));
    const maxEr = Math.max(0.001, ...rows.map((t) => t.er));
    for (const t of rows) {
      const sizeScore = t.subs / maxSubs;
      const activityScore = t.posts / maxPosts;
      const engagementScore = t.er / maxEr;
      t.score = (sizeScore + activityScore + engagementScore) / 3;
      t.sizeScore = sizeScore;
      t.activityScore = activityScore;
      t.engagementScore = engagementScore;
    }
    return rows.sort((a, b) => b.score - a.score);
  }

  function leagueLeaderboard(data, windowDays = 28) { return leaderboard(data, { kind: 'team', windowDays }); }

  function leagueTotals(data, windowDays = 7, { kind = 'all' } = {}) {
    const md = maxDate([...data.accounts, ...data.posts]);
    const from = addDays(md, -windowDays);
    const prevFrom = addDays(md, -windowDays * 2);

    const source = kind === 'liga' ? CFG.ligaOnly : (kind === 'team' ? CFG.teamsOnly : CFG.teams);
    const slugs = new Set(source.map((t) => t.slug));
    const subsNow = source.reduce((s, t) => s + subsSumOnDay(data.accounts, t.slug, md), 0);
    const subsPrev = source.reduce((s, t) => s + subsSumOnDay(data.accounts, t.slug, from), 0);

    const windowPosts = data.posts.filter((p) => p.team && slugs.has(p.team) && p.date >= from && p.date <= md);
    const prevPosts = data.posts.filter((p) => p.team && slugs.has(p.team) && p.date >= prevFrom && p.date < from);

    return {
      referenceDate: md,
      windowDays,
      kind,
      teamCount: source.length,
      subs: subsNow,
      subsDelta: subsNow - subsPrev,
      subsDeltaPct: subsPrev > 0 ? (subsNow - subsPrev) / subsPrev : 0,
      engagement: sumEngagement(windowPosts),
      engagementPrev: sumEngagement(prevPosts),
      views: sumViews(windowPosts),
      viewsPrev: sumViews(prevPosts),
      storiesViews: sumStoriesViews(windowPosts),
      posts: windowPosts.length,
      postsPrev: prevPosts.length,
      reach: reachLatestPerAccount(data.accounts, { kind, onDate: md }),
      reachPrev: reachLatestPerAccount(data.accounts, { kind, onDate: from }),
      fastestGrowing: leaderboard(data, { kind: kind === 'liga' ? 'liga' : 'team', windowDays })
        .slice().sort((a, b) => b.subsDelta - a.subsDelta)[0],
    };
  }

  function weeklyTrendByTeam(data) {
    const byTeamPlatformWeek = new Map();
    const allWeeks = new Set();
    for (const r of data.accounts) {
      if (!r.team) continue;
      allWeeks.add(r.week);
      const key = `${r.team}|${r.platformKey}|${r.carlAccountId}|${r.week}`;
      const prev = byTeamPlatformWeek.get(key);
      if (!prev || prev.date < r.date) byTeamPlatformWeek.set(key, r);
    }
    const sortedWeeks = [...allWeeks].sort();
    const teamAccounts = new Map();
    for (const [key, row] of byTeamPlatformWeek) {
      const acctKey = `${row.team}|${row.platformKey}|${row.carlAccountId}`;
      if (!teamAccounts.has(acctKey)) teamAccounts.set(acctKey, new Map());
      teamAccounts.get(acctKey).set(row.week, row.subs);
    }
    const teamWeekSums = new Map();
    for (const [acctKey, weekMap] of teamAccounts) {
      const team = acctKey.split('|')[0];
      if (!teamWeekSums.has(team)) teamWeekSums.set(team, new Map());
      const teamMap = teamWeekSums.get(team);
      let lastKnown = null;
      for (const w of sortedWeeks) {
        if (weekMap.has(w)) lastKnown = weekMap.get(w);
        if (lastKnown !== null) teamMap.set(w, (teamMap.get(w) || 0) + lastKnown);
      }
    }
    const teams = CFG.teams.filter((t) => !t.kind || t.kind === 'team');
    return {
      weeks: sortedWeeks,
      series: teams.map((team) => ({
        team,
        values: sortedWeeks.map((w) => (teamWeekSums.get(team.slug) || new Map()).get(w) ?? null),
      })),
    };
  }

  function platformMixByTeam(data, { kind = 'team' } = {}) {
    const source = kind === 'liga' ? CFG.ligaOnly : (kind === 'all' ? CFG.teams : CFG.teamsOnly);
    const platforms = ['ig', 'fb', 'tt', 'yt'];
    const rows = [];
    for (const team of source) {
      const row = { team, total: 0 };
      for (const p of platforms) {
        const latest = latestSubs(data.accounts, team.slug, p);
        row[p] = latest ? latest.subs : 0;
        row.total += row[p];
      }
      rows.push(row);
    }
    return rows.sort((a, b) => b.total - a.total);
  }

  function bestPostingTimes(posts, platformKey) {
    const grid = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({ sumEr: 0, count: 0 })));
    for (const p of posts) {
      if (platformKey && p.platform !== platformKey) continue;
      if (!p.er) continue;
      const cell = grid[p.dow][p.hour];
      cell.sumEr += p.er;
      cell.count += 1;
    }
    const data = [];
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        const c = grid[d][h];
        if (c.count >= 2) data.push([h, d, c.sumEr / c.count, c.count]);
      }
    }
    return data;
  }

  function formatMix(posts, platformKey) {
    const byFormat = new Map();
    for (const p of posts) {
      if (platformKey && p.platform !== platformKey) continue;
      if (!p.format) continue;
      const f = p.format;
      if (!byFormat.has(f)) byFormat.set(f, { format: f, count: 0, sumEr: 0, engagement: 0 });
      const entry = byFormat.get(f);
      entry.count += 1;
      entry.sumEr += p.er;
      entry.engagement += p.engagement;
    }
    const out = [];
    for (const e of byFormat.values()) {
      out.push({ ...e, avgEr: e.count ? e.sumEr / e.count : 0 });
    }
    return out.sort((a, b) => b.avgEr - a.avgEr);
  }

  function topPosts(posts, { limit = 10, windowDays = null, platform = null, minImpressions = 100 } = {}) {
    let list = posts.filter((p) => p.team && (p.impressions >= minImpressions || p.views >= minImpressions));
    if (platform) list = list.filter((p) => p.platform === platform);
    if (windowDays) {
      const md = maxDate(list);
      const from = addDays(md, -windowDays);
      list = list.filter((p) => p.date >= from);
    }
    return list.sort((a, b) => b.er - a.er).slice(0, limit);
  }

  function consistencyHeroes(data, minPosts = 5) {
    const md = maxDate(data.posts);
    const from = addDays(md, -56);
    const byTeam = new Map();
    for (const p of data.posts) {
      if (!p.team || p.date < from) continue;
      if (!byTeam.has(p.team)) byTeam.set(p.team, []);
      byTeam.get(p.team).push(p.date);
    }
    const rows = [];
    for (const [team, dates] of byTeam) {
      if (dates.length < minPosts) continue;
      const sorted = dates.slice().sort((a, b) => a - b);
      const gaps = [];
      for (let i = 1; i < sorted.length; i++) gaps.push((sorted[i] - sorted[i - 1]) / 86400000);
      const avg = gaps.reduce((s, g) => s + g, 0) / gaps.length;
      const variance = gaps.reduce((s, g) => s + (g - avg) ** 2, 0) / gaps.length;
      const stdev = Math.sqrt(variance);
      const cv = avg > 0 ? stdev / avg : Infinity;
      const teamObj = CFG.teams.find((t) => t.slug === team);
      rows.push({ team: teamObj, posts: dates.length, avgGapDays: avg, cv });
    }
    return rows.sort((a, b) => a.cv - b.cv);
  }

  function captionLengthBuckets(posts, platformKey) {
    const buckets = [
      { label: '0–50', min: 0, max: 50 },
      { label: '51–150', min: 51, max: 150 },
      { label: '151–300', min: 151, max: 300 },
      { label: '301–600', min: 301, max: 600 },
      { label: '600+', min: 601, max: Infinity },
    ];
    const result = buckets.map((b) => ({ ...b, count: 0, sumEr: 0, avgEr: 0 }));
    for (const p of posts) {
      if (platformKey && p.platform !== platformKey) continue;
      if (!p.er) continue;
      const b = result.find((x) => p.captionLength >= x.min && p.captionLength <= x.max);
      if (!b) continue;
      b.count += 1;
      b.sumEr += p.er;
    }
    for (const b of result) b.avgEr = b.count ? b.sumEr / b.count : 0;
    return result;
  }

  function growthRanking(data, windowDays = 7, { kind = 'team' } = {}) {
    const source = kind === 'liga' ? CFG.ligaOnly : (kind === 'all' ? CFG.teams : CFG.teamsOnly);
    const md = maxDate(data.accounts);
    const from = addDays(md, -windowDays);
    const rows = [];
    for (const team of source) {
      const now = subsSumOnDay(data.accounts, team.slug, md);
      const before = subsSumOnDay(data.accounts, team.slug, from);
      rows.push({ team, subs: now, delta: now - before, pct: before > 0 ? (now - before) / before : 0 });
    }
    return rows.filter((r) => r.subs > 0);
  }

  window.ULLHMetrics = {
    seasonOf,
    maxDate, addDays, formatNumber, formatDelta,
    latestSubs, subsByDate, currentSubsSumByTeam, subsSumOnDay, subsGrowth,
    postsInWindow, avgEr, sumEngagement, sumImpressions, sumViews,
    sumStoriesViews, reachLatestPerAccount,
    teamSnapshot, leaderboard, leagueLeaderboard, leagueTotals,
    weeklyTrendByTeam, platformMixByTeam,
    bestPostingTimes, formatMix, topPosts,
    consistencyHeroes, captionLengthBuckets, growthRanking,
  };
})();
