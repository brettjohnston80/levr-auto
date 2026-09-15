import { cache } from "react";
import { existsSync, readdirSync } from "fs";
import path from "path";
import { slugifyForImage } from "@/lib/vehicle-color-images";

/**
 * Real photos of a specific feature on a specific vehicle, when we happen
 * to have them. The feature-checklist sibling of vehicle-color-images.ts,
 * and deliberately the same shape: a directory scan, a data-layer switch,
 * and "no image" as the normal answer.
 *
 * WHAT IS ACTUALLY ON DISK (2026-09-14): Toyota Camry only -- "Heated
 * seats" and "Heated steering wheel". Both are package_only (Cold Weather
 * Package) on LE / SE / Nightshade, i.e. they genuinely reach the features
 * step. Matched to the exact configurator_options name via a hand-checked
 * map, never by slugifying the source filename: Toyota's own label for the
 * seats photo is "Heated and Ventilated Seats", which slugifies to nothing
 * in the dataset.
 *
 * ⚠ THE 11 CIVIC FEATURE PHOTOS ARE DELIBERATELY NOT HERE. Every Civic
 * feature they show is coded standard or unavailable -- confirmed correct
 * against Honda's live Build & Price, which sells trims, not factory
 * options -- so the features step never asks about any of them. Placing
 * files that can never render would read to a future session as a broken
 * pipeline. Originals are archived at
 * ~/Downloads/camry-civic-feature-originals-2026-09-14/.
 *
 * Layout, all segments slugified:
 *
 *   public/vehicle-features/<make>/<model>/<feature>.<ext>
 *   e.g. public/vehicle-features/toyota/camry/heated-seats.jpg
 *
 * ⚠ A FEATURE NAME IS NOT A PHOTO SUBJECT ACROSS TRIMS. "Moonroof" (LE/SE)
 * and "Moonroof/panoramic roof" (XLE/XSE) are different hardware and slug
 * to different files, so one can never silently borrow the other's photo.
 * Keep it that way: never copy a photo under a second feature's name.
 */

/**
 * ⚠ MASTER OFF-SWITCH FOR VEHICLE FEATURE PHOTOS. Currently DISABLED.
 *
 * Independent of VEHICLE_COLOR_IMAGES_ENABLED on purpose. These are the
 * same kind of asset -- screenshots of a manufacturer's own site, terms of
 * use never reviewed -- and flipping the colour switch was an explicit,
 * separate risk decision. It must not extend to a new set of images by
 * sharing a constant.
 *
 * Gated at the data layer, like the colour switch: the lookup below
 * returns nothing while this is false, so no caller can render a URL it
 * obtained some other way.
 */
export const VEHICLE_FEATURE_IMAGES_ENABLED = false;

const IMAGE_ROOT = path.join(process.cwd(), "public", "vehicle-features");
const ACCEPTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".avif"];

/**
 * Every feature image actually on disk, keyed make/model/feature -> URL.
 * React cache(), no arguments, for the same reason as the colour index.
 */
const loadImageIndex = cache((): Map<string, string> => {
  const index = new Map<string, string>();
  if (!existsSync(IMAGE_ROOT)) return index;

  const dirsIn = (dir: string) => {
    try {
      return readdirSync(dir, { withFileTypes: true });
    } catch {
      return [];
    }
  };

  for (const make of dirsIn(IMAGE_ROOT)) {
    if (!make.isDirectory()) continue;
    for (const model of dirsIn(path.join(IMAGE_ROOT, make.name))) {
      if (!model.isDirectory()) continue;
      for (const file of dirsIn(path.join(IMAGE_ROOT, make.name, model.name))) {
        if (!file.isFile()) continue;
        const ext = path.extname(file.name).toLowerCase();
        if (!ACCEPTED_EXTENSIONS.includes(ext)) continue;
        const feature = slugifyForImage(path.basename(file.name, ext));
        const key = `${slugifyForImage(make.name)}/${slugifyForImage(model.name)}/${feature}`;
        index.set(key, encodeURI(`/vehicle-features/${make.name}/${model.name}/${file.name}`));
      }
    }
  }
  return index;
});

/**
 * Resolves photos for a whole features question at once. A name with no
 * photo is simply absent from the result -- render it text-only, never
 * with a placeholder.
 */
export function resolveFeatureImages(
  make: string | null,
  model: string | null,
  featureNames: string[],
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!VEHICLE_FEATURE_IMAGES_ENABLED) return out;
  if (!make || !model) return out;
  const index = loadImageIndex();
  const prefix = `${slugifyForImage(make)}/${slugifyForImage(model)}`;
  for (const name of featureNames) {
    const url = index.get(`${prefix}/${slugifyForImage(name)}`);
    if (url) out[name] = url;
  }
  return out;
}
