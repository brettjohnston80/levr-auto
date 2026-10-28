// Offer entry, Chunk 3: save draft, send (through send_offer_submission), discard.
// Calls the branch's real modules (gen/real, built by lib/build-modules.cjs) as the persistent
// test admin, never as Brett. One disposable customer (claude-verify-<ts>@levrauto-test.invalid)
// and its search; everything written is deleted afterwards and confirmed by count.
import { createAdminClient } from "../lib/admin.mjs";
import crypto from "node:crypto";
const S = await import("../gen/real/offer-submission.mjs");

const a = createAdminClient();
const ts = Date.now(), tag = `claude-verify-${ts}-${crypto.randomUUID().slice(0, 8)}`;
const DEALER = `CLAUDE VERIFY OE3 DEALER ${ts}`;
let pass = 0, fail = 0;
const ok = (n, c, d = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };
const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data; };

const { data: padmin } = await a.from("agents").select("id").eq("email", "claude-verify-admin@levrauto-test.invalid").single();
const { data: brett } = await a.from("agents").select("id").eq("levrid", 1).single();
const cnt = async (id) => (await a.from("agent_activity_log").select("id", { count: "exact", head: true }).eq("agent_id", id)).count;
const b0 = await cnt(brett.id);

let userId = null, searchId = null;
const base = () => ({
  dealer_name: DEALER, dealer_contact: "sales@levrauto-test.invalid", dealer_city: "Overland Park", dealer_state: "KS",
  vin: "1HGCM82633A004352", vehicle_trim: "LE", vehicle_exterior_color: "Ice Cap", vehicle_interior_color: "Black Fabric",
  vehicle_model_year: 2026, offer_price_cents: 2810000, msrp_cents: 3089500,
  good_until: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10), note_to_customer: "Test note",
  delivery_estimate_status: "requested",
  addons: [{ description: "Nitrogen", amount_cents: 19900, dealer_says_removable: true }], addons_none_confirmed: false,
  fees: [{ kind: "doc_fee", amount_cents: 39900 }, { kind: "title_registration", amount_cents: 24400 }], other_fees_none_confirmed: true,
  options: [{ name: "Cold Weather Package", customer_asked_for: true, on_the_car: true },
            { name: "Mudguards", customer_asked_for: false, on_the_car: true, sticker_price_cents: 14900, install_kind: "port" }],
  trim_match_confirmed: true, tax_paid_at_registration: false, warnings_confirmed: [],
});
const offerCount = async () => (await a.from("qualifying_offers").select("id", { count: "exact", head: true }).eq("customer_search_id", searchId)).count;

try {
  const u = must(await a.auth.admin.createUser({ email: `${tag}@levrauto-test.invalid`, email_confirm: true }), "customer").user;
  userId = u.id;
  must(await a.from("customers").update({ first_name: "Oethree", last_name: "Test" }).eq("id", userId), "name");
  searchId = must(await a.from("customer_searches").insert({
    customer_id: userId, zip: "66213", make: "Toyota", model: "Camry", model_year: 2026, trim: "LE",
    search_status: "searching", paid_at: new Date().toISOString(),
  }).select("id").single(), "search").id;

  // 1-2. Drafts never reach the customer; saving again updates the same draft.
  const d1 = await S.saveOfferDraftFor(padmin.id, searchId, null, { dealer_name: DEALER, offer_price_cents: 2810000 });
  ok("save draft creates an agent draft", d1.ok);
  const d2 = await S.saveOfferDraftFor(padmin.id, searchId, d1.submissionId, { ...base(), offer_price_cents: 2800000 });
  const sub = (await a.from("offer_submissions").select("submission_status, submission_source, working_payload").eq("id", d1.submissionId).single()).data;
  ok("saving again updates the same draft", d2.ok && d2.submissionId === d1.submissionId && sub.working_payload.offer_price_cents === 2800000 && sub.submission_status === "draft");
  ok("a draft is never an offer the customer can see", (await offerCount()) === 0);

  // 3-6. Refusals before anything is written.
  let r = await S.sendOfferFor(padmin.id, searchId, d1.submissionId, { ...base(), offer_price_cents: 3089500 });
  ok("price at the sticker without the tick is refused, with the warning listed",
     !r.ok && r.code === "warnings_unconfirmed" && r.warnings.map((w) => w.code).join() === "above_sticker", JSON.stringify(r));
  r = await S.sendOfferFor(padmin.id, searchId, d1.submissionId, { ...base(), vin: "1HGCM82643A004352" });
  ok("a VIN with a wrong check digit is refused", !r.ok && r.code === "vin_invalid", r.code);
  r = await S.sendOfferFor(padmin.id, searchId, d1.submissionId, { ...base(), otd_source: "dealer_quote", otd_total_cents: 2800000 });
  ok("an out-the-door total that doesn't match the lines is refused", !r.ok && r.code === "otd_mismatch", r.code);
  r = await S.sendOfferFor(padmin.id, searchId, d1.submissionId, { ...base(), trim_match_confirmed: false });
  ok("trim not confirmed is refused (by the database function)", !r.ok && r.code === "trim_not_confirmed", r.code);
  ok("still no offer after the refusals", (await offerCount()) === 0);

  // 7. A good send: everything at once.
  r = await S.sendOfferFor(padmin.id, searchId, d1.submissionId, base());
  ok("a good send", r.ok, JSON.stringify(r));
  const offer1 = r.offerId;
  const q = (await a.from("qualifying_offers").select("offer_source, offer_submission_id, sent_by_agent_id, otd_requested_at, delivered_at, is_below_msrp, dealer_alias_id, delivery_estimate_status").eq("id", offer1).single()).data;
  ok("the offer: sent by the agent, linked to its submission, out-the-door requested, not yet delivered, counts toward the guarantee",
     q.offer_source === "agent" && q.offer_submission_id === d1.submissionId && q.sent_by_agent_id === padmin.id && q.otd_requested_at && !q.delivered_at && q.is_below_msrp && q.delivery_estimate_status === "requested");
  ok("the dealer was resolved to an alias", !!q.dealer_alias_id);
  const counts = await Promise.all(["offer_addons", "offer_fees", "offer_vehicle_options"].map(async (t) =>
    (await a.from(t).select("id", { count: "exact", head: true }).eq("qualifying_offer_id", offer1)).count));
  ok("add-ons, fees and options written with it", counts.join("/") === "1/2/2", counts.join("/"));
  ok("result says out-the-door is missing and names the customer", r.otdMissing === true && r.customerFirstName === "Oethree");
  const note = (await a.from("notification_events").select("id", { count: "exact", head: true }).eq("customer_search_id", searchId).eq("event_type", "offer_logged")).count;
  ok("the new-offer notification was logged after the send", note === 1, String(note));
  const acts = (await a.from("agent_activity_log").select("action").eq("search_id", searchId).eq("agent_id", padmin.id)).data.map((x) => x.action).sort();
  ok("activity: two draft saves and one offer_sent", acts.join() === "offer_draft_saved,offer_draft_saved,offer_sent", acts.join());

  r = await S.sendOfferFor(padmin.id, searchId, d1.submissionId, base());
  ok("sending the same submission twice is refused", !r.ok && r.code === "submission_not_sendable", r.code);

  // 8. A second offer for the same car and dealer: both duplicate warnings, then ticked.
  r = await S.sendOfferFor(padmin.id, searchId, null, base());
  ok("same VIN and dealer: both duplicate warnings, nothing sent",
     !r.ok && r.code === "warnings_unconfirmed" && r.warnings.map((w) => w.code).join() === "duplicate_vin,duplicate_dealer" && (await offerCount()) === 1,
     JSON.stringify(r.warnings?.map((w) => w.code)));
  r = await S.sendOfferFor(padmin.id, searchId, null, { ...base(), warnings_confirmed: ["duplicate_vin", "duplicate_dealer", "inactive_search"] });
  const w2 = r.ok ? (await a.from("qualifying_offers").select("warnings_confirmed, warnings_confirmed_by_agent_id").eq("id", r.offerId).single()).data : null;
  ok("ticked: sent, storing only the warnings that applied",
     r.ok && w2.warnings_confirmed.join() === "duplicate_vin,duplicate_dealer" && w2.warnings_confirmed_by_agent_id === padmin.id, JSON.stringify(w2));

  // 9. An inactive search.
  must(await a.from("customer_searches").update({ search_status: "paused" }).eq("id", searchId), "pause");
  r = await S.sendOfferFor(padmin.id, searchId, null, { ...base(), vin: null, dealer_name: DEALER + " B" });
  ok("a paused search is refused without the tick", !r.ok && r.code === "warnings_unconfirmed" && r.warnings.map((w) => w.code).join() === "inactive_search");
  must(await a.from("customer_searches").update({ search_status: "searching" }).eq("id", searchId), "unpause");

  // 10. Discard.
  r = await S.discardSubmissionFor(padmin.id, d1.submissionId, "test");
  ok("an agent's own submission can't be discarded", !r.ok && r.code === "discard_only_dealer", r.code);
  const dealerSub = must(await a.from("offer_submissions").insert({
    customer_search_id: searchId, submission_source: "dealer_link", submission_status: "awaiting_review",
    submitted_payload: { from: "dealer" }, working_payload: { from: "dealer" }, submitted_at: new Date().toISOString(),
  }).select("id").single(), "dealer submission").id;
  r = await S.discardSubmissionFor(padmin.id, dealerSub, "   ");
  ok("discarding needs a reason", !r.ok && r.code === "discard_reason_needed");
  r = await S.discardSubmissionFor(padmin.id, dealerSub, "Duplicate of an offer already sent");
  const ds = (await a.from("offer_submissions").select("submission_status, discard_reason, reviewed_by_agent_id, submitted_payload").eq("id", dealerSub).single()).data;
  ok("a dealer submission is discarded with its reason; the dealer's original is untouched",
     r.ok && ds.submission_status === "discarded" && ds.discard_reason === "Duplicate of an offer already sent" && ds.reviewed_by_agent_id === padmin.id && ds.submitted_payload.from === "dealer");
  r = await S.sendOfferFor(padmin.id, searchId, dealerSub, base());
  ok("a discarded submission can't be sent", !r.ok && r.code === "submission_not_sendable", r.code);
} catch (e) {
  fail++; console.log("FAIL  run stopped:", e.message);
} finally {
  // Cleanup: activity rows on the search, notification events, dealer aliases this run created,
  // then the search (offers, lines and submissions cascade) and the login (customer cascades).
  if (searchId) {
    const offerIds = ((await a.from("qualifying_offers").select("id").eq("customer_search_id", searchId)).data ?? []).map((o) => o.id);
    must(await a.from("agent_activity_log").delete().eq("search_id", searchId), "activity cleanup");
    if (offerIds.length) must(await a.from("agent_activity_log").delete().in("qualifying_offer_id", offerIds), "activity cleanup (offers)");
    must(await a.from("notification_events").delete().eq("customer_search_id", searchId), "notifications cleanup");
    must(await a.from("customer_searches").delete().eq("id", searchId), "search cleanup");
  }
  must(await a.from("dealer_aliases").delete().like("dealer_name", `${DEALER}%`), "alias cleanup");
  if (userId) must(await a.auth.admin.deleteUser(userId), "login cleanup");
  const left = await Promise.all([
    a.from("customer_searches").select("id", { count: "exact", head: true }).eq("id", searchId ?? "00000000-0000-0000-0000-000000000000"),
    a.from("offer_submissions").select("id", { count: "exact", head: true }).eq("customer_search_id", searchId ?? "00000000-0000-0000-0000-000000000000"),
    a.from("qualifying_offers").select("id", { count: "exact", head: true }).eq("dealer_name", DEALER),
    a.from("dealer_aliases").select("id", { count: "exact", head: true }).like("dealer_name", `${DEALER}%`),
    a.from("agent_activity_log").select("id", { count: "exact", head: true }).eq("search_id", searchId ?? "00000000-0000-0000-0000-000000000000"),
    a.from("customers").select("id", { count: "exact", head: true }).eq("id", userId ?? "00000000-0000-0000-0000-000000000000"),
  ]);
  const leftCounts = left.map((x) => x.count);
  ok("cleanup: search, submissions, offers, aliases, activity rows, customer all 0", leftCounts.every((n) => n === 0), leftCounts.join("/"));
  const b1 = await cnt(brett.id);
  ok("Brett's activity count unchanged", b1 === b0, `${b0} -> ${b1}`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
