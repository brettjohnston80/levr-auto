// Real service-role client, except rpc("add_agent") is captured and refused, so nothing is written.
import { createAdminClient as real } from "../lib/admin.mjs";
export const captured = [];
export const createAdminClient = () => {
  const c = real();
  const rpc = c.rpc.bind(c);
  c.rpc = (fn, args) => fn === "add_agent"
    ? (captured.push(args), Promise.resolve({ data: null, error: { message: "captured by test, not run" } }))
    : rpc(fn, args);
  return c;
};
