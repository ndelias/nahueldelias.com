# Homepage reference

Standalone version of `docs/design/Main.dc.html` that opens in any browser with no runtime (the `.dc.html` mocks need the Design canvas's `support.js`, which isn't a public file).

- `home.html`: same tokens, sizes, easing, timings and behavior as the canvas mock, including the looping strip, the (Index) view and arrow keys.
- `fonts/`: Instrument Sans 400/500 and DM Mono 400, Latin subset, from @fontsource (OFL).
- `screens/`: baseline screenshots at 1440×900 for Playwright comparisons, captured from `home.html` over HTTP in CI (see below).

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

The same job compares the built homepage, with JS off (the full no-JS page), against the two (Index) baselines, allowing 0.5% of pixels to differ:

```sh
node scripts/screens.mjs compare .screens/compare   # --strict to exit 1 when over
```

Run locally, both commands work but won't match CI: macOS renders text with subpixel antialiasing, which alone puts about 1.3% of pixels out.

