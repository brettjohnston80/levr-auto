# Plan: "Continue your search" after sign-in (BAE #1, 2026-10-30)

**Status: done and live on www (2026-10-30, `8af0f0e`); ported to `offer-entry` (`f575a6a`) and in the Phase 1 branch through the `main` merge.** One change from the plan: `login()` works out the destination itself instead of redirecting through `/account/continue` (a server action can't follow a redirect into a page that redirects again); `/account/continue` serves the email links. Verified on www with disposable customers, 7/7.

## What BAE hit

After signing in and changing their password, BAE was on `/account` ("Your Dashboard") and didn't realise it was account settings. Two causes, both confirmed in the code:

1. **Sign-in always lands on `/account`.** `login()` in `src/lib/auth-actions.ts` redirects to `next` when it's set, otherwise to `/account`. The sign-up confirmation link does the same (`/auth/callback?next=/account`).
2. **On `/account` the settings come first.** After the heading, the order is: the "Finish starting your search" card (unpaid searches only), then the account settings form, then the change-password form, and only then the search cards. For a paid search, the first thing under the heading is the settings form.

## Proposal

### 1. Sign-in goes to where the search stands

A new route, `/account/continue`, works out the customer's next step and redirects there. `login()` and the sign-up confirmation use it in place of `/account` when there's no `next` (a `next` still wins, e.g. the survey link).

| The customer's latest active search | Goes to |
|---|---|
| Saved, not paid | `/account/vehicle?searchId=…` (Review your search) |
| Paid, trim and options not chosen yet | `/finalize/{id}` |
| In the 24-hour change window | `/account/vehicle?searchId=…` (Your Car, with Make changes) |
| Live, paused or purchased | `/account/deal?searchId=…` (Your Deal) |
| No search, or only cancelled or switched ones | `/` at the Get started section |

"Latest active" means the most recent search that isn't cancelled or switched (superseded). The rule lives in one pure helper (`src/lib/search-destination.ts`) with a unit test per row, so the redirect and the button below always agree.

### 2. "Continue your search" at the top of `/account`

- A button right under "Your Dashboard", going to the same place as the table. It's shown whenever the customer has an active search.
- The unpaid "Finish starting your search" card stays as it is; for an unpaid search the button goes to the same place, so the card's own button is kept and the top button isn't shown twice. (For unpaid, only the card shows.)
- **Settings move below the searches,** under a heading "Account settings", so the searches come first.

### 3. After a password change

The change-password form's success line gets the same "Continue your search" button underneath, when there's an active search.

## Wording for sign-off (drafts)

| Where | Text |
|---|---|
| Button on `/account`, and under the password-changed line | Continue your search |
| Heading above the moved settings and password forms | Account settings |

No other new wording: the pages it lands on keep their approved text.

## Tests

- Unit: one case per row of the table, plus "latest active wins" with two searches and `next` taking priority.
- Browser (disposable accounts): sign in with each state and check where it lands; `/account` order (button, searches, then settings) on desktop and phone; the password-change success button. Screenshots of each.

## Not changing

- `/login?next=…` links (the post-deal survey) still go to `next`.
- Agent sign-in (`/agent`) is separate and untouched.
