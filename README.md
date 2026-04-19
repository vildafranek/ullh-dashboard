# ULLH Social Dashboard

Manažerský přehled social media výkonu týmů Univerzitní ligy ledního hokeje. Statická HTML aplikace, bez buildu, hostovaná na GitHub Pages. Data se tahají živě z publikovaného Google Sheetu při každém načtení stránky.

## Struktura

```
ullh-dashboard/
├── index.html          # Ligový přehled (default landing)
├── teams.html          # Detail týmu (query param ?team=slug)
├── posts.html          # Filtrovatelná tabulka všech postů
├── inspiration.html    # 6 žebříčků "co replikovat"
└── assets/
    ├── css/style.css   # Brand styl (navy/cyan, Sinter font)
    ├── fonts/          # Sinter OTF (Regular, Medium, Bold)
    ├── img/teams/      # (prázdné — loga z /loga týmů/ zatím neexportovaná)
    └── js/
        ├── config.js       # 2 CSV URL + team mapa + enum map
        ├── data.js         # fetch, Papa Parse, CZ datum, cache
        ├── metrics.js      # ER, růst, best times, skóre
        ├── charts.js       # ECharts helpery v brand tématu
        ├── overview.js
        ├── teams.js
        ├── posts.js
        └── inspiration.js
```

## Zdroj dat

Publikovaný Google Sheet `1093SfGko3pFZ97vqceYAGPgoNiAIa5q3aSUPJnILH9k` s dvěma taby:

| Tab | GID | Obsah |
|---|---|---|
| `consulting_client_college_hockey_account` | 1905041098 | Denní snapshot per účet (followers, reach, impressions) |
| `consulting_client_college_hockey_post` | 82127506 | Řádek per post (typ, caption, views, likes, comments, shares) |

URL endpointy jsou fixně nastavené v [`assets/js/config.js`](assets/js/config.js). Pokud se publish-to-web token změní (Vilda někdy klikne "Zastavit publikování"), stačí aktualizovat `publishId`.

### Jak publikuji data

V Google Sheets: **Soubor → Sdílet → Publikovat na web → Celý dokument → CSV → Publikovat**. Výsledné endpointy jsou veřejné, ale nesouvisí s editačním sdílením tabulky — skutečný Sheet zůstává privátní.

## Lokální spuštění

Kořenový adresář projektu obsahuje konfiguraci Claude Code Preview. Pro ruční spuštění stačí libovolný static server:

```bash
cd ullh-dashboard
python3 -m http.server 8000
# → http://localhost:8000
```

Žádný build, žádný npm. Knihovny (PapaParse, ECharts) se tahají z jsDelivr CDN.

## Deploy na GitHub Pages

1. Vytvoř repo `ullh-dashboard` (public nebo private-with-pages).
2. Push obsah této složky do `main`.
3. V **Settings → Pages** nastav `Deploy from branch: main / root`.
4. Za ~1 min bude k dispozici na `https://<user>.github.io/ullh-dashboard/`.

## Známá omezení

- **YouTube data chybí** — Supermetrics export v dodaném Sheetu YT neobsahuje. Sloupec "YouTube" je v UI zachován, ale zůstává prázdný, dokud se YT účty nepřidají do zdrojové tabulky.
- **3 týmy bez dat** — Black Dogs, Farmers a UK Kings v datech nejsou (žádné spárovatelné účty). Jsou vyjmuti ze všech žebříčků. Pokud získají účty, stačí je doplnit do pole `teams` v [`assets/js/config.js`](assets/js/config.js).
- **Ligové a event stránky** (`@univerzitnihokej`, `@bitvaoprahu`, `@derbyuniverzit`, atd.) **nejsou započítány do týmových metrik** — jsou v poli `ligaAccounts` v configu pro případné budoucí zobrazení v samostatné sekci.
- **Loga týmů** jsou zatím vykreslená jako iniciály na barevném kruhu. Původní `.pdf`/`.ai` soubory ve složce `loga týmů/` je potřeba jednorázově vyexportovat na SVG/PNG a odkázat v `config.js` (`teams[].logo`), nebo je dát do `assets/img/teams/<slug>.svg`.
- **Engagement rate** se počítá jako `(likes + comments + shares) / (impressions || views)`. Pokud oba zdroje chybí, post má ER = 0 a do průměrů nevstupuje.
- **Cache** v prohlížeči = 1 h (`localStorage`). Tlačítko "Přenačíst data" na overview cache čistí.

## Údržba

| Kdy | Akce | Kde |
|---|---|---|
| Nový tým vstoupí do ligy | Přidej záznam do `teams[]` | `assets/js/config.js` |
| Existující tým změní handle | Přidej handle do `accountNames[]` daného týmu | `assets/js/config.js` |
| Supermetrics přejmenuje sloupec | Uprav normalizaci v `normalizeAccountRow` / `normalizePostRow` | `assets/js/data.js` |
| Sheet re-published s jiným ID | Uprav `publishId` | `assets/js/config.js` |
| Přidat YT data | Po doplnění do Sheetu dashboard vykreslí automaticky | žádná úprava kódu |

## Datové detaily

- Datum v tabulce je v CZ formátu (`18.4.2026 18:32:26`) — parser v `data.js`.
- `carl_account_id` je UUID; první oktet slouží jako klíč pro spárování s týmem (jeden tým může mít víc accountů na stejné platformě, pokud ho Supermetrics sleduje odděleně).
- Post type `IG Story` / `IG Reel` / `FB Video` má kombinovanou prefixu — v `config.js/postTypeMap` se mapuje na enum `{platform, format}`.
- Liga má referenční bod v `max(date)` napříč oběma taby — nikoliv `now()`. Tj. všechny "poslední 7 dní" okna se počítají od posledního snapshotu v datech, ne od kalendářního dne.
