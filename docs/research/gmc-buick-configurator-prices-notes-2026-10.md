# gmc-buick configurator: prices notes (2026-10-16)

Input `data/gmc-buick-configurator-repass-2026-10.csv` → output `data/gmc-buick-configurator-prices-2026-10.csv`. Same header, same 81 rows in the same order, 18 fields per row, same cell format and line endings. Only option prices (and, for Porsche, one added Paint to Sample option per row) changed; every changed row has its source added to `sources` if it wasn't already there.

Progress: GMC done | Buick done

How it was checked: GMC and Buick: each blank item was added on its own to the row's own build (same styleId as the source data) through GM's configurator feed on gmc.com / buick.com (ZIP 67201), and the configurator's total was compared before and after. A price is filled only when adding the item changed nothing else; where the total stayed the same, that is GM's configurator charging $0 (written as 0). Items GM only sells together with other options, or that it won't let you pick on their own, keep a blank price.

## Prices filled

| make | model | trim | model_year | option | old price | new price | source URL |
|---|---|---|---|---|---|---|---|
| GMC | Terrain | Elevation | 2026 | License plate front mounting package | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | Terrain | AT4 | 2026 | License plate front mounting package | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | Terrain | Denali | 2026 | License plate front mounting package | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | Acadia | Elevation | 2026 | License plate bracket, front | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | Acadia | Denali | 2026 | License plate bracket, front | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | Acadia | Denali Ultimate | 2026 | License plate bracket, front | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | Acadia | AT4 | 2026 | License plate bracket, front | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | Yukon | Elevation | 2026 | License plate front mounting package | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | Yukon | Denali | 2026 | License plate front mounting package | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | Yukon | AT4 | 2026 | License plate front mounting package | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | Yukon | AT4 Ultimate | 2026 | License plate front mounting package | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | Yukon | Denali Ultimate | 2026 | License plate front mounting package | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | Yukon | Elevation | 2027 | License plate front mounting package | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | Yukon | Denali | 2027 | License plate front mounting package | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | Yukon | AT4 | 2027 | License plate front mounting package | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | Yukon | AT4 Ultimate | 2027 | License plate front mounting package | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | Yukon | Denali Ultimate | 2027 | License plate front mounting package | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | Yukon XL | Elevation | 2026 | License plate front mounting package | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | Yukon XL | Denali | 2026 | License plate front mounting package | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | Yukon XL | AT4 | 2026 | License plate front mounting package | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | Yukon XL | AT4 Ultimate | 2026 | License plate front mounting package | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | Yukon XL | Denali Ultimate | 2026 | License plate front mounting package | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | Yukon XL | Elevation | 2027 | License plate front mounting package | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | Yukon XL | Denali | 2027 | License plate front mounting package | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | Yukon XL | AT4 | 2027 | License plate front mounting package | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | Yukon XL | AT4 Ultimate | 2027 | License plate front mounting package | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | Yukon XL | Denali Ultimate | 2027 | License plate front mounting package | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | Sierra 1500 | Pro | 2026 | Bumpers, front, Black (semi-gloss) | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | Sierra 1500 | Pro | 2026 | Bumpers, rear, Black (semi-gloss) | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | Sierra 1500 | Pro | 2026 | License plate kit, front | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | Sierra 1500 | SLE | 2026 | License plate kit, front | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | Sierra 1500 | Elevation | 2026 | License plate kit, front | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | Sierra 1500 | SLT | 2026 | License plate kit, front | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | Sierra 1500 | AT4 | 2026 | License plate kit, front | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | Sierra 1500 | Denali | 2026 | License plate kit, front | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | Sierra 1500 | AT4X | 2026 | License plate kit, front | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | Sierra 1500 | Denali Ultimate | 2026 | License plate kit, front | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | Sierra 2500HD | Pro | 2026 | License plate kit, front, Incandescent lighting | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | Sierra 2500HD | SLE | 2026 | License plate kit, front, Incandescent lighting | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | Sierra 2500HD | SLE | 2026 | Floor covering, rubberized-vinyl | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | Sierra 2500HD | SLT | 2026 | License plate kit, front, Incandescent lighting | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | Sierra 2500HD | AT4 | 2026 | License plate kit, front, Incandescent lighting | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | Sierra 2500HD | AT4X | 2026 | License plate kit, front, Incandescent lighting | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | Sierra 2500HD | Denali | 2026 | License plate kit, front, Incandescent lighting | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | Sierra 2500HD | Denali Ultimate | 2026 | License plate kit, front, Incandescent lighting | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | Sierra 3500HD | SLE | 2026 | Floor covering, rubberized-vinyl | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | Sierra 3500HD | AT4 | 2026 | LPO, Black GMC emblems | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | Sierra 3500HD | AT4 | 2026 | LPO, Black Sierra nameplates | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | Sierra 3500HD | Denali | 2026 | LPO, Black GMC emblems | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | Sierra 3500HD | Denali | 2026 | LPO, Black Sierra nameplates | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | Sierra 3500HD | Denali Ultimate | 2026 | LPO, Black GMC emblems | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | Sierra 3500HD | Denali Ultimate | 2026 | LPO, Black Sierra nameplates | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | HUMMER EV Pickup | 3X | 2026 | Skid plate insert, Carbon Fiber | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | HUMMER EV Pickup | 3X | 2026 | Approach shield, Black-painted | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | HUMMER EV SUV | 3X | 2026 | Wheel, spare, 22" Carbon Fiber Black | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | HUMMER EV SUV | 3X | 2026 | Skid plate insert, Carbon Fiber | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| GMC | HUMMER EV SUV | 3X | 2026 | Approach shield, Black-painted | (blank) | 0 | https://www.gmc.com/gmc/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| Buick | Enclave | Preferred | 2026 | License plate bracket, front mounting package | (blank) | 0 | https://www.buick.com/buick/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| Buick | Enclave | Sport Touring | 2026 | License plate bracket, front mounting package | (blank) | 0 | https://www.buick.com/buick/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| Buick | Enclave | Avenir | 2026 | License plate bracket, front mounting package | (blank) | 0 | https://www.buick.com/buick/shopping/api/aec-cp-configurator-gateway/p/v1/update |

Basis: 60 × no charge

## Options added

None.

## Still blank

| make | model | trim | model_year | option | reason |
|---|---|---|---|---|---|
| GMC | Terrain | Elevation | 2026 | Rear Camera Mirror | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Terrain | Elevation | 2026 | Mirror caps, Ebony Twilight | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Terrain | AT4 | 2026 | Rear Camera Mirror | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Terrain | AT4 | 2026 | Mirror caps, Ebony Twilight | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Terrain | Denali | 2026 | Mirror caps, Ebony Twilight | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Terrain | Elevation | 2027 | Rear Camera Mirror | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Terrain | Elevation | 2027 | Mirror caps, Ebony Twilight | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Terrain | AT4 | 2027 | Rear Camera Mirror | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Terrain | AT4 | 2027 | Mirror caps, Ebony Twilight | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Terrain | Denali | 2027 | Mirror caps, Ebony Twilight | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Acadia | Elevation | 2026 | LPO, 22" (55.9 cm) transit wheels | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Acadia | Elevation | 2026 | Seating, 8-passenger | already in the configurator's default build for this trim; no separate price shown |
| GMC | Acadia | Elevation | 2026 | Super Cruise hands-free driver assistance | not found in today's configurator data for this build |
| GMC | Acadia | Denali | 2026 | LPO, 22" (55.9 cm) transit wheels | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Acadia | Denali | 2026 | Super Cruise hands-free driver assistance | not found in today's configurator data for this build |
| GMC | Acadia | AT4 | 2026 | Super Cruise hands-free driver assistance | not found in today's configurator data for this build |
| GMC | Acadia | Elevation | 2027 | LPO, 22" (55.9 cm) transit wheels | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Acadia | Elevation | 2027 | Seating, 8-passenger | already in the configurator's default build for this trim; no separate price shown |
| GMC | Acadia | Elevation | 2027 | Super Cruise hands-free driver assistance | not found in today's configurator data for this build |
| GMC | Acadia | Denali | 2027 | LPO, 22" (55.9 cm) transit wheels | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Acadia | AT4 | 2027 | LPO, 18" (45.7 cm) Gloss Black wheels | package-priced (comes in "Adventure Package", priced in package_definitions) |
| GMC | Acadia | AT4 | 2027 | Super Cruise hands-free driver assistance | not found in today's configurator data for this build |
| GMC | Yukon | Elevation | 2026 | Wheels, 22" x 9" Interim | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon | Elevation | 2026 | Active Aero Shutters, upper and lower | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon | Elevation | 2026 | LPO, Cat-Back Performance Exhaust | the configurator returned no usable price for this item |
| GMC | Yukon | Elevation | 2026 | Alternator, 250 amps | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon | Elevation | 2026 | Battery, 850 cold-cranking amps with 95 amp hour rating | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon | Denali | 2026 | Wheels, 22" x 9" Interim | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon | Denali | 2026 | Seats, second row 60/40 split-folding bench, power release | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Yukon | Denali | 2026 | Active Aero Shutters, upper and lower | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon | Denali | 2026 | Alternator, 250 amps | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon | Denali | 2026 | Battery, 850 cold-cranking amps with 95 amp hour rating | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon | Denali | 2026 | USB ports, 2 type-A and C, charge and data, located inside center console | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Yukon | AT4 | 2026 | Alternator, 250 amps | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon | AT4 | 2026 | Battery, 850 cold-cranking amps with 95 amp hour rating | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon | AT4 Ultimate | 2026 | Transmission, 10-speed automatic | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Yukon | AT4 Ultimate | 2026 | Engine block heater | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon | AT4 Ultimate | 2026 | Alternator, 250 amps | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon | AT4 Ultimate | 2026 | Battery, 850 cold-cranking amps with 95 amp hour rating | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon | Denali Ultimate | 2026 | Wheels, 22" x 9" Interim | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon | Denali Ultimate | 2026 | Wheels, 24" x 9.5" Interim | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon | Denali Ultimate | 2026 | Active Aero Shutters, upper and lower | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon | Denali Ultimate | 2026 | Transmission, 10-speed automatic | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Yukon | Denali Ultimate | 2026 | Engine block heater | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon | Denali Ultimate | 2026 | Alternator, 250 amps | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon | Denali Ultimate | 2026 | Battery, 850 cold-cranking amps with 95 amp hour rating | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon | Elevation | 2027 | Wheels, 22" x 9" Interim | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon | Elevation | 2027 | Active Aero Shutters, upper and lower | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon | Elevation | 2027 | Battery, 850 cold-cranking amps with 95 amp hour rating | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon | Elevation | 2027 | Alternator, 250 amps | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon | Elevation | 2027 | Console, floor, power-sliding center | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Yukon | Denali | 2027 | Wheels, 22" x 9" Interim | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon | Denali | 2027 | Active Aero Shutters, upper and lower | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon | Denali | 2027 | Transmission, 10-speed automatic | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Yukon | Denali | 2027 | Battery, 850 cold-cranking amps with 95 amp hour rating | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon | Denali | 2027 | Alternator, 250 amps | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon | Denali | 2027 | Cooling system, extra capacity | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Yukon | Denali | 2027 | Engine block heater | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon | Denali | 2027 | Console, floor with storage area, cup holders | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Yukon | Denali | 2027 | USB ports, 2 type-A and C, charge and data, located inside center console | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Yukon | AT4 | 2027 | Alternator, 250 amps | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon | AT4 | 2027 | Battery, 850 cold-cranking amps with 95 amp hour rating | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon | AT4 | 2027 | Console, floor, power-sliding center | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Yukon | AT4 Ultimate | 2027 | Transmission, 10-speed automatic | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Yukon | AT4 Ultimate | 2027 | Engine block heater | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon | AT4 Ultimate | 2027 | Alternator, 250 amps | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon | AT4 Ultimate | 2027 | Battery, 850 cold-cranking amps with 95 amp hour rating | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon | Denali Ultimate | 2027 | Wheels, 22" x 9" Interim | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon | Denali Ultimate | 2027 | Wheels, 24" x 9.5" Interim | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon | Denali Ultimate | 2027 | Active Aero Shutters, upper and lower | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon | Denali Ultimate | 2027 | Transmission, 10-speed automatic | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Yukon | Denali Ultimate | 2027 | Battery, 850 cold-cranking amps with 95 amp hour rating | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon | Denali Ultimate | 2027 | Alternator, 250 amps | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon | Denali Ultimate | 2027 | Engine block heater | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon XL | Elevation | 2026 | Wheels, 22" x 9" Interim | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon XL | Elevation | 2026 | Active Aero Shutters, upper and lower | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon XL | Elevation | 2026 | LPO, Cat-Back Performance Exhaust | the configurator returned no usable price for this item |
| GMC | Yukon XL | Elevation | 2026 | Alternator, 250 amps | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon XL | Elevation | 2026 | Battery, 850 cold-cranking amps with 95 amp hour rating | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon XL | Denali | 2026 | Wheels, 22" x 9" Interim | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon XL | Denali | 2026 | Seats, second row 60/40 split-folding bench, power release | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Yukon XL | Denali | 2026 | Active Aero Shutters, upper and lower | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon XL | Denali | 2026 | Alternator, 250 amps | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon XL | Denali | 2026 | Battery, 850 cold-cranking amps with 95 amp hour rating | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon XL | Denali | 2026 | USB ports, 2 type-A and C, charge and data, located inside center console | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Yukon XL | AT4 | 2026 | Alternator, 250 amps | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon XL | AT4 | 2026 | Battery, 850 cold-cranking amps with 95 amp hour rating | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon XL | AT4 Ultimate | 2026 | Transmission, 10-speed automatic | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Yukon XL | AT4 Ultimate | 2026 | Engine block heater | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon XL | AT4 Ultimate | 2026 | Alternator, 250 amps | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon XL | AT4 Ultimate | 2026 | Battery, 850 cold-cranking amps with 95 amp hour rating | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon XL | Denali Ultimate | 2026 | Wheels, 22" x 9" Interim | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon XL | Denali Ultimate | 2026 | Wheels, 24" x 9.5" Interim | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon XL | Denali Ultimate | 2026 | Active Aero Shutters, upper and lower | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon XL | Denali Ultimate | 2026 | Transmission, 10-speed automatic | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Yukon XL | Denali Ultimate | 2026 | Engine block heater | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon XL | Denali Ultimate | 2026 | Alternator, 250 amps | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon XL | Denali Ultimate | 2026 | Battery, 850 cold-cranking amps with 95 amp hour rating | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon XL | Elevation | 2027 | Wheels, 22" x 9" Interim | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon XL | Elevation | 2027 | Active Aero Shutters, upper and lower | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon XL | Elevation | 2027 | Alternator, 250 amps | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon XL | Elevation | 2027 | Battery, 850 cold-cranking amps with 95 amp hour rating | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon XL | Elevation | 2027 | Console, floor, power-sliding center | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Yukon XL | Denali | 2027 | Wheels, 22" x 9" Interim | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon XL | Denali | 2027 | Active Aero Shutters, upper and lower | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon XL | Denali | 2027 | Transmission, 10-speed automatic | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Yukon XL | Denali | 2027 | Engine block heater | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon XL | Denali | 2027 | Cooling system, extra capacity | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Yukon XL | Denali | 2027 | Alternator, 250 amps | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon XL | Denali | 2027 | Battery, 850 cold-cranking amps with 95 amp hour rating | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon XL | Denali | 2027 | USB ports, 2 type-A and C, charge and data, located inside center console | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Yukon XL | Denali | 2027 | Console, floor with storage area, cup holders | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Yukon XL | AT4 | 2027 | Alternator, 250 amps | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon XL | AT4 | 2027 | Battery, 850 cold-cranking amps with 95 amp hour rating | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon XL | AT4 | 2027 | Console, floor, power-sliding center | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Yukon XL | AT4 Ultimate | 2027 | Transmission, 10-speed automatic | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Yukon XL | AT4 Ultimate | 2027 | Engine block heater | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon XL | AT4 Ultimate | 2027 | Alternator, 250 amps | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon XL | AT4 Ultimate | 2027 | Battery, 850 cold-cranking amps with 95 amp hour rating | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon XL | Denali Ultimate | 2027 | Wheels, 22" x 9" Interim | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon XL | Denali Ultimate | 2027 | Wheels, 24" x 9.5" Interim | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon XL | Denali Ultimate | 2027 | Active Aero Shutters, upper and lower | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon XL | Denali Ultimate | 2027 | Transmission, 10-speed automatic | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Yukon XL | Denali Ultimate | 2027 | Engine block heater | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon XL | Denali Ultimate | 2027 | Alternator, 250 amps | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Yukon XL | Denali Ultimate | 2027 | Battery, 850 cold-cranking amps with 95 amp hour rating | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Canyon | Elevation | 2026 | Rear axle, 3.42 ratio | already in the configurator's default build for this trim; no separate price shown |
| GMC | Canyon | AT4 | 2026 | Rear axle, 3.42 ratio | already in the configurator's default build for this trim; no separate price shown |
| GMC | Canyon | Denali | 2026 | Rear axle, 3.42 ratio | already in the configurator's default build for this trim; no separate price shown |
| GMC | Canyon | AT4X | 2026 | Rear axle, 3.42 ratio | already in the configurator's default build for this trim; no separate price shown |
| GMC | Canyon | AT4X | 2026 | GVWR, 6250 lbs (2835 kg) | already in the configurator's default build for this trim; no separate price shown |
| GMC | Sierra 1500 | Pro | 2026 | Cooling, external engine oil cooler | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 1500 | Pro | 2026 | Cooling, auxiliary external transmission oil cooler | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 1500 | Pro | 2026 | Alternator, 170 amps | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 1500 | Pro | 2026 | Alternator, 220 amps | the configurator asks to confirm a change when it is added; not recorded as no-charge |
| GMC | Sierra 1500 | Pro | 2026 | Transmission, 10-speed automatic, (Column shifter) electronically controlled | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 1500 | Pro | 2026 | GVWR, 6800 lbs. (3084 kg) | already in the configurator's default build for this trim; no separate price shown |
| GMC | Sierra 1500 | Pro | 2026 | GVWR, 6900 lbs. (3130 kg) | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 1500 | Pro | 2026 | USB ports, (2) charge-only, rear | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Sierra 1500 | Pro | 2026 | Power outlet, bed mounted, 120-volt | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Sierra 1500 | Pro | 2026 | Mirror, inside rearview auto-dimming | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Sierra 1500 | SLE | 2026 | Suspension Package, High Capacity | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 1500 | SLE | 2026 | Cooling, external engine oil cooler | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 1500 | SLE | 2026 | Cooling, auxiliary external transmission oil cooler | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 1500 | SLE | 2026 | Alternator, 170 amps | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 1500 | SLE | 2026 | Transmission, 10-speed automatic, (Column shifter) electronically controlled | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 1500 | SLE | 2026 | GVWR, 6800 lbs. (3084 kg) | already in the configurator's default build for this trim; no separate price shown |
| GMC | Sierra 1500 | SLE | 2026 | GVWR, 6900 lbs. (3130 kg) | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 1500 | SLE | 2026 | GVWR, 7100 lbs. (3221 kg) | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 1500 | SLE | 2026 | Mirror, inside rearview auto-dimming | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 1500 | Elevation | 2026 | Wireless phone charging | not found in today's configurator data for this build |
| GMC | Sierra 1500 | Elevation | 2026 | Electronic Precision Shift and steering column paddle shifters | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Sierra 1500 | Elevation | 2026 | Cooling, external engine oil cooler | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 1500 | Elevation | 2026 | Cooling, auxiliary external transmission oil cooler | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 1500 | Elevation | 2026 | Alternator, 170 amps | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 1500 | Elevation | 2026 | Transmission, 10-speed automatic, (Column shifter) electronically controlled | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 1500 | Elevation | 2026 | Transmission, 10-speed automatic with Electronic Precision shift, electronically controlled | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 1500 | Elevation | 2026 | GVWR, 6800 lbs. (3084 kg) | already in the configurator's default build for this trim; no separate price shown |
| GMC | Sierra 1500 | Elevation | 2026 | GVWR, 7000 lbs. (3175 kg) | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 1500 | Elevation | 2026 | GVWR, 6900 lbs. (3130 kg) | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 1500 | Elevation | 2026 | GVWR, 7100 lbs. (3221 kg) | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Sierra 1500 | Elevation | 2026 | Center Console, floor-mounted | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Sierra 1500 | Elevation | 2026 | Premium Floor Liners with removable carpet insert, rear | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 1500 | Elevation | 2026 | USB Ports, 2, Charge/Data ports located inside center console | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Sierra 1500 | Elevation | 2026 | Mirror, inside rearview auto-dimming | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 1500 | SLT | 2026 | Transmission, 10-speed automatic with Electronic Precision shift, electronically controlled | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 1500 | SLT | 2026 | GVWR, 6900 lbs. (3130 kg) | already in the configurator's default build for this trim; no separate price shown |
| GMC | Sierra 1500 | SLT | 2026 | GVWR, 7000 lbs. (3175 kg) | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 1500 | SLT | 2026 | GVWR, 7100 lbs. (3221 kg) | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 1500 | SLT | 2026 | Premium Floor Liners with removable carpet insert, rear | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 1500 | AT4 | 2026 | Mirror caps, chrome | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 1500 | AT4 | 2026 | Engine block heater | the configurator asks to confirm a change when it is added; not recorded as no-charge |
| GMC | Sierra 1500 | AT4 | 2026 | Cooling, external engine oil cooler | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 1500 | AT4 | 2026 | Cooling, auxiliary external transmission oil cooler | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 1500 | AT4 | 2026 | Alternator, 170 amps | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 1500 | AT4 | 2026 | GVWR, 7200 lbs. (3266 kg) | already in the configurator's default build for this trim; no separate price shown |
| GMC | Sierra 1500 | AT4 | 2026 | GVWR, 7100 lbs. (3221 kg) | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 1500 | Denali | 2026 | Alternator, 220 amps | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 1500 | Denali | 2026 | GVWR, 6900 lbs. (3130 kg) | already in the configurator's default build for this trim; no separate price shown |
| GMC | Sierra 1500 | Denali | 2026 | GVWR, 7000 lbs. (3175 kg) | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 1500 | Denali | 2026 | Premium Floor Liners with removable carpet insert, rear | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 1500 | AT4X | 2026 | Engine block heater | the configurator asks to confirm a change when it is added; not recorded as no-charge |
| GMC | Sierra 1500 | AT4X | 2026 | Cooling, external engine oil cooler | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 1500 | AT4X | 2026 | Cooling, auxiliary external transmission oil cooler | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 1500 | AT4X | 2026 | Alternator, 170 amps | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 1500 | AT4X | 2026 | GVWR, 7300 lbs. (3311 kg) | already in the configurator's default build for this trim; no separate price shown |
| GMC | Sierra 1500 | AT4X | 2026 | GVWR, 7100 lbs. (3221 kg) | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 1500 | Denali Ultimate | 2026 | Engine block heater | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Sierra 1500 | Denali Ultimate | 2026 | Alternator, 220 amps | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Sierra 1500 | Denali Ultimate | 2026 | Exhaust, dual system | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Sierra 1500 | Denali Ultimate | 2026 | GVWR, 7100 lbs. (3221 kg) | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 1500 | Denali Ultimate | 2026 | GVWR, 7200 lbs. (3266 kg) | already in the configurator's default build for this trim; no separate price shown |
| GMC | Sierra 1500 | Denali Ultimate | 2026 | Premium Floor Liners with removable carpet insert, rear | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 2500HD | Pro | 2026 | Winter Grille Cover | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 2500HD | Pro | 2026 | Exhaust brake | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 2500HD | Pro | 2026 | Floor mats, rubberized-vinyl front | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 2500HD | Pro | 2026 | Floor mats, rubberized-vinyl rear | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 2500HD | Pro | 2026 | USB ports, (2) charge-only, rear | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 2500HD | Pro | 2026 | Mirror, inside rearview auto dimming with partial video display | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 2500HD | SLE | 2026 | Winter Grille Cover | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 2500HD | SLE | 2026 | Exhaust brake | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 2500HD | SLE | 2026 | Premium Floor Liners with removable carpet insert, rear | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 2500HD | SLE | 2026 | Mirror, inside rearview auto-dimming | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | Sierra 2500HD | SLT | 2026 | Winter Grille Cover | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 2500HD | SLT | 2026 | Exhaust brake | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 2500HD | SLT | 2026 | Premium Floor Liners with removable carpet insert, rear | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 2500HD | AT4 | 2026 | Winter Grille Cover | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 2500HD | AT4 | 2026 | Exhaust brake | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 2500HD | AT4X | 2026 | Winter Grille Cover | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 2500HD | AT4X | 2026 | Exhaust brake | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 2500HD | Denali | 2026 | Winter Grille Cover | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 2500HD | Denali | 2026 | Exhaust brake | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 2500HD | Denali | 2026 | Premium Floor Liners with removable carpet insert, rear | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 2500HD | Denali Ultimate | 2026 | Premium Floor Liners with removable carpet insert, rear | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 3500HD | Pro | 2026 | Winter Grille Cover | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 3500HD | Pro | 2026 | Exhaust Brake | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 3500HD | Pro | 2026 | Floor mats, rubberized-vinyl front | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 3500HD | Pro | 2026 | Floor mats, rubberized-vinyl rear | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 3500HD | Pro | 2026 | USB ports, (2) charge-only, rear | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 3500HD | Pro | 2026 | Power outlet, bed mounted, 120-volt | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 3500HD | Pro | 2026 | Mirror, inside rearview auto dimming with partial video display | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 3500HD | SLE | 2026 | Winter Grille Cover | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 3500HD | SLE | 2026 | LPO, Black GMC emblems | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 3500HD | SLE | 2026 | LPO, Black Sierra nameplates | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 3500HD | SLE | 2026 | Exhaust Brake | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 3500HD | SLE | 2026 | Transmission, 10-speed automatic with integrated Power Take-Off (PTO) | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 3500HD | SLE | 2026 | Premium Floor Liners with removable carpet insert, rear | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 3500HD | SLE | 2026 | Mirror, inside rearview auto-dimming | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 3500HD | SLT | 2026 | Winter Grille Cover | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 3500HD | SLT | 2026 | LPO, Black GMC emblems | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 3500HD | SLT | 2026 | LPO, Black Sierra nameplates | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 3500HD | SLT | 2026 | Exhaust Brake | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 3500HD | SLT | 2026 | Premium Floor Liners with removable carpet insert, rear | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 3500HD | AT4 | 2026 | Winter Grille Cover | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 3500HD | AT4 | 2026 | Exhaust Brake | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 3500HD | Denali | 2026 | Winter Grille Cover | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 3500HD | Denali | 2026 | Exhaust Brake | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 3500HD | Denali | 2026 | Premium Floor Liners with removable carpet insert, rear | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra 3500HD | Denali Ultimate | 2026 | Premium Floor Liners with removable carpet insert, rear | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra EV | Denali | 2026 | Dual Level Charge Cord | already in the configurator's default build for this trim; no separate price shown |
| GMC | Sierra EV | Denali | 2026 | LPO, Wheel lug nuts, Black | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra EV | Elevation | 2026 | Dual Level Charge Cord | already in the configurator's default build for this trim; no separate price shown |
| GMC | Sierra EV | Elevation | 2026 | LPO, Wheel lug nuts, Black | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | Sierra EV | AT4 | 2026 | Dual Level Charge Cord | already in the configurator's default build for this trim; no separate price shown |
| GMC | HUMMER EV Pickup | 2X | 2026 | Wheels, 18" x 9" Black Aluminum with machined accents | the configurator returned no usable price for this item |
| GMC | HUMMER EV Pickup | 2X | 2026 | Dual level charge cord, dual-mode, portable | already in the configurator's default build for this trim; no separate price shown |
| GMC | HUMMER EV Pickup | 2X | 2026 | LPO, Outside Rearview Mirror Projection Lights with HUMMER EV logo | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | HUMMER EV Pickup | 2X | 2026 | LPO, Front Off-Road Auxiliary Lights | the configurator returned no usable price for this item |
| GMC | HUMMER EV Pickup | 2X | 2026 | Battery Pack, 20 module pack | already in the configurator's default build for this trim; no separate price shown |
| GMC | HUMMER EV Pickup | 2X | 2026 | LPO, Accessory Touch-Screen Control Switches | the configurator returned no usable price for this item |
| GMC | HUMMER EV Pickup | 2X | 2026 | LPO, Interior LED Lighting Kit, front footwell | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | HUMMER EV Pickup | 3X | 2026 | Wheels, 18" x 9" Black Aluminum with machined accents | the configurator returned no usable price for this item |
| GMC | HUMMER EV Pickup | 3X | 2026 | Wheels, 22" x 9.5" Carbon Fiber Black | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | HUMMER EV Pickup | 3X | 2026 | Dual level charge cord, dual-mode, portable | already in the configurator's default build for this trim; no separate price shown |
| GMC | HUMMER EV Pickup | 3X | 2026 | LPO, Outside Rearview Mirror Projection Lights with HUMMER EV logo | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | HUMMER EV Pickup | 3X | 2026 | LPO, Front Off-Road Auxiliary Lights | the configurator returned no usable price for this item |
| GMC | HUMMER EV Pickup | 3X | 2026 | Battery Pack, 20 module pack | already in the configurator's default build for this trim; no separate price shown |
| GMC | HUMMER EV Pickup | 3X | 2026 | LPO, Accessory Touch-Screen Control Switches | the configurator returned no usable price for this item |
| GMC | HUMMER EV Pickup | 3X | 2026 | LPO, Interior LED Lighting Kit, front footwell | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | HUMMER EV SUV | 2X | 2026 | Wheels, 18" x 9" Black Aluminum | the configurator returned no usable price for this item |
| GMC | HUMMER EV SUV | 2X | 2026 | Wheel, Spare 22" x 9.5" Premium Finish Painted Aluminum | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | HUMMER EV SUV | 2X | 2026 | Dual Level Charge Cord, dual-mode, portable | already in the configurator's default build for this trim; no separate price shown |
| GMC | HUMMER EV SUV | 2X | 2026 | LPO, Spare Wheel, 22" | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | HUMMER EV SUV | 2X | 2026 | LPO, Spare Wheel, 18" | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | HUMMER EV SUV | 2X | 2026 | LPO, Outside Rearview Mirror Projection Lights | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | HUMMER EV SUV | 2X | 2026 | LPO, Front Off-Road Auxiliary Lights | the configurator returned no usable price for this item |
| GMC | HUMMER EV SUV | 2X | 2026 | LPO, Accessory Touch-Screen Control Switches | the configurator returned no usable price for this item |
| GMC | HUMMER EV SUV | 2X | 2026 | LPO, Interior LED Lighting Kit, front footwell | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | HUMMER EV SUV | 3X | 2026 | Wheels, 18" x 9" Black Aluminum | the configurator returned no usable price for this item |
| GMC | HUMMER EV SUV | 3X | 2026 | Wheels, 22" x 9.5" Carbon Fiber Black | not selectable on its own: the configurator asks for another choice first and shows no price |
| GMC | HUMMER EV SUV | 3X | 2026 | Dual Level Charge Cord, dual-mode, portable | already in the configurator's default build for this trim; no separate price shown |
| GMC | HUMMER EV SUV | 3X | 2026 | LPO, Spare Wheel, 22" | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | HUMMER EV SUV | 3X | 2026 | LPO, Spare Wheel, 18" | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | HUMMER EV SUV | 3X | 2026 | LPO, Outside Rearview Mirror Projection Lights | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| GMC | HUMMER EV SUV | 3X | 2026 | LPO, Front Off-Road Auxiliary Lights | the configurator returned no usable price for this item |
| GMC | HUMMER EV SUV | 3X | 2026 | LPO, Accessory Touch-Screen Control Switches | the configurator returned no usable price for this item |
| GMC | HUMMER EV SUV | 3X | 2026 | LPO, Interior LED Lighting Kit, front footwell | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Buick | Encore GX | Preferred | 2026 | AUX heater, electric, heating/defroster | configurator total rises $395 when added but it asks to confirm a change first; not recorded |
| Buick | Enclave | Avenir | 2026 | Rear Camera Mirror | not found in today's configurator data for this build |
| Buick | Enclave | Preferred | 2027 | LPO, 22" (55.9 cm) transit wheels | not selectable on its own: the configurator asks for another choice first and shows no price |
| Buick | Enclave | Sport Touring | 2027 | LPO, 22" (55.9 cm) transit wheels | not selectable on its own: the configurator asks for another choice first and shows no price |

## Unresolved

- Most GMC blanks (276 of 334) are items GM's configurator only sells together with other options (for example Rear Camera Mirror with the Technology Package, Winter Grille Cover and Exhaust Brake with the diesel, block heaters and alternators with an engine) or won't let you pick on their own. GM publishes no separate price for them. Their availability (Standalone) looks wrong for many of them, but availability was not changed, as the brief says.
- Super Cruise on five 2026/2027 Acadia rows and "Wireless phone charging" on the 2026 Sierra 1500 Elevation no longer appear in today's configurator data for those builds.
- HUMMER EV rows: for some accessories the configurator returned no usable total, so they stay blank.
- Three items show $0 in the configurator but it also asks to confirm a change (2026 Sierra 1500 Pro Alternator 220 amps; 2026 Sierra 1500 AT4 and AT4X engine block heater). Left blank rather than recorded as $0.
- Buick Encore GX Preferred: the electric AUX heater adds $395 in the configurator, but it asks to confirm a change first. Left blank.
- 2027 Acadia AT4: the 18-in. Gloss Black wheels are Package-only in the file; GM lists $2,495 for them (they also need the Black lug nuts). Kept blank (package-only rule).

## Counts

| make | blank prices in | filled | package-priced | still blank | options added |
|---|---|---|---|---|---|
| GMC | 334 | 57 | 1 | 276 | 0 |
| Buick | 7 | 3 | 0 | 4 | 0 |

Rows in = rows out: 81 = 81.
