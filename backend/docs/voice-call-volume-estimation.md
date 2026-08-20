# Voice call volume estimation (sales)

Internal guide for pricing flat annual Civic Core Voice contracts. Customers are **not** billed per call — this methodology sets a conservative annual fee anchor.

## Pricing formula

```
Annual fee = estimated calls per year × $1.50
```

Example: 500 calls/month → 6,000/year → **$9,000/year** flat.

## Step 1 — Get a baseline from the customer

Ask for any of the following (best to worst):

1. **Historical call volume** for the line(s) Voice would replace (IVR, main switchboard info line, permit hotline, etc.)
2. **Monthly average** over the last 12 months (avoid cherry-picking a slow month)
3. **Proxy metric** if no direct data: comparable county size, population served, or staff time spent on repetitive phone inquiries

Record the source and date range. Note seasonality (tax season, election cycles, construction season).

## Step 2 — Normalize to annual calls

| Input | Conversion |
|-------|------------|
| Calls per month | × 12 |
| Calls per week | × 52 |
| Calls per business day | × 260 (typical U.S. municipal year) |
| Peak month only | Do **not** use alone — multiply by 12 only if they confirm year-round peak |

## Step 3 — Apply a conservative buffer (round up)

Round **up** so the contract absorbs normal growth without renegotiation mid-year:

| Situation | Buffer |
|-----------|--------|
| Solid 12-month history | +20% |
| Partial data or estimated proxy | +30% |
| New service / no history | +30–50% or use peer benchmark |

**Example:** 420 calls/month × 12 = 5,040/year → +25% buffer → **6,300 estimated calls/year** → $9,450/year (round to **$9,500** or **$9,000** for clean pricing).

## Step 4 — Sanity-check against human cost

Human equivalent (planning): **~$4/call** (≈280 seconds).

| Estimated volume | Human annual | Civic Core @ $1.50/call | City savings |
|------------------|--------------|-------------------------|--------------|
| 4,000 | $16,000 | $6,000 | 62% |
| 6,000 | $24,000 | $9,000 | 62% |
| 10,000 | $40,000 | $15,000 | 62% |

Pitch: predictable flat fee, ~62% savings vs. status quo, same knowledge base as the chat widget.

## Step 5 — Internal margin check (not customer-facing)

Planning COGS (OpenAI Realtime full, ~6 min/call): **~$0.31/call**.

At $1.50/call priced in, you can absorb roughly **4.8×** actual volume before the contract hits break-even COGS:

```
$1.50 ÷ $0.31 ≈ 4.8× overage tolerance
```

| Contract (6K estimate, $9K) | Actual calls | Est. COGS | Gross profit | Margin |
|-----------------------------|--------------|-----------|--------------|--------|
| On estimate | 6,000 | $1,860 | $7,140 | 79% |
| +50% volume | 9,000 | $2,790 | $6,210 | 69% |
| 2× volume | 12,000 | $3,720 | $5,280 | 59% |

Use backend `VoiceCall` records during pilot to compare estimate vs. actual. Flag jurisdictions trending toward 2×+ estimate before renewal.

## If actual volume exceeds estimate

1. **Do nothing** — buffer usually covers up to ~5× before pain
2. **Adjust at renewal** — re-estimate with 12 months of metered (internal) data
3. **Soft cap** (extreme only) — prompt caller to visit the website or call back during business hours; never surprise bill for overage

## Quick worksheet

```
Baseline monthly calls:     ______
× 12 = annual baseline:     ______
Buffer (+____%):            ______  → estimated calls/year: ______
× $1.50 = annual fee:       $______
Human equivalent (@ $4):    $______
Savings vs human:           ______%
```
