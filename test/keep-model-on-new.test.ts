import assert from "node:assert/strict";
import { test } from "node:test";

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import extension from "../src/keep-model-on-new.ts";

type ActiveModel = NonNullable<ExtensionContext["model"]>;
type SwitchEvent = { type: "session_before_switch"; reason: "new" | "resume" };
type StartEvent = { type: "session_start"; reason: "startup" | "reload" | "new" | "resume" | "fork" };
type Event = SwitchEvent | StartEvent;

const model = (id: string): ActiveModel => ({ provider: "test", id }) as ActiveModel;
const ctxWith = (active: ActiveModel): ExtensionContext => ({ model: active } as ExtensionContext);

/**
 * Loads a fresh instance by calling the factory again — exactly what a new
 * runtime does on `/new` and `/reload`. The two instances share module scope
 * but not their closures, which is the distinction these tests pin. A
 * closure-scoped carry passes every test below except the first.
 */
function load() {
  const handlers: Record<string, (event: Event, ctx: ExtensionContext) => unknown> = {};
  const setModels: ActiveModel[] = [];
  extension({
    on: (event: string, handler: (event: Event, ctx: ExtensionContext) => unknown) => {
      handlers[event] = handler;
    },
    setModel: async (m: ActiveModel) => {
      setModels.push(m);
      return true;
    },
  } as unknown as ExtensionAPI);

  return {
    setModels,
    emit: async (event: Event, ctx: ExtensionContext) => {
      await handlers[event.type]?.(event, ctx);
    },
  };
}

test("/new carries the outgoing model into the session built by a fresh runtime", async () => {
  const outgoing = load();
  await outgoing.emit({ type: "session_before_switch", reason: "new" }, ctxWith(model("chosen")));

  // `/new` re-invokes the factory; a closure-scoped carry would be lost here.
  const incoming = load();
  await incoming.emit({ type: "session_start", reason: "new" }, ctxWith(model("default")));

  assert.deepEqual(
    incoming.setModels.map((m) => m.id),
    ["chosen"],
  );
});

test("resume does not carry", async () => {
  const outgoing = load();
  await outgoing.emit({ type: "session_before_switch", reason: "resume" }, ctxWith(model("chosen")));

  const incoming = load();
  await incoming.emit({ type: "session_start", reason: "new" }, ctxWith(model("default")));

  assert.deepEqual(incoming.setModels, []);
});

test("a plain startup or reload never switches the model", async () => {
  const instance = load();
  await instance.emit({ type: "session_start", reason: "startup" }, ctxWith(model("startup-model")));
  await instance.emit({ type: "session_start", reason: "reload" }, ctxWith(model("startup-model")));

  assert.deepEqual(instance.setModels, []);
});

test("the carry is consumed, so a second session_start does not replay it", async () => {
  const outgoing = load();
  await outgoing.emit({ type: "session_before_switch", reason: "new" }, ctxWith(model("first")));

  const incoming = load();
  await incoming.emit({ type: "session_start", reason: "new" }, ctxWith(model("default")));
  await incoming.emit({ type: "session_start", reason: "new" }, ctxWith(model("default")));

  assert.deepEqual(
    incoming.setModels.map((m) => m.id),
    ["first"],
  );
});
