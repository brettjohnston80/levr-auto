# Context diagram: LEVR Auto and everything around it

**Pilot, 2026-10-15.** Drawn from the Phase 1 branch (`agent-dashboard-phase1-code` at `1d95e28`). The live site runs `main` until the Phase 1 deploy, so the agent sign-in, assignment and alert pieces shown here aren't live yet.

**How to read it:** the box in the middle is the system we build and run. Everything outside it is a person, a company's service, or a scheduled trigger that the system talks to. Each arrow says what passes between them.

```mermaid
flowchart LR
  %% People
  Customer(["Customer<br/>(browser or phone)"])
  Agent(["Agent / lead / admin<br/>(signs in at /agent)"])
  Dealer(["Dealers<br/>(phone and email, outside the system)"])

  subgraph LEVR["LEVR Auto system (www.levrauto.com on Vercel, Portland region)"]
    direction TB
    Site["Customer website<br/>intake, Matchmaker, Your Car, Your Deal, messages"]
    Internal["Agent dashboard<br/>/internal pages"]
    Jobs["Scheduled jobs<br/>15 Vercel Cron routes"]
    DB[("Supabase<br/>database, logins, files")]
    Site --- DB
    Internal --- DB
    Jobs --- DB
  end

  %% Outside services
  Stripe["Stripe<br/>payments and refunds<br/>(test mode until the offer-entry phase)"]
  MC["MarketCheck<br/>dealer inventory<br/>(500 calls/month)"]
  Zepto["ZeptoMail<br/>all email"]
  Anthropic["Anthropic Claude API<br/>reads dealer offers, drafts articles and posts"]
  PandaDoc["PandaDoc<br/>service-agreement e-sign<br/>(sandbox key; launch decision 1)"]
  Mapbox["Mapbox<br/>Your Deal map"]
  Cron(["Vercel Cron<br/>the clock"])
  Social(["Social platforms<br/>(posted by hand)"])

  Customer -- "signs up, pays, picks options, reads offers, messages" --> Site
  Site -- "offers, updates, guarantee timeline" --> Customer
  Agent -- "logs offers, resolves calls, refunds, manages agents" --> Internal
  Agent -. "calls and emails" .-> Dealer
  Dealer -. "offer sheets and replies" .-> Agent

  Site -- "checkout" --> Stripe
  Stripe -- "payment-completed webhook" --> Site
  Internal -- "refunds" --> Stripe
  Jobs -- "auto-renew charges" --> Stripe

  Jobs -- "inventory syncs" --> MC
  Site -- "on-demand syncs at payment and switches" --> MC
  Internal -- "Refresh inventory" --> MC

  Site -- "customer emails" --> Zepto
  Jobs -- "reminders, daily updates, alert emails" --> Zepto
  Internal -- "invites, resets, call-request emails" --> Zepto
  DB -- "sign-up and password-reset emails (Supabase Auth SMTP)" --> Zepto
  Zepto --> Customer
  Zepto --> Agent

  Internal -- "dealer reply text or PDF" --> Anthropic
  Jobs -- "article and social drafts" --> Anthropic
  Site -- "service agreement" --> PandaDoc
  Site -- "map tiles" --> Mapbox
  Cron -- "runs each job on its schedule" --> Jobs
  Internal -. "approved captions, copied by hand" .-> Social
```

## What each outside party sees

| Party | What the system sends it | What it never gets |
|---|---|---|
| Stripe | the $699 fee, $100 switch and extension fees, refunds | nothing about the vehicle beyond the line-item text |
| MarketCheck | make, model, page number | any customer details |
| ZeptoMail | each email's address, subject and body | `.invalid` test addresses (stopped in `sendEmail`) |
| Anthropic | a dealer's reply (text or PDF); article and post prompts | customer account details |
| PandaDoc | the customer's name and email, for the agreement | anything else |
| Dealers | only what an agent tells them, by phone or email | nothing automatic; no customer details before an offer is accepted |

## Scheduled jobs (Vercel Cron, times in UTC)

| When | Job |
|---|---|
| every hour at :00 | solidify searches 24 hours after finalizing |
| every hour at :15 | **agent sweep** (Phase 1): assign any paid search with no agent, then send alert emails |
| every hour at :30 | unpaid-search reminders (switched off until a mailing address is set) |
| 06:00 daily | nightly inventory sync for searched models |
| 07:00 Sundays | weekly/monthly inventory refresh |
| 08:00 daily | Day-30 guarantee check; Day-60 deadline reminder |
| 09:00 daily | Day-60 pause (tries auto-renew first) |
| 10:00 daily | resume reminder for paused searches |
| 11:00 daily | delete offer sheets of ended searches |
| 12:00 daily | post-deal survey |
| 13:00 daily | daily update email |
| 14:00 daily | draft next month's article |
| 15:00 daily | article review reminders to agents |
| 22:00 Sundays | weekly social post batch |

Source: `vercel.json` on the branch.
