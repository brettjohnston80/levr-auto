import type { InventoryBlock } from "@/lib/inventory-block";

/**
 * Every string the zero-inventory block shows, in one place (approved by
 * Brett 2026-09-14). The customer screen, the server refusals and the agent
 * section all read from here so their wording cannot drift.
 *
 * Client-safe: the InventoryBlock import is type-only.
 *
 * Deliberately no message promises an agent can help. There is no agent
 * override for the block, so "Schedule a call" is not offered while a
 * search is blocked.
 */
export function inventoryBlockCopy(
  block: InventoryBlock,
  make: string,
  model: string,
): { heading: string; body: string } {
  if (block.kind === "year") {
    const year = block.committedYear;
    const others = block.otherYears.join(" and ");
    return {
      heading: `No ${year} ${make} ${model} inventory right now`,
      body: `We don't have any ${year} ${make} ${model} listings at the moment, so there's nothing for us to search yet. ${others} models are available — you can change your model year below, or choose a different vehicle. Changes are free until your search starts.`,
    };
  }
  return {
    heading: `We can't see any ${make} ${model} inventory right now`,
    body: `We don't have any ${make} ${model} listings at the moment, for any model year, so there's nothing for us to search yet. This can happen when our inventory data is temporarily unavailable. You can choose a different vehicle below for free, or check back later.`,
  };
}

export const AGENT_INVENTORY_BLOCK_HEADING = "Blocked — no inventory for the committed vehicle";

export const AGENT_INVENTORY_BLOCK_DESCRIPTION =
  "Paid searches whose committed make, model and year have no synced listings. Neither the customer nor an agent can finalize these until inventory exists or the customer changes their vehicle.";

/** Returned by both agent finalize actions when the block applies. */
export const AGENT_INVENTORY_BLOCK_REFUSAL = `${AGENT_INVENTORY_BLOCK_HEADING}. Neither the customer nor an agent can finalize this search until inventory exists or the vehicle changes.`;
