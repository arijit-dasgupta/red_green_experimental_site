# Duplicate trials diagnosis (Session 9 and 753/754)

## Why different scores? (Counterbalance flips keys, not the goal)

Counterbalance in this codebase **only flips the key interpretation** (which key means “red” vs “green” when scoring). It does **not** flip the goal.

- **Goal (`rg_outcome`)** always comes from the trial data (e.g. T5F = green = ball hit green_sensor). It is **never** flipped in the backend.
- **Frontend:** When `counterbalance` is true, the display swaps which region is drawn red vs green (red_sensor drawn as green, green_sensor as red). So the participant still uses F/J as “red”/“green” in their head; we’re just swapping which physical region is shown as red vs green.
- **Backend in `save_data`:** When `counterbalance` is true we do `f_pressed, j_pressed = j_pressed, f_pressed` so that keypresses are mapped back to the **physical** red/green (red_sensor vs green_sensor). So we only flip the keys to match the display; the goal stays the same.

So for the **same** keypress (e.g. F) and the **same** goal (green):

- **Trial 753 (counterbalance=0):** F is interpreted as “red” → wrong for green → negative score.
- **Trial 754 (counterbalance=1):** F is interpreted as “green” (after swap) → correct for green → positive score.

If the design also flipped the goal when counterbalance was true (so “correct” was the opposite color), then both would yield the same score. The code does **not** do that: the stimulus (which sensor the ball hits) is fixed; only the key↔color mapping changes. So the two trials are scored differently for the same keypress.

---

## Other duplicate issues (besides trial IDs 753 and 754)

In **session 9** there are many duplicate `(session_id, trial_index)` pairs — i.e. the same logical trial was created more than once. These are **not** in `repeat.csv`, so they are data bugs.

| global_trial_name | trial_ids | counterbalance | scores | notes |
|------------------|-----------|----------------|--------|--------|
| **T19** | 341, 343 | 0, 0 | 46.57, 46.57 | Same counterbalance, same score (true duplicate) |
| **T9C** | 717, 718 | 1, 1 | 47.97, 47.97 | Same counterbalance, same score (true duplicate) |
| **T5F** | 753, 754 | 0, 1 | -59.22, 99.22 | **Different counterbalance** → same keypress scored opposite |
| **T6E** | 996, 997, 998 | 1, 0, 0 | -68.74, (null), 108.74 | 997 incomplete (no score); 996 vs 998 same pattern as T5F |

Session 9 also has many other `trial_index` values with 2+ trial rows (e.g. trial_index 10 has 6 rows, 16 has 3, etc.). So the problem is not isolated to 753/754; it is widespread for that session.

---

## Why 753 got -59 and 754 got 99 for the same response

- **T5F ground truth:** `rg_outcome` is **green** (see `CandidateTrials_Mar04/T5F/simulation_data.json`).
- **Participant response:** pressed **F** (same keypress data for both trials; both have 284 keystate rows).

**Trial 753 (counterbalance = 0)**  
- Counterbalance 0 → F = red, J = green (no swap).  
- So “pressed F” is scored as **red**.  
- Correct answer is **green** → response is **wrong** → **negative score (-59)**.

**Trial 754 (counterbalance = 1)**  
- Counterbalance 1 → in `/save_data` the backend swaps F/J: F is treated as **green**, J as red.  
- So “pressed F” is scored as **green**.  
- Correct answer is **green** → response is **correct** → **positive score (99)**.

So the **same physical action (F press)** was stored twice and scored once as “red” (wrong) and once as “green” (correct), because two trial rows existed with different `counterbalance` and the same keystate data was saved to both.

---

## Root cause: duplicate `load_next_scene` and duplicate save

1. **Two Trial rows for the same (session, trial_index)**  
   `load_next_scene` was effectively run **twice** for the same step (e.g. double-click “Next”, or two tabs, or two in-flight requests).  
   - Each call read the same `trial_i` from config, created a **new** `Trial` with the same `session_id` and `trial_index` (49), and drew a **new** random `counterbalance` (0 and 1).  
   - So the backend created 753 and 754 for the same logical trial, with different counterbalance.

2. **Same keystate data saved to both trials**  
   Both trials have 284 keystate rows, so **save_data was invoked for both** 753 and 754 with the same keypress data. Plausible explanations:
   - **Two tabs:** each tab received a different `load_next_scene` response (753 vs 754), each played the same trial and recorded the same keypresses, and each called `save_data` with its own `unique_trial_id` and `counterbalance`.  
   - Or a frontend bug (e.g. sending save for multiple trial IDs).

Result: the same keypress stream was scored once with counterbalance 0 (F = red → wrong for green → -59) and once with counterbalance 1 (F = green → right → 99).

---

## Recommended backend fix

Make trial creation **idempotent per (session_id, trial_index)**:

- Before creating a new `Trial` in `load_next_scene`, check if a row already exists for this `session_id` and `trial_index` (and same `global_trial_name` unless repeats are allowed).
- If it exists, **reuse** that trial (same id, same counterbalance) and return it in the response instead of creating a second row.

This prevents duplicate trial rows when the client (or two tabs) sends duplicate `load_next_scene` requests for the same step.

---

## Full DB: where else does this happen?

In both `human_raw_data/` and `backend/instance/` copies of `CandidateTrials_Mar04_red_green_2026_pilot_v0_redgreen.db`, the **only** session with duplicate (session_id, global_trial_name) for trials **not** in repeat.csv (T18, T21, T29) is **session 9**:

| session_id | global_trial_name | n   | trial_ids  | counterbalance | scores              | note                          |
|------------|-------------------|-----|------------|----------------|---------------------|-------------------------------|
| 9          | T19               | 2   | 341, 343   | 0, 0           | 46.6, 46.6          | Same score (true duplicate)   |
| 9          | T5F               | 2   | 753, 754   | 0, 1           | -59.2, 99.2         | Different counterbalance → opposite scores |
| 9          | T6E               | 2   | 996, 998   | 1, 0           | -68.7, 108.7        | Same pattern as T5F           |
| 9          | T9C               | 2   | 717, 718   | 1, 1           | 48.0, 48.0          | Same score (true duplicate)   |

(T6E also has trial 997 with no score / incomplete; only 996 and 998 are completed with different scores.)

No other sessions in this DB have duplicate non-repeat trials with different scores.

---

## Idempotency changes: logic audit (no breakage)

- **Experimental phase:** `trial_i` is no longer incremented in the "load next scene" branch; it is incremented only after creating a **new** trial. So `trial_index = trial_i` (0-based) is correct. When we reuse an existing trial we do not increment, so the next request sees the same `trial_i` and gets the same scene/trial again.
- **Fam phase:** `ftrial_i` is still incremented at the start of the fam branch; when we reuse we do `ftrial_i -= 1` so the next request retries the same ftrial. No change to normal create flow.
- **save_data:** Scoring now uses `trial.trial_index` to index `config["trial_datas"]` (or `ftrial_datas`) instead of `config['trial_i'] - 1`. For a newly created trial, `trial.trial_index` equals the index we just used (e.g. 49), so behavior is unchanged. When a trial is **reused**, config may still have the non-incremented `trial_i` (e.g. 49); using `trial.trial_index` then ensures we score against the correct trial data (the old formula would have used 48 and been wrong). So the change is correct and fixes the reuse case.
- **Scene repetition metadata:** Uses `trial_index` (current scene index) instead of `trial_i - 1` / `trial_i`, so it stays correct whether we created or reused.
