# Historické snapshoty

Obsah této složky průběžně vytváří GitHub Action [`daily-snapshot.yml`](../.github/workflows/daily-snapshot.yml) — každý den v 7:00 CEST stáhne aktuální CSV z Google Sheetu a commitne do:

```
data/snapshots/YYYY-MM-DD/
├── account.csv   # snapshot taboru consulting_client_college_hockey_account
└── post.csv      # snapshot taboru consulting_client_college_hockey_post
```

Tyto soubory jsou podklad pro **roční a meziroční pohledy** (YoY), jakmile nasbíráme dost měsíců historie. Action necommituje nic, pokud se Sheet nezměnil vs. poslední snapshot.

Pro testování lze Action spustit ručně v GitHub → Actions → Daily snapshot → Run workflow.
