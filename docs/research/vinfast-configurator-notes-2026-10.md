# VinFast: eligibility check and why no configurator file (2026-10-15)

**Result: VinFast passes the dealer test, but no configurator CSV was built, because VinFast's US configurator is stale and contradicts VinFast's own current prices.** No `data/vinfast-...` file and no VinFast Matchmaker rows were created. This needs Brett's call (see the end).

## 1. Does VinFast sell through independent dealers with negotiable pricing?

**Yes on dealers; no evidence of fixed or agency pricing.**
- VinFast moved from direct sales to independent franchised dealers in 2024: "VinFast announces signing of initial independent dealers in the US" (5 dealers in NC, NY, TX and KS, including VinFast Wichita). https://vinfastauto.us/newsroom/press-release/vinfast-announces-signing-of-initial-independent-dealers-in-the-us
- It is still adding franchised dealers: on 2026-09-17 it finalized franchise agreements for three more (Redondo Beach and Tustin, CA; Philadelphia, PA), its first California dealerships. https://www.stocktitan.net/news/VFS/vinfast-expands-dealership-network-reinforcing-long-term-commitment-6y68shlg94c1.html
- The 2027 VF 8 went on sale in September 2026 "at authorized VinFast dealerships". https://finance.yahoo.com/technology/articles/vinfast-begins-sales-2027-vf-103000696.html
- vinfastauto.us sends shoppers to a dealer ("Locate Dealer", test drives booked through dealers) and says offers vary: "Please see your local VinFast dealer for details." Its MSRPs are labeled as suggested prices excluding destination. Nothing on the site or in coverage describes a no-haggle or agency model.
- Caveat: no source says in so many words that dealers negotiate. Franchised dealers set their own selling price, so negotiation is the normal case, but it isn't stated.

## 2. Why no configurator file

VinFast's US online configurator (shop.vinfastauto.us) does not reflect what VinFast currently sells:
- The VF 8 configurator page is a 2023-coded page (`US_PD1U_2023_MOD_ND11U`, footer "© 2024"). It shows Eco $39,900 / Plus $44,900, while its hidden page data says Plus $52,400, and VinFast's September 2026 release prices the **2027** VF 8 at Eco $40,400 / Plus $45,600.
- The VF 9 "Configure Your EV" link redirects to the VF 9 marketing page; there is no VF 9 configurator. The configurator's hidden model data shows the VF 9 at $69,800; vinfastauto.us says "From $62,900".
- The configurator's destination fee ($1,200) isn't confirmed anywhere current.

Building the CSV from this would mix model years and prices that VinFast itself no longer quotes, which the Wave 3 rules ("never estimate") and the "no messy customer-visible data" standard rule out.

What the configurator does show (for reference only, not imported): VF 8 colors Jet Black and Brahminy White (included), Neptune Grey and Desat Silver ($700), Sunset Orange, Deep Ocean, Crimson Red, VinFast Blue ($990); Granite Black interior; 19-inch wheels.

Current official figures found:
- **VF 8 (MY2027):** Eco $40,400, Plus $45,600 (press release above). Destination not stated.
- **VF 9:** "From $62,900" starting MSRP (vinfastauto.us/vehicles/vf-9); Eco 330 mi / Plus 291 mi EPA range, 402 hp, 123 kWh, 7 seats, 10-year/125,000-mile warranty. Plus price and model year not stated.

## 3. Decision needed

- **(a)** Hold VinFast until its configurator is updated (re-check monthly), or
- **(b)** Build VinFast rows from a dealer order guide / window stickers instead of the online configurator (needs a source Brett is comfortable with), or
- **(c)** Add Matchmaker rows only (VF 8 2027 Eco/Plus from the press release; VF 9 Eco/Plus once the Plus price and model year are confirmed), with no configurator data.

## Naming notes for MarketCheck

MarketCheck lists the models as "VF 8" / "VF 9" (with a space) in most feeds; some sources write "VF8". Trims are "Eco" and "Plus".
