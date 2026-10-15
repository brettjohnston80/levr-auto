import "server-only";

/**
 * PostgREST returns at most 1,000 rows per request and cuts the rest off silently, so any read
 * that can grow past that must page. `fetchPage(from, to)` runs the query for one inclusive
 * range; this calls it until a short page comes back. The query must have a stable order.
 */
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) return rows;
  }
}

/** Splits a long id list for `.in()` filters, which go in the URL. */
export function chunks<T>(items: T[], size = 200): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * A lookup by a list of ids that can be long: the ids go in the request URL, and a list of about
 * 650 uuids or more makes PostgREST answer "Bad Request" (measured 2026-10-14: 600 fine, 650
 * refused). Splits the list into chunks of `chunkSize` (duplicates removed) and pages each
 * chunk's rows. `fetchPage(chunk, from, to)` runs the query for one chunk and range; give it a
 * stable order. Errors are thrown, never swallowed.
 */
export async function fetchByIds<T, Id>(
  ids: Id[],
  fetchPage: (chunk: Id[], from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  chunkSize = 200,
): Promise<T[]> {
  const rows: T[] = [];
  for (const chunk of chunks([...new Set(ids)], chunkSize)) {
    rows.push(...(await fetchAllPages((from, to) => fetchPage(chunk, from, to))));
  }
  return rows;
}
