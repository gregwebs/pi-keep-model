/**
 * Carry the active model across `/new`.
 *
 * `/new` resolves its model from scratch — CLI args, scoped models, the saved
 * settings default, then first available — so a model chosen earlier in the
 * session (by `/model`, or by another extension) is silently dropped. This
 * makes the new session start on whatever the outgoing one was using.
 *
 * The carry is captured in `session_before_switch`, which runs on the *old*
 * session before teardown, and applied in `session_start` on the new one. Both
 * handlers must share a variable that outlives the switch, and that is why it
 * lives at module scope rather than in the factory: `/new` builds a fresh
 * runtime, which re-invokes every extension factory, so a per-instance closure
 * set on the way out is gone by the time the new session starts. The module
 * itself is not re-evaluated for a same-directory session swap, so module scope
 * is the narrowest scope that bridges the two events.
 *
 * The state is deliberately per process and in memory: persisting a "last
 * model" to disk would let one pi instance overwrite the model another is
 * legitimately running. `/reload` needs nothing carried — it keeps the session's
 * model and does not switch sessions — and the carry is captured fresh at the
 * next `/new` regardless.
 */
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

let carried: ExtensionContext["model"];

export default function (pi: ExtensionAPI) {
  pi.on("session_before_switch", (event, ctx) => {
    // Only `/new` needs this; resume and fork restore their own model.
    if (event.reason === "new") carried = ctx.model;
  });

  pi.on("session_start", async (event) => {
    if (event.reason !== "new" || !carried) return;
    const model = carried;
    // Consume it so a later plain startup cannot reapply a stale model.
    carried = undefined;
    await pi.setModel(model);
  });
}
