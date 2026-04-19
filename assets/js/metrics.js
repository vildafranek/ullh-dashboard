(function () {
  const CFG = window.ULLH_CONFIG;

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
    if (opts.percent) return (n * 100).toFixed(opts.digits ?? 1) + '%';
    if (opts.compact && abs >= 1000) {
      if (abs >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + ' M';
      if (abs >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + ' k';
    }
    return new Intl.NumberFormat('cs-CZ').format(Math.round(n));
  }

  function formatDelta(n, asPercent = false) {
    if (!Number.isFinite(n) || n === 0) return { text: '±0', klass: 'flat' };
    const sign = n > 0 ? '+' : '';
    const klass = n > 0 ? 'up' : 'down';
    const text = asPercent ? `${sign}${(n * 100).toFixed(1)}%` : `${sign}${formatNumber(n)}`;
    return { text, klass };
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
      er: avgEr(windowPosts),
      erPrev: avgEr(prevPosts),
    };
  }

  function leagueLeaderboard(data, windowDays = 28) {
    const teams = CFG.teams.map((t) => teamSnapshot(data, t.slug, windowDays));
    const maxSubs = Math.max(1, ...teams.map((t) => t.subs));
    const maxPosts = Math.max(1, ...teams.map((t) => t.posts));
    const maxEr = Math.max(0.001, ...teams.map((t) => t.er));
    for (const t of teams) {
      const sizeScore = t.subs / maxSubs;
      const activityScore = t.posts / maxPosts;
      const engagementScore = t.er / maxEr;
      t.score = (sizeScore + activityScore + engagementScore) / 3;
      t.sizeScore = sizeScore;
      t.activityScore = activityScore;
      t.engagementScore = engagementScore;
    }
    return teams.sort((a, b) => b.score - a.score);
  }

  function leagueTotals(data, windowDays = 7) {
    const md = maxDate([...data.accounts, ...data.posts]);
    const from = addDays(md, -windowDays);
    const prevFrom = addDays(md, -windowDays * 2);

    const slugs = CFG.teams.map((t) => t.slug);
    const subsNow = slugs.reduce((s, slug) => s + subsSumOnDay(data.accounts, slug, md), 0);
    const subsPrev = slugs.reduce((s, slug) => s + subsSumOnDay(data.accounts, slug, from), 0);

    const windowPosts = data.posts.filter((p) => p.team && p.date >= from && p.date <= md);
    const prevPosts = data.posts.filter((p) => p.team && p.date >= prevFrom && p.date < from);

    return {
      referenceDate: md,
      windowDays,
      subs: subsNow,
      subsDelta: subsNow - subsPrev,
      subsDeltaPct: subsPrev > 0 ? (subsNow - subsPrev) / subsPrev : 0,
      engagement: sumEngagement(windowPosts),
      engagementPrev: sumEngagement(prevPosts),
      posts: windowPosts.length,
      postsPrev: prevPosts.length,
      fastestGrowingTeam: leagueLeaderboard(data, windowDays)
        .slice()
        .sort((a, b) => b.subsDelta - a.subsDelta)[0],
    };
  }

  function weeklyTrendByTeam(data) {
    const byTeamWeek = new Map();
    for (const r of data.accounts) {
      if (!r.team) continue;
      const key = `${r.team}|${r.week}`;
      const prev = byTeamWeek.get(key);
      if (!prev || prev.date < r.date) byTeamWeek.set(key, r);
    }
    const teamWeeks = new Map();
    for (const [key, row] of byTeamWeek) {
      const [team, week] = key.split('|');
      if (!teamWeeks.has(team)) teamWeeks.set(team, new Map());
      const accumulator = teamWeeks.get(team);
      accumulator.set(week, (accumulator.get(week) || 0) + row.subs);
    }
    const weeks = new Set();
    for (const m of teamWeeks.values()) for (const w of m.keys()) weeks.add(w);
    const sortedWeeks = [...weeks].sort();
    const result = { weeks: sortedWeeks, series: [] };
    for (const team of CFG.teams) {
      const series = sortedWeeks.map((w) => (teamWeeks.get(team.slug) || new Map()).get(w) ?? null);
      result.series.push({ team, values: series });
    }
    return result;
  }

  function platformMixByTeam(data) {
    const platforms = ['ig', 'fb', 'tt', 'yt'];
    const rows = [];
    for (const team of CFG.teams) {
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

  function growthRanking(data, windowDays = 7) {
    const md = maxDate(data.accounts);
    const from = addDays(md, -windowDays);
    const rows = [];
    for (const team of CFG.teams) {
      const now = subsSumOnDay(data.accounts, team.slug, md);
      const before = subsSumOnDay(data.accounts, team.slug, from);
      rows.push({ team, subs: now, delta: now - before, pct: before > 0 ? (now - before) / before : 0 });
    }
    return rows.filter((r) => r.subs > 0);
  }

  window.ULLHMetrics = {
    maxDate, addDays, formatNumber, formatDelta,
    latestSubs, subsByDate, currentSubsSumByTeam, subsSumOnDay, subsGrowth,
    postsInWindow, avgEr, sumEngagement, sumImpressions,
    teamSnapshot, leagueLeaderboard, leagueTotals,
    weeklyTrendByTeam, platformMixByTeam,
    bestPostingTimes, formatMix, topPosts,
    consistencyHeroes, captionLengthBuckets, growthRanking,
  };
})();
