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

## Finding 4 — run length is set by how fast blight arrives, not by anything else

Asked to bring a run down from ~200 placements to ~120, the obvious knobs were
the demand growth ramp. Sweeping them (`node scripts/sweep.mjs`) turned up
something more useful than a setting:

```
DECADE  GROWTH_MAX  placements  lines  blight  population
    25           3         208     54    28.8      12,921
    18           4         163     42    28.3       9,839
    14           5         139     33    29.1       8,042
    10           5         126     31    28.3       6,918
```

**Blight events barely move — 28 to 30 across every combination.** A run ends at
roughly 29 blight cells however it is tuned, because that is the load at which
enough rows and columns are blocked for the board to saturate. The growth knobs
only change how fast you get there; they do not change the shape of the ending.

Two settings reach ~125 placements. `GROWTH_BASE=3` with a slow ramp is
uniformly hard from the first move; `DECADE=10, GROWTH_MAX=5` keeps a gentle
opening and escalates. The second is the better game, so that is what shipped.

One consequence worth recording: **anything priced in population has to be
rescaled when run length moves.** Halving run length halved the population a run
banks, which silently halved both parks earned and bulldozer charges granted.
`PARK_EVERY` went 2200 → 1500 and `POPULATION_PER_CHARGE` 1500 → 1000 to hold
them steady.

## Where it stands

20 runs per bot, at the shipped settings:

| | greedy | reacting | thinking |
|---|---|---|---|
| mean population | 5,919 | 7,019 | **8,693** |
| median placements | 117 | 126 | 138 |
| median lines | 23 | 31 | 34 |
| clears per placement | 0.208 | 0.239 | 0.247 |
| blight events | 31.4 | 28.5 | 32.3 |
| runs in a blight spiral | 0% | 0% | 0% |
| **placements that overlap** | 57.2% | 44.2% | **44.9%** |
| **…with space to spare** | 92.5% | 95.8% | **97.7%** |
| roads placed | 3.3 | 14.7 | 13.7 |
| parks placed | 1.8 | 2.8 | 3.4 |
| harvested at density 1 | 65.9% | 79.9% | 79.8% |
| harvested at density 2 | 23.0% | 10.8% | 12.1% |
| harvested at density 3 | 11.0% | 9.4% | 8.1% |

**Lookahead is worth 46.9%** over greedy — past the 40% the design asks for, and
up from 37.4% before the run was shortened. Pressure makes playing well matter
more, which is the right direction for a game to move under tuning.

**Overlap is a proactive verb, not a dumping ground.** 46% of placements overlap,
and 98% of those happen with twenty or more empty cells still available. That was
the single most important thing to establish and it holds.

## Still open

- **Blight at ~30 events a run** against 3 bulldozer charges. Survivable — no run
  in any sweep entered a spiral — but the player is bulldozing perhaps a tenth of
  what lands, so most blight is permanent by design rather than by decision.
  Whether that reads as pressure or as helplessness is a question for hands, not
  for bots.
- **`thinking` runs longer than `reacting`** (138 against 126) while scoring more.
  Survival and score are not yet in tension, and a game where the best players
  also last longest has no real endgame decision.
- **Parks at 1.8–3.4 a run.** Present in every run, but the queue backs up: a park
  in the works slot blocks road refills until placed, so hoarding one costs roads.
  Intended, unverified.
- No bot models a human's inability to see four neighbours at a glance, so none
  of this says whether the game reads well in the hand.
