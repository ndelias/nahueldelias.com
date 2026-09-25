# Homepage reference

Standalone version of `docs/design/Main.dc.html` that opens in any browser with no runtime (the `.dc.html` mocks need the Design canvas's `support.js`, which isn't a public file).

- `home.html`: same tokens, sizes, easing, timings and behavior as the canvas mock, including the looping strip, the (Index) view and arrow keys.
- `fonts/`: Instrument Sans 400/500 and DM Mono 400, Latin subset, from @fontsource (OFL).
- `screens/`: baseline screenshots at 1440×900 for Playwright comparisons.

URL options: `?theme=dark`, `?view=index`, `?active=0..7`, `?still=1` (freezes the video sheen and progress bar so screenshots are stable).

This is a design reference at a fixed 1440px frame. Port the values and behavior, not the markup. There's no phone layout yet.
