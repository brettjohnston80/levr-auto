"""
LEVR Auto Matchmaker — Data Cleaning + Scoring Pipeline
=========================================================
Single source of truth for turning a raw Cowork-researched vehicle CSV into
a cleaned, fully-scored dataset across all 9 Matchmaker dimensions.

USAGE:
    python matchmaker_scoring_pipeline.py <input_csv> <output_csv>

WHAT THIS DOES:
    1. CLEAN   — normalizes body_style, extracts embedded citations out of
                 reliability_rating, validates every numeric column for
                 embedded-text corruption (flags rather than silently breaks).
    2. SCORE   — computes all 9 dimension scores (Safety, Comfort, Cargo,
                 Fuel Economy, Reliability, Technology & Features, Price
                 Value, Resale Value, Performance) per body-style class,
                 using the rules established for the 2026 dataset.
    3. OUTPUT  — writes a single CSV with every raw + score column, plus a
                 validation report printed to stdout.

Built 2026-08-31, both open weighting decisions confirmed same day (Comfort
75/25 front-rear/third-row, Cargo 75/25 seats-up/max). Update the
ASSUMPTIONS block below as decisions change — that's the first thing to
check before assuming a rule is still current.
"""

import sys
import re
import pandas as pd
import numpy as np

# =========================================================================
# ASSUMPTIONS — review this block first when carrying forward to 2027 data.
# Anything marked "NOT YET CONFIRMED" is a placeholder, not a decision.
# =========================================================================

# Body style normalization: raw value -> canonical category.
# NEW 2027 MODELS MAY INTRODUCE VALUES NOT IN THIS MAP — the script will
# print any unmapped values it finds rather than silently drop/misclassify
# them. Add new mappings here as they appear.
BODY_STYLE_MAP = {
    'SUV': 'SUV', '3-row SUV': 'SUV', 'mid-size SUV': 'SUV', 'full-size SUV': 'SUV',
    'subcompact SUV': 'SUV', 'compact electric SUV': 'SUV', 'compact SUV': 'SUV',
    'mid-size electric SUV': 'SUV', 'full-size electric SUV': 'SUV',
    'mid-size SUV (3-row, extended length)': 'SUV',
    'Sedan': 'Sedan', 'sedan': 'Sedan', 'mid-size sedan': 'Sedan',
    'heavy-duty truck': 'Truck', 'full-size truck': 'Truck', 'pickup truck': 'Truck',
    'mid-size truck': 'Truck', 'full-size electric truck': 'Truck', 'cab-chassis': 'Truck',
    'Pickup': 'Truck', 'Pickup Truck': 'Truck', 'Truck': 'Truck', 'compact truck': 'Truck',
    'Minivan': 'Minivan', 'minivan': 'Minivan',
    'cargo van': 'Cargo Van', 'passenger van': 'Cargo Van',
    'Hatchback': 'Hatchback', 'hatchback': 'Hatchback',
    'Coupe': 'Coupe', 'coupe': 'Coupe', 'Coupe (Retractable Hardtop)': 'Coupe', 'sports car': 'Coupe',
    'Convertible': 'Convertible', 'convertible': 'Convertible', 'Targa': 'Convertible',
    'Wagon': 'Wagon', 'Cross Turismo': 'Wagon', 'Sport Turismo': 'Wagon',
}

# Every column that should be pure numeric — the script scans these for
# embedded text (e.g. "40.2 f / 36.7 r", "4.0/5.0 (RepairPal...)") and
# either extracts what it can (reliability_rating) or flags it for manual
# review (everything else — don't guess at a split like the headroom case).
NUMERIC_COLUMNS = [
    'msrp', 'destination_fee', 'true_starting_price', 'epa_city_mpg', 'epa_hwy_mpg',
    'epa_combined_mpg', 'range_mi', 'nhtsa_overall_stars', 'passenger_volume_cuft',
    'front_legroom_in', 'rear_legroom_in', 'third_row_legroom_in', 'front_headroom_in',
    'rear_headroom_in', 'third_row_headroom_in', 'cargo_volume_seats_up_cuft',
    'max_cargo_volume_cuft', 'towing_capacity_lbs', 'payload_capacity_lbs',
    'reliability_rating', 'horsepower', 'torque_lbft', 'zero_to_60_sec', 'top_speed_mph',
    'tech_score', 'resale_depreciation_pct', 'fuel_tank_capacity_gal', 'bed_length_ft',
]

# Dimensions using the universal formula: final = 50 + (x - min)/(max - min) * 50
# "higher_is_better": True means the raw column scores higher = better (Safety,
# Comfort, Cargo, Reliability, Tech, Fuel Economy). False means inverted
# (Price Value, Resale Value, and the zero-to-60 component of Performance).

# Cargo: CONFIRMED 2026-08-31. Sedan uses cargo_volume_seats_up_cuft alone.
# For body styles where max_cargo_volume_cuft (seats folded) is also
# commonly reported, combine as 75% seats-up (the everyday experience) +
# 25% max (seats folded) — each independently normalized before weighting,
# consistent with the Comfort weighting below.
CARGO_DUAL_VALUE_BODY_STYLES = ['SUV', 'Hatchback', 'Wagon', 'Minivan', 'Cargo Van']
CARGO_SEATS_UP_WEIGHT = 0.75
CARGO_MAX_WEIGHT = 0.25

# CONFIRMED 2026-09-02: Truck is a special case, using bed_length_ft alone
# (not cargo_volume_seats_up_cuft/max_cargo_volume_cuft at all). The cuft
# metrics measure interior cab storage, not the truck bed — verified on
# real data that the populated values (33-53 cuft) are far too small to be
# bed volume, and only 22% of trucks have it populated in the first place.
# bed_length_ft is a real, well-sourced (93.7%), genuinely differentiating
# spec (4.3-8.2 ft range) that measures the thing that actually matters for
# a truck's cargo capacity. The 12 Ram Chassis Cab rows with no bed_length_ft
# (they ship without a factory bed at all) correctly floor at 50 like any
# other missing-data case — no special handling needed.
CARGO_BED_LENGTH_BODY_STYLES = ['Truck']

# Comfort: CONFIRMED 2026-08-31. third_row_legroom_in / third_row_headroom_in
# are included for SUVs (and Minivans) where has_third_row == 'yes', combined
# as 75% front/rear (4 measurements, averaged) + 25% third row (2
# measurements, averaged) — third row matters, but less than front/rear.
THIRD_ROW_COMFORT_BODY_STYLES = ['SUV', 'Minivan']
COMFORT_FRONT_REAR_WEIGHT = 0.75
COMFORT_THIRD_ROW_WEIGHT = 0.25

# Safety: fixed absolute scale, not class-relative (every rated Sedan tied
# at 5 stars in the 2026 dataset — a class-relative min/max would divide by
# zero, and NHTSA/IIHS stars are a government/industry scale, not a relative one).
SAFETY_SCALE_MIN, SAFETY_SCALE_MAX = 1, 5

# Performance: trim flag (50%) + zero-to-60 (50%, inverted). Top speed is
# EXCLUDED entirely (sourcing proved too inconsistent — see 2026-08-30 notes).
# When zero-to-60 is missing, Performance Score floors at 50 regardless of
# the trim flag — a known performance trim with no speed data must not
# outrank a verified-fast car on the flag alone. This was a deliberate fix;
# do not revert to "use trim flag alone when 0-60 missing."
# Applies to ALL body styles uniformly — towing/payload capability lives in
# its own dedicated Towing & Payload dimension instead (see below), not
# blended into Performance. (Earlier same-day iteration briefly blended
# towing/payload into Performance for Truck/SUV/Cargo Van; superseded by
# this dedicated-dimension approach once the priority-ranking implications
# were worked through — don't resurrect the blended version.)
PERFORMANCE_TRIM_WEIGHT = 0.5
PERFORMANCE_ZERO_TO_60_WEIGHT = 0.5

# CONFIRMED 2026-08-31: Towing & Payload is a new 9th dimension, computed for
# EVERY vehicle (equal-weight 50/50 average of towing_capacity_lbs and
# payload_capacity_lbs, using whichever is available), but only surfaced as
# a rankable priority option in the UI for Truck, SUV, and Cargo Van — where
# it REPLACES Resale Value as that body style's 9th option. Resale Value is
# still computed for every vehicle (including Truck/SUV/Cargo Van) so the
# column stays populated and consistent, it's just not offered as a ranking
# choice for those 3 body styles at the UI layer. This is a UI-layer
# decision, not a data-layer one — both dimensions exist for every vehicle
# in this dataset; which 9 are offered as rankable is a frontend concern.
TOWING_PAYLOAD_BODY_STYLES_AS_PRIORITY = ['Truck', 'SUV', 'Cargo Van']

# Fuel Economy: MPG and range are each normalized WITHIN the vehicle's own
# fuel_type group (exact match: Gas/EV/Hybrid/PHEV/Hydrogen), not the whole
# body-style class — otherwise EVs' higher MPGe dominates by default.
# Single-member fuel-type groups (e.g. one lone Hydrogen sedan) get a flat
# neutral 50 sub-score rather than an undefined relative rank.
FUEL_ECONOMY_SINGLETON_FALLBACK = 50

# CONFIRMED 2026-09-02: alongside each of the 9 scores, the pipeline now also
# outputs a companion "<Dimension> Has Data" boolean. This exists because a
# score of exactly 50 is ambiguous — it means EITHER "no underlying data at
# all" (the universal floor) OR "real data, but genuinely tied for worst in
# the class" (a legitimate score, not a gap). The UI needs to tell these
# apart (e.g. a neutral "no data" indicator vs. a real "red" rating), and
# that determination has to check the actual raw spec column(s), not the
# score — so it lives here, once, rather than being re-derived (and risking
# drift) in application code. Mapping of which raw column(s) determine
# "has data" per dimension:
#   Safety                    -> nhtsa_overall_stars
#   Comfort                   -> any of front/rear legroom/headroom (+ third
#                                 row for SUV/Minivan) populated
#   Cargo                     -> bed_length_ft (Truck) or cargo_volume_seats_up_cuft (everyone else)
#   Fuel Economy               -> epa_combined_mpg OR range_mi populated
#   Reliability                -> reliability_rating
#   Technology & Features      -> tech_score
#   Price Value                 -> true_starting_price
#   Resale Value                 -> resale_depreciation_pct
#   Performance                  -> zero_to_60_sec (the trim flag alone doesn't
#                                 count — this matches the 2026-08-30 fix
#                                 where a missing 0-60 floors the score
#                                 regardless of the trim flag)
#   Towing & Payload              -> towing_capacity_lbs OR payload_capacity_lbs populated

# The universal floor: any dimension with fully missing raw data scores
# exactly 50 (not blank) — missing data is never rewarded, never penalized
# below the floor. Confirmed 2026-08-30, applies to all 9 dimensions.
UNIVERSAL_FLOOR = 50
# Defensive fallback for genuine zero-variance-with-real-data edge cases
# (distinct from the missing-data floor above).
ZERO_VARIANCE_FALLBACK = 75


# =========================================================================
# STEP 1: CLEANING
# =========================================================================

def clean_body_style(df):
    unmapped = set(df['body_style'].dropna().unique()) - set(BODY_STYLE_MAP.keys())
    if unmapped:
        print(f"⚠ UNMAPPED body_style values found — add these to BODY_STYLE_MAP "
              f"before proceeding, they will be left blank otherwise: {unmapped}")
    df['body_style'] = df['body_style'].map(BODY_STYLE_MAP)
    return df


def clean_reliability_rating(df):
    """Extract embedded citation text (e.g. RepairPal source notes) out of
    reliability_rating into a separate note column, leaving a clean numeric
    value behind. This pattern has recurred across multiple research passes
    — don't assume a future pass will deliver it pre-cleaned."""
    is_messy = df['reliability_rating'].astype(str).str.contains('[a-zA-Z]', na=False, regex=True)
    if 'reliability_source_note' not in df.columns:
        df['reliability_source_note'] = None
    df.loc[is_messy, 'reliability_source_note'] = df.loc[is_messy, 'reliability_rating']
    df['reliability_rating'] = df['reliability_rating'].astype(str).str.extract(r'^(\d+\.?\d*)')[0]
    df['reliability_rating'] = pd.to_numeric(df['reliability_rating'], errors='coerce')
    return df


def validate_numeric_columns(df):
    """Flag (don't auto-fix) any other numeric column with embedded text —
    e.g. the 2026 case where a single cell held '40.2 f / 36.7 r' instead of
    separate front/rear values. These need manual review, not a guessed split.

    IMPORTANT: explicitly excludes actual null/NaN values via .notna() before
    the string check, rather than relying on astype(str) + na=False to handle
    them correctly — that combination is pandas-version-dependent (some
    versions/dtypes stringify NaN as the literal text "nan", which contains
    letters and would otherwise false-positive as "corruption" on every
    missing value in the dataset). Bug found 2026-09-02 via a real run that
    produced 12,633 false positives, all of them the string "nan" — fixed
    here rather than left as a version-dependent landmine."""
    issues = []
    for col in NUMERIC_COLUMNS:
        if col not in df.columns:
            continue
        not_null = df[col].notna()
        weird = df[not_null & df[col].astype(str).str.contains('[a-zA-Z]', na=False, regex=True)]
        if len(weird):
            for _, row in weird.iterrows():
                issues.append((col, row.get('make'), row.get('model'), row.get('trim'), row[col]))
    if issues:
        print(f"⚠ {len(issues)} embedded-text values found in columns that should be pure numeric "
              f"(excluding reliability_rating, already handled above). Needs manual review:")
        for i in issues:
            print("   ", i)
    else:
        print("✓ No embedded-text corruption found in any numeric column.")
    return issues


def coerce_numeric_columns(df):
    """After validation has flagged any embedded-text corruption for manual
    review, safely coerce every numeric column to actual numeric dtype —
    any unparseable value becomes NaN (caught by the universal floor) rather
    than crashing the scoring step. The flagged report above is what tells
    you a value was dropped this way; this step doesn't hide that."""
    for col in NUMERIC_COLUMNS:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')
    return df


def clean(df):
    df = clean_body_style(df)
    df = clean_reliability_rating(df)
    validate_numeric_columns(df)
    df = coerce_numeric_columns(df)
    return df


# =========================================================================
# STEP 2: SCORING HELPERS
# =========================================================================

def normalize_0_100(series, higher_is_better=True):
    """Plain 0-100 relative normalization within whatever slice is passed in.
    Used for SUB-components before they're combined (e.g. Comfort's 4-6
    measurements) — NOT for final dimension scores, which use floor_rescale."""
    lo, hi = series.min(), series.max()
    if pd.isna(lo) or pd.isna(hi) or hi == lo:
        return pd.Series(np.nan, index=series.index)
    if higher_is_better:
        return (series - lo) / (hi - lo) * 100
    else:
        return (hi - series) / (hi - lo) * 100


def floor_rescale(series, higher_is_better=True):
    """The universal final-score formula: 50 + (x-min)/(max-min)*50, so the
    class-best vehicle scores 100 and class-worst scores 50. Missing input
    floors at 50 directly (not blank). Zero-variance real data falls back to
    75 (distinct from the missing-data floor)."""
    lo, hi = series.min(), series.max()
    result = pd.Series(UNIVERSAL_FLOOR, index=series.index, dtype=float)
    if pd.isna(lo) or pd.isna(hi):
        return result  # nothing in the class has this data at all
    if hi == lo:
        result[series.notna()] = ZERO_VARIANCE_FALLBACK
        return result
    if higher_is_better:
        scored = UNIVERSAL_FLOOR + (series - lo) / (hi - lo) * 50
    else:
        scored = UNIVERSAL_FLOOR + (hi - series) / (hi - lo) * 50
    result[series.notna()] = scored[series.notna()]
    return result


# =========================================================================
# STEP 3: PER-DIMENSION SCORING (applied per body-style class)
# =========================================================================

def score_safety(cls):
    """Fixed 1-5 absolute scale — NOT class-relative. safety_source column
    (NHTSA/IIHS) is informational only, doesn't affect the formula."""
    stars = cls['nhtsa_overall_stars']
    scored = pd.Series(UNIVERSAL_FLOOR, index=cls.index, dtype=float)
    has_data = stars.notna()
    scored[has_data] = UNIVERSAL_FLOOR + (stars[has_data] - SAFETY_SCALE_MIN) / \
        (SAFETY_SCALE_MAX - SAFETY_SCALE_MIN) * 50
    return scored


def score_comfort(cls, body_style):
    front_rear = ['front_legroom_in', 'rear_legroom_in', 'front_headroom_in', 'rear_headroom_in']
    front_rear_norms = pd.DataFrame({m: normalize_0_100(cls[m]) for m in front_rear if m in cls.columns})
    front_rear_avg = front_rear_norms.mean(axis=1, skipna=True)
    front_rear_avg[front_rear_norms.count(axis=1) == 0] = np.nan

    if body_style in THIRD_ROW_COMFORT_BODY_STYLES and 'third_row_legroom_in' in cls.columns:
        third_row = ['third_row_legroom_in', 'third_row_headroom_in']
        third_row_norms = pd.DataFrame({m: normalize_0_100(cls[m]) for m in third_row})
        third_row_avg = third_row_norms.mean(axis=1, skipna=True)
        third_row_avg[third_row_norms.count(axis=1) == 0] = np.nan

        raw_avg = pd.Series(np.nan, index=cls.index)
        both = front_rear_avg.notna() & third_row_avg.notna()
        raw_avg[both] = (front_rear_avg[both] * COMFORT_FRONT_REAR_WEIGHT +
                          third_row_avg[both] * COMFORT_THIRD_ROW_WEIGHT)
        # vehicle has no third row (or no third-row data) -> use front/rear alone
        fr_only = front_rear_avg.notna() & ~both
        raw_avg[fr_only] = front_rear_avg[fr_only]
        return floor_rescale(raw_avg)
    else:
        return floor_rescale(front_rear_avg)


def score_cargo(cls, body_style):
    if body_style in CARGO_BED_LENGTH_BODY_STYLES:
        return floor_rescale(cls['bed_length_ft'])
    elif body_style in CARGO_DUAL_VALUE_BODY_STYLES and 'max_cargo_volume_cuft' in cls.columns:
        seats_up_norm = normalize_0_100(cls['cargo_volume_seats_up_cuft'])
        max_norm = normalize_0_100(cls['max_cargo_volume_cuft'])

        raw_avg = pd.Series(np.nan, index=cls.index)
        both = seats_up_norm.notna() & max_norm.notna()
        raw_avg[both] = (seats_up_norm[both] * CARGO_SEATS_UP_WEIGHT +
                          max_norm[both] * CARGO_MAX_WEIGHT)
        # only one of the two is known -> use whichever is available alone
        su_only = seats_up_norm.notna() & ~both
        raw_avg[su_only] = seats_up_norm[su_only]
        max_only = max_norm.notna() & ~both
        raw_avg[max_only] = max_norm[max_only]
        return floor_rescale(raw_avg)
    else:
        return floor_rescale(cls['cargo_volume_seats_up_cuft'])


def score_fuel_economy(cls):
    def within_fuel_type(col):
        result = pd.Series(np.nan, index=cls.index)
        for ft, grp in cls.groupby('fuel_type'):
            vals = grp[col]
            if vals.notna().sum() <= 1:
                result.loc[vals.index[vals.notna()]] = FUEL_ECONOMY_SINGLETON_FALLBACK
            else:
                result.loc[vals.index] = normalize_0_100(vals)
        return result
    mpg_norm = within_fuel_type('epa_combined_mpg')
    range_norm = within_fuel_type('range_mi')
    both = pd.DataFrame({'mpg': mpg_norm, 'range': range_norm})
    raw_avg = both.mean(axis=1, skipna=True)
    raw_avg[both.count(axis=1) == 0] = np.nan
    return floor_rescale(raw_avg)


def score_reliability(cls):
    return floor_rescale(cls['reliability_rating'])


def score_tech(cls):
    return floor_rescale(cls['tech_score'])


def score_price_value(cls):
    return floor_rescale(cls['true_starting_price'], higher_is_better=False)


def score_resale_value(cls):
    return floor_rescale(cls['resale_depreciation_pct'], higher_is_better=False)


def score_performance(cls, body_style):
    trim_norm = cls['is_performance_trim'].astype(str).str.lower().map({'yes': 100, 'no': 0})
    zero60_norm = normalize_0_100(cls['zero_to_60_sec'], higher_is_better=False)
    raw_avg = pd.Series(np.nan, index=cls.index)
    has_060 = zero60_norm.notna()
    raw_avg[has_060] = (trim_norm[has_060] * PERFORMANCE_TRIM_WEIGHT +
                         zero60_norm[has_060] * PERFORMANCE_ZERO_TO_60_WEIGHT)
    # missing 0-60 -> raw_avg stays NaN -> floor_rescale gives 50, regardless
    # of trim flag. This is the deliberate 2026-08-30 fix — do not "helpfully"
    # fall back to trim_norm alone here.
    return floor_rescale(raw_avg)


def score_towing_payload(cls):
    """New 9th dimension (2026-08-31), computed for every vehicle regardless
    of body style — equal-weight average of towing and payload capacity,
    using whichever is available. Only surfaced as a rankable UI priority
    for Truck/SUV/Cargo Van (see TOWING_PAYLOAD_BODY_STYLES_AS_PRIORITY),
    but computed universally so the column is always populated."""
    tow_norm = normalize_0_100(cls['towing_capacity_lbs'])
    payload_norm = normalize_0_100(cls['payload_capacity_lbs'])
    comps = pd.DataFrame({'tow': tow_norm, 'payload': payload_norm})
    raw_avg = comps.mean(axis=1, skipna=True)
    raw_avg[comps.count(axis=1) == 0] = np.nan
    return floor_rescale(raw_avg)


def compute_has_data_flags(cls, body_style):
    """Companion boolean per dimension: was there real underlying data for
    this vehicle, independent of what the final score came out to. A score
    of exactly 50 can mean either 'no data' (this returns False) or 'real
    data, genuinely worst in class' (this returns True) — the UI needs to
    tell these apart, so it's computed here from the same raw columns the
    scores themselves are built from, rather than re-derived downstream."""
    flags = pd.DataFrame(index=cls.index)

    flags['Safety Has Data'] = cls['nhtsa_overall_stars'].notna()

    comfort_cols = ['front_legroom_in', 'rear_legroom_in', 'front_headroom_in', 'rear_headroom_in']
    if body_style in THIRD_ROW_COMFORT_BODY_STYLES:
        comfort_cols += ['third_row_legroom_in', 'third_row_headroom_in']
    flags['Comfort Has Data'] = cls[comfort_cols].notna().any(axis=1)

    if body_style in CARGO_BED_LENGTH_BODY_STYLES:
        flags['Cargo Has Data'] = cls['bed_length_ft'].notna()
    else:
        flags['Cargo Has Data'] = cls['cargo_volume_seats_up_cuft'].notna()

    flags['Fuel Economy Has Data'] = cls['epa_combined_mpg'].notna() | cls['range_mi'].notna()
    flags['Reliability Has Data'] = cls['reliability_rating'].notna()
    flags['Technology & Features Has Data'] = cls['tech_score'].notna()
    flags['Price Value Has Data'] = cls['true_starting_price'].notna()
    flags['Resale Value Has Data'] = cls['resale_depreciation_pct'].notna()
    # matches the 2026-08-30 fix: a missing 0-60 floors Performance regardless
    # of the trim flag, so "has data" for Performance means "has a real 0-60".
    flags['Performance Has Data'] = cls['zero_to_60_sec'].notna()
    flags['Towing & Payload Has Data'] = cls['towing_capacity_lbs'].notna() | cls['payload_capacity_lbs'].notna()

    return flags


def score_all_dimensions(df):
    scored_frames = []
    for body_style, cls in df.groupby('body_style'):
        cls = cls.copy()
        cls['Safety Score'] = score_safety(cls)
        cls['Comfort Score'] = score_comfort(cls, body_style)
        cls['Cargo Score'] = score_cargo(cls, body_style)
        cls['Fuel Economy Score'] = score_fuel_economy(cls)
        cls['Reliability Score'] = score_reliability(cls)
        cls['Technology & Features Score'] = score_tech(cls)
        cls['Price Value Score'] = score_price_value(cls)
        cls['Resale Value Score'] = score_resale_value(cls)
        cls['Performance Score'] = score_performance(cls, body_style)
        cls['Towing & Payload Score'] = score_towing_payload(cls)

        has_data = compute_has_data_flags(cls, body_style)
        for col in has_data.columns:
            cls[col] = has_data[col]
        scored_frames.append(cls)
    return pd.concat(scored_frames).sort_index()


# =========================================================================
# MAIN
# =========================================================================

def main(input_path, output_path):
    df = pd.read_csv(input_path)
    print(f"Loaded {len(df)} rows from {input_path}\n")

    df = clean(df)
    print()

    n_before = len(df)
    df = df[df['body_style'].notna()]
    if len(df) < n_before:
        print(f"⚠ Dropped {n_before - len(df)} rows with unmapped/missing body_style — "
              f"fix BODY_STYLE_MAP and rerun rather than silently losing these.\n")

    df = score_all_dimensions(df)

    print("\n=== Body style breakdown ===")
    print(df['body_style'].value_counts())

    print("\n=== Score coverage (should be 100% everywhere — floor covers missing data) ===")
    for col in ['Safety Score', 'Comfort Score', 'Cargo Score', 'Fuel Economy Score',
                'Reliability Score', 'Technology & Features Score', 'Price Value Score',
                'Resale Value Score', 'Performance Score', 'Towing & Payload Score']:
        print(f"  {col}: {df[col].notna().sum()}/{len(df)}")

    df.to_csv(output_path, index=False)
    print(f"\nSaved to {output_path}")


if __name__ == '__main__':
    if len(sys.argv) != 3:
        print("Usage: python matchmaker_scoring_pipeline.py <input_csv> <output_csv>")
        sys.exit(1)
    main(sys.argv[1], sys.argv[2])
