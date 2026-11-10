# Voice-over script (about 3 minutes)

Student concept for the ESCP Turin hackathon. Not a Nexi product. All customers are made up.

| # | Part | Voice-over | On screen |
|---|---|---|---|
| 1 | 2028 | It is 2028. Humans face a Global Intelligence Crisis. AI agents now make many of the decisions that people used to make. They compare prices. They negotiate for us. And they pay. Most payments are now invisible. | 2028. Payments fade out, one by one. |
| 2 | Permission | You do not approve each payment any more. You give your agent permission once, and you set spending limits. Payment authorisation has become delegated permission. | One tap becomes one permission. |
| 3 | Risk | This brings new risks. Scams are more sophisticated. A fraudulent agent can pretend to be yours. Digital identity and payment security are under pressure. | One red agent among the blue. |
| 4 | Demand | People still want to see where their money goes. They want transparency and control, even when the payment is automatic. | Transparency. Control. |
| 5 | Nexi | This is where Nexi comes in. Nexi already moves the money. Now Nexi also keeps the rules. | Nexi logo. |
| 6 | Customers | Start with regular customers. We show ten, in a sample of two hundred and forty. Each customer enters Nexi Agent, and connects a signed AI agent. | 240 dots, 10 named. |
| 7 | Boundaries | Each customer defines their boundaries. What to buy. The most the agent can pay. A weekly budget. Which suppliers are allowed. Luca wants three loaves for Friday, and will pay at most two euros a loaf. | Luca's mandate card. |
| 8 | Shared demand | Nexi collects these boundaries, and shares the total with the supply side. The bakery sees four hundred and forty six loaves wanted for Friday. It sees demand at each price. It never sees a name or a budget. | 446 loaves. Demand by price. |
| 9 | Supply | Now the supply side decides. At what price? At what quality? In what quantity? The bakery offers three hundred and fifty loaves, at two euros forty. | Offer: 350 loaves, €2.40. |
| 10 | Match | Nexi makes demand and supply meet. It checks the offer against every mandate, and finds the best option for each customer. Then the agent buys automatically. One hundred and seventy five customers are matched. Every loaf is sold, and the baker prepares the exact number. | 175 matched. 350 sold. €840. |
| 11 | Luca | And Luca? The price is two euros forty. Luca's limit is two euros. So Luca's agent does not buy, and no money moves. | Stopped. No money moved. |
| 12 | Guardrails | This is how the guardrails work. Nexi checks every payment, in a fixed order. Is the mandate active? Is the agent signed? Is the shop allowed? Is the time allowed? Is the price inside the limit? Is the weekly budget inside the limit? Above an amount you choose, the agent must ask you first. If one rule fails, the payment stops. | Seven checks, in order. |
| 13 | Proof | Every payment gets a one-time token: one shop, one amount, ten minutes. Every decision goes in an audit log, with the rule that made it. | Token. Audit log. |
| 14 | Responsibility | So responsibility is clear. You set the rules. The agent acts inside them. Nexi enforces them. And you can revoke the mandate at any time. | You. Agent. Nexi. |
| 15 | Close | In 2028, payments can be invisible. The rules stay in your hands. Nexi. | Logo and disclaimer. |

## Version 2: the product film (about 1 minute 30)

The film is a page: `#/film`. Each scene is code in `src/pages/Film.tsx`, and the voice-over line of a scene is its `line`. Edit the line there, and this table after it.
To use a recorded voice, save one file for each scene as `public/voice/<scene>.mp3`. Without a file, the browser reads the line.

| Scene | File name | Voice-over |
|---|---|---|
| 2028 | `hook` | It is 2028. Your AI agent does the shopping. So who checks what it pays? |
| Sara | `sara` | This is Sara. She lives in Torino. On Friday she buys bread. On Saturday, flowers. |
| Set up | `setup` | With Nexi, Sara sets up her agent in one minute. Which shops it can use. The most it can pay. A weekly budget. And when it must ask her first. |
| Voice | `voice` | Then she just talks. Buy two loaves. Nexi runs seven checks, always in the same order. All seven pass. Paid, with a one-time token. |
| Ask first | `ask` | Flowers cost more. So her agent asks first. Sara says yes. |
| Attacks | `attack` | Now a fake agent tries to pay. Then an unknown shop. A price ten times higher. A payment at three in the morning. Nexi stops all four. No money moves. |
| Stop | `stop` | And one word stops everything. Stop. |
| The shop | `shop` | The bakery wins too. It sees four hundred and forty-six loaves wanted for Friday. No names. No budgets. It bakes three hundred and fifty, and sells every one. |
| Close | `close` | You set the rules. Your agent acts inside them. Nexi checks every payment. Your AI agent pays. Your rules decide. |
