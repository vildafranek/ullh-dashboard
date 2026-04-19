(function () {
  const M = window.ULLHMetrics;
  const C = window.ULLHCharts;
  const CFG = window.ULLH_CONFIG;

  const state = { allPosts: [], filtered: [], sort: { col: 'date', dir: 'desc' } };

  const columns = [
    { key: 'date', label: 'Datum', get: (p) => p.date, format: (v) => new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'numeric', year: '2-digit', hour: '2-digit', minute: '2-digit' }).format(v) },
    { key: 'team', label: 'Tým', get: (p) => p.teamName || p.accountName, format: (v) => v },
    { key: 'platform', label: 'Platforma', get: (p) => p.platform || '', format: (v) => v ? `<span class="badge ${v}">${Object.values(CFG.platforms).find(x => x.key === v)?.label || v}</span>` : '—' },
    { key: 'format', label: 'Formát', get: (p) => p.format || '', format: (v) => CFG.formatLabels[v] || v || '—' },
    { key: 'caption', label: 'Post', get: (p) => p, format: (p) => `<a href="${p.permalink}" target="_blank" rel="noopener">${(p.caption || '(bez popisku)').slice(0, 120).replace(/</g,'&lt;')}</a>` },
    { key: 'views', label: 'Zhlédnutí', get: (p) => p.views, format: (v) => M.formatNumber(v), align: 'right' },
    { key: 'likes', label: 'Like', get: (p) => p.likes, format: (v) => M.formatNumber(v), align: 'right' },
    { key: 'comments', label: 'Kom.', get: (p) => p.comments, format: (v) => M.formatNumber(v), align: 'right' },
    { key: 'engagement', label: 'Eng.', get: (p) => p.engagement, format: (v) => M.formatNumber(v), align: 'right' },
    { key: 'er', label: 'ER', get: (p) => p.er, format: (v) => (v * 100).toFixed(2) + '%', align: 'right' },
  ];

  function populateFilters(posts) {
    const teamSel = document.getElementById('f-team');
    const teamsHtml = '<option value="">Všechny</option>'
      + '<optgroup label="Týmy">' + CFG.teamsOnly.map((t) => `<option value="${t.slug}">${t.name}</option>`).join('') + '</optgroup>'
      + '<optgroup label="Ligové a event účty">' + CFG.ligaOnly.map((t) => `<option value="${t.slug}">${t.name}</option>`).join('') + '</optgroup>';
    teamSel.innerHTML = teamsHtml;
    const formats = [...new Set(posts.map((p) => p.format).filter(Boolean))];
    const fmtSel = document.getElementById('f-format');
    fmtSel.innerHTML = '<option value="">Vše</option>' + formats.map((f) => `<option value="${f}">${CFG.formatLabels[f] || f}</option>`).join('');
    const dates = posts.map((p) => p.date).sort((a, b) => a - b);
    if (dates.length) {
      document.getElementById('f-from').value = dates[0].toISOString().slice(0, 10);
      document.getElementById('f-to').value = dates[dates.length - 1].toISOString().slice(0, 10);
    }
    const presetTeam = new URL(location.href).searchParams.get('team');
    if (presetTeam) teamSel.value = presetTeam;
  }

  function getFilters() {
    return {
      team: document.getElementById('f-team').value,
      platform: document.getElementById('f-platform').value,
      format: document.getElementById('f-format').value,
      from: document.getElementById('f-from').value ? new Date(document.getElementById('f-from').value) : null,
      to: document.getElementById('f-to').value ? new Date(document.getElementById('f-to').value + 'T23:59:59') : null,
      minEr: parseFloat(document.getElementById('f-er').value || '0') / 100,
    };
  }

  function applyFilters() {
    const f = getFilters();
    state.filtered = state.allPosts.filter((p) => {
      if (f.team && p.team !== f.team) return false;
      if (f.platform && p.platform !== f.platform) return false;
      if (f.format && p.format !== f.format) return false;
      if (f.from && p.date < f.from) return false;
      if (f.to && p.date > f.to) return false;
      if (p.er < f.minEr) return false;
      return true;
    });
    sortAndRender();
  }

  function sortAndRender() {
    const { col, dir } = state.sort;
    const column = columns.find((c) => c.key === col);
    state.filtered.sort((a, b) => {
      const av = column.get(a);
      const bv = column.get(b);
      const cmp = (av > bv ? 1 : av < bv ? -1 : 0);
      return dir === 'asc' ? cmp : -cmp;
    });
    render();
  }

  function render() {
    const table = document.getElementById('posts-table');
    const thHtml = columns.map((c) => {
      const cls = c.key === state.sort.col ? `sorted-${state.sort.dir}` : '';
      const style = c.align === 'right' ? 'text-align: right' : '';
      return `<th class="${cls}" data-col="${c.key}" style="${style}">${c.label}</th>`;
    }).join('');
    const MAX_ROWS = 500;
    const rows = state.filtered.slice(0, MAX_ROWS);
    const bodyHtml = rows.map((p) => `<tr>${columns.map((c) => {
      const val = c.get(p);
      const formatted = c.format(val, p);
      const style = c.align === 'right' ? 'text-align: right' : '';
      return `<td style="${style}">${formatted}</td>`;
    }).join('')}</tr>`).join('');
    table.innerHTML = `<thead><tr>${thHtml}</tr></thead><tbody>${bodyHtml}</tbody>`;
    document.getElementById('filter-count').textContent = `${state.filtered.length} postů${state.filtered.length > MAX_ROWS ? ` (zobrazuji prvních ${MAX_ROWS})` : ''}`;
    table.querySelectorAll('th').forEach((th) => th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (!col) return;
      if (state.sort.col === col) state.sort.dir = state.sort.dir === 'asc' ? 'desc' : 'asc';
      else { state.sort.col = col; state.sort.dir = 'desc'; }
      sortAndRender();
    }));
  }

  function exportCsv() {
    const headers = columns.map((c) => c.label);
    const rows = state.filtered.map((p) => columns.map((c) => {
      const v = c.get(p);
      if (v instanceof Date) return v.toISOString();
      if (typeof v === 'object' && v && 'caption' in v) return v.caption;
      return v;
    }));
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ullh-posty-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function renderScatter() {
    C.scatterTimeEr(document.getElementById('scatter'), state.filtered);
  }

  function renderMeta(data) {
    const md = M.maxDate([...data.accounts, ...data.posts]);
    const fmt = new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' }).format(md);
    document.getElementById('meta').innerHTML = `Data ke dni <strong>${fmt}</strong>${data.fromCache ? ' · z cache' : ''}`;
  }

  async function init() {
    try {
      const data = await window.ULLHData.load();
      state.allPosts = data.posts.filter((p) => p.team);
      populateFilters(state.allPosts);
      renderMeta(data);
      applyFilters();
      renderScatter();

      document.querySelectorAll('#f-team, #f-platform, #f-format, #f-from, #f-to, #f-er').forEach((el) => {
        el.addEventListener('change', () => { applyFilters(); renderScatter(); });
        el.addEventListener('input', () => { applyFilters(); renderScatter(); });
      });
      document.getElementById('btn-export').addEventListener('click', exportCsv);
      document.getElementById('btn-reset').addEventListener('click', () => {
        document.getElementById('f-team').value = '';
        document.getElementById('f-platform').value = '';
        document.getElementById('f-format').value = '';
        document.getElementById('f-er').value = '0';
        const dates = state.allPosts.map((p) => p.date).sort((a, b) => a - b);
        if (dates.length) {
          document.getElementById('f-from').value = dates[0].toISOString().slice(0, 10);
          document.getElementById('f-to').value = dates[dates.length - 1].toISOString().slice(0, 10);
        }
        applyFilters(); renderScatter();
      });
    } catch (err) {
      console.error(err);
      document.getElementById('posts-table').innerHTML = `<tbody><tr><td style="color: var(--bad)">${String(err && err.message || err)}</td></tr></tbody>`;
    }
  }

  init();
})();
