# pi-keep-model

Keep the active [pi](https://github.com/earendil-works/pi) model across `/new`.

`/new` resolves a new session's model from scratch — CLI args, scoped models, the saved settings
default, then first available — so a model you picked earlier in the session (with `/model`, or via
another extension that switched it) is dropped the moment you start a fresh session. This extension
makes `/new` start on whatever the outgoing session was using.

## Install

From GitHub:

```sh
pi install git:github.com/gregwebs/pi-keep-model
```

Pin a tag or commit for a stable version:

```sh
pi install git:github.com/gregwebs/pi-keep-model@v0.1.0
```

For a one-off trial without adding it to settings:

```sh
pi -e git:github.com/gregwebs/pi-keep-model
```

## How it works

Two pi events bracket a session switch:

- `session_before_switch` (`reason: "new"`) fires on the **old** session before teardown, so
  `ctx.model` is the model you were just on. The extension records it.
- `session_start` (`reason: "new"`) fires on the **new** session after its runtime is built. The
  extension calls `pi.setModel(...)` with the recorded model, then clears it.

The recorded value lives at **module scope**, not in the factory closure, and that is the load-
bearing detail. `/new` builds a fresh runtime, which re-invokes every extension factory; a variable
captured in the factory on the way out is gone by the time the new session starts. The extension
module itself is not re-evaluated for a same-directory session swap, so module scope is the
narrowest scope that survives the switch.

The record is consumed on use, so a later plain startup cannot replay a stale model. `resume` and
`fork` are deliberately ignored — they restore their own model from the transcript.

## Limitations

- **Per process, in memory.** Nothing is written to disk. This is on purpose: a shared "last model"
  file would let one pi process overwrite the model another is legitimately running. `/reload` needs
  nothing carried (it keeps the session's model and does not switch sessions); the carry is captured
  fresh at the next `/new`.
- **Session scope.** The model is kept only for the current pi process. A brand-new session started
  after restarting pi still uses the configured default, because this extension never changes your
  saved default — use `/model` and press `ctrl+s` for that.

## Development

```sh
npm install
npm test        # node --test (type stripping; needs Node >= 22.18)
npm run typecheck
```

CI runs both on Node 22.18 and 24 — see [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

## License

Apache-2.0
