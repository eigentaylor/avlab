# AVLab

AVLab is an interactive, browser-based sandbox for exploring approval voting and related election dynamics.

It lets you place 2 to 4 candidates in ideological space (1D or 2D), inspect induced voter preference rankings, and compare outcomes across multiple methods and strategy models.

## What it does

- Interactive candidate placement
  - 1D mode on `[0,1]` with draggable candidates and indifference points
  - 2D mode on `[0,1] x [0,1]` with draggable candidates, Voronoi regions, and indifference lines
- Core election analysis
  - IRV/RCV rounds with ballot exhaustion and reverse-Borda tie-breaking
  - Pairwise matrix and Condorcet winner detection
  - Reverse Borda scoring
  - AV critical profiles
- Simulation tools
  - Monte Carlo simulation for approval voting outcomes
  - Sincere-threshold voter simulation
  - Turn-based strategic update simulation
- Experiment controls
  - Candidate count (2-4)
  - Candidate labels (A/B/C/D by default)
  - Strategy mode (`threshold` or `leaderRule`)
  - Basic strategy toggle (always approve closest, never furthest)
  - Async update rate and sincere voter proportion
  - URL state persistence + one-click "Copy URL"

## Project structure

- `index.html` - App shell, CDN scripts, and React mount point
- `voting.jsx` - Main React component (`VotingAnalysis`) with all UI + logic

## Run locally

This project has no build step and no npm dependencies. It runs directly in the browser using React + Babel from CDNs.

### Option 1: Open directly

1. Open `index.html` in your browser.
2. Use the UI immediately.

### Option 2: Serve with a local static server (recommended)

Using a local server avoids some browser restrictions and gives cleaner URL behavior.

PowerShell example (from project root):

```powershell
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

## Usage notes

- Drag candidates on the visualization to change positions.
- Use the candidate add/remove controls to switch between 2, 3, and 4 candidates.
- Use the strategy and simulation panels to compare how outcomes shift under different assumptions.
- Use "Copy URL" to share the exact current scenario.

## URL parameters

The app persists state in query params so scenarios are reproducible/shareable.

Common parameters:

- `n` - number of candidates (`2` to `4`)
- `dim` - space mode (`1d` or `2d`)
- `c1..c4` - 1D candidate positions (`0..1`)
- `c1_2d..c4_2d` - 2D candidate positions as `x,y`
- `l1..l4` - candidate labels
- `st` - sincere threshold
- `bs` - basic strategy flag (`1/0` or `true/false`)
- `strat` - strategy type (`threshold`, `leaderRule`, legacy `basic` support)
- `au` - async update rate (`0.1..1.0`)
- `sv` - sincere voter proportion (`0.0..1.0`)
- `mr` - max RCV ranks allowed

## Tech details

- React 18 (UMD via CDN)
- ReactDOM 18 (UMD via CDN)
- Babel Standalone for in-browser JSX transpilation
- Single-file React component architecture
