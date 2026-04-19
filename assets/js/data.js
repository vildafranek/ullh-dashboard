(function () {
  const CFG = window.ULLH_CONFIG;
  const CACHE_KEY = `ullh-cache-${CFG.cacheVersion}`;

  function parseCzDate(s) {
    if (!s) return null;
    const m = String(s).trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (!m) return null;
    const [, d, mo, y, hh = 0, mm = 0, ss = 0] = m;
    return new Date(Number(y), Number(mo) - 1, Number(d), Number(hh), Number(mm), Number(ss));
  }

  function isoWeekKey(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
  }

  function dayKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function toNum(v) {
    if (v === null || v === undefined || v === '') return 0;
    const n = Number(String(v).replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }

  function normalizeAccountRow(row) {
    const date = parseCzDate(row.data_date);
    if (!date) return null;
    const platformKey = (row.social_network_id || '').toLowerCase().trim();
    const platform = CFG.platforms[platformKey];
    const team = CFG.resolveTeam(row.account_name, row.carl_account_id);
    return {
      kind: 'account',
      date,
      day: dayKey(date),
      week: isoWeekKey(date),
      accountName: row.account_name || '',
      carlAccountId: row.carl_account_id || '',
      platformKey,
      platform: platform ? platform.key : null,
      team: team ? team.slug : null,
      teamName: team ? team.name : null,
      isLigaAccount: !team && CFG.ligaAccounts.accountNames.includes(row.account_name),
      subs: toNum(row.subs),
      reach: toNum(row.reach),
      impressions: toNum(row.page_impressions),
    };
  }

  function normalizePostRow(row) {
    const date = parseCzDate(row.published);
    if (!date) return null;
    const platformKey = (row.social_network_id || '').toLowerCase().trim();
    const platform = CFG.platforms[platformKey];
    const team = CFG.resolveTeam(row.account_name, row.carl_account_id);
    const postType = row.post_type || '';
    const typeMap = CFG.postTypeMap[postType] || {};
    let format = typeMap.format || null;
    const mediaType = (row.media_url_type || '').toUpperCase();
    if (!format) {
      if (mediaType === 'CAROUSEL_ALBUM' || mediaType === 'ALBUM') format = 'carousel';
      else if (mediaType === 'VIDEO' || mediaType === 'REEL') format = platformKey === 'instagram' ? 'reel' : 'video';
      else if (mediaType === 'IMAGE' || mediaType === 'PHOTO') format = 'photo';
      else if (mediaType === 'TEXT') format = 'text';
    }
    const impressions = toNum(row.impressions);
    const views = toNum(row.views);
    const likes = toNum(row.likes);
    const comments = toNum(row.comments);
    const shares = toNum(row.shares);
    const engagement = likes + comments + shares;
    const denom = impressions || views;
    const er = denom > 0 ? engagement / denom : 0;
    return {
      kind: 'post',
      date,
      day: dayKey(date),
      week: isoWeekKey(date),
      hour: date.getHours(),
      dow: date.getDay(),
      accountName: row.account_name || '',
      carlAccountId: row.carl_account_id || '',
      postId: row.carl_post_id || '',
      platformKey,
      platform: platform ? platform.key : null,
      team: team ? team.slug : null,
      teamName: team ? team.name : null,
      isLigaAccount: !team && CFG.ligaAccounts.accountNames.includes(row.account_name),
      postType,
      format,
      mediaType: mediaType || null,
      caption: (row.caption || '').trim(),
      captionLength: (row.caption || '').trim().length,
      permalink: row.permalink || '',
      impressions,
      views,
      likes,
      comments,
      shares,
      engagement,
      er,
    };
  }

  function fetchCsv(url) {
    return new Promise((resolve, reject) => {
      Papa.parse(url, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: (res) => resolve(res.data),
        error: reject,
      });
    });
  }

  async function load(options = {}) {
    const { force = false } = options;
    if (!force) {
      try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
        if (cached && cached.expiresAt > Date.now()) {
          cached.accounts = cached.accounts.map((r) => ({ ...r, date: new Date(r.date) }));
          cached.posts = cached.posts.map((r) => ({ ...r, date: new Date(r.date) }));
          cached.fromCache = true;
          return cached;
        }
      } catch (_) { /* ignore */ }
    }

    const [accountRaw, postRaw] = await Promise.all([
      fetchCsv(CFG.csvUrls.account),
      fetchCsv(CFG.csvUrls.post),
    ]);

    const accounts = accountRaw.map(normalizeAccountRow).filter(Boolean);
    const posts = postRaw.map(normalizePostRow).filter(Boolean);

    const ttl = CFG.cacheTtlMinutes * 60 * 1000;
    const result = {
      accounts,
      posts,
      fetchedAt: new Date().toISOString(),
      expiresAt: Date.now() + ttl,
      fromCache: false,
    };
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(result));
    } catch (_) { /* quota */ }
    return result;
  }

  function clearCache() { localStorage.removeItem(CACHE_KEY); }

  window.ULLHData = { load, clearCache, parseCzDate, isoWeekKey, dayKey };
})();
