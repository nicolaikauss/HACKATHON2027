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

## Version 4: the product demo (about 57 seconds)

The film is a page: `#/film`. Each scene is code in `src/pages/Film.tsx`; its voice-over is its `line`, and its sound effects are its `cues`.
Voice: Higgsfield, model `elevenlabs_v4`, preset "Sienna" (41023a48-71ab-478a-bea7-c7b5a78f6b36), stability 0.4, one file per scene in `public/voice/<scene>.mp3`. "Nexi" is pronounced "Nexee": write it that way in a voice prompt. "..." in a prompt gives a pause.
Music: ElevenLabs Music v2.5 through Higgsfield, 96 s instrumental, `public/sound/music.mp3`; it fades out at the end of the film. Effects: Mirelo SFX through Higgsfield, `public/sound/<name>.mp3` (whoosh, paid, blocked, switch, pop, tick).

| Scene | File name | Voice-over (as captioned) |
|---|---|---|
| 2028 | `hook` | Your AI agent does the shopping now, and Nexi makes sure it always follows your rules. |
| Set up | `setup` | Setting it up takes a minute. Your shops. A price limit. A weekly budget, and when it should ask you first. |
| Talk | `voice` | Then, you just talk. Buy two loaves. Seven checks, all clear. Paid. |
| Ask first | `ask` | Something bigger? It asks you first. |
| Attacks | `attack` | And when someone tries to cheat? A fake agent. An unknown shop. Ten times the price. Three in the morning. All blocked. Not a cent moves. |
| Stop | `stop` | And one word stops everything. |
| The shop | `shop` | Shops see what people want, never who they are. |
| Nexi | `close` | Your AI agent pays. Your rules decide. Nexi. |
