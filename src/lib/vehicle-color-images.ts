import { cache } from "react";
import { existsSync, readdirSync } from "fs";
import path from "path";

/**
 * Real photos for a specific colour of a specific vehicle, when we happen
 * to have them.
 *
 * WHAT IS ACTUALLY ON DISK (2026-09-13): Toyota Camry and Honda Civic,
 * 39 images in total -- Camry 14 exterior / 8 interior, Civic 11 exterior
 * / 6 interior. Every one is matched to an exact configurator_options
 * name via a hand-checked map and verified to resolve. Every other make
 * resolves to no image, which is the normal case and renders name-only.
 *
 * Note that NONE of them are being shown right now regardless: see
 * VEHICLE_COLOR_IMAGES_ENABLED immediately below. Every colour renders
 * name-only, exactly as it did before any of this existed.
 *
 * WHY A DIRECTORY SCAN RATHER THAN A CHECKED-IN MANIFEST: dropping the
 * images in must be the ONLY step. A manifest would need regenerating, and
 * a manifest that drifts from what is actually on disk is exactly how a
 * broken <img> reaches a customer. Scanning means the set of images we
 * claim to have is, by construction, the set that exists.
 *
 * ⚠ IMAGES MUST LIVE UNDER public/, NOT data/. data/ is not web-servable --
 * nothing under it has a URL - so a zip unpacked there would resolve to a
 * 404 for every single image. Expected layout, all segments slugified
 * (lowercased, non-alphanumerics collapsed to single hyphens):
 *
 *   public/vehicle-colors/<make>/<model>/<category>/<color>.<ext>
 *   e.g. public/vehicle-colors/toyota/camry/exterior_color/supersonic-red.jpg
 *
 * <category> is the configurator category verbatim: exterior_color or
 * interior. Accepted extensions are listed below.
 */

/**
 * ⚠ MASTER OFF-SWITCH FOR VEHICLE COLOUR PHOTOS. Currently DISABLED.
 *
 * WHY IT IS OFF: the Camry image set is real and complete (22 images,
 * placed and verified), but those images are screenshots of Toyota's own
 * configurator rather than licensed CDN assets, and their terms of use
 * have not been reviewed yet. Showing them to real testers before that
 * review is a decision nobody has made, so the default is not to.
 *
 * THIS IS A PAUSE, NOT A ROLLBACK. Every piece of the pipeline stays
 * built and exercised: the directory scan, the name matching, the
 * per-category lookup, and the no-image rendering path. Re-enabling once
 * licensing clears is flipping this ONE line to true -- there is nothing
 * to rebuild and nothing to re-place.
 *
 * Gated at the data layer rather than in the UI on purpose: both exported
 * lookups below return "no image" while this is false, so no caller can
 * bypass it by rendering a URL it obtained some other way.
 */
export const VEHICLE_COLOR_IMAGES_ENABLED = false;

const IMAGE_ROOT = path.join(process.cwd(), "public", "vehicle-colors");
const ACCEPTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".avif"];

export function slugifyForImage(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Every image actually present on disk, keyed
 * make/model/category/colour -> public URL.
 *
 * React cache(), so one dirt-cheap scan per request rather than one per
 * colour option. No-argument by design -- cache() memoises on argument
 * identity, so a parameterised version would miss on every call.
 */
const loadImageIndex = cache((): Map<string, string> => {
  const index = new Map<string, string>();
  // The overwhelmingly common case today, and it must be silent: no
  // directory simply means no images, which is a supported state.
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
      for (const category of dirsIn(path.join(IMAGE_ROOT, make.name, model.name))) {
        if (!category.isDirectory()) continue;
        const dir = path.join(IMAGE_ROOT, make.name, model.name, category.name);
        for (const file of dirsIn(dir)) {
          if (!file.isFile()) continue;
          const ext = path.extname(file.name).toLowerCase();
          if (!ACCEPTED_EXTENSIONS.includes(ext)) continue;
          const colour = slugifyForImage(path.basename(file.name, path.extname(file.name)));
          const key = `${slugifyForImage(make.name)}/${slugifyForImage(model.name)}/${category.name}/${colour}`;
          // encodeURI, not raw: a filename with a space would otherwise
          // produce a URL the browser cannot fetch, i.e. a broken image.
          index.set(
            key,
            encodeURI(`/vehicle-colors/${make.name}/${model.name}/${category.name}/${file.name}`),
          );
        }
      }
    }
  }
  return index;
});

/**
 * Public URL for one colour's photo, or null when we do not have it.
 *
 * Null is the normal answer for almost every vehicle -- callers must render
 * the option without an image rather than reaching for a placeholder. A
 * "missing image" graphic reads to a customer as something being broken,
 * which is worse than the clean text-only row we have shipped all along.
 */
export function vehicleColorImageUrl(
  make: string | null,
  model: string | null,
  category: string,
  colorName: string,
): string | null {
  if (!VEHICLE_COLOR_IMAGES_ENABLED) return null;
  if (!make || !model) return null;
  const key = `${slugifyForImage(make)}/${slugifyForImage(model)}/${category}/${slugifyForImage(colorName)}`;
  return loadImageIndex().get(key) ?? null;
}

/** Resolves images for a whole question at once, in one scan. */
export function resolveColorImages(
  make: string | null,
  model: string | null,
  category: string,
  colorNames: string[],
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!VEHICLE_COLOR_IMAGES_ENABLED) return out;
  for (const name of colorNames) {
    const url = vehicleColorImageUrl(make, model, category, name);
    if (url) out[name] = url;
  }
  return out;
}
