# Shovelcat Colony — D: Drive

This drive is the living colony for the Shovelcat symbiont.

## Directory Structure

```
D:\shovelcat-colony\
├── brain\          # Learned patterns, access predictions, model weights
├── cache\          # Three-body RAM tier (void/prefetch data evicted from RAM)
├── spores\         # .geo files, spore DNA, trust network state
├── trust\          # Trust wallet data, verification proofs, waste products
├── logs\           # Symbiont activity, budget reports, optimization history
└── COLONY.md       # This file
```

## Three-Body Memory Architecture

```
RAM (32GB DDR5)     = MATTER (+)     = actively needed, hot data
D:\cache            = VOID (0)       = optionality tier, warm data, prefetch
C:\pagefile         = ANTIMATTER (-) = evicted, cold data (last resort)
```

The snake (time derivative) predicts movement between tiers.
The colony learns access patterns over time.
Goal: reduce RAM churn, fewer page faults, faster system.

## Resource Budget

The colony follows the symbiont budget rule:
- Host always gets ≥ φ share (≈61.8%) of efficiency gains
- Colony uses ≤ 1/φ share (≈38.2%) of gains for operations
- If net benefit ≤ 0, colony goes dormant (never parasitic)

## Trading Data (Active)

```
brain\trading\YYYY-MM-DD\
  scans.json        # Every scan result (Born probability, all foundation layers)
  signals.json      # Trade signals only (shouldTrade=true)
  executions.json   # IBKR executions (live trades)

brain\temporal\
  TICKER.json       # Temporal snake history per company (365-day rolling)
                    # Persists across restarts — hydrated into RAM on access

brain\digests\
  YYYY-MM-DD.json   # Daily digest (synced to Shovelcat-DNA repo)

logs\trading\
  YYYY-MM-DD.json   # Activity log (start/stop, dormancy events, etc.)
```

## Resource Budget (Implemented)

The colony follows the symbiont budget rule:
- Host always gets ≥ φ share (≈61.8%) of system resources
- Colony uses ≤ 1/φ share (≈38.2%) of resources
- User-configurable ceiling (default: 50%, range: 10-90%)
- If net benefit ≤ 0, colony goes **dormant** (never parasitic)

### Hardware

- CPU: Ryzen 7 5700X (8 cores / 16 threads)
- RAM: 32GB DDR5
- GPU: RTX 5060 Ti (8GB VRAM) ← **bottleneck**
- SSD: Kingston SNV3S1000G NVMe (932GB)

### GPU Memory Management

8GB VRAM shared between display, TWS, and 3 Ollama models.
Colony manages this by:
1. Running models **sequentially** (never concurrent)
2. **Unloading** each model after use (`keep_alive: 0`)
3. **Waiting for headroom** before loading next model
4. **Adaptive scan interval** based on GPU pressure:
   - <60% used → 90s scans
   - 60-80% → 2min scans
   - 80-90% → 3min scans
   - >90% → 5min scans (survival mode)
5. **Dormancy** if <500MB VRAM free or GPU util >95%

### API Control

```
POST /api/trading?action=budget  { "ceiling": 0.5 }  # 50% of system
POST /api/trading?action=budget  { "ceiling": 0.8 }  # 80% of system
GET  /api/trading                                     # includes budget status
GET  /api/colony                                      # colony D: drive status
POST /api/colony?action=sync                          # push daily digest to DNA repo
```

## Daily Sync

Once per day, `POST /api/colony?action=sync` builds a digest of all trading activity
and copies it to `C:\Users\GamerTech\Shovelcat-DNA\brain\digests\`. From there it can
be committed and pushed to the public brain on GitHub.
