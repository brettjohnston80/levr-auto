// A customer's reset link used at /agent/accept: refused, this browser signed out, the customer's
// other session untouched (signOut scope "local").
import puppeteer from "puppeteer-core"; import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { createAdminClient } from "../lib/admin.mjs";
const a = createAdminClient(); const NEW = "http://localhost:3100"; const ts = Date.now(); const email = `claude-verify-${ts}-cust@levrauto-test.invalid`, pw = `Cust!${ts}aA`;
let pass = 0, fail = 0; const ok = (n, c, d = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, protocolTimeout: 300000, userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), "acc-")) });
const at = (p) => new URL(p.url()).pathname;
async function page() { const c = await browser.createBrowserContext(); const p = await c.newPage(); p.setDefaultTimeout(240000); return p; }
async function go(p, u) { await p.goto(u, { waitUntil: "domcontentloaded", timeout: 300000 }); await p.waitForNetworkIdle({ idleTime: 800, timeout: 120000 }).catch(() => {}); }
let uid;
try {
  const { data: u, error } = await a.auth.admin.createUser({ email, email_confirm: true, password: pw }); if (error) throw error; uid = u.user.id;
  const other = await page(); await go(other, NEW + "/login"); await other.type('input[name="email"]', email); await other.type('input[name="password"]', pw);
  await other.click('form:has(input[name="password"]) button[type="submit"]'); await other.waitForFunction(() => location.pathname !== "/login", { timeout: 240000 }).catch(() => {});
  ok("customer signed in on another device", at(other) === "/account", at(other));
  const { data: gl } = await a.auth.admin.generateLink({ type: "recovery", email });
  const q = await page(); await go(q, `${NEW}/agent/accept?token_hash=${gl.properties.hashed_token}&purpose=reset`);
  await q.click('form button[type="submit"]'); await q.waitForFunction(() => !!document.querySelector('[role="alert"]'), { timeout: 240000 }).catch(() => {});
  ok("customer's link at /agent/accept → refused", (await q.evaluate(() => document.querySelector('[role="alert"]')?.textContent)) === "This link has expired or has already been used.");
  await go(q, NEW + "/account"); ok("…that browser is signed out", at(q) === "/login", at(q));
  await go(other, NEW + "/account"); ok("…the customer's other session is untouched", at(other) === "/account", at(other));
} catch (e) { fail++; console.log("ERROR", e.stack ?? e); }
finally { await browser.close(); if (uid) await a.auth.admin.deleteUser(uid); await a.from("customers").delete().eq("email", email);
  const left = (await a.from("customers").select("id", { count: "exact", head: true }).eq("email", email)).count; console.log(`CLEANUP: customer rows ${left}`); if (left) fail++;
  console.log(`${pass} passed, ${fail} failed`); }
