# vw-audi configurator: prices notes (2026-10-16)

Input `data/vw-audi-configurator-repass-2026-10.csv` → output `data/vw-audi-configurator-prices-2026-10.csv`. Same header, same 90 rows in the same order, 18 fields per row, same cell format and line endings. Only option prices (and, for Porsche, one added Paint to Sample option per row) changed; every changed row has its source added to `sources` if it wasn't already there.

Progress: Audi done | Volkswagen done

How it was checked: Audi: each blank paint was selected on audiusa.com's Build page for that model and year, and the price Audi shows for the selected paint was read. Volkswagen: vw.com's builder for the 2026 ID.4 Pro was opened.

## Prices filled

| make | model | trim | model_year | option | old price | new price | source URL |
|---|---|---|---|---|---|---|---|
| Audi | A8 | 55 TFSI quattro | 2027 | Mythos Black Metallic | (blank) | 0 | https://www.audiusa.com/en/models/a8/a8-sedan/2027/overview/build/ |
| Audi | A8 | 55 TFSI quattro | 2027 | Glacier White Metallic | (blank) | 0 | https://www.audiusa.com/en/models/a8/a8-sedan/2027/overview/build/ |
| Audi | A8 | 55 TFSI quattro | 2027 | Firmament Blue Metallic | (blank) | 0 | https://www.audiusa.com/en/models/a8/a8-sedan/2027/overview/build/ |
| Audi | A8 | 55 TFSI quattro | 2027 | Daytona Gray Pearl Effect | (blank) | 0 | https://www.audiusa.com/en/models/a8/a8-sedan/2027/overview/build/ |
| Audi | A8 | 55 TFSI quattro | 2027 | Sebring Black Crystal | (blank) | 0 | https://www.audiusa.com/en/models/a8/a8-sedan/2027/overview/build/ |
| Audi | RS 6 Avant | Performance | 2026 | Nardo Gray | (blank) | 0 | https://www.audiusa.com/en/models/a6/rs6-avant/2026/overview/build/ |
| Audi | RS 6 Avant | Performance | 2026 | Mythos Black Metallic | (blank) | 595 | https://www.audiusa.com/en/models/a6/rs6-avant/2026/overview/build/ |
| Audi | RS 6 Avant | Performance | 2026 | Glacier White Metallic | (blank) | 595 | https://www.audiusa.com/en/models/a6/rs6-avant/2026/overview/build/ |
| Audi | RS 6 Avant | Performance | 2026 | Ascari Blue Metallic | (blank) | 595 | https://www.audiusa.com/en/models/a6/rs6-avant/2026/overview/build/ |
| Audi | RS 6 Avant | Performance | 2026 | Grenadine Red Metallic | (blank) | 595 | https://www.audiusa.com/en/models/a6/rs6-avant/2026/overview/build/ |
| Audi | RS 6 Avant | Performance | 2026 | Daytona Gray Pearl Effect | (blank) | 595 | https://www.audiusa.com/en/models/a6/rs6-avant/2026/overview/build/ |
| Audi | RS e-tron GT | performance | 2026 | Arkona White | (blank) | 0 | https://www.audiusa.com/en/models/e-tron-gt/rs-e-tron-gt/2026/overview/build/ |
| Audi | RS e-tron GT | performance | 2026 | Mythos Black Metallic | (blank) | 595 | https://www.audiusa.com/en/models/e-tron-gt/rs-e-tron-gt/2026/overview/build/ |
| Audi | RS e-tron GT | performance | 2026 | Kemora Gray Metallic | (blank) | 595 | https://www.audiusa.com/en/models/e-tron-gt/rs-e-tron-gt/2026/overview/build/ |
| Audi | RS e-tron GT | performance | 2026 | Daytona Gray Pearl Effect | (blank) | 595 | https://www.audiusa.com/en/models/e-tron-gt/rs-e-tron-gt/2026/overview/build/ |
| Audi | RS e-tron GT | performance | 2026 | Nimbus Gray Metallic | (blank) | 595 | https://www.audiusa.com/en/models/e-tron-gt/rs-e-tron-gt/2026/overview/build/ |

Basis: 15 × price shown by Audi's configurator when selected; 1 × price shown by Audi's configurator when selected; Audi's configurator names it "Nimbus Gray pearl effect"; $595 shown

## Options added

None.

## Still blank

| make | model | trim | model_year | option | reason |
|---|---|---|---|---|---|
| Volkswagen | Atlas | Peak Edition | 2026 | 6-passenger 2nd-row captain's chairs | package-priced (comes in "2nd-Row Dual Captain's Chairs", priced in package_definitions) |
| Volkswagen | Atlas | SE w/Technology | 2026 | Black-finish alloy wheels | package-priced (comes in "Black Wheel Package", priced in package_definitions) |
| Volkswagen | Atlas | SE w/Technology | 2026 | Panoramic sunroof | package-priced (comes in "Panoramic Sunroof Package", priced in package_definitions) |
| Volkswagen | Atlas | SE w/Technology | 2026 | 6-passenger 2nd-row captain's chairs | package-priced (comes in "2nd-Row Dual Captain's Chairs", priced in package_definitions) |
| Volkswagen | Atlas | SE w/Technology | 2026 | Sunroof | package-priced (comes in "Panoramic Sunroof Package", priced in package_definitions) |
| Volkswagen | Atlas | SEL | 2026 | 6-passenger 2nd-row captain's chairs | package-priced (comes in "2nd-Row Dual Captain's Chairs", priced in package_definitions) |
| Volkswagen | Atlas | SEL Premium R-Line | 2026 | 6-passenger 2nd-row captain's chairs | package-priced (comes in "2nd-Row Dual Captain's Chairs", priced in package_definitions) |
| Volkswagen | Atlas Cross Sport | SE with Technology | 2026 | Black-finish alloy wheels | package-priced (comes in "Black Wheel Package", priced in package_definitions) |
| Volkswagen | Atlas Cross Sport | SE with Technology | 2026 | Panoramic sunroof | package-priced (comes in "Panoramic Sunroof Package", priced in package_definitions) |
| Volkswagen | Atlas Cross Sport | SE with Technology | 2026 | Sunroof | package-priced (comes in "Panoramic Sunroof Package", priced in package_definitions) |
| Volkswagen | Golf GTI | SE | 2026 | Titan Black Vienna leather | package-priced (comes in "SE Leather Seating Package", priced in package_definitions) |
| Volkswagen | Golf GTI | SE | 2026 | Leather seating | package-priced (comes in "SE Leather Seating Package", priced in package_definitions) |
| Volkswagen | Golf R | Golf R | 2026 | Blue and Soul Black diamond-pattern cloth with ArtVelours bolsters | package-priced (comes in "Euro Style Package", priced in package_definitions) |
| Volkswagen | Golf R | Golf R | 2026 | 19-in. gloss black R-design alloy wheels | package-priced (comes in "Black Wheel Package", priced in package_definitions) |
| Volkswagen | Golf R | Golf R | 2026 | Solid roof sunroof delete | package-priced (comes in "Euro Style Package", priced in package_definitions) |
| Volkswagen | ID.4 | Pro | 2026 | 20-in. two-tone machined alloy wheels AWD | not published: vw.com builder for the 2026 ID.4 Pro (RWD) offers only the 19-in. wheel; the 20-in. AWD wheel is not offered on this trim, so it has no price |
| Volkswagen | ID.4 | Pro S | 2026 | 20-in. gloss black-painted alloy wheels | package-priced (comes in "ID.4 Black Package", priced in package_definitions) |
| Volkswagen | ID.4 | Pro S Plus | 2026 | 20-in. gloss black-painted alloy wheels | package-priced (comes in "ID.4 Black Package", priced in package_definitions) |
| Volkswagen | Jetta | SE | 2027 | 18-in. black alloy wheels | package-priced (comes in "Black Wheel Package", priced in package_definitions) |
| Volkswagen | Jetta GLI | Autobahn | 2027 | Pure White with Deep Black Pearl roof | package-priced (comes in "Black Package", priced in package_definitions) |
| Volkswagen | Jetta GLI | Autobahn | 2027 | Monterey Blue Pearl with Deep Black Pearl roof | package-priced (comes in "Black Package", priced in package_definitions) |
| Volkswagen | Jetta GLI | Autobahn | 2027 | Monument Gray with Black Roof | package-priced (comes in "Black Package", priced in package_definitions) |
| Volkswagen | Jetta GLI | Autobahn | 2027 | Kings Red Metallic with Deep Black Pearl roof | package-priced (comes in "Black Package", priced in package_definitions) |
| Volkswagen | Jetta GLI | Autobahn | 2027 | 18-in. black painted alloy wheels | package-priced (comes in "Black Package", priced in package_definitions) |
| Volkswagen | Jetta GLI | Autobahn | 2027 | Deep Black Pearl painted roof | package-priced (comes in "Black Package", priced in package_definitions) |
| Volkswagen | Taos | SE | 2027 | Panoramic sunroof | package-priced (comes in "Panoramic Sunroof Package", priced in package_definitions) |
| Volkswagen | Taos | SE | 2027 | Sunroof | package-priced (comes in "Panoramic Sunroof Package", priced in package_definitions) |
| Volkswagen | Taos | SEL | 2027 | 19-in. black alloy wheels | package-priced (comes in "Black Wheel Plus Package", priced in package_definitions) |
| Volkswagen | Tiguan | S | 2026 | 18-in. 2-tone machined alloy wheels | package-priced (comes in "18-in. Wheel Package", priced in package_definitions) |
| Volkswagen | Tiguan | SE | 2026 | Panoramic sunroof | package-priced (comes in "Panoramic Sunroof Package", priced in package_definitions) |
| Volkswagen | Tiguan | SE | 2026 | Sunroof | package-priced (comes in "Panoramic Sunroof Package", priced in package_definitions) |
| Audi | A3 | Base | 2027 | Adaptive cruise control | package-priced (comes in "Driver assistance package", priced in package_definitions) |
| Audi | A3 | Black optic plus | 2027 | Adaptive cruise control | package-priced (comes in "Driver assistance package", priced in package_definitions) |
| Audi | A3 | S line plus | 2027 | Adaptive cruise control | package-priced (comes in "Driver assistance package", priced in package_definitions) |
| Audi | A5 | Premium | 2027 | Black leather/Dinamica with Express Red stitching | package-priced (comes in "Sport plus package", priced in package_definitions) |
| Audi | A5 | Premium | 2027 | 19-in. 5-double-spoke-Y wheels | package-priced (comes in "19" wheel package", priced in package_definitions) |
| Audi | A5 | Premium | 2027 | 20-in. 5-double-spoke bicolor wheels | package-priced (comes in "20" wheel package", priced in package_definitions) |
| Audi | A5 | Premium | 2027 | 19-in. 5-double-spoke bicolor wheels | package-priced (comes in "S line black optic package", priced in package_definitions) |
| Audi | A5 | Premium | 2027 | 20-in. 5-arm-falx bicolor wheels | package-priced (comes in "Sport plus package", priced in package_definitions) |
| Audi | A5 | Premium | 2027 | Ventilated front sport seats | package-priced (comes in "Executive package", priced in package_definitions) |
| Audi | A5 | Premium | 2027 | Heated rear seats | package-priced (comes in "Vorsprung package", priced in package_definitions) |
| Audi | A6 | Premium | 2027 | Black Fine Nappa leather | package-priced (comes in "Luxury Package", priced in package_definitions) |
| Audi | A6 | Premium | 2027 | Muscat Brown Fine Nappa leather | package-priced (comes in "Luxury Package", priced in package_definitions) |
| Audi | A6 | Premium | 2027 | Black Fine Nappa/Pearl Nappa leather w/ diamond stitching | package-priced (comes in "Sport Plus Package", priced in package_definitions) |
| Audi | A6 | Premium | 2027 | Neodymium Gold/Baikal Blue Fine Nappa leather | package-priced (comes in "Audi Exclusive Design Package", priced in package_definitions) |
| Audi | A6 | Premium | 2027 | 20-in. 5-arm-peak bicolor wheels | package-priced (comes in "S line Black Optic Package", priced in package_definitions) |
| Audi | A6 | Premium | 2027 | 21-in. multispoke-twist black metallic wheels | package-priced (comes in "Sport Plus Package", priced in package_definitions) |
| Audi | A6 Sportback e-tron | Premium | 2027 | 19-in. 5-arm dynamic design platinum wheels | package-priced (comes in "Ultra package", priced in package_definitions) |
| Audi | A6 Sportback e-tron | Premium | 2027 | Heated steering wheel | package-priced (comes in "Convenience package", priced in package_definitions) |
| Audi | A6 Sportback e-tron | Premium Plus | 2027 | Black leather ventilated sport seats | package-priced (comes in "Warm weather package", priced in package_definitions) |
| Audi | A6 Sportback e-tron | Premium Plus | 2027 | Pearl Beige leather ventilated sport seats | package-priced (comes in "Warm weather package", priced in package_definitions) |
| Audi | A6 Sportback e-tron | Premium Plus | 2027 | 20-in. 5-spoke-tripod design bicolor wheels | package-priced (comes in "S line black optic package", priced in package_definitions) |
| Audi | A6 Sportback e-tron | Premium Plus | 2027 | Ventilated front sport seats | package-priced (comes in "Warm weather package", priced in package_definitions) |
| Audi | A6 Sportback e-tron | Prestige | 2027 | Black leather ventilated sport seats | package-priced (comes in "Warm weather package", priced in package_definitions) |
| Audi | A6 Sportback e-tron | Prestige | 2027 | Pearl Beige leather ventilated sport seats | package-priced (comes in "Warm weather package", priced in package_definitions) |
| Audi | A6 Sportback e-tron | Prestige | 2027 | 20-in. 5-spoke-tripod design bicolor wheels | package-priced (comes in "S line black optic package", priced in package_definitions) |
| Audi | A6 Sportback e-tron | Prestige | 2027 | Ventilated front sport seats | package-priced (comes in "Warm weather package", priced in package_definitions) |
| Audi | A8 | 55 TFSI quattro | 2027 | Black Valcona leather | package-priced (comes in "Executive Plus Package", priced in package_definitions) |
| Audi | A8 | 55 TFSI quattro | 2027 | Sarder Brown Valcona leather | package-priced (comes in "Executive Plus Package", priced in package_definitions) |
| Audi | A8 | 55 TFSI quattro | 2027 | Pearl Beige Valcona leather | package-priced (comes in "Executive Plus Package", priced in package_definitions) |
| Audi | A8 | 55 TFSI quattro | 2027 | Cognac Brown Valcona leather | package-priced (comes in "Executive Plus Package", priced in package_definitions) |
| Audi | A8 | 55 TFSI quattro | 2027 | 21-in. 5-double-spoke-star-S bicolor wheels | package-priced (comes in "Black Optic Package", priced in package_definitions) |
| Audi | A8 | 55 TFSI quattro | 2027 | Adaptive cruise control | package-priced (comes in "Executive Plus Package", priced in package_definitions) |
| Audi | Q3 | S line | 2027 | Heated steering wheel | package-priced (comes in "Convenience package", priced in package_definitions) |
| Audi | Q4 Sportback e-tron | Premium | 2026 | Black leather with embossed S emblem | package-priced (comes in "Black optic plus package", priced in package_definitions) |
| Audi | Q4 Sportback e-tron | Premium | 2026 | Wireless charging | package-priced (comes in "Convenience package", priced in package_definitions) |
| Audi | Q4 Sportback e-tron | Premium Plus | 2026 | Black leather with embossed S emblem | package-priced (comes in "Sport package", priced in package_definitions) |
| Audi | Q4 Sportback e-tron | Premium Plus | 2026 | Black leather with embossed S emblem | package-priced (comes in "Black optic plus package", priced in package_definitions) |
| Audi | Q4 Sportback e-tron | Premium Plus | 2026 | 21-in. 5-W-spoke platinum gray wheels | package-priced (comes in "Sport package", priced in package_definitions) |
| Audi | Q4 e-tron | Premium | 2026 | 20-in. 5-Y-V-spoke polygon titanium wheels | package-priced (comes in "Black optic package - 55 quattro", priced in package_definitions) |
| Audi | Q4 e-tron | Premium | 2026 | Wireless charging | package-priced (comes in "Convenience package", priced in package_definitions) |
| Audi | Q4 e-tron | Premium Plus | 2026 | Black leather with embossed S emblem | package-priced (comes in "Sport package", priced in package_definitions) |
| Audi | Q4 e-tron | Premium Plus | 2026 | 20-in. 5-Y-V-spoke polygon titanium wheels | package-priced (comes in "Black optic package - 55 quattro", priced in package_definitions) |
| Audi | Q4 e-tron | Premium Plus | 2026 | 21-in. 5-W-spoke platinum gray wheels | package-priced (comes in "Sport package", priced in package_definitions) |
| Audi | Q5 | Premium | 2027 | Black leather ventilated front sport seats | package-priced (comes in "Executive package", priced in package_definitions) |
| Audi | Q5 Sportback | Premium | 2027 | Black leather ventilated front sport seats | package-priced (comes in "Executive package", priced in package_definitions) |
| Audi | Q5 Sportback | Premium | 2027 | 20-in. 5-double-spoke bicolor wheels | package-priced (comes in "Black optic package", priced in package_definitions) |
| Audi | Q6 Sportback e-tron | Premium | 2027 | Heated steering wheel | package-priced (comes in "Convenience package", priced in package_definitions) |
| Audi | Q6 Sportback e-tron | Premium Plus | 2027 | Black leather ventilated sport seats | package-priced (comes in "Warm Weather Package - Black", priced in package_definitions) |
| Audi | Q6 Sportback e-tron | Premium Plus | 2027 | Pearl Beige leather ventilated sport seats | package-priced (comes in "Warm Weather Package - Pearl Beige", priced in package_definitions) |
| Audi | Q6 Sportback e-tron | Premium Plus | 2027 | 20-in. 5-double-spoke offset bicolor wheels | package-priced (comes in "Black optic package", priced in package_definitions) |
| Audi | Q6 Sportback e-tron | Prestige | 2027 | Black leather ventilated sport seats | package-priced (comes in "Warm Weather Package - Black", priced in package_definitions) |
| Audi | Q6 Sportback e-tron | Prestige | 2027 | Pearl Beige leather ventilated sport seats | package-priced (comes in "Warm Weather Package - Pearl Beige", priced in package_definitions) |
| Audi | Q6 Sportback e-tron | Prestige | 2027 | 20-in. 5-double-spoke offset bicolor wheels | package-priced (comes in "Black optic package", priced in package_definitions) |
| Audi | Q6 e-tron | Premium | 2027 | Heated steering wheel | package-priced (comes in "Convenience package", priced in package_definitions) |
| Audi | Q6 e-tron | Premium Plus | 2027 | Black leather ventilated sport seats | package-priced (comes in "Warm Weather Package - Black", priced in package_definitions) |
| Audi | Q6 e-tron | Premium Plus | 2027 | Pearl Beige leather ventilated sport seats | package-priced (comes in "Warm Weather Package - Pearl Beige", priced in package_definitions) |
| Audi | Q6 e-tron | Premium Plus | 2027 | 20-in. 5-double-spoke offset bicolor wheels | package-priced (comes in "S line black optic package", priced in package_definitions) |
| Audi | Q6 e-tron | Prestige | 2027 | Black leather ventilated sport seats | package-priced (comes in "Warm Weather Package - Black", priced in package_definitions) |
| Audi | Q6 e-tron | Prestige | 2027 | Pearl Beige leather ventilated sport seats | package-priced (comes in "Warm Weather Package - Pearl Beige", priced in package_definitions) |
| Audi | Q6 e-tron | Prestige | 2027 | 20-in. 5-double-spoke offset bicolor wheels | package-priced (comes in "S line black optic package", priced in package_definitions) |
| Audi | Q7 | Premium | 2026 | 20-in. 5-double-spoke bicolor wheels | package-priced (comes in "Convenience Plus Package", priced in package_definitions) |
| Audi | Q7 | Premium | 2026 | Heated steering wheel | package-priced (comes in "Convenience Plus Package", priced in package_definitions) |
| Audi | Q7 | Premium Plus | 2026 | 20-in. 5-double-spoke bicolor wheels | package-priced (comes in "Black Optic Package", priced in package_definitions) |
| Audi | Q7 | Premium Plus | 2026 | 21-in. 5-double-spoke module matte gray wheels | package-priced (comes in "Black Optic Package", priced in package_definitions) |
| Audi | Q7 | Prestige | 2026 | Black Fine Nappa leather with Crimson Red stitching | package-priced (comes in "Sport Plus Package", priced in package_definitions) |
| Audi | Q7 | Prestige | 2026 | 21-in. 5-double-spoke module matte gray wheels | package-priced (comes in "Black Optic Package", priced in package_definitions) |
| Audi | Q7 | Prestige | 2026 | 21-in. 5-double-spoke bicolor wheels | package-priced (comes in "Sport Plus Package", priced in package_definitions) |
| Audi | Q7 | Premium | 2027 | Heated steering wheel | package-priced (comes in "Convenience Package", priced in package_definitions) |
| Audi | Q7 | Premium Plus | 2027 | 21-in. 5-V-spoke bicolor wheels | package-priced (comes in "Black Optic Package", priced in package_definitions) |
| Audi | Q7 | Premium Plus | 2027 | Panoramic sunroof with variable light control | package-priced (comes in "Executive Package", priced in package_definitions) |
| Audi | Q7 | Prestige | 2027 | 21-in. 5-V-spoke bicolor wheels | package-priced (comes in "Black Optic Package", priced in package_definitions) |
| Audi | Q7 | Prestige | 2027 | 22-in. 5-spoke-tripod bicolor wheels | package-priced (comes in "Launch Edition", priced in package_definitions) |
| Audi | Q8 | Premium | 2027 | 21-in. 5-segment-spoke graphite gray wheels | package-priced (comes in "Convenience Plus Package", priced in package_definitions) |
| Audi | Q8 | Premium | 2027 | Heated steering wheel | package-priced (comes in "Convenience Plus Package", priced in package_definitions) |
| Audi | Q8 | Premium Plus | 2027 | 22-in. 5-double-arm bicolor wheels | package-priced (comes in "Black Optic Package", priced in package_definitions) |
| Audi | Q8 | Prestige | 2027 | Black Fine Nappa leather with red stitching | package-priced (comes in "Sport Plus Package", priced in package_definitions) |
| Audi | Q8 | Prestige | 2027 | 22-in. 5-double-arm bicolor wheels | package-priced (comes in "Black Optic Package", priced in package_definitions) |
| Audi | Q8 | Prestige | 2027 | 23-in. 10-spoke-trapezoid bicolor wheels | package-priced (comes in "Sport Plus Package", priced in package_definitions) |
| Audi | Q9 | Premium Plus | 2027 | 22-in. 5-Y-spoke bicolor wheels | package-priced (comes in "Black Optic Package", priced in package_definitions) |
| Audi | Q9 | Prestige | 2027 | 22-in. 5-Y-spoke bicolor wheels | package-priced (comes in "Black Optic Package", priced in package_definitions) |
| Audi | Q9 | Prestige | 2027 | 23-in. 8-flat-spoke bicolor wheels | package-priced (comes in "Launch Edition", priced in package_definitions) |
| Audi | RS 3 | Base | 2027 | 19-in. 10-cross-spoke dark gray matte wheels | package-priced (comes in "Carbon package", priced in package_definitions) |
| Audi | RS 6 Avant | Performance | 2026 | Sebring Black Crystal Effect | Audi's configurator would not switch to this paint from the default build (selection needs other changes); no price shown |
| Audi | RS 6 Avant | Performance | 2026 | Black/Rock Gray Valcona/Milano leather | package-priced (comes in "Individual Contour Seat Package", priced in package_definitions) |
| Audi | RS 6 Avant | Performance | 2026 | 22-in. 5-Y-spoke bicolor black wheels | package-priced (comes in "Black Optic Package", priced in package_definitions) |
| Audi | RS 6 Avant | Performance | 2026 | 22-in. 5-Y-spoke matte black wheels | package-priced (comes in "Matte Carbon Package", priced in package_definitions) |
| Audi | RS 6 Avant | Performance | 2026 | Adaptive cruise control | package-priced (comes in "Driver Assistance Package", priced in package_definitions) |
| Audi | RS 7 | Performance | 2026 | Black/Rock Gray Valcona/Milano leather | package-priced (comes in "Individual Contour Seat Package", priced in package_definitions) |
| Audi | RS 7 | Performance | 2026 | 22-in. 5-Y-spoke bicolor black wheels | package-priced (comes in "Black Optic Package", priced in package_definitions) |
| Audi | RS 7 | Performance | 2026 | 22-in. 5-Y-spoke matte black wheels | package-priced (comes in "Matte Carbon Package", priced in package_definitions) |
| Audi | RS 7 | Performance | 2026 | Adaptive cruise control | package-priced (comes in "Driver Assistance Package", priced in package_definitions) |
| Audi | RS Q8 | Performance | 2027 | 23-in. 5-Y-spoke bicolor milled-cut wheels | package-priced (comes in "Black Optic Package", priced in package_definitions) |
| Audi | RS Q8 | Performance | 2027 | 23-in. 5-Y-spoke matte black wheels | package-priced (comes in "Matte Carbon Package", priced in package_definitions) |
| Audi | RS e-tron GT | performance | 2026 | Ascari Blue Metallic | Audi's configurator would not switch to this paint from the default build (selection needs other changes); no price shown |
| Audi | RS e-tron GT | performance | 2026 | Progressive Red Metallic | Audi's configurator would not switch to this paint from the default build (selection needs other changes); no price shown |
| Audi | RS e-tron GT | performance | 2026 | Bedford Green | Audi's configurator would not switch to this paint from the default build (selection needs other changes); no price shown; Audi's configurator names it "Bedford Green metallic" |
| Audi | RS e-tron GT | performance | 2026 | 21-in. 6-double-spoke RS milled-cut dark wheels | package-priced (comes in "Forged carbon package", priced in package_definitions) |
| Audi | RS e-tron GT | performance | 2026 | Dark carbon roof panel | package-priced (comes in "Forged carbon package", priced in package_definitions) |
| Audi | RS e-tron GT | performance | 2027 | 21-in. 6-double-spoke RS milled-cut dark wheels | package-priced (comes in "Forged carbon package", priced in package_definitions) |
| Audi | RS e-tron GT | performance | 2027 | Dark carbon roof panel | package-priced (comes in "Forged carbon package", priced in package_definitions) |
| Audi | S e-tron GT | Premium Plus | 2026 | Black Fine Nappa leather | package-priced (comes in "Full leather interior", priced in package_definitions) |
| Audi | S e-tron GT | Premium Plus | 2026 | Black/Steel Gray Fine Nappa leather | package-priced (comes in "Full leather interior", priced in package_definitions) |
| Audi | S e-tron GT | Premium Plus | 2026 | Arras Red Fine Nappa leather | package-priced (comes in "Full leather interior", priced in package_definitions) |
| Audi | S e-tron GT | Premium Plus | 2026 | Ventilated and massage front sport seats pro | package-priced (comes in "Full leather interior", priced in package_definitions) |
| Audi | S e-tron GT | Premium Plus | 2026 | Leather seating | package-priced (comes in "Full leather interior", priced in package_definitions) |
| Audi | S e-tron GT | Premium Plus | 2026 | Heated steering wheel | package-priced (comes in "Full leather interior", priced in package_definitions) |
| Audi | S e-tron GT | Prestige | 2026 | Black Fine Nappa leather | package-priced (comes in "Full leather interior", priced in package_definitions) |
| Audi | S e-tron GT | Prestige | 2026 | Black/Steel Gray Fine Nappa leather | package-priced (comes in "Full leather interior", priced in package_definitions) |
| Audi | S e-tron GT | Prestige | 2026 | Arras Red Fine Nappa leather | package-priced (comes in "Full leather interior", priced in package_definitions) |
| Audi | S e-tron GT | Prestige | 2026 | Ventilated and massage front sport seats pro | package-priced (comes in "Full leather interior", priced in package_definitions) |
| Audi | S e-tron GT | Prestige | 2026 | Leather seating | package-priced (comes in "Full leather interior", priced in package_definitions) |
| Audi | S e-tron GT | Prestige | 2026 | Heated steering wheel | package-priced (comes in "Full leather interior", priced in package_definitions) |
| Audi | S3 | Base | 2027 | 19-in. multispoke-S bicolor wheels | package-priced (comes in "Black optic package", priced in package_definitions) |
| Audi | S3 | Base | 2027 | Adaptive cruise control | package-priced (comes in "Driver assistance package", priced in package_definitions) |
| Audi | S5 | Premium | 2027 | Black Fine Nappa/Pearl Nappa leather | package-priced (comes in "Executive package", priced in package_definitions) |
| Audi | S5 | Premium | 2027 | Black/Jet Gray/Ocean Blue Fine Nappa/Pearl Nappa leather | package-priced (comes in "Audi exclusive design package", priced in package_definitions) |
| Audi | S5 | Premium | 2027 | 20-in. multispoke-S bicolor wheels | package-priced (comes in "20" wheel package multispoke-S", priced in package_definitions) |
| Audi | S5 | Premium | 2027 | 20-in. 5-double-spoke bicolor wheels | package-priced (comes in "20" wheel package 5-double-spoke", priced in package_definitions) |
| Audi | S5 | Premium | 2027 | Front sport seats plus with ventilation and massage | package-priced (comes in "Executive package", priced in package_definitions) |
| Audi | S5 | Premium | 2027 | Heated rear seats | package-priced (comes in "Vorsprung package", priced in package_definitions) |
| Audi | S6 Sportback e-tron | Premium Plus | 2027 | 21-in. multispoke-S design bicolor wheels | package-priced (comes in "21" wheel package", priced in package_definitions) |
| Audi | S6 Sportback e-tron | Premium Plus | 2027 | 21-in. 5-arm dynamic design bicolor wheels | package-priced (comes in "21" Black optic package", priced in package_definitions) |
| Audi | S6 Sportback e-tron | Prestige | 2027 | Jet Gray Fine Nappa leather with Ocean Blue stitching | package-priced (comes in "Audi exclusive design package - Jet Gray/Ocean Blue", priced in package_definitions) |
| Audi | S6 Sportback e-tron | Prestige | 2027 | 21-in. multispoke-S design bicolor wheels | package-priced (comes in "21" wheel package", priced in package_definitions) |
| Audi | S6 Sportback e-tron | Prestige | 2027 | 21-in. 5-arm dynamic design bicolor wheels | package-priced (comes in "21" Black optic package", priced in package_definitions) |
| Audi | S8 | 4.0 TFSI quattro | 2027 | 21-in. 7-arm-dynamic matte black wheels | package-priced (comes in "Black Optic Plus Package", priced in package_definitions) |
| Audi | S8 | 4.0 TFSI quattro | 2027 | 4-passenger w/ rear center console | package-priced (comes in "Luxury Rear Seat Package 4 Passenger", priced in package_definitions) |
| Audi | S8 | 4.0 TFSI quattro | 2027 | Adaptive cruise control | package-priced (comes in "Executive Plus Package", priced in package_definitions) |
| Audi | SQ5 | Premium | 2027 | Black Fine Nappa/Milano leather | package-priced (comes in "Executive package", priced in package_definitions) |
| Audi | SQ5 Sportback | Premium | 2027 | Black Fine Nappa/Milano leather | package-priced (comes in "Executive package", priced in package_definitions) |
| Audi | SQ6 Sportback e-tron | Premium Plus | 2027 | Black leather ventilated sport seats | package-priced (comes in "Warm Weather Package", priced in package_definitions) |
| Audi | SQ6 Sportback e-tron | Prestige | 2027 | Black leather ventilated sport seats | package-priced (comes in "Warm Weather Package", priced in package_definitions) |
| Audi | SQ6 Sportback e-tron | Prestige | 2027 | Jet Gray/Ocean Blue Fine Nappa leather | package-priced (comes in "Audi exclusive design package", priced in package_definitions) |
| Audi | SQ6 e-tron | Premium Plus | 2027 | Black leather ventilated sport seats | package-priced (comes in "Warm Weather Package", priced in package_definitions) |
| Audi | SQ6 e-tron | Prestige | 2027 | Black leather ventilated sport seats | package-priced (comes in "Warm Weather Package", priced in package_definitions) |
| Audi | SQ6 e-tron | Prestige | 2027 | Jet Gray/Ocean Blue Fine Nappa leather | package-priced (comes in "Audi exclusive design package", priced in package_definitions) |
| Audi | SQ7 | Premium Plus | 2026 | 21-in. 6-Y-spoke black wheels | package-priced (comes in "Black Optic Package", priced in package_definitions) |
| Audi | SQ7 | Prestige | 2026 | 21-in. 6-Y-spoke black wheels | package-priced (comes in "Black Optic Package", priced in package_definitions) |
| Audi | SQ7 | Base | 2027 | Panoramic sunroof with variable light control | package-priced (comes in "Executive Package", priced in package_definitions) |
| Audi | SQ8 | Premium Plus | 2027 | 22-in. 10-spoke-Y black metallic wheels | package-priced (comes in "Black Optic Package", priced in package_definitions) |
| Audi | SQ8 | Prestige | 2027 | 22-in. 10-spoke-Y black metallic wheels | package-priced (comes in "Black Optic Package", priced in package_definitions) |

## Unresolved

- RS 6 Avant 2026 "Sebring Black Crystal Effect" and RS e-tron GT 2026 "Ascari Blue Metallic", "Progressive Red Metallic" and "Bedford Green": Audi's configurator wouldn't switch to these paints from its default build (the paint needs other changes), so no price was shown. Left blank.
- RS e-tron GT 2026: Audi calls the file's "Nimbus Gray Metallic" "Nimbus Gray pearl effect" and "Bedford Green" "Bedford Green metallic". Names not changed.
- Volkswagen ID.4 Pro 2026: vw.com offers only the 19-in. wheel on the Pro (RWD); the 20-in. two-tone wheel listed as Standalone on that row is an AWD wheel and isn't offered, so it has no price. Its availability looks wrong but wasn't changed.
- A8 2027: all five paints show $0 on Audi's configurator (no-cost paint on A8).

## Counts

| make | blank prices in | filled | package-priced | still blank | options added |
|---|---|---|---|---|---|
| Audi | 157 | 16 | 137 | 4 | 0 |
| Volkswagen | 31 | 0 | 30 | 1 | 0 |

Rows in = rows out: 90 = 90.
