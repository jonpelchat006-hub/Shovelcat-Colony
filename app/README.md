# Shovelcat — Invisible System Optimizer

A cross-platform tool that maps your hardware onto a quaternion derivative chain and optimizes resource allocation using the golden ratio (φ).

**Zero dependencies beyond Node.js.** Works on Windows (nvidia-smi + wmic) and Linux (nvidia-smi + /proc).

## Quick Start

```bash
git clone https://github.com/jonpelchat006-hub/Shovelcat-Colony.git
cd Shovelcat-Colony/app
npm run setup    # install → build → init spore → benchmark
```

Or step by step:

```bash
npm install
npm run build
node dist/cli.js init    # creates ~/.shovelcat/spore.geo
node dist/cli.js bench   # see your hardware through the derivative chain
node dist/cli.js test    # A/B: random vs Fibonacci allocation
```

## Commands

| Command | What it does |
|---------|-------------|
| `shovelcat init` | Create a .geo spore file for this machine |
| `shovelcat start` | Start the derivative chain daemon |
| `shovelcat stop` | Stop the daemon |
| `shovelcat status` | Show spore status + live hardware snapshot |
| `shovelcat bench` | Quick benchmark: derivatives, quaternion, predictions |
| `shovelcat test` | A/B test: random 4KB vs Fibonacci chunks (disk + memory) |
| `shovelcat live` | Live test: run A/B during GPU workload, watch quaternion shift |
| `shovelcat config ceiling=0.5` | Set resource ceiling (10-90%) |

## What It Measures

### The Derivative Chain
Your hardware forms a derivative chain — each tier IS the derivative of the one below:

```
Tier 0: Disk  = x        (field, stored potential)
Tier 1: RAM   = dx/dt    (velocity, data in motion)
Tier 2: CPU   = d²x/dt²  (acceleration, transformation)
Tier 3: VRAM  = observer  (collapse into output)
```

### The Hardware Quaternion
These four tiers map onto Hamilton's quaternion: `q = w + xi + yj + zk`

- **w** (VRAM) = Observer — collapses to visible output
- **i** (Disk) = Euler term — `e^(iπ)+1=0`, binary existence
- **j** (RAM) = Snake term — `0.999...→1`, volatile convergence
- **k** (CPU) = Bridge term — `sin²+cos²=1`, invariant transform

`k = ij` → CPU IS the cross-product of disk × RAM.
`ijk = -1` → data is consumed through the chain.
`|q| ≈ 1` → healthy system. `|q| > 1` → overloaded.

### IS/ISN'T/Void Streams
Every tier has bidirectional data flow:
- **IS (+)**: forward flow (read, load, process, render)
- **ISN'T (-)**: reverse flow (evict, flush, write, commit)
- **Void (0)**: available capacity

The bridge (CPU) allocates bandwidth between IS and ISN'T using the trig identity.

### φ Budget Rule
- Host gets ≥ 61.8% of resources (golden ratio)
- Colony uses ≤ 38.2%
- Goes dormant if system is stressed

### Fibonacci Chunk Sizing
Data is allocated in chunks scaled by the Fibonacci sequence, starting from `h_info` — the minimum meaningful chunk size derived from `δ = π - 3 ≈ 0.14159` (the circle-polygon gap).

## Benchmark Results

See `/benchmarks/` for hardware-specific results. Key findings:

- **Fibonacci disk I/O: 2.07x faster** than random 4KB blocks under GPU load
- **Memory fragmentation: 84.5% reduction** with Fibonacci allocation
- **Prediction accuracy: 92-99%** depending on workload volatility
- **|q| > 1** correctly signals system overload

## Requirements

- Node.js 18+
- nvidia-smi (for GPU monitoring — optional, degrades gracefully)
- Windows or Linux

## Theory

Shovelcat Theory by Jonathan Pelchat. The derivative chain, quaternion mapping, and geometric storage are part of a unified framework described in the Shovelcat-Theory repository.
