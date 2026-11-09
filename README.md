# Nexi hackathon concept

Prototype for the ESCP Turin hackathon, sponsor Nexi. This is a student concept and not a Nexi product. All customers are made up.

## Features

The homepage is a dot map that zooms from Europe to Italy to the streets of Torino. Each feature has several examples to pick from.

## Demo flow

1. **Customers** (`#/customers`). Ten named customers sign mandates. Nexi holds 240 in all.
2. **Supplier** (`#/supplier`). The supplier sees demand by price, and no names.
3. **Offer** (`#/offer`). Nexi checks one offer against every mandate and matches it.

## Deep dives

- **Spending limit** (`#/limit`). A full mandate, one-time tokens, a price check and an audit log.
- **How much to prepare** (`#/order`). Agent orders become one number. Includes a merchant agent.
- **Live data, no names** (`#/names`). Bundles for shops, banks and market analysts.

## Run

```bash
npm install
npm run dev
```

The app runs on port 3900.

## Test

```bash
npm test
```

## Data

- `src/lib/forecast.ts` holds the simulation. The results are not from real shops.
- `npm run shops` recalculates the shop examples. Only goods that spoil within a day or two are used, because other goods sell before they spoil.
- `npm run signals` updates the free data in `src/data/signals.json`.
- `npm run europe` rebuilds the map from Natural Earth, Eurostat (food waste per person) and OpenStreetMap (Torino streets).
- The main feature reads live weather from Open-Meteo. If the request fails, the page uses the saved data.
- The map gestures in `src/lib/gestures.ts` are copied from `maed/src/ui/gestures.ts`.

## Video

`video/` holds the first Remotion draft. It shows the old story and must be rebuilt on the three features.
