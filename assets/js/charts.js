(function () {
  const CFG = window.ULLH_CONFIG;

  const THEME = {
    color: [
      '#00D4FF', '#2563EB', '#22D3EE', '#10B981', '#F59E0B',
      '#EF4444', '#A855F7', '#E11D48', '#14B8A6', '#FACC15',
      '#3B82F6', '#64748B',
    ],
    textStyle: {
      fontFamily: "'Sinter', -apple-system, system-ui, sans-serif",
      color: '#FFFFFF',
    },
    backgroundColor: 'transparent',
    grid: { left: 40, right: 16, top: 24, bottom: 32, containLabel: true },
    xAxis: {
      axisLine: { lineStyle: { color: 'rgba(156,163,175,0.3)' } },
      axisLabel: { color: '#9CA3AF', fontSize: 11 },
      splitLine: { show: false },
    },
    yAxis: {
      axisLine: { show: false },
      axisLabel: { color: '#9CA3AF', fontSize: 11 },
      splitLine: { lineStyle: { color: 'rgba(0,212,255,0.08)' } },
    },
    tooltip: {
      backgroundColor: 'rgba(10, 30, 66, 0.95)',
      borderColor: 'rgba(0, 212, 255, 0.35)',
      borderWidth: 1,
      textStyle: { color: '#FFFFFF', fontFamily: "'Sinter', system-ui", fontSize: 12 },
      extraCssText: 'backdrop-filter: blur(10px); border-radius: 8px;',
    },
    legend: { textStyle: { color: '#9CA3AF', fontSize: 11 } },
  };

  function init(el, option) {
    const chart = echarts.init(el, null, { renderer: 'canvas' });
    chart.setOption(deepMerge(THEME, option));
    window.addEventListener('resize', () => chart.resize());
    return chart;
  }

  function deepMerge(a, b) {
    if (Array.isArray(b)) return b.slice();
    if (typeof b !== 'object' || b === null) return b;
    const out = { ...a };
    for (const k of Object.keys(b)) {
      if (typeof b[k] === 'object' && !Array.isArray(b[k]) && b[k] !== null && typeof out[k] === 'object' && out[k] !== null) {
        out[k] = deepMerge(out[k], b[k]);
      } else {
        out[k] = b[k];
      }
    }
    return out;
  }

  function growthTrend(el, trend) {
    const series = trend.series.map((s) => ({
      name: s.team.name,
      type: 'line',
      data: s.values,
      smooth: true,
      showSymbol: false,
      lineStyle: { width: 2, color: s.team.color },
      itemStyle: { color: s.team.color },
      emphasis: { focus: 'series', lineStyle: { width: 3 } },
    }));
    return init(el, {
      xAxis: { type: 'category', data: trend.weeks, boundaryGap: false },
      yAxis: { type: 'value', name: 'Followers', nameTextStyle: { color: '#6B7A99', fontSize: 11 } },
      tooltip: { trigger: 'axis' },
      legend: { top: 0, type: 'scroll', itemWidth: 12, itemHeight: 8 },
      grid: { top: 40, left: 48, right: 16, bottom: 30 },
      series,
    });
  }

  function platformMix(el, rows) {
    const categories = rows.map((r) => r.team.short);
    const mk = (p, label, color) => ({
      name: label,
      type: 'bar',
      stack: 'total',
      data: rows.map((r) => r[p]),
      itemStyle: { color },
      barMaxWidth: 28,
    });
    return init(el, {
      xAxis: { type: 'value' },
      yAxis: { type: 'category', data: categories, inverse: true },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { top: 0, itemWidth: 12, itemHeight: 8 },
      grid: { top: 32, left: 48, right: 16, bottom: 20 },
      series: [
        mk('ig', 'Instagram', CFG.platforms.instagram.color),
        mk('fb', 'Facebook',  CFG.platforms.facebook.color),
        mk('tt', 'TikTok',    CFG.platforms.tiktok.color),
        mk('yt', 'YouTube',   CFG.platforms.youtube.color),
      ],
    });
  }

  function teamActivityHeat(el, data) {
    const teams = CFG.teams;
    const platforms = [['ig','IG'], ['fb','FB'], ['tt','TT'], ['yt','YT']];
    const rows = [];
    const max = { v: 0 };
    for (let ti = 0; ti < teams.length; ti++) {
      for (let pi = 0; pi < platforms.length; pi++) {
        const [pk] = platforms[pi];
        const md = window.ULLHMetrics.maxDate(data.posts);
        const from = window.ULLHMetrics.addDays(md, -28);
        const pts = data.posts.filter((p) => p.team === teams[ti].slug && p.platform === pk && p.date >= from);
        const count = pts.length;
        const er = window.ULLHMetrics.avgEr(pts);
        const v = count * er;
        rows.push([pi, ti, count ? Number(v.toFixed(4)) : 0, count, er]);
        if (v > max.v) max.v = v;
      }
    }
    return init(el, {
      tooltip: {
        formatter: (p) => {
          const [, , v, count, er] = p.data;
          const team = teams[p.data[1]].name;
          const plat = platforms[p.data[0]][1];
          return `${team} · ${plat}<br>Postů (28 d): <b>${count}</b><br>Ø ER: <b>${(er * 100).toFixed(2)}%</b>`;
        },
      },
      grid: { top: 20, left: 80, right: 16, bottom: 48 },
      xAxis: { type: 'category', data: platforms.map((p) => p[1]), splitArea: { show: true } },
      yAxis: { type: 'category', data: teams.map((t) => t.short), splitArea: { show: true } },
      visualMap: {
        min: 0,
        max: max.v || 1,
        calculable: false,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        textStyle: { color: '#9CA3AF', fontSize: 10 },
        inRange: { color: ['#0a1e42', '#2563EB', '#00D4FF'] },
      },
      series: [{
        type: 'heatmap',
        data: rows,
        label: { show: false },
        emphasis: { itemStyle: { borderColor: '#fff', borderWidth: 1 } },
      }],
    });
  }

  function bestTimesHeat(el, data) {
    const days = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];
    const hours = Array.from({ length: 24 }, (_, i) => `${i}:00`);
    const values = data.map(([h, d, er, count]) => [h, d, Number((er * 100).toFixed(2)), count]);
    const max = values.reduce((m, v) => Math.max(m, v[2]), 0);
    return init(el, {
      tooltip: {
        formatter: (p) => {
          const [h, d, er, count] = p.data;
          return `${days[d]} ${h}:00<br>Ø ER: <b>${er.toFixed(2)}%</b><br>Postů: <b>${count}</b>`;
        },
      },
      grid: { top: 16, left: 40, right: 16, bottom: 56 },
      xAxis: { type: 'category', data: hours, splitArea: { show: true }, axisLabel: { interval: 2 } },
      yAxis: { type: 'category', data: days, splitArea: { show: true } },
      visualMap: {
        min: 0, max: max || 1,
        calculable: false, orient: 'horizontal', left: 'center', bottom: 0,
        textStyle: { color: '#9CA3AF', fontSize: 10 },
        inRange: { color: ['#0a1e42', '#2563EB', '#00D4FF', '#22D3EE'] },
      },
      series: [{
        type: 'heatmap', data: values,
        emphasis: { itemStyle: { borderColor: '#fff', borderWidth: 1 } },
      }],
    });
  }

  function formatBars(el, rows) {
    const labels = CFG.formatLabels;
    return init(el, {
      xAxis: { type: 'category', data: rows.map((r) => labels[r.format] || r.format) },
      yAxis: { type: 'value', name: 'Ø ER (%)', nameTextStyle: { color: '#6B7A99', fontSize: 11 } },
      tooltip: {
        trigger: 'axis',
        formatter: (p) => {
          const i = p[0].dataIndex;
          const r = rows[i];
          return `${labels[r.format] || r.format}<br>Ø ER: <b>${(r.avgEr * 100).toFixed(2)}%</b><br>Postů: <b>${r.count}</b>`;
        },
      },
      grid: { top: 20, left: 44, right: 16, bottom: 30 },
      series: [{
        type: 'bar',
        data: rows.map((r) => Number((r.avgEr * 100).toFixed(2))),
        itemStyle: { color: '#00D4FF', borderRadius: [6, 6, 0, 0] },
        barMaxWidth: 44,
      }],
    });
  }

  function scatterTimeEr(el, posts) {
    const bySeries = {};
    for (const p of posts) {
      if (!p.platform || !p.er) continue;
      if (!bySeries[p.platform]) bySeries[p.platform] = [];
      bySeries[p.platform].push([p.hour + Math.random() * 0.8, Number((p.er * 100).toFixed(2)), p]);
    }
    const series = Object.entries(bySeries).map(([plat, arr]) => {
      const p = Object.values(CFG.platforms).find((x) => x.key === plat);
      return {
        name: p ? p.label : plat,
        type: 'scatter',
        data: arr,
        symbolSize: 7,
        itemStyle: { color: p ? p.color : '#999', opacity: 0.75 },
        emphasis: { itemStyle: { opacity: 1, borderColor: '#fff', borderWidth: 1 } },
      };
    });
    return init(el, {
      xAxis: { type: 'value', min: 0, max: 24, name: 'Hodina publikace' },
      yAxis: { type: 'value', name: 'ER (%)' },
      tooltip: {
        formatter: (p) => {
          const post = p.data[2];
          const caption = (post.caption || '').slice(0, 80);
          return `<b>${post.teamName || post.accountName}</b><br>${post.postType} · ${post.hour}:${String(post.date.getMinutes()).padStart(2,'0')}<br>ER: <b>${(post.er*100).toFixed(2)}%</b><br><span style="color:#9CA3AF">${caption}</span>`;
        },
      },
      legend: { top: 0, itemWidth: 10, itemHeight: 8 },
      grid: { top: 30, left: 44, right: 16, bottom: 40 },
      series,
    });
  }

  function captionLengthBars(el, buckets) {
    return init(el, {
      xAxis: { type: 'category', data: buckets.map((b) => b.label) },
      yAxis: { type: 'value', name: 'Ø ER (%)', nameTextStyle: { color: '#6B7A99', fontSize: 11 } },
      tooltip: {
        trigger: 'axis',
        formatter: (p) => {
          const b = buckets[p[0].dataIndex];
          return `${b.label} znaků<br>Ø ER: <b>${(b.avgEr * 100).toFixed(2)}%</b><br>Postů: <b>${b.count}</b>`;
        },
      },
      grid: { top: 20, left: 44, right: 16, bottom: 30 },
      series: [{
        type: 'bar',
        data: buckets.map((b) => Number((b.avgEr * 100).toFixed(2))),
        itemStyle: { color: '#2563EB', borderRadius: [6, 6, 0, 0] },
        barMaxWidth: 44,
      }],
    });
  }

  function teamSubsTrend(el, series) {
    return init(el, {
      xAxis: { type: 'time' },
      yAxis: { type: 'value', name: 'Followers' },
      tooltip: { trigger: 'axis' },
      legend: { top: 0, itemWidth: 12, itemHeight: 8 },
      grid: { top: 40, left: 56, right: 16, bottom: 30 },
      series: series.map((s) => ({
        name: s.name,
        type: 'line',
        showSymbol: false,
        smooth: true,
        lineStyle: { width: 2, color: s.color },
        itemStyle: { color: s.color },
        data: s.points,
      })),
    });
  }

  window.ULLHCharts = {
    init, growthTrend, platformMix, teamActivityHeat,
    bestTimesHeat, formatBars, scatterTimeEr, captionLengthBars, teamSubsTrend,
  };
})();
