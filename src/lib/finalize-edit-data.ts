import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { ConfiguratorSelection } from "@/lib/configurator-matching";
import type { FinalizeInitial } from "@/lib/finalize-initial";

const trimId = (trim: string, year: number | null) => `${trim}::${year ?? "unknown"}`;

/** Loads a search's saved answers for "Make changes" (see FinalizeInitial). */
export async function getFinalizeInitial(searchId: string): Promise<FinalizeInitial> {
  const admin = createAdminClient();
  const [{ data: search }, { data: trims }, { data: sels }, { data: combos }] = await Promise.all([
    admin.from("customer_searches").select("colors, required_options").eq("id", searchId).maybeSingle(),
    admin.from("search_trim_preferences").select("trim, model_year, rank_position, excluded").eq("search_id", searchId),
    admin
      .from("search_option_selections")
      .select("category, question_kind, selection, rank_position, excluded, package_name, package_price_cents, package_contents, price_unknown")
      .eq("search_id", searchId),
    admin
      .from("search_combination_preferences")
      .select("trim, model_year, exterior_color, interior, seating, rank_position, excluded")
      .eq("search_id", searchId),
  ]);

  const byRank = <T extends { rank_position: number | null }>(rows: T[]) =>
    [...rows].sort((a, b) => (a.rank_position ?? 0) - (b.rank_position ?? 0));
  const trimRows = trims ?? [];
  const comboRows = combos ?? [];
  const comboId = (c: (typeof comboRows)[number]) =>
    [trimId(c.trim as string, c.model_year as number | null), c.exterior_color ?? " ", c.interior ?? " ", c.seating ?? " "].join("::");

  return {
    rankedTrimIds: byRank(trimRows.filter((t) => !t.excluded && t.rank_position != null)).map((t) =>
      trimId(t.trim as string, t.model_year as number | null),
    ),
    excludedTrimIds: trimRows.filter((t) => t.excluded).map((t) => trimId(t.trim as string, t.model_year as number | null)),
    colors: (search?.colors as string[] | null) ?? [],
    options: (search?.required_options as string[] | null) ?? [],
    selections: byRank(sels ?? []).map(
      (s): ConfiguratorSelection => ({
        category: s.category as ConfiguratorSelection["category"],
        questionKind: s.question_kind as ConfiguratorSelection["questionKind"],
        selection: s.selection as string,
        rankPosition: (s.rank_position as number | null) ?? null,
        excluded: Boolean(s.excluded),
        packageName: (s.package_name as string | null) ?? null,
        packagePriceCents: (s.package_price_cents as number | null) ?? null,
        packageContents: (s.package_contents as string[] | null) ?? null,
        priceUnknown: Boolean(s.price_unknown),
      }),
    ),
    combinationRanked: byRank(comboRows.filter((c) => !c.excluded && c.rank_position != null)).map(comboId),
    combinationExcluded: comboRows.filter((c) => c.excluded).map(comboId),
  };
}
