// Spustit v Chromu na https://business.carlforsocial.com (přihlášený), např. přes DevTools konzoli.
// Projde všechny tvůrce kampaně, u každého účtu vytáhne graf "Odběratelé" (aktuální hodnota + týdenní řada)
// a stáhne výsledek jako carl_followers_<datum>.json do ~/Downloads.
(async () => {
  const C = '/campaign/65d312e5-d1a7-4631-9dc2-760ef938613c/creators';
  const get = async (u) => new DOMParser().parseFromString(await (await fetch(u, { headers: { 'HX-Request': 'true' } })).text(), 'text/html');
  const list = await get(C);
  const creators = [...new Set([...list.querySelectorAll('a[href*="/profile"]')]
    .map((a) => a.getAttribute('href').match(/creators\/([0-9a-f-]{36})\/profile/)?.[1]).filter(Boolean))];
  const res = [];
  for (const c of creators) {
    const d = await get(`${C}/${c}/profile`);
    const accs = [...new Set([...d.querySelectorAll('a[href*="/profile/"]')]
      .map((a) => a.getAttribute('href').match(/profile\/([0-9a-f-]{36})/)?.[1]).filter(Boolean))];
    for (const acc of accs) {
      const p = await get(`${C}/${c}/profile/${acc}`);
      const lc = [...p.querySelectorAll('[data-linechart]')].map((e) => JSON.parse(e.dataset.linechart)).find((o) => o.title === 'Odběratelé');
      const link = p.querySelector('a[target="_blank"][href*="instagram.com"],a[target="_blank"][href*="facebook.com"],a[target="_blank"][href*="tiktok.com"],a[target="_blank"][href*="youtube.com"]');
      res.push({ c, acc, url: link?.getAttribute('href'), value: lc?.value ?? null, series: lc?.seriesData || [] });
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(res)], { type: 'application/json' }));
  a.download = `carl_followers_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  return res.length;
})();
