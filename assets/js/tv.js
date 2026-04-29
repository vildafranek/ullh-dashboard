(function () {
  const M = window.ULLHMetrics;
  const C = window.ULLHCharts;

  const METRIC_LABELS = {
    count: 'Počet přenosů',
    reach4plus: 'Reach 4+ (tis.)',
    rating000_4plus: 'Rating 4+ (tis.)',
    share4plus: 'Share 4+',
    reach15plus: 'Reach 15+ (tis.)',
    reachM15plus: 'Reach muži 15+ (tis.)',
    reachZ15plus: 'Reach ženy 15+ (tis.)',
  };

  function fmt(n, opts = {}) { return M.formatNumber(n, opts); }
  function pct(n, digits = 2) {
    if (!Number.isFinite(n)) return '—';
    return new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n * 100) + ' %';
  }
  function dateFmt(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }).format(d);
  }

  function kpiCard({ label, value, sub, delta }) {
    const subHtml = sub ? `<div class="kpi__sub">${sub}</div>` : '';
    const deltaHtml = delta ? `<div class="kpi__delta ${delta.klass}">${delta.text}</div>` : '';
    const div = document.createElement('div');
    div.className = 'kpi';
    div.innerHTML = `<div class="kpi__label">${label}</div><div class="kpi__value">${value}</div>${deltaHtml}${subHtml}`;
    return div;
  }

  async function loadData() {
    const [tv, plus] = await Promise.all([
      fetch('assets/data/tv-ct-sport.json').then((r) => r.json()),
      fetch('assets/data/tv-ct-sport-plus.json').then((r) => r.json()),
    ]);
    return { tv, plus };
  }

  function renderKpis({ tv, plus }) {
    const grid = document.getElementById('kpi-grid');
    grid.innerHTML = '';

    const tvPrem = tv.records.filter((r) => r.premiera === 'premiéra');
    const tvRepr = tv.records.filter((r) => r.premiera !== 'premiéra');
    const totalReach = tvPrem.reduce((s, r) => s + (r.reach4plus || 0), 0);
    const tvTopRecord = tvPrem.slice().sort((a, b) => (b.reach4plus || 0) - (a.reach4plus || 0))[0];

    const plusTotal = plus.records.length;
    const plusTotalViews = plus.records.reduce((s, r) => s + (r.viewsLive || 0), 0);
    const plusTotalHours = plus.records.reduce((s, r) => s + (r.watchedHours || 0), 0);
    const plusTop = plus.records.slice().sort((a, b) => (b.viewsLive || 0) - (a.viewsLive || 0))[0];

    const seasonsKnown = [...new Set(tv.records.map((r) => seasonKeyForRecord(r)).filter(Boolean))].sort();
    const firstSeason = seasonsKnown[0] || '—';
    grid.appendChild(kpiCard({
      label: 'Premiéry na ČT sport',
      value: fmt(tvPrem.length),
      sub: `+ ${fmt(tvRepr.length)} repríz · od sezóny ${firstSeason}`,
    }));
    grid.appendChild(kpiCard({
      label: 'Celkový reach 4+ (TV)',
      value: fmt(totalReach * 1000, { compact: true }),
      sub: 'Sum reach 4+ ze všech premiér · proxy „kolik lidí to v lize zachytilo"',
    }));
    grid.appendChild(kpiCard({
      label: 'Rekordní TV přenos',
      value: fmt((tvTopRecord?.reach4plus || 0) * 1000, { compact: true }),
      sub: tvTopRecord ? `${tvTopRecord.title?.replace(/^Hokej:\s*/, '') || '—'} · ${dateFmt(tvTopRecord.date)}` : '—',
    }));
    const plusFirstSeason = (() => {
      const seasons = [...new Set(plus.records.map((r) => seasonKeyForRecord(r)).filter(Boolean))].sort();
      return seasons[0] || '—';
    })();
    grid.appendChild(kpiCard({
      label: 'Online přenosy (ČT sport Plus)',
      value: fmt(plusTotal),
      sub: `Od sezóny ${plusFirstSeason} · ${fmt(plusTotalHours)} h sledování celkem`,
    }));
    grid.appendChild(kpiCard({
      label: 'Online views celkem',
      value: fmt(plusTotalViews, { compact: true }),
      sub: 'Sum „views živě" napříč všemi přenosy',
    }));
    grid.appendChild(kpiCard({
      label: 'Rekordní online přenos',
      value: fmt(plusTop?.viewsLive || 0, { compact: true }),
      sub: plusTop ? `${(plusTop.title || '').replace(/^Univerzitní hokejová liga[:\s-]*/i, '').replace(/^Hokej[:\s-]*/i, '').slice(0, 90)} · sezóna ${seasonKeyForRecord(plusTop) || plusTop.year}` : '—',
    }));
  }

  function seasonKeyForRecord(r) {
    if (r.date) {
      const s = M.seasonOf(r.date);
      if (s) return s.key;
    }
    // fallback: rok
    if (r.year) return String(r.year);
    return null;
  }

  function aggregateBySeason(records, valueKey, mode) {
    const bySeason = new Map();
    for (const r of records) {
      const key = seasonKeyForRecord(r);
      if (!key) continue;
      if (!bySeason.has(key)) bySeason.set(key, []);
      const v = valueKey === 'count' ? 1 : (r[valueKey] || 0);
      bySeason.get(key).push(v);
    }
    const keys = [...bySeason.keys()].sort();
    const series = keys.map((k) => {
      const vals = bySeason.get(k).filter((v) => v != null);
      if (!vals.length) return 0;
      if (mode === 'sum' || valueKey === 'count') return vals.reduce((s, v) => s + v, 0);
      if (mode === 'avg') return vals.reduce((s, v) => s + v, 0) / vals.length;
      if (mode === 'max') return Math.max(...vals);
      return vals.reduce((s, v) => s + v, 0);
    });
    return { years: keys, series };
  }
  // Zpětná kompatibilita názvu (interně teď agreguje po sezónách)
  const aggregateByYear = aggregateBySeason;

  function renderTvYearlyChart(tv) {
    const metric = document.getElementById('tv-metric').value;
    const view = document.getElementById('tv-view').value;
    const prem = tv.records.filter((r) => r.premiera === 'premiéra');
    const repr = tv.records.filter((r) => r.premiera !== 'premiéra');

    const a = aggregateByYear(prem, metric, view);
    const b = aggregateByYear(repr, metric, view);
    // unify years
    const years = [...new Set([...a.years, ...b.years])].sort();
    const premSeries = years.map((y) => {
      const i = a.years.indexOf(y);
      return i >= 0 ? Number(a.series[i].toFixed(metric === 'count' ? 0 : 2)) : 0;
    });
    const reprSeries = years.map((y) => {
      const i = b.years.indexOf(y);
      return i >= 0 ? Number(b.series[i].toFixed(metric === 'count' ? 0 : 2)) : 0;
    });

    const isPercent = metric === 'share4plus';
    const yLabel = METRIC_LABELS[metric] + (view === 'avg' ? ' (Ø/přenos)' : view === 'max' ? ' (rekord)' : '');

    const stacked = metric === 'count' || (view === 'sum' && !isPercent);

    C.init(document.getElementById('chart-tv-yearly'), {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { top: 0, itemWidth: 12, itemHeight: 8 },
      grid: { top: 36, left: 56, right: 16, bottom: 30 },
      xAxis: { type: 'category', data: years.map(String) },
      yAxis: {
        type: 'value', name: yLabel, nameTextStyle: { color: '#6B7A99', fontSize: 11 },
        axisLabel: { formatter: (v) => isPercent ? (v * 100).toFixed(1) + ' %' : new Intl.NumberFormat('cs-CZ').format(v) },
      },
      series: [
        {
          name: 'Premiéra', type: 'bar', stack: stacked ? 'tv' : null,
          data: premSeries, itemStyle: { color: '#00D4FF', borderRadius: stacked ? 0 : [6,6,0,0] }, barMaxWidth: 44,
        },
        {
          name: 'Repríza', type: 'bar', stack: stacked ? 'tv' : null,
          data: reprSeries, itemStyle: { color: '#2563EB', borderRadius: stacked ? [6,6,0,0] : [6,6,0,0] }, barMaxWidth: 44,
        },
      ],
    });
  }

  function renderTvTopTable(tv) {
    const top = tv.records
      .filter((r) => r.premiera === 'premiéra' && r.reach4plus)
      .slice().sort((a, b) => (b.reach4plus || 0) - (a.reach4plus || 0))
      .slice(0, 10);
    const container = document.getElementById('tv-top-table');
    if (!top.length) { container.innerHTML = '<div class="empty">Bez dat.</div>'; return; }
    container.innerHTML = `<table class="table"><thead><tr>
      <th>#</th><th>Datum</th><th>Den</th><th>Titul</th><th style="text-align:right">Reach 4+ (tis.)</th><th style="text-align:right">Rating 4+ (tis.)</th><th style="text-align:right">Share 4+</th><th style="text-align:right">Reach 15+ (tis.)</th>
    </tr></thead><tbody>${top.map((r, i) => `<tr>
      <td><strong>${i + 1}</strong></td>
      <td>${dateFmt(r.date)}</td>
      <td style="color: var(--silver)">${r.dow || ''}</td>
      <td class="caption-cell">${(r.title || '').replace(/^Hokej:\s*/, '')}</td>
      <td style="text-align:right"><strong>${fmt(r.reach4plus)}</strong></td>
      <td style="text-align:right">${fmt(r.rating000_4plus)}</td>
      <td style="text-align:right">${pct(r.share4plus, 1)}</td>
      <td style="text-align:right">${fmt(r.reach15plus)}</td>
    </tr>`).join('')}</tbody></table>`;
  }

  function renderPlusYearlyChart(plus) {
    const a = aggregateByYear(plus.records, 'count', 'sum');
    const b = aggregateByYear(plus.records, 'viewsLive', 'sum');
    const c = aggregateByYear(plus.records, 'watchedHours', 'sum');

    C.init(document.getElementById('chart-plus-yearly'), {
      tooltip: { trigger: 'axis' },
      legend: { top: 0, itemWidth: 12, itemHeight: 8 },
      grid: { top: 36, left: 56, right: 60, bottom: 30 },
      xAxis: { type: 'category', data: a.years.map(String) },
      yAxis: [
        { type: 'value', name: 'Počet přenosů', position: 'left', nameTextStyle: { color: '#6B7A99', fontSize: 11 }, axisLabel: { formatter: (v) => new Intl.NumberFormat('cs-CZ').format(v) } },
        { type: 'value', name: 'Views / hodiny', position: 'right', nameTextStyle: { color: '#6B7A99', fontSize: 11 }, axisLabel: { formatter: (v) => new Intl.NumberFormat('cs-CZ').format(Math.round(v)) } },
      ],
      series: [
        { name: 'Počet přenosů', type: 'bar', yAxisIndex: 0, data: a.series, itemStyle: { color: '#2563EB', borderRadius: [6,6,0,0] }, barMaxWidth: 38 },
        { name: 'Views živě (sum)', type: 'line', yAxisIndex: 1, data: b.series.map((v) => Math.round(v)), smooth: true, lineStyle: { color: '#00D4FF', width: 3 }, itemStyle: { color: '#00D4FF' }, symbolSize: 8 },
        { name: 'Sledované hodiny', type: 'line', yAxisIndex: 1, data: c.series.map((v) => Math.round(v)), smooth: true, lineStyle: { color: '#22D3EE', width: 2, type: 'dashed' }, itemStyle: { color: '#22D3EE' }, symbolSize: 6 },
      ],
    });
  }

  function renderPlusTopTable(plus) {
    const top = plus.records.slice()
      .sort((a, b) => (b.viewsLive || 0) - (a.viewsLive || 0))
      .slice(0, 10);
    const container = document.getElementById('plus-top-table');
    if (!top.length) { container.innerHTML = '<div class="empty">Bez dat.</div>'; return; }
    container.innerHTML = `<table class="table"><thead><tr>
      <th>#</th><th>Sezóna</th><th>Datum</th><th>Zápas</th><th style="text-align:right">Views živě</th><th style="text-align:right">Sledov. hodin</th><th style="text-align:right">Délka přenosu</th>
    </tr></thead><tbody>${top.map((r, i) => {
      const cleanTitle = (r.title || '').replace(/^Univerzitní hokejová liga[:\s-]*/i, '').replace(/^Hokej[:\s-]*/i, '').replace(/\(hokej\/ULLH\)\s*$/i, '').trim();
      return `<tr>
        <td><strong>${i + 1}</strong></td>
        <td>${seasonKeyForRecord(r) || r.year}</td>
        <td>${r.rawDate || ''}</td>
        <td class="caption-cell">${cleanTitle}</td>
        <td style="text-align:right"><strong>${fmt(r.viewsLive)}</strong></td>
        <td style="text-align:right">${r.watchedHours ? fmt(r.watchedHours) + ' h' : '—'}</td>
        <td style="text-align:right">${r.durationMin ? r.durationMin + ' min' : '—'}</td>
      </tr>`;
    }).join('')}</tbody></table>`;
  }

  function renderCrossChart({ tv, plus }) {
    const tvByYear = aggregateByYear(tv.records.filter((r) => r.premiera === 'premiéra'), 'reach4plus', 'sum');
    const plusByYear = aggregateByYear(plus.records, 'viewsLive', 'sum');
    const allYears = [...new Set([...tvByYear.years, ...plusByYear.years])].sort();
    const tvSeries = allYears.map((y) => {
      const i = tvByYear.years.indexOf(y);
      return i >= 0 ? Math.round(tvByYear.series[i] * 1000) : null;
    });
    const plusSeries = allYears.map((y) => {
      const i = plusByYear.years.indexOf(y);
      return i >= 0 ? Math.round(plusByYear.series[i]) : null;
    });

    C.init(document.getElementById('chart-cross'), {
      tooltip: { trigger: 'axis' },
      legend: { top: 0, itemWidth: 12, itemHeight: 8 },
      grid: { top: 36, left: 64, right: 64, bottom: 30 },
      xAxis: { type: 'category', data: allYears.map(String) },
      yAxis: [
        { type: 'value', name: 'TV reach 4+', position: 'left', nameTextStyle: { color: '#6B7A99', fontSize: 11 }, axisLabel: { formatter: (v) => new Intl.NumberFormat('cs-CZ', { notation: 'compact', maximumFractionDigits: 1 }).format(v) } },
        { type: 'value', name: 'Online views', position: 'right', nameTextStyle: { color: '#6B7A99', fontSize: 11 }, axisLabel: { formatter: (v) => new Intl.NumberFormat('cs-CZ').format(v) } },
      ],
      series: [
        { name: 'TV reach 4+ (premiéry, sum)', type: 'bar', yAxisIndex: 0, data: tvSeries, itemStyle: { color: 'rgba(0,212,255,0.5)' }, barMaxWidth: 36 },
        { name: 'Online views živě (sum)', type: 'line', yAxisIndex: 1, data: plusSeries, smooth: true, lineStyle: { color: '#22D3EE', width: 3 }, itemStyle: { color: '#22D3EE' }, symbolSize: 9 },
      ],
    });
  }

  function renderMeta(data) {
    const now = new Date();
    const allSeasons = [...new Set([...data.tv.records, ...data.plus.records].map(seasonKeyForRecord).filter(Boolean))].sort();
    const range = allSeasons.length ? `<strong>sezóna ${allSeasons[0]} – ${allSeasons[allSeasons.length - 1]}</strong>` : '<strong>—</strong>';
    document.getElementById('meta').innerHTML = `Datový záběr ${range}`;
    document.getElementById('data-updated').textContent = new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' }).format(now);
  }

  async function init() {
    try {
      const data = await loadData();
      renderMeta(data);
      renderKpis(data);
      renderTvYearlyChart(data.tv);
      renderTvTopTable(data.tv);
      renderPlusYearlyChart(data.plus);
      renderPlusTopTable(data.plus);
      renderCrossChart(data);

      document.getElementById('tv-metric').addEventListener('change', () => renderTvYearlyChart(data.tv));
      document.getElementById('tv-view').addEventListener('change', () => renderTvYearlyChart(data.tv));
    } catch (err) {
      console.error(err);
      document.getElementById('kpi-grid').innerHTML = `<div class="panel" style="grid-column: 1 / -1"><div class="panel__title" style="color: var(--bad)">Nepodařilo se načíst data</div><div class="panel__note">${err.message || err}</div></div>`;
    }
  }

  init();
})();
