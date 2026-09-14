# Balance — what the harness changed

`npm run model` plays three bots thousands of placements and reports the metrics
the design document says would falsify it. Twice now it has said the design was
wrong, and both times the design lost.

Run it yourself: `RUNS=25 npm run model` (about three minutes).

---

## Finding 1 — runs never ended

The first pass reported a median of **997 placements**, which was the harness's
own guard. Probing a single run showed why:

```
place  empty  blight  d1/d2/d3 on board  demand(R/C/I)  growth  lines
   60     84       0       14/0/0          47/ 51/ 50     3/3/3     19
  180     67       6       24/0/0          80/ 60/ 93     9/9/9     62
  360     74       7       12/2/0          71/ 73/ 68     9/9/9    130
  600     57      10       33/0/0          60/ 78/ 60     9/9/9    220
```

**The board sat 60–80% empty forever.** At 0.49 clears per placement, clears
removed ten cells about as fast as placements added four — a stable equilibrium.
Saturation was unreachable, so the only fail state could never fire.

Blight made it worse rather than better. Counting as filled *and* clearing with
its line, every overflow gifted free line-completion material to the very engine
that was generating the overflows. 451 blight events a run, none of them lasting.

**The fix:** blight now **blocks** its row and column, and is permanent until
bulldozed. One cell at an intersection kills two of the twenty lines. This is the
water problem from v0.2 — deliberately, this time — and the difference is that
blight is caused by your own play, arrives gradually, and can be removed. Runs
now end on their own at about 200 placements.

## Finding 2 — nobody upzoned

**98% of all harvested cells were density 1.** The core verb was decoration.

The v0.2 review had scaled synergy by `min(own, neighbour)` to kill donor
farming, which worked — but it also flattened the return to exactly 15 population
per density unit at every density. And because an upzone fills no new cell, it
also costs tempo. A flat return plus a tempo cost means a rational player never
upzones, and the bots duly never did.

**The fix:** the base value is now superlinear — `[10, 25, 45]` rather than
`10 × d`.

| density | population next to a d3 neighbour | per unit invested |
|---|---|---|
| 1 | 15 | 15.0 |
| 2 | 35 | **17.5** |
| 3 | 60 | **20.0** |

Dense now pays better per unit, so upzoning is worth its tempo. Donor farming
stays dead because the *neighbour* side is still capped by `min()` — a density-1
cell beside a density-3 shop scores exactly what it would beside a density-1 shop.

## Finding 3 — the bot heuristic was the problem, not the game

After the first two fixes the skill curve read **+0.2%**, and `greedy` was
matching `thinking` while using density more. That was the harness lying: the
heuristic rewarded line-fill and open space, which is advice to spread out and
clear fast — precisely wrong once density pays superlinearly.

Rewritten to value **stored population** (a density-3 block is 45 waiting to be
harvested, in one cell rather than three) and to ignore progress on lines that
blight has already killed.

## Where it stands

25 runs per bot:

| | greedy | reacting | thinking |
|---|---|---|---|
| mean population | 10,261 | 13,262 | **14,099** |
| median placements | 188 | 205 | 204 |
| median lines | 44 | 54 | 53 |
| clears per placement | 0.229 | 0.267 | 0.265 |
| blight events | 28.6 | 29.7 | 29.0 |
| **placements that overlap** | 56.9% | 43.5% | **46.4%** |
| **…with space to spare** | 95.9% | 95.3% | **98.2%** |
| roads placed | 4.8 | 16.6 | 12.3 |
| parks placed | 3.8 | 5.5 | 5.9 |
| harvested at density 1 | 65.8% | 81.6% | 79.6% |
| harvested at density 2 | 23.1% | 10.7% | 12.6% |
| harvested at density 3 | 11.2% | 7.7% | 7.8% |

**Lookahead is worth 37.4%** over greedy. The design asks for more than 40%, so
this is close but not yet passing — the ladder is real and monotonic, but the
second ply is only worth 6% over the first, which says most of the skill is in
evaluating one move well rather than seeing ahead.

**Overlap is a proactive verb, not a dumping ground.** 46% of placements overlap,
and 98% of those happen with twenty or more empty cells still available. That was
the single most important thing to establish and it holds.

## Still open

- **Run length.** 204 placements against a design target of 70–110. At two to
  three seconds a placement that is 8–10 minutes, which is inside the session
  target, so the placement figure in the design doc was the wrong guess rather
  than the game being wrong. Left alone deliberately; `DECADE` and `GROWTH_MAX`
  are the knobs if it needs tightening.
- **The last 3% of the skill curve.** Worth attacking by making density decisions
  more consequential rather than by adding rules.
- **Blight at 29 events a run** is high. Survivable, but the bulldozer economy
  has not been tuned against it.
- No bot models a human's inability to see four neighbours at a glance, so none
  of this says whether the game reads well in the hand.
