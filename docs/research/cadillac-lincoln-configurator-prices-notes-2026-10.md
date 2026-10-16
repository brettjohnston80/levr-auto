# cadillac-lincoln configurator: prices notes (2026-10-16)

Input `data/cadillac-lincoln-configurator-repass-2026-10.csv` → output `data/cadillac-lincoln-configurator-prices-2026-10.csv`. Same header, same 95 rows in the same order, 18 fields per row, same cell format and line endings. Only option prices (and, for Porsche, one added Paint to Sample option per row) changed; every changed row has its source added to `sources` if it wasn't already there.

Progress: Cadillac done | Lincoln done

How it was checked: Cadillac: same method as GMC, on cadillac.com's configurator feed. Lincoln: every Lincoln row's lincoln.com Build & Price page was reopened (Aviator, Corsair, Nautilus, Navigator, Navigator L). Lincoln shows none of these items or packages with a price.

## Prices filled

| make | model | trim | model_year | option | old price | new price | source URL |
|---|---|---|---|---|---|---|---|
| Cadillac | CT5 | V Blackwing | 2026 | Front splitter, none | (blank) | 0 | https://www.cadillac.com/cadillac/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| Cadillac | Escalade | Platinum Luxury | 2026 | Night Vision | (blank) | 0 | https://www.cadillac.com/cadillac/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| Cadillac | Escalade | Platinum Sport | 2026 | Night Vision | (blank) | 0 | https://www.cadillac.com/cadillac/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| Cadillac | Escalade | V-Series | 2026 | Night Vision | (blank) | 0 | https://www.cadillac.com/cadillac/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| Cadillac | Escalade ESV | Platinum Luxury | 2026 | Night Vision | (blank) | 0 | https://www.cadillac.com/cadillac/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| Cadillac | Escalade ESV | Platinum Sport | 2026 | Night Vision | (blank) | 0 | https://www.cadillac.com/cadillac/shopping/api/aec-cp-configurator-gateway/p/v1/update |
| Cadillac | Escalade ESV | V-Series | 2026 | Night Vision | (blank) | 0 | https://www.cadillac.com/cadillac/shopping/api/aec-cp-configurator-gateway/p/v1/update |

Basis: 7 × no charge

## Options added

None.

## Still blank

| make | model | trim | model_year | option | reason |
|---|---|---|---|---|---|
| Cadillac | CT5 | Premium Luxury | 2026 | Tires, 245/40R19, all-season, run-flat | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | CT5 | Premium Luxury | 2026 | Rear Park Assist | the configurator returned no usable price for this item |
| Cadillac | CT5 | Premium Luxury | 2026 | HD Rear Vision Camera | the configurator returned no usable price for this item |
| Cadillac | CT5 | Sport | 2026 | Calipers, Blue front and rear | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | CT5 | Sport | 2026 | Calipers, Red front and rear | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | CT5 | V | 2026 | Tires, 245/40R19, all-season, run-flat | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | CT5 | V Blackwing | 2026 | Adaptive cruise control | not found in today's configurator data for this build |
| Cadillac | CT5 | V Blackwing | 2026 | Tires, competition oriented, 285/35ZR19 XL (103Y) front, 305/30ZR19 XL (102Y) rear, Michelin Pilot Sport Cup 2 R | not selectable on its own: the configurator asks for another choice first and shows no price |
| Cadillac | CT5 | V Blackwing | 2026 | Enhanced Automatic Emergency Braking | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | CT5 | V Blackwing | 2026 | Intersection Automatic Emergency Braking | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | CT5 | V Blackwing | 2026 | Reverse Automatic Braking | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | CT5 | V Blackwing | 2026 | Rear Cross Traffic Braking | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | CT5 | V Blackwing | 2026 | Enhanced Automatic Parking Assist | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | CT5 | V Blackwing | 2026 | Front Pedestrian and Bicyclist Braking | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | CT5 | V Blackwing | 2026 | Side Bicyclist Alert | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | CT5 | V Blackwing | 2026 | Buckle to Drive | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | CT5 | V Blackwing | 2026 | Electronic Precision Shift | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | CT5 | V Blackwing | 2026 | Brake, automatic vehicle hold | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | CT5 | V Blackwing | 2026 | Adaptive Remote Start | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | Escalade | Luxury | 2026 | Active Noise Cancellation with Dolby Atmos | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | Escalade | Sport | 2026 | Active Noise Cancellation with Dolby Atmos | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | Escalade ESV | Luxury | 2026 | Active Noise Cancellation with Dolby Atmos | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | Escalade ESV | Sport | 2026 | Active Noise Cancellation with Dolby Atmos | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | Escalade IQ | Luxury | 2026 | LPO, Roof rack side rails | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | Escalade IQ | Sport | 2026 | LPO, Black wheel center cap with bronze ring | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | Escalade IQ | Sport | 2026 | LPO, Roof rack side rails | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | Escalade IQ | Premium Luxury | 2026 | LPO, Roof rack side rails | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | Escalade IQ | Premium Sport | 2026 | LPO, Black wheel center cap with bronze ring | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | Escalade IQ | Premium Sport | 2026 | LPO, Roof rack side rails | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | Escalade IQL | Luxury | 2026 | Roof rails, Black | the configurator returned no usable price for this item |
| Cadillac | Escalade IQL | Sport | 2026 | LPO, Black wheel center cap with bronze ring | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | Escalade IQL | Premium Luxury | 2026 | Roof rails, Black | the configurator returned no usable price for this item |
| Cadillac | Escalade IQL | Premium Sport | 2026 | LPO, Black wheel center cap with bronze ring | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | Lyriq | Luxury | 2026 | Trailer hitch receiver plug | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | Lyriq | Premium Luxury | 2026 | Trailer hitch receiver plug | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | Lyriq | Signature Luxury | 2026 | Trailer hitch receiver plug | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | Lyriq | Sport | 2026 | Trailer hitch receiver plug | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | Lyriq | Premium Sport | 2026 | Trailer hitch receiver plug | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | Lyriq | Signature Sport | 2026 | Trailer hitch receiver plug | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | Lyriq | V | 2026 | Brake rotor, non-FNC | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | Lyriq | V | 2026 | Trailer hitch receiver plug | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | Lyriq | V Premium | 2026 | Brake rotor, non-FNC | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | Lyriq | V Premium | 2026 | Trailer hitch receiver plug | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | Lyriq | Luxury | 2027 | LPO, Trailer hitch receiver plug | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | Lyriq | Premium Luxury | 2027 | LPO, Trailer hitch receiver plug | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | Lyriq | Signature Luxury | 2027 | LPO, Trailer hitch receiver plug | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | Lyriq | Sport | 2027 | LPO, Trailer hitch receiver plug | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | Lyriq | Premium Sport | 2027 | LPO, Trailer hitch receiver plug | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | Lyriq | Signature Sport | 2027 | LPO, Trailer hitch receiver plug | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | Lyriq | V | 2027 | Brake rotor, non-FNC | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | Lyriq | V | 2027 | LPO, Trailer hitch receiver plug | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | Lyriq | V Premium | 2027 | Brake rotor, non-FNC | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | Lyriq | V Premium | 2027 | LPO, Trailer hitch receiver plug | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | Optiq | V | 2026 | Brake lining, low metallic | the configurator returned no usable price for this item |
| Cadillac | Optiq | V | 2026 | package: Charging and Convenience Package 2 | not published: no package price in the configurator data |
| Cadillac | Optiq | Luxury | 2026 | LPO, Trailer hitch bezel | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | Optiq | Premium Luxury | 2026 | LPO, Trailer hitch bezel | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | Optiq | Premium Luxury | 2026 | Floor mats, deluxe carpeted front | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | Optiq | Premium Luxury | 2026 | Floor mats, deluxe carpeted rear | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | Optiq | Sport | 2026 | LPO, Trailer hitch bezel | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | Optiq | Premium Sport | 2026 | LPO, Trailer hitch bezel | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | Optiq | Premium Sport | 2026 | Floor mats, deluxe carpeted front | the configurator returned no usable price for this item |
| Cadillac | Optiq | Premium Sport | 2026 | Floor mats, deluxe carpeted rear | the configurator returned no usable price for this item |
| Cadillac | Optiq | Luxury | 2027 | Trailer hitch receiver plug | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | Optiq | Luxury | 2027 | LPO, Trailer hitch bezel | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | Optiq | Premium Luxury | 2027 | Trailer hitch receiver plug | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | Optiq | Premium Luxury | 2027 | LPO, Trailer hitch bezel | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | Optiq | Premium Luxury | 2027 | Floor mats, deluxe carpeted front | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | Optiq | Premium Luxury | 2027 | Floor mats, deluxe carpeted rear | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | Optiq | Sport | 2027 | Trailer hitch receiver plug | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | Optiq | Sport | 2027 | LPO, Trailer hitch bezel | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | Optiq | Premium Sport | 2027 | Trailer hitch receiver plug | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | Optiq | Premium Sport | 2027 | LPO, Trailer hitch bezel | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | Optiq | Premium Sport | 2027 | Floor mats, deluxe carpeted front | the configurator returned no usable price for this item |
| Cadillac | Optiq | Premium Sport | 2027 | Floor mats, deluxe carpeted rear | the configurator returned no usable price for this item |
| Cadillac | Vistiq | Luxury | 2026 | Wheels, 21" (53.3 cm) Diamond Cut with Medium Android finish and Carbon Flash Metallic inserts | 2026 Vistiq is no longer on cadillac.com's configurator ("Unsupported Vehicle") |
| Cadillac | Vistiq | Luxury | 2026 | Roof rails, Gloss Black | 2026 Vistiq is no longer on cadillac.com's configurator ("Unsupported Vehicle") |
| Cadillac | Vistiq | Luxury | 2026 | LPO, Trailer hitch receiver plug | 2026 Vistiq is no longer on cadillac.com's configurator ("Unsupported Vehicle") |
| Cadillac | Vistiq | Luxury | 2026 | LPO, Trailer hitch bezel | 2026 Vistiq is no longer on cadillac.com's configurator ("Unsupported Vehicle") |
| Cadillac | Vistiq | Premium Luxury | 2026 | Roof rails, Gloss Black | 2026 Vistiq is no longer on cadillac.com's configurator ("Unsupported Vehicle") |
| Cadillac | Vistiq | Premium Luxury | 2026 | LPO, Trailer hitch receiver plug | 2026 Vistiq is no longer on cadillac.com's configurator ("Unsupported Vehicle") |
| Cadillac | Vistiq | Premium Luxury | 2026 | LPO, Trailer hitch bezel | 2026 Vistiq is no longer on cadillac.com's configurator ("Unsupported Vehicle") |
| Cadillac | Vistiq | Sport | 2026 | Wheels, 21" (53.3 cm) Diamond Cut with Dark Android finish and High Gloss Black inserts | 2026 Vistiq is no longer on cadillac.com's configurator ("Unsupported Vehicle") |
| Cadillac | Vistiq | Sport | 2026 | LPO, Trailer hitch receiver plug | 2026 Vistiq is no longer on cadillac.com's configurator ("Unsupported Vehicle") |
| Cadillac | Vistiq | Sport | 2026 | LPO, Trailer hitch bezel | 2026 Vistiq is no longer on cadillac.com's configurator ("Unsupported Vehicle") |
| Cadillac | Vistiq | Platinum | 2026 | LPO, Trailer hitch receiver plug | 2026 Vistiq is no longer on cadillac.com's configurator ("Unsupported Vehicle") |
| Cadillac | Vistiq | Platinum | 2026 | LPO, Trailer hitch bezel | 2026 Vistiq is no longer on cadillac.com's configurator ("Unsupported Vehicle") |
| Cadillac | Vistiq | Luxury | 2027 | Roof rails, Gloss Black | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | Vistiq | Premium Luxury | 2027 | Roof rails, Gloss Black | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | XT5 | Luxury | 2026 | Tires, P235/55R20 all-season, H-rated, blackwall | not selectable on its own: the configurator asks for another choice first and shows no price |
| Cadillac | XT5 | Premium Luxury | 2026 | Front-Wheel Drive, 3.6L V6 engine, 9-speed automatic transmission for 3.6L engine | not found in today's configurator data for this build |
| Cadillac | XT5 | Premium Luxury | 2026 | All-Wheel Drive, 3.6L V6 engine, 9-speed automatic transmission for 3.6L engine | not found in today's configurator data for this build |
| Cadillac | XT5 | Premium Luxury | 2026 | Cooling system, heavy-duty | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | XT5 | Premium Luxury | 2026 | Alternator, 155 amps | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | XT5 | Premium Luxury | 2026 | Hitch Guidance | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | XT5 | Premium Luxury | 2026 | Hitch Guidance with Hitch View | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | XT5 | Premium Luxury | 2026 | Seats, heated rear outboard seating positions | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Cadillac | XT5 | Premium Luxury | 2026 | Air Ionizer | requires other items: the configurator adds or removes other options with it, so it has no separate price |
| Lincoln | Aviator | Reserve | 2026 | Air Glide Suspension with Dynamic Lower Entry | package-priced, but its package ("Dynamic Handling Package") has no published price |
| Lincoln | Aviator | Reserve | 2026 | package: Dynamic Handling Package | not published: lincoln.com shows this package with no price on this trim (re-checked 2026-10-16) |
| Lincoln | Aviator | Black Label | 2026 | Flight Theme | not published: lincoln.com shows this item with no price (only "Details") |
| Lincoln | Aviator | Black Label | 2026 | Moonbeam Theme | not published: lincoln.com shows this item with no price (only "Details") |
| Lincoln | Aviator | Reserve | 2027 | Air Glide Suspension with Dynamic Lower Entry | package-priced, but its package ("Dynamic Handling Package") has no published price |
| Lincoln | Aviator | Reserve | 2027 | package: Dynamic Handling Package | not published: lincoln.com shows this package with no price on this trim (re-checked 2026-10-16) |
| Lincoln | Aviator | Black Label | 2027 | Flight Theme | not published: lincoln.com shows this item with no price (only "Details") |
| Lincoln | Aviator | Black Label | 2027 | Moonbeam Theme | not published: lincoln.com shows this item with no price (only "Details") |
| Lincoln | Corsair | Reserve | 2026 | Hands-free driver assistance | not published: lincoln.com shows this item with no price (only "Details") |
| Lincoln | Corsair | Reserve | 2026 | BlueCruise Hands-Free Highway Driving (4-years Included) | not published: lincoln.com shows this item with no price (only "Details") |
| Lincoln | Corsair | Reserve | 2026 | Finestra Aluminum Appliqué | not published: lincoln.com shows this item with no price (only "Details") |
| Lincoln | Corsair | Reserve | 2026 | Pista Aluminum Appliqué | not published: lincoln.com shows this item with no price (only "Details") |
| Lincoln | Corsair | Grand Touring | 2026 | Hands-free driver assistance | not published: lincoln.com shows this item with no price (only "Details") |
| Lincoln | Corsair | Grand Touring | 2026 | BlueCruise Hands-Free Highway Driving (4-years Included) | not published: lincoln.com shows this item with no price (only "Details") |
| Lincoln | Corsair | Grand Touring | 2026 | Finestra Aluminum Appliqué | not published: lincoln.com shows this item with no price (only "Details") |
| Lincoln | Corsair | Grand Touring | 2026 | Pista Aluminum Appliqué | not published: lincoln.com shows this item with no price (only "Details") |
| Lincoln | Corsair | Grand Touring | 2026 | Paldao Wood Applique | not published: lincoln.com shows this item with no price (only "Details") |
| Lincoln | Nautilus | Reserve | 2026 | Lincoln Rejuvenate | not published: lincoln.com shows this item with no price (only "Details") |
| Lincoln | Nautilus | Black Label | 2026 | Aurora Theme | not published: lincoln.com shows this item with no price (only "Details") |
| Lincoln | Navigator | Premiere | 2026 | PowerFold® 40/20/40 Split Bench with Power Recline | not published: lincoln.com shows this item with no price (only "Details") |
| Lincoln | Navigator | Black Label | 2026 | Enlighten Theme | not published: lincoln.com shows this item with no price (only "Details") |
| Lincoln | Navigator | Black Label | 2026 | Atmospheric Theme | not published: lincoln.com shows this item with no price (only "Details") |
| Lincoln | Navigator | Premiere | 2027 | Engine Radiator – 26MM | package-priced, but its package ("Heavy-Duty Trailer Tow Package") has no published price |
| Lincoln | Navigator | Premiere | 2027 | package: Heavy-Duty Trailer Tow Package | not published: lincoln.com shows this package with no price on this trim (re-checked 2026-10-16) |
| Lincoln | Navigator | Reserve | 2027 | Engine Radiator – 26MM | package-priced, but its package ("Heavy-Duty Trailer Tow Package") has no published price |
| Lincoln | Navigator | Reserve | 2027 | PowerFold® 40/20/40 Split Bench with Power Recline | not published: lincoln.com shows this item with no price (only "Details") |
| Lincoln | Navigator | Reserve | 2027 | package: Heavy-Duty Trailer Tow Package | not published: lincoln.com shows this package with no price on this trim (re-checked 2026-10-16) |
| Lincoln | Navigator | Black Label | 2027 | 40/Console/40 with Power Tailored Seats | package-priced, but its package ("Heavy-Duty Trailer Tow Package") has no published price |
| Lincoln | Navigator | Black Label | 2027 | Engine Radiator – 26MM | package-priced, but its package ("Heavy-Duty Trailer Tow Package") has no published price |
| Lincoln | Navigator | Black Label | 2027 | Enlighten Theme | not published: lincoln.com shows this item with no price (only "Details") |
| Lincoln | Navigator | Black Label | 2027 | Atmospheric Theme | not published: lincoln.com shows this item with no price (only "Details") |
| Lincoln | Navigator | Black Label | 2027 | package: Lincoln Black Label Atmospheric Special Edition | not published: lincoln.com shows this package with no price on this trim (re-checked 2026-10-16) |
| Lincoln | Navigator | Black Label | 2027 | package: Heavy-Duty Trailer Tow Package | not published: lincoln.com shows this package with no price on this trim (re-checked 2026-10-16) |
| Lincoln | Navigator L | Premiere | 2026 | PowerFold® 40/20/40 Split Bench with Power Recline | not published: lincoln.com shows this item with no price (only "Details") |
| Lincoln | Navigator L | Black Label | 2026 | Enlighten Theme | not published: lincoln.com shows this item with no price (only "Details") |
| Lincoln | Navigator L | Black Label | 2026 | Atmospheric Theme | not published: lincoln.com shows this item with no price (only "Details") |
| Lincoln | Navigator L | Premiere | 2027 | Engine Radiator – 26MM | package-priced, but its package ("Heavy-Duty Trailer Tow Package") has no published price |
| Lincoln | Navigator L | Premiere | 2027 | package: Heavy-Duty Trailer Tow Package | not published: lincoln.com shows this package with no price on this trim (re-checked 2026-10-16) |
| Lincoln | Navigator L | Reserve | 2027 | Engine Radiator – 26MM | package-priced, but its package ("Heavy-Duty Trailer Tow Package") has no published price |
| Lincoln | Navigator L | Reserve | 2027 | PowerFold® 40/20/40 Split Bench with Power Recline | not published: lincoln.com shows this item with no price (only "Details") |
| Lincoln | Navigator L | Reserve | 2027 | package: Heavy-Duty Trailer Tow Package | not published: lincoln.com shows this package with no price on this trim (re-checked 2026-10-16) |
| Lincoln | Navigator L | Black Label | 2027 | 40/Console/40 with Power Tailored Seats | package-priced, but its package ("Heavy-Duty Trailer Tow Package") has no published price |
| Lincoln | Navigator L | Black Label | 2027 | Engine Radiator – 26MM | package-priced, but its package ("Heavy-Duty Trailer Tow Package") has no published price |
| Lincoln | Navigator L | Black Label | 2027 | Enlighten Theme | not published: lincoln.com shows this item with no price (only "Details") |
| Lincoln | Navigator L | Black Label | 2027 | Atmospheric Theme | not published: lincoln.com shows this item with no price (only "Details") |
| Lincoln | Navigator L | Black Label | 2027 | package: Lincoln Black Label Atmospheric Special Edition | not published: lincoln.com shows this package with no price on this trim (re-checked 2026-10-16) |
| Lincoln | Navigator L | Black Label | 2027 | package: Heavy-Duty Trailer Tow Package | not published: lincoln.com shows this package with no price on this trim (re-checked 2026-10-16) |

## Unresolved

- 2026 Vistiq (4 rows, 12 items): cadillac.com no longer offers the 2026 Vistiq in its configurator ("Unsupported Vehicle"). These can't be priced any more.
- Night Vision on the 2026 Escalade / Escalade ESV rows (6) is filled as $0: adding it leaves Cadillac's total unchanged. These are the Platinum Luxury, Platinum Sport and V-Series rows.
- Lincoln: no prices published for the Black Label themes, BlueCruise, appliqués, PowerFold bench, Lincoln Rejuvenate, Dynamic Handling Package on Reserve (it needs Reserve II), Heavy-Duty Trailer Tow Package or Black Label Atmospheric Special Edition (2027 Navigator). For reference only: the Dynamic Handling Package is $2,500 on the 2026 and 2027 Aviator Black Label pages, but the Reserve rows don't show it, so it wasn't copied across.
- Lincoln Corsair items (BlueCruise, hands-free driver assistance, appliqués) aren't shown under those names on today's Corsair pages.

## Counts

| make | blank prices in | filled | package-priced | still blank | options added |
|---|---|---|---|---|---|
| Cadillac | 105 | 7 | 0 | 98 | 0 |
| Lincoln | 47 | 0 | 0 | 47 | 0 |

Rows in = rows out: 95 = 95.
