# Chat recognition explanations — 2026-10-10

Tapping the supporter heart or a previous-season podium cup must open a compact
explanation above the icon and close it automatically after two seconds.

The server already supplies independent `supporter` and `previousSeasonRank`
facts to General, Clan and DM. Keep that recognition and its border precedence.
Supporter copy explains support for Astera Online; podium copy names the exact
previous-season place, never the current ladder.

Use real buttons with the existing icon size, a larger transparent touch area,
keyboard activation and a linked, politely announced tooltip. Render the tooltip
outside the scrolling log so it is not clipped, keep it within the viewport and
match the badge's color with the existing v2 surface tokens.

Required cases: each of places 1/2/3, supporter and podium on the same author,
two-second boundary, repeat taps resetting the timer, switching badges leaving
only one explanation, keyboard/Escape, outside press, scrolling/resizing and
unmount cleanup. Badge presses must not focus a planet, open reply/reaction
actions or submit the composer. Preserve channel/history behavior and all six
supported languages. Ordinary unrecognized messages get no badge or tooltip.

Touch points: `ChatScreen.tsx`, its regression tests, localized chat strings,
interface documentation and the visual verification harness. No API, server,
identity rule or reward change is needed. Write red interaction tests first,
then implement and check at 350px and desktop widths.

## Verification

- The initial interaction suite failed all 17 new cases before implementation.
  The targeted chat, host, type-scale and translation suites then passed all 168
  cases. A further Escape regression failed before consuming the key event;
  chat and host tests now pass all 81 cases and Escape leaves the chat open.
- `node tools/visual.mjs out/chat-recognition --chat-recognition` passed in
  Chromium at 350px and 1280px, in Turkish and English. All five badge examples
  stayed above their buttons and inside the viewport, with one tooltip at a time.
  Automatic close and keyboard activation/dismissal passed without closing the
  sheet, focusing a planet or reporting browser errors. Screenshots were inspected.
