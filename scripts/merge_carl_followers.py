"""Doplní follower snapshoty z Carl for Social do data/latest/account.csv.
Použití: python3 -I merge_carl_followers.py carl_followers.json account.csv out.csv YYYY-MM-DD
carl_followers.json = výstup JS skriptu scripts/carl_followers.js (běží v Chromu na business.carlforsocial.com).
- Stávající řádky (Supermetrics) zůstávají.
- Týdenní body z Carlu (datum = neděle ISO týdne) se přidají jen po posledním datu daného účtu.
- Dnešní 'value' se přidá jen pro IG/TikTok (u FB vrací Carl neaktuální číslo).
"""
import csv, json, sys, datetime
src, old_path, out_path, today = sys.argv[1:5]
today = datetime.date.fromisoformat(today)
NET = {'instagram.com': 'instagram', 'facebook.com': 'facebook', 'tiktok.com': 'tiktok', 'youtube.com': 'youtube'}
cols = ['account_name', 'social_network_id', 'carl_account_id', 'data_date', 'subs', 'reach', 'page_impressions']
fmt = lambda d: f'{d.day}.{d.month}.{d.year}'
parse = lambda s: datetime.datetime.strptime(s, '%d.%m.%Y').date()
old = list(csv.DictReader(open(old_path, encoding='utf-8')))
last, meta = {}, {}
for r in old:
    k = r['carl_account_id']; d = parse(r['data_date'])
    if k not in last or d > last[k]: last[k] = d
    meta.setdefault(k, (r['account_name'], r['social_network_id']))
new = []
for c in json.load(open(src, encoding='utf-8')):
    url = (c.get('url') or '').split('?')[0].rstrip('/')
    net = next((v for k, v in NET.items() if k in url), '')
    name, net0 = meta.get(c['acc'], ('@' + url.split('/')[-1].lstrip('@'), net))
    net = net0 or net
    cutoff = last.get(c['acc'], datetime.date.min)
    pts = {}
    for p in c['series']:
        y, w = p['x'].split('-W')
        d = datetime.date.fromisocalendar(int(y), int(w), 7)
        if cutoff < d < today: pts[d] = p['y']
    if net in ('instagram', 'tiktok') and c.get('value') is not None and cutoff < today:
        pts[today] = c['value']
    for d, v in sorted(pts.items()):
        new.append({'account_name': name, 'social_network_id': net, 'carl_account_id': c['acc'],
                    'data_date': fmt(d), 'subs': v, 'reach': '', 'page_impressions': ''})
w = csv.DictWriter(open(out_path, 'w', encoding='utf-8', newline=''), fieldnames=cols, lineterminator='\n')
w.writeheader(); w.writerows(old + new)
print(f'old={len(old)} new={len(new)} total={len(old)+len(new)}')
new_ids = sorted({r['carl_account_id'] for r in new} - set(meta))
if new_ids: print('NOVÉ účty (doplnit do config.js):', new_ids)
