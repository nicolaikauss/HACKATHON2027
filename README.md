# Nexi agent payments: hackathon concept

Student concept for the ESCP Turin hackathon. It is not a Nexi product. All customers and shops are made up.

In 2028, AI agents buy for people. This demo shows one market with three sides. Nexi sits between them and checks every payment against a mandate.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3900. The dev server also keeps the demo state, so every device on the same Wi-Fi shares one market. On the Live demo page, select **Join by phone** to show a QR code. A phone that scans it joins as a customer.

`npm run build` makes a static site in `dist`. A static host has no shared server. There, the tabs of one browser share the state.

## Pages

| Route | What it shows |
|---|---|
| `#/` | Landing page: the map, three steps, and a door to each side |
| `#/agent` | The customer's home: the map of their shops, their rules, and the agent they talk to |
| `#/demo` | Customer, Nexi, merchant and supplier on one screen |
| `#/customer` | One customer: the rules, the agent, the last decisions |
| `#/merchant` | The shop: demand at each price, one offer, the result |
| `#/supplier` | The supplier: one total, one price |

## How a day runs

1. Customers set rules: quantity, price limit, weekly budget, ask-first amount, allowed shop, daytime only. They can revoke the mandate.
2. The merchant sees totals from all mandates. Groups under 50 customers stay hidden.
3. The merchant publishes one offer. First the merchant's agent buys supplies from the supplier, under the merchant's own limit. If that payment stops, the offer does not go live.
4. Every customer agent answers the offer. Nexi runs seven checks in a fixed order. The first check that fails decides. A paid order gets a one-time token.
5. The merchant closes the day. Weekly budgets carry over to the next day.

## The agent

Open `#/agent`. The agent asks six questions. Each answer becomes a rule in the mandate. Then you tell the agent what to buy. You can speak, type, or select a suggestion.

- **Voice** uses the speech engines of the browser. It needs no key. Listening works in Chrome, Edge and Safari, on `localhost` or https. A phone that joins on `http://192.168...` cannot use the microphone, but it can type.
- **The agent does not decide.** It turns a sentence into an action. Every purchase goes through `reduce` and the seven checks in `guard.ts`.
- **It is a demo agent.** It understands a set of commands, not free speech. It is not a language model.

Things to say: "Buy two loaves", "Pay at most 3 euros for a loaf", "Ask me first above 5 euros", "Block the fish stall", "Test the guardrails", "Why did you stop?", "Stop everything", "Resume".

When no offer is live, the agent orders at the usual price of the shop. When the merchant publishes an offer, the agent answers it, and tells the customer.

## Code

- `src/lib/guard.ts`: the mandate rules (`decide`) and the order of the checks.
- `src/lib/world.ts`: the shared state, the actions (`reduce`) and what each side can see.
- `src/lib/agent.ts`: the agent. From a sentence to actions (`understand`), and from the engine to an answer (`respond`). The onboarding questions (`setup`).
- `src/lib/voice.ts`: voice in and out.
- `src/pages/Agent.tsx`: the customer's home and the chat.
- `src/lib/store.ts`: sync, through the local server or between browser tabs.
- `vite.config.ts`: the local sync server (`/api/world`, `/api/act`, `/api/events`).
- `src/views/`: the customer, merchant, supplier and Nexi panels.
- `tests/`: 78 tests, for the rules, the market and the agent. Run `npm test`.

The local server accepts actions from any device on the network, with no login. Use it only for the demo.
