(function () {
  function teamBadge(team, size = '') {
    if (!team) return '';
    const kindClass = team.kind === 'liga' ? ' liga' : '';
    const sizeClass = size ? ` ${size}` : '';
    const label = team.short || team.name;
    if (team.logo) {
      return `<span class="team-logo${kindClass}${sizeClass}" title="${team.name}"><img src="${team.logo}" alt="${team.name}" loading="lazy"></span>`;
    }
    return `<span class="team-logo${kindClass}${sizeClass}" style="background: linear-gradient(135deg, ${team.color}88, ${team.color})">${label}</span>`;
  }

  function teamHeroLogo(team) {
    if (!team) return '';
    if (team.logo) {
      return `<span class="team-logo xl"><img src="${team.logo}" alt="${team.name}"></span>`;
    }
    return `<span class="team-logo xl" style="background: linear-gradient(135deg, ${team.color}88, ${team.color})">${team.short || team.name}</span>`;
  }

  function fmtDate(date, opts = { day: 'numeric', month: 'numeric' }) {
    if (!(date instanceof Date)) return '—';
    return new Intl.DateTimeFormat('cs-CZ', opts).format(date);
  }

  window.ULLHUi = { teamBadge, teamHeroLogo, fmtDate };
})();
