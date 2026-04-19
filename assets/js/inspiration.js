(function () {
  const M = window.ULLHMetrics;
  const C = window.ULLHCharts;
  const CFG = window.ULLH_CONFIG;

  function teamBadge(team) {
    if (!team) return '—';
    return `<span class="team-logo" style="background: linear-gradient(135deg, ${team.color}88, ${team.color})">${team.short}</span>`;
  }

  function renderTopPosts(data) {
    const top = M.topPosts(data.posts, { limit: 10, windowDays: 28, minImpressions: 100 });
    const container = document.getElementById('top-posts-table');
    if (!top.length) {
      container.innerHTML = '<div class="empty">Zatím žádné posty s dostatečným dosahem v posledním měsíci.</div>';
      return;
    }
    const dfmt = new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
    container.innerHTML = `<table class="table"><thead><tr>
      <th>#</th><th>Tým</th><th>Platforma</th><th>Formát</th><th>Kdy</th><th>Post</th><th style="text-align:right">Eng.</th><th style="text-align:right">ER</th>
    </tr></thead><tbody>${top.map((p, i) => {
      const team = CFG.teams.find((t) => t.slug === p.team);
      return `<tr>
        <td><strong>${i + 1}</strong></td>
        <td><div class="team">${teamBadge(team)}${team?.name || p.teamName || p.accountName}</div></td>
        <td><span class="badge ${p.platform}">${Object.values(CFG.platforms).find(x=>x.key===p.platform)?.label || p.platform}</span></td>
        <td>${CFG.formatLabels[p.format] || p.format || '—'}</td>
        <td>${dfmt.format(p.date)}</td>
        <td class="caption-cell"><a href="${p.permalink}" target="_blank" rel="noopener">${(p.caption || '(bez popisku)').slice(0,120).replace(/</g,'&lt;')}</a></td>
        <td style="text-align:right">${M.formatNumber(p.engagement)}</td>
        <td style="text-align:right"><strong>${(p.er*100).toFixed(2)}%</strong></td>
      </tr>`;
    }).join('')}</tbody></table>`;
  }

  function renderGrowth(data) {
    const rows = M.growthRanking(data, 7).sort((a, b) => b.delta - a.delta);
    document.getElementById('growth-table').innerHTML = `<table class="leaderboard"><thead><tr>
      <th>#</th><th>Tým</th><th style="text-align:right">Followers</th><th style="text-align:right">Δ 7 d</th><th style="text-align:right">%</th>
    </tr></thead><tbody>${rows.slice(0, 8).map((r, i) => {
      const d = M.formatDelta(r.delta);
      const pct = M.formatDelta(r.pct, true);
      return `<tr><td><span class="rank">${i + 1}</span></td>
        <td><div class="team">${teamBadge(r.team)}${r.team.name}</div></td>
        <td style="text-align:right">${M.formatNumber(r.subs, { compact: true })}</td>
        <td style="text-align:right"><span class="delta ${d.klass}">${d.text}</span></td>
        <td style="text-align:right"><span class="delta ${pct.klass}">${pct.text}</span></td>
      </tr>`;
    }).join('')}</tbody></table>`;
  }

  function renderBestTimes(data) {
    const heat = M.bestPostingTimes(data.posts);
    if (!heat.length) {
      document.getElementById('times-heat').innerHTML = '<div class="empty">Nedostatek postů v datech pro heatmapu.</div>';
      return;
    }
    C.bestTimesHeat(document.getElementById('times-heat'), heat);
    const top = heat.slice().sort((a, b) => b[2] - a[2])[0];
    const days = ['ne', 'po', 'út', 'st', 'čt', 'pá', 'so'];
    document.getElementById('best-times-rule').innerHTML =
      `Nejsilnější slot v lize: <strong>${days[top[1]]} ${top[0]}–${top[0]+1} h</strong> (Ø ER ${(top[2]*100).toFixed(2)}%). Zkus sem umístit klíčové posty — důležité highlighty, bilance kola, před-zápasová motivace.`;
  }

  function renderFormats(data) {
    const container = document.getElementById('format-charts');
    container.innerHTML = '';
    const ranked = [];
    for (const [name, meta] of Object.entries(CFG.platforms)) {
      const rows = M.formatMix(data.posts, meta.key);
      if (!rows.length) continue;
      const wrap = document.createElement('div');
      wrap.innerHTML = `<h3 style="font-size: 13px; color: var(--silver); margin-bottom: 8px; letter-spacing: 0.5px;">${meta.label}</h3><div class="chart short" id="fmt-${meta.key}"></div>`;
      container.appendChild(wrap);
      C.formatBars(wrap.querySelector(`#fmt-${meta.key}`), rows);
      if (rows[0]) ranked.push({ platform: meta.label, format: rows[0].format, er: rows[0].avgEr });
    }
    const best = ranked.sort((a, b) => b.er - a.er)[0];
    if (best) {
      document.getElementById('formats-rule').innerHTML =
        `Nejsilnější kombinace v datech: <strong>${CFG.formatLabels[best.format] || best.format} na ${best.platform}</strong> (Ø ER ${(best.er*100).toFixed(2)}%). Instagram Reels obecně bijí statické fotky ~2–3× — pokud na nich nepracuješ, tohle je největší quick win.`;
    }
  }

  function renderConsistency(data) {
    const rows = M.consistencyHeroes(data);
    if (!rows.length) {
      document.getElementById('consistency-table').innerHTML = '<div class="empty">Nedostatek dat.</div>';
      return;
    }
    document.getElementById('consistency-table').innerHTML = `<table class="leaderboard"><thead><tr>
      <th>#</th><th>Tým</th><th style="text-align:right">Postů 8 tý</th><th style="text-align:right">Ø interval</th><th style="text-align:right">CV</th>
    </tr></thead><tbody>${rows.slice(0, 5).map((r, i) => `<tr>
      <td><span class="rank">${i + 1}</span></td>
      <td><div class="team">${teamBadge(r.team)}${r.team.name}</div></td>
      <td style="text-align:right">${r.posts}</td>
      <td style="text-align:right">${r.avgGapDays.toFixed(1)} d</td>
      <td style="text-align:right">${r.cv.toFixed(2)}</td>
    </tr>`).join('')}</tbody></table>`;
  }

  function renderCaption(data) {
    const buckets = M.captionLengthBuckets(data.posts, 'ig');
    if (!buckets.some((b) => b.count)) {
      document.getElementById('caption-bars').innerHTML = '<div class="empty">Nedostatek dat pro analýzu.</div>';
      return;
    }
    C.captionLengthBars(document.getElementById('caption-bars'), buckets);
    const best = buckets.slice().sort((a, b) => b.avgEr - a.avgEr)[0];
    document.getElementById('caption-rule').innerHTML =
      `Instagramový sweet spot: <strong>${best.label} znaků</strong> (Ø ER ${(best.avgEr*100).toFixed(2)}%). Pravidlo: short captions pro emoce a hype, longer captions pro behind-the-scenes storytelling.`;
  }

  function renderMeta(data) {
    const md = M.maxDate([...data.accounts, ...data.posts]);
    const fmt = new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' }).format(md);
    document.getElementById('meta').innerHTML = `Data ke dni <strong>${fmt}</strong>${data.fromCache ? ' · z cache' : ''}`;
  }

  async function init() {
    try {
      const data = await window.ULLHData.load();
      renderMeta(data);
      renderTopPosts(data);
      renderGrowth(data);
      renderBestTimes(data);
      renderFormats(data);
      renderConsistency(data);
      renderCaption(data);
    } catch (err) {
      console.error(err);
      document.body.insertAdjacentHTML('afterbegin', `<div style="padding: 24px; background: rgba(248,113,113,0.15); color: var(--bad)">${err.message || err}</div>`);
    }
  }

  init();
})();
