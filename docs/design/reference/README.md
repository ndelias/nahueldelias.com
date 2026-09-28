# Homepage reference

Standalone version of `docs/design/Main.dc.html` that opens in any browser with no runtime (the `.dc.html` mocks need the Design canvas's `support.js`, which isn't a public file).

- `home.html`: same tokens, sizes, easing, timings and behavior as the canvas mock, including the looping strip, the (Index) view and arrow keys.
- `fonts/`: Instrument Sans 400/500 and DM Mono 400, Latin subset, from @fontsource (OFL).
- `screens/`: screenshots of this mock at 1440×900, for the per-region report, captured from `home.html` over HTTP in CI (see below).

URL options: `?theme=dark`, `?view=index`, `?active=0..7`, `?still=1` (freezes the video sheen and progress bar so screenshots are stable).

This is a design reference at a fixed 1440px frame. Port the values and behavior, not the markup. There's no phone layout yet.

## Baselines and comparisons

Baselines are captured in the same environment the comparisons run in: the `screens` job in CI (ubuntu-latest, the runner's Google Chrome, 1440×900 at 1x), which serves this folder over HTTP and runs:

```sh
node scripts/screens.mjs capture .screens/captured
```

Every CI run captures them again, reports whether they still match the committed files byte for byte, and uploads them as the `reference-screens` artifact. To refresh the baselines (for example, after changing `home.html`), download that artifact from the run and commit it:

```sh
gh run download <run-id> -n reference-screens -D docs/design/reference/screens
```

The same job compares the built homepage against these screenshots, per region (header, list or meta, preview or strip, footer). That's a report, not a gate: the page differs from the mock on purpose in places. It lands in the job summary and as a comment on the PR:

```sh
node scripts/screens.mjs mock .screens/mock
```

The gate is the site's own baselines in `tests/screens/` (`/` at 1440×900 and 390×844, both themes, both views), captured in the same job. Any shot that differs from its baseline by more than 0.5% fails CI. When a change is intended, push, then regenerate them from that CI run and commit them, so the change shows in the PR diff:

```sh
npm run screens:update
```

Run locally, the commands work but won't match CI: macOS renders text with subpixel antialiasing, which alone puts about 1.3% of pixels out.
