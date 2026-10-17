# Dukaan Dost

Stock forecasting and restock helper for kiryana (corner) shops. Built for the AMD Developer Hackathon ACT III, Track 3: Reinvent Commerce.

A shop owner uploads daily sales (`date,product,units_sold`). Plain code forecasts the next 7 days per product (weekday pattern + exponential smoothing), flags what will run out before the next delivery, and suggests order quantities. An open model served on AMD Token Factory explains the result in Roman Urdu or English and drafts the supplier's WhatsApp message. Any AI draft that contains a number not in the data is blocked.

## Run it

Static site plus one serverless function. No build step.

```
npm test            # engine tests
npx vercel dev      # local, needs the env vars below for AI
```

## Deploy on Vercel

1. Push this folder to a public GitHub repo (no secrets in it).
2. Import the repo in Vercel. Framework preset: Other. Output directory: `public`.
3. Add environment variables from `.env.example`: `AMD_BASE_URL`, `AMD_API_KEY`, `AMD_MODEL`.
4. Deploy. Without the variables the app still works and uses a built-in template for the explanation.

## Honest limits

- The sample shop is synthetic. The 28-day test shows the method, not a guaranteed saving on a real shop.
- Fewer stockouts comes with holding more stock; the app shows both.
- No festival, price or supplier-shortage awareness.

## Files

- `public/engine.js` forecast, backtest, restock rules, sample data (no AI)
- `public/index.html` the interface
- `api/explain.js` AMD Token Factory call + number check
