window.ULLH_CONFIG = {
  source: {
    publishId: '2PACX-1vRfYZ7GQz-P3scyqXvzPaG1hr0n8dURLn5wgKmlj8CAqR8yM9ucXoYKhDZbiHdD6-0sLQ3M2fvRiEfE',
    accountGid: '1905041098',
    postGid: '82127506',
  },
  cacheTtlMinutes: 60,
  cacheVersion: 'v1',

  platforms: {
    instagram: { key: 'ig', label: 'Instagram', color: '#E1306C', order: 1 },
    facebook:  { key: 'fb', label: 'Facebook',  color: '#1877F2', order: 2 },
    tiktok:    { key: 'tt', label: 'TikTok',    color: '#25F4EE', order: 3 },
    youtube:   { key: 'yt', label: 'YouTube',   color: '#FF0033', order: 4 },
  },

  teams: [
    { slug: 'akademici',   name: 'Akademici Plzeň',  short: 'AKA', color: '#EF4444', accountIds: ['d87b94e3-f0a1-45fa-8cbf-6dc5f99d2ff0','65494228','8f78cb3d'], accountNames: ['@AkademiciPlzen','@akademiciplzen','@akademici_plzen'] },
    { slug: 'ostrava',     name: 'BO Ostrava',       short: 'OST', color: '#0EA5E9', accountIds: ['c9082543','1176ddaf'], accountNames: ['@BOhokej','@boostrava'] },
    { slug: 'cavaliers',   name: 'VUT Cavaliers',    short: 'CAV', color: '#A855F7', accountIds: ['3351b43e','b384bebf'], accountNames: ['@VUTCavaliersBrno','@vutcavaliersbrno'] },
    { slug: 'engineers',   name: 'Engineers ČVUT',   short: 'ENG', color: '#F59E0B', accountIds: ['afd06d1d','11963a07'], accountNames: ['@engineersprague','@cvutengineers'] },
    { slug: 'munibrno',    name: 'HC MUNI',          short: 'MUN', color: '#10B981', accountIds: ['d1f9e9f9','43cd62c8'], accountNames: ['@hcmuni','@hc_muni'] },
    { slug: 'hsubrno',     name: 'HSU Brno',         short: 'HSU', color: '#14B8A6', accountIds: ['86b4295e'], accountNames: ['@hsubrno'] },
    { slug: 'northwings',  name: 'North Wings',      short: 'NOW', color: '#64748B', accountIds: ['2b08a479'], accountNames: ['@hcnorthwings'] },
    { slug: 'olomouc',     name: 'HC UP Olomouc',    short: 'OLM', color: '#FACC15', accountIds: ['2ade9992','2d87eafd'], accountNames: ['@hcupolomouc'] },
    { slug: 'riders',      name: 'Riders Pardubice', short: 'RID', color: '#E11D48', accountIds: ['f99ed6c3','4d6a67ab'], accountNames: ['@riderspardubice'] },
    { slug: 'united',      name: 'UNIted HK',        short: 'UNI', color: '#3B82F6', accountIds: ['bfe6cc29','b18c071b','7e062517'], accountNames: ['@unitedhk','@united_hk'] },
    { slug: 'falcons',     name: 'VŠE Falcons',      short: 'FAL', color: '#22D3EE', accountIds: ['709fceba'], accountNames: ['vsefalcons','@vsefalcons'] },
  ],

  ligaAccounts: {
    description: 'Centrální a eventové účty ligy (nejsou samostatné týmy)',
    accountNames: [
      '@univerzitnihokej', '@derbyuniverzit', '@bitva_o_budejce',
      '@bitvaoprahu', '@vychodoceskederbyuniverzit', '@hokejovy_souboj_univerzit',
      '@218107044725785', '@742626308943576',
    ],
  },

  missingTeams: {
    description: 'Týmy z ULLH brand složky, které v datech nejsou (patrně nemají zveřejněné účty)',
    slugs: ['blackdogs', 'farmers', 'ukkings'],
  },

  postTypeMap: {
    'IG Post':   { platform: 'instagram', format: 'photo' },
    'IG Reel':   { platform: 'instagram', format: 'reel' },
    'IG Story':  { platform: 'instagram', format: 'story' },
    'FB Post':   { platform: 'facebook',  format: 'photo' },
    'FB Video':  { platform: 'facebook',  format: 'video' },
    'FB Story':  { platform: 'facebook',  format: 'story' },
    'TT Video':  { platform: 'tiktok',    format: 'video' },
    'YT Video':  { platform: 'youtube',   format: 'video' },
    'YT Short':  { platform: 'youtube',   format: 'short' },
  },

  formatLabels: {
    photo:    'Foto',
    reel:     'Reel',
    video:    'Video',
    story:    'Story',
    carousel: 'Karusel',
    short:    'Short',
    text:     'Text',
  },
};

window.ULLH_CONFIG.csvUrls = (() => {
  const { publishId, accountGid, postGid } = window.ULLH_CONFIG.source;
  const base = `https://docs.google.com/spreadsheets/d/e/${publishId}/pub`;
  return {
    account: `${base}?output=csv&single=true&gid=${accountGid}`,
    post:    `${base}?output=csv&single=true&gid=${postGid}`,
  };
})();

window.ULLH_CONFIG.teamLookup = (() => {
  const byName = new Map();
  const byId = new Map();
  for (const team of window.ULLH_CONFIG.teams) {
    for (const n of team.accountNames) byName.set(n.toLowerCase(), team);
    for (const id of team.accountIds) byId.set(id, team);
  }
  return { byName, byId };
})();

window.ULLH_CONFIG.resolveTeam = function (accountName, carlAccountId) {
  const L = window.ULLH_CONFIG.teamLookup;
  if (carlAccountId) {
    const prefix = carlAccountId.split('-')[0];
    if (L.byId.has(prefix)) return L.byId.get(prefix);
    if (L.byId.has(carlAccountId)) return L.byId.get(carlAccountId);
  }
  if (accountName) {
    const key = accountName.trim().toLowerCase();
    if (L.byName.has(key)) return L.byName.get(key);
    if (L.byName.has('@' + key.replace(/^@/, ''))) return L.byName.get('@' + key.replace(/^@/, ''));
  }
  return null;
};
