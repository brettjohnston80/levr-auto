# dodge-chrysler-alfa configurator: prices notes (2026-10-16)

Input `data/dodge-chrysler-alfa-configurator-repass-2026-10.csv` → output `data/dodge-chrysler-alfa-configurator-prices-2026-10.csv`. Same header, same 41 rows in the same order, 18 fields per row, same cell format and line endings. Only option prices (and, for Porsche, one added Paint to Sample option per row) changed; every changed row has its source added to `sources` if it wasn't already there.

Progress: Dodge done | Chrysler done | Alfa Romeo done

How it was checked: Confirm-only for prices (every blank item is a package-only feature whose package carries the price). The 2027 Charger check used Dodge's own Build & Price data (dodge.com /hostd/api/cvd/CUD202714).

## Prices filled

None.

## Options added

None.

## Still blank

| make | model | trim | model_year | option | reason |
|---|---|---|---|---|---|
| Dodge | Charger | R/T | 2026 | Leatherette / Cloth Performance Seats | package-priced (comes in "Driver Convenience Group", priced in package_definitions) |
| Dodge | Charger | R/T | 2026 | Leatherette / Suede High-Back Performance Seats | package-priced (comes in "Performance Handling Group", priced in package_definitions) |
| Dodge | Charger | R/T | 2026 | 20" x 10.0" Diamond Cut / Luster Aluminum Wheels | package-priced (comes in "Performance Handling Group", priced in package_definitions) |
| Dodge | Charger | R/T | 2026 | 20-Inch x 9.0-Inch Blacknoise Aluminum Wheels | package-priced (comes in "Blacktop Package", priced in package_definitions) |
| Dodge | Charger | R/T | 2026 | 20-Inch x 10.0-Inch Blacknoise Aluminum Wheels | package-priced (comes in "Blacktop Package", priced in package_definitions) |
| Dodge | Charger | R/T | 2026 | Heated front seats | package-priced (comes in "Performance Handling Group", priced in package_definitions) |
| Dodge | Charger | R/T | 2026 | Ventilated front seats | package-priced (comes in "Performance Handling Group", priced in package_definitions) |
| Dodge | Charger | R/T | 2026 | Heated steering wheel | package-priced (comes in "Driver Convenience Group", priced in package_definitions) |
| Dodge | Charger | R/T Plus | 2026 | Leatherette / Suede High-Back Performance Seats | package-priced (comes in "Performance Handling Group", priced in package_definitions) |
| Dodge | Charger | R/T Plus | 2026 | 20" x 10.0" Diamond Cut / Luster Aluminum Wheels | package-priced (comes in "Performance Handling Group", priced in package_definitions) |
| Dodge | Charger | R/T Plus | 2026 | 20-Inch x 10.0-Inch Blacknoise Aluminum Wheels | package-priced (comes in "Blacktop Package", priced in package_definitions) |
| Dodge | Charger | Scat Pack | 2026 | 20-Inch x 10.0-Inch Blacknoise Aluminum Wheels | package-priced (comes in "Blacktop Package", priced in package_definitions) |
| Dodge | Charger | Scat Pack | 2026 | 20-Inch x 11.0-Inch Luster Aluminum Wheels | package-priced (comes in "20-Inch x 11.0-Inch Wheel and Tire Package", priced in package_definitions) |
| Dodge | Charger | Scat Pack | 2026 | 20-Inch x 11.0-Inch Aluminum Wheels | package-priced (comes in "20-Inch x 11.0-Inch Wheel and Tire Package", priced in package_definitions) |
| Dodge | Charger | Scat Pack Plus | 2026 | Leather High-Back Performance Seats | package-priced (comes in "Highback Performance Seat Package", priced in package_definitions) |
| Dodge | Charger | Scat Pack Plus | 2026 | Leather / Suede Performance Seats | package-priced (comes in "Carbon and Suede Package", priced in package_definitions) |
| Dodge | Charger | Scat Pack Plus | 2026 | 20-Inch x 10.0-Inch Blacknoise Aluminum Wheels | package-priced (comes in "Blacktop Package", priced in package_definitions) |
| Dodge | Charger | Scat Pack Plus | 2026 | 20-Inch x 11.0-Inch Luster Aluminum Wheels | package-priced (comes in "20-Inch x 11.0-Inch Wheel and Tire Package", priced in package_definitions) |
| Dodge | Charger | Scat Pack Plus | 2026 | 20-Inch x 11.0-Inch Aluminum Wheels | package-priced (comes in "20-Inch x 11.0-Inch Wheel and Tire Package", priced in package_definitions) |
| Dodge | Charger | Scat Pack Plus | 2026 | Leather seating | package-priced (comes in "Highback Performance Seat Package", priced in package_definitions) |
| Dodge | Charger | R/T | 2027 | Leatherette / Cloth Performance Seats | package-priced (comes in "Driver Convenience Group", priced in package_definitions) |
| Dodge | Charger | R/T | 2027 | Leatherette / Suede Performance Seats | package-priced (comes in "Performance Handling Group", priced in package_definitions) |
| Dodge | Charger | R/T | 2027 | 20" x 10.0" Diamond Cut / Luster Aluminum Wheels | package-priced (comes in "Performance Handling Group", priced in package_definitions) |
| Dodge | Charger | R/T | 2027 | 20-Inch x 9.0-Inch Blacknoise Aluminum Wheels | package-priced (comes in "Blacktop Package", priced in package_definitions) |
| Dodge | Charger | R/T | 2027 | 20-Inch x 10.0-Inch Blacknoise Aluminum Wheels | package-priced (comes in "Blacktop Package", priced in package_definitions) |
| Dodge | Charger | R/T | 2027 | Heated front seats | package-priced (comes in "Performance Handling Group", priced in package_definitions) |
| Dodge | Charger | R/T | 2027 | Ventilated front seats | package-priced (comes in "Performance Handling Group", priced in package_definitions) |
| Dodge | Charger | R/T | 2027 | Heated steering wheel | package-priced (comes in "Driver Convenience Group", priced in package_definitions) |
| Dodge | Charger | R/T Plus | 2027 | Leatherette / Suede Performance Seats | package-priced (comes in "Performance Handling Group", priced in package_definitions) |
| Dodge | Charger | R/T Plus | 2027 | 20" x 10.0" Diamond Cut / Luster Aluminum Wheels | package-priced (comes in "Performance Handling Group", priced in package_definitions) |
| Dodge | Charger | R/T Plus | 2027 | 20-Inch x 10.0-Inch Blacknoise Aluminum Wheels | package-priced (comes in "Blacktop Package", priced in package_definitions) |
| Dodge | Charger | Scat Pack | 2027 | 20-Inch x 10.0-Inch Blacknoise Aluminum Wheels | package-priced (comes in "Blacktop Package", priced in package_definitions) |
| Dodge | Charger | Scat Pack | 2027 | 20-Inch x 11.0-Inch Aluminum Wheels | package-priced (comes in "20-Inch x 11.0-Inch Wheel and Tire Package", priced in package_definitions) |
| Dodge | Charger | Scat Pack Plus | 2027 | Leather / Suede Performance Seats | package-priced (comes in "Carbon and Suede Package", priced in package_definitions) |
| Dodge | Charger | Scat Pack Plus | 2027 | 20-Inch x 11.0-Inch Satin Carbon Aluminum Wheels | package-priced (comes in "20-Inch x 11.0-Inch Wheel and Tire Package II", priced in package_definitions) |
| Dodge | Charger | Scat Pack Plus | 2027 | 20-Inch x 10.0-Inch Blacknoise Aluminum Wheels | package-priced (comes in "Blacktop Package", priced in package_definitions) |
| Dodge | Charger | Scat Pack Plus | 2027 | 20-Inch x 11.0-Inch Luster Aluminum Wheels | package-priced (comes in "20-Inch x 11.0-Inch Wheel and Tire Package", priced in package_definitions) |
| Dodge | Charger | Scat Pack Plus | 2027 | 20-Inch x 11.0-Inch Aluminum Wheels | package-priced (comes in "20-Inch x 11.0-Inch Wheel and Tire Package", priced in package_definitions) |
| Dodge | Charger Daytona | Scat Pack | 2026 | Leatherette / Suede High-Back Performance Seats | package-priced (comes in "Track Package", priced in package_definitions) |
| Dodge | Charger Daytona | Scat Pack | 2026 | 20" x 11.0" / 20" x 11.5" Satin Carbon Alum Wheels | package-priced (comes in "Track Package", priced in package_definitions) |
| Dodge | Charger Daytona | Scat Pack | 2026 | 20" x 11.0" / 20" x 11.5" Luster Wheels | package-priced (comes in "Blacktop Package", priced in package_definitions) |
| Dodge | Charger Daytona | Scat Pack | 2026 | 20-Inch x 11.0-Inch Luster Aluminum Wheels | package-priced (comes in "Blacktop Package", priced in package_definitions) |
| Dodge | Charger Daytona | Scat Pack | 2026 | Ventilated front seats | package-priced (comes in "Track Package", priced in package_definitions) |
| Dodge | Charger Daytona | Scat Pack Plus | 2026 | Leather / Suede Performance Seats | package-priced (comes in "Carbon and Suede Package", priced in package_definitions) |
| Dodge | Charger Daytona | Scat Pack Plus | 2026 | Leatherette / Suede High-Back Performance Seats | package-priced (comes in "Track Package", priced in package_definitions) |
| Dodge | Charger Daytona | Scat Pack Plus | 2026 | 20" x 11.0" / 20" x 11.5" Satin Carbon Alum Wheels | package-priced (comes in "Track Package", priced in package_definitions) |
| Dodge | Charger Daytona | Scat Pack Plus | 2026 | 20" x 11.0" / 20" x 11.5" Luster Wheels | package-priced (comes in "Blacktop Package", priced in package_definitions) |
| Dodge | Charger Daytona | Scat Pack Plus | 2026 | 20-Inch x 11.0-Inch Luster Aluminum Wheels | package-priced (comes in "Track Package", priced in package_definitions) |
| Dodge | Charger Daytona | Scat Pack Plus | 2027 | Leather / Suede Performance Seats | package-priced (comes in "Carbon and Suede Package", priced in package_definitions) |
| Dodge | Charger Daytona | Scat Pack Plus | 2027 | Leatherette / Suede Performance Seats | package-priced (comes in "Track Package", priced in package_definitions) |
| Dodge | Charger Daytona | Scat Pack Plus | 2027 | 20" x 11.0" / 20" x 11.5" Satin Carbon Alum Wheels | package-priced (comes in "Track Package", priced in package_definitions) |
| Dodge | Charger Daytona | Scat Pack Plus | 2027 | 20-Inch x 11.0-Inch Luster Aluminum Wheels | package-priced (comes in "Blacktop Package", priced in package_definitions) |
| Dodge | Charger Daytona | Scat Pack Plus | 2027 | Ventilated front seats | package-priced (comes in "Track Package", priced in package_definitions) |
| Dodge | Durango | GT | 2026 | 20-Inch x 8.0-Inch Black Noise Aluminum Wheels | package-priced (comes in "Blacktop Package", priced in package_definitions) |
| Dodge | Durango | GT | 2026 | 20" x 10.0" Forged Y-Spoke Lights Out Wheels | package-priced (comes in "Blacktop Package", priced in package_definitions) |
| Dodge | Durango | GT | 2026 | 20" x 8.0" Black Noise Split 5-Spoke Wheels | package-priced (comes in "Blacktop Package", priced in package_definitions) |
| Dodge | Durango | GT | 2026 | 20-Inch x 10.0-Inch Painted Satin-Carbon Wheels | package-priced (comes in "Tow N Go Package", priced in package_definitions) |
| Dodge | Durango | GT Plus | 2026 | Blacktop Leather SRT Performance Seats | package-priced (comes in "Blacktop Redline Package", priced in package_definitions) |
| Dodge | Durango | GT Plus | 2026 | 20-Inch x 8.0-Inch Black Noise Aluminum Wheels | package-priced (comes in "Blacktop Package", priced in package_definitions) |
| Dodge | Durango | GT Plus | 2026 | 20" x 10.0" Forged Y-Spoke Lights Out Wheels | package-priced (comes in "Tow N Go Package", priced in package_definitions) |
| Dodge | Durango | GT Plus | 2026 | 20" x 8.0" Black Noise Split 5-Spoke Wheels | package-priced (comes in "Blacktop Package", priced in package_definitions) |
| Dodge | Durango | GT Plus | 2026 | 20-Inch x 10.0-Inch Painted Satin-Carbon Wheels | package-priced (comes in "Tow N Go Package", priced in package_definitions) |
| Dodge | Durango | R/T 392 Launch Edition | 2026 | 20-Inch x 10-Inch Lights Out Aluminum Wheels | package-priced (comes in "Blacktop Package", priced in package_definitions) |
| Dodge | Durango | GT HEMI Premium | 2026 | Blacktop Leather SRT Performance Seats | package-priced (comes in "Blacktop Redline Package", priced in package_definitions) |
| Dodge | Durango | GT HEMI Premium | 2026 | 20" x 10.0" Forged Y-Spoke Lights Out Wheels | package-priced (comes in "Tow N Go Package", priced in package_definitions) |
| Dodge | Durango | GT HEMI Premium | 2026 | 20" x 8.0" Black Noise Split 5-Spoke Wheels | package-priced (comes in "Blacktop Package", priced in package_definitions) |
| Dodge | Durango | GT HEMI Premium | 2026 | 20-Inch x 10.0-Inch Painted Satin-Carbon Wheels | package-priced (comes in "Tow N Go Package", priced in package_definitions) |
| Dodge | Durango | R/T 392 Premium Launch Edition | 2026 | 20-Inch x 10-Inch Lights Out Aluminum Wheels | package-priced (comes in "Blacktop Package", priced in package_definitions) |
| Dodge | Durango | SRT Hellcat | 2026 | 7-Passenger Seating | package-priced (comes in "3rd Row Seating Group", priced in package_definitions) |
| Dodge | Durango | SRT Hellcat Jailbreak | 2026 | 7-Passenger Seating | package-priced (comes in "3rd Row Seating Group", priced in package_definitions) |
| Dodge | Durango | SRT Hellcat Jailbreak | 2026 | Adaptive cruise control | package-priced (comes in "Premium Group", priced in package_definitions) |
| Dodge | Durango | GT HEMI | 2027 | 20 x 10.0-Inch Forged Y-Spoke Lights Out Wheels | package-priced (comes in "Blacktop Package", priced in package_definitions) |
| Dodge | Durango | GT HEMI | 2027 | 20 x 8.0-Inch Brass Monkey Wheels | package-priced (comes in "Brass Monkey Package", priced in package_definitions) |
| Dodge | Durango | GT HEMI | 2027 | 20 x 8.0-Inch Black Noise Split 5-Spoke Wheels | package-priced (comes in "Blacktop Package", priced in package_definitions) |
| Dodge | Durango | GT HEMI | 2027 | 20 x 10.0-Inch Brass Monkey Wheels | package-priced (comes in "Tow 'n Go Package", priced in package_definitions) |
| Dodge | Durango | GT HEMI | 2027 | 20 x 10.0-Inch Satin-Carbon Wheels | package-priced (comes in "Tow 'n Go Package", priced in package_definitions) |
| Dodge | Durango | GT HEMI Plus | 2027 | Blacktop Leather SRT Performance Seats | package-priced (comes in "Blacktop Redline Package", priced in package_definitions) |
| Dodge | Durango | GT HEMI Plus | 2027 | 20 x 10.0-Inch Forged Y-Spoke Lights Out Wheels | package-priced (comes in "Blacktop Package", priced in package_definitions) |
| Dodge | Durango | GT HEMI Plus | 2027 | 20 x 8.0-Inch Brass Monkey Wheels | package-priced (comes in "Brass Monkey Package", priced in package_definitions) |
| Dodge | Durango | GT HEMI Plus | 2027 | 20 x 8.0-Inch Black Noise Split 5-Spoke Wheels | package-priced (comes in "Blacktop Package", priced in package_definitions) |
| Dodge | Durango | GT HEMI Plus | 2027 | 20 x 10.0-Inch Satin-Carbon Wheels | package-priced (comes in "Tow 'n Go Package", priced in package_definitions) |
| Dodge | Durango | GT HEMI Premium | 2027 | Blacktop Leather SRT Performance Seats | package-priced (comes in "Blacktop Redline Package", priced in package_definitions) |
| Dodge | Durango | GT HEMI Premium | 2027 | 20 x 10.0-Inch Forged Y-Spoke Lights Out Wheels | package-priced (comes in "Blacktop Package", priced in package_definitions) |
| Dodge | Durango | GT HEMI Premium | 2027 | 20 x 8.0-Inch Brass Monkey Wheels | package-priced (comes in "Brass Monkey Package", priced in package_definitions) |
| Dodge | Durango | GT HEMI Premium | 2027 | 20 x 8.0-Inch Black Noise Split 5-Spoke Wheels | package-priced (comes in "Blacktop Package", priced in package_definitions) |
| Dodge | Durango | GT HEMI Premium | 2027 | 20 x 10.0-Inch Brass Monkey Wheels | package-priced (comes in "Tow 'n Go Package", priced in package_definitions) |
| Dodge | Durango | GT HEMI Premium | 2027 | 20 x 10.0-Inch Satin-Carbon Wheels | package-priced (comes in "Tow 'n Go Package", priced in package_definitions) |
| Dodge | Durango | R/T 392 | 2027 | 20 x 10.0-Inch Forged Y-Spoke Foreshadow Wheels | package-priced (comes in "Blacktop Package", priced in package_definitions) |
| Dodge | Durango | R/T 392 Plus | 2027 | 20 x 10.0-Inch Forged Y-Spoke Foreshadow Wheels | package-priced (comes in "Blacktop Package", priced in package_definitions) |
| Dodge | Durango | R/T 392 Premium | 2027 | Blacktop Leather SRT Performance Seats | package-priced (comes in "Blacktop Redline Package", priced in package_definitions) |
| Dodge | Durango | R/T 392 Premium | 2027 | 20 x 10.0-Inch Forged Y-Spoke Foreshadow Wheels | package-priced (comes in "Blacktop Package", priced in package_definitions) |
| Dodge | Durango | SRT Hellcat | 2027 | 7-Passenger Seating | package-priced (comes in "3rd Row Seating Group", priced in package_definitions) |
| Dodge | Durango | SRT Hellcat Jailbreak | 2027 | 7-Passenger Seating | package-priced (comes in "3rd Row Seating Group", priced in package_definitions) |
| Dodge | Durango | SRT Hellcat Jailbreak | 2027 | Adaptive cruise control | package-priced (comes in "Premium Group", priced in package_definitions) |
| Chrysler | Pacifica | Select | 2026 | Caprice Leatherette with "S" Logo | package-priced (comes in "S Appearance Package", priced in package_definitions) |
| Chrysler | Pacifica | Select | 2026 | 20" x 7.5" Foreshadow Painted Aluminum Wheels | package-priced (comes in "S Appearance Package", priced in package_definitions) |
| Chrysler | Pacifica | Limited | 2026 | Nappa Leather Buckets Seats with "S" Logo | package-priced (comes in "S Appearance Package", priced in package_definitions) |
| Chrysler | Pacifica | Limited | 2026 | 20" x 7.5" Foreshadow Painted Aluminum Wheels | package-priced (comes in "S Appearance Package", priced in package_definitions) |
| Chrysler | Pacifica | Select | 2027 | Caprice Leatherette with "S" Logo | package-priced (comes in "S Appearance Package", priced in package_definitions) |
| Chrysler | Pacifica | Select | 2027 | Leather Seats | package-priced (comes in "America's 250th Anniversary Edition", priced in package_definitions) |
| Chrysler | Pacifica | Select | 2027 | 20 x 7.5-Inch Foreshadow Painted Aluminum Wheels | package-priced (comes in "America's 250th Anniversary Edition", priced in package_definitions) |
| Chrysler | Pacifica | Select | 2027 | Leather seating | package-priced (comes in "America's 250th Anniversary Edition", priced in package_definitions) |
| Chrysler | Pacifica | Limited | 2027 | Nappa Leather Bucket Seats with "S" Logo | package-priced (comes in "S Appearance Package", priced in package_definitions) |
| Chrysler | Pacifica | Limited | 2027 | 20 x 7.5-Inch Painted Aluminum Wheels | package-priced (comes in "S Appearance Package", priced in package_definitions) |
| Alfa Romeo | Giulia | Base | 2026 | Black Sport Leather Seats | package-priced (comes in "Veloce Package RWD", priced in package_definitions) |
| Alfa Romeo | Stelvio | Base | 2026 | Sport Leather Seats | package-priced (comes in "Veloce AWD", priced in package_definitions) |
| Alfa Romeo | Tonale | Sprint | 2026 | Perforated Red Leather Seats with Red Stitching | package-priced (comes in "Premium Interior Package", priced in package_definitions) |
| Alfa Romeo | Tonale | Sprint | 2026 | Perforated Black Leather Seats w/Grey Stitching | package-priced (comes in "Black Premium Package", priced in package_definitions) |
| Alfa Romeo | Tonale | Sprint | 2026 | Leather seating | package-priced (comes in "Premium Interior Package", priced in package_definitions) |
| Alfa Romeo | Tonale | Sprint | 2026 | Ventilated front seats | package-priced (comes in "Black Premium Package", priced in package_definitions) |
| Alfa Romeo | Tonale | Sprint | 2026 | Power liftgate/trunk | package-priced (comes in "Black Premium Package", priced in package_definitions) |

## Charger 2027 two-door vs four-door

| trim | two-door MSRP | four-door MSRP | four-door premium | destination | source URL |
|---|---|---|---|---|---|
| R/T | $49,995 | $51,995 | +$2,000 | $1,995 | https://www.dodge.com/hostd/api/cvd/CUD202714/CUD202714_CVD.json |
| R/T Plus | $56,285 | $58,285 | +$2,000 | $1,995 | https://www.dodge.com/hostd/api/cvd/CUD202714/CUD202714_CVD.json |
| Scat Pack | $55,845 | $57,845 | +$2,000 | $1,995 | https://www.dodge.com/hostd/api/cvd/CUD202714/CUD202714_CVD.json |
| Scat Pack Plus | $60,840 | $62,840 | +$2,000 | $1,995 | https://www.dodge.com/hostd/api/cvd/CUD202714/CUD202714_CVD.json |
| Daytona Scat Pack Plus (EV, for comparison) | $77,490 | $77,990 | +$500 | $1,995 | https://www.dodge.com/hostd/api/cvd/CUD202714/CUD202714_CVD.json |

Super Bee Launch Edition: not on Dodge's 2027 Build & Price; no US price published. Report only: the file was not changed for this check.

## Unresolved

- 2027 gas Charger: the four-door premium is still $2,000 on every SIXPACK trim (only the Daytona EV dropped to $500). Super Bee Launch Edition isn't on Dodge's 2027 configurator, so it has no prices. The file's 4-Door AWD +$2,000 items already match; nothing to change.
- R/T Plus figures are Dodge's "starting at" prices, which include a priced item in the default build (the file's base is $54,990 for the 2-door).

## Counts

| make | blank prices in | filled | package-priced | still blank | options added |
|---|---|---|---|---|---|
| Dodge | 94 | 0 | 94 | 0 | 0 |
| Chrysler | 10 | 0 | 10 | 0 | 0 |
| Alfa Romeo | 7 | 0 | 7 | 0 | 0 |

Rows in = rows out: 41 = 41.
