# Admin online total

Owner request, 2026-10-12: show the number of players in the admin Players list.
The list currently represents human commanders active within the last five minutes
across all galaxies and loads in pages. The total must use that same scope, without
requiring every page to load. Cursor and page size must not reduce the total.

Add the aggregate to the existing read-only repeatable-read transaction and expose
it through the client API schema. Show it next to the existing section heading;
preserve a measured zero, omit an unavailable count, and update on refresh. Do not
change moderation actions, activity windows, list order or game rules.

Coverage: full total on partial pages, across galaxies and beyond the final cursor;
offline and bot exclusions; exact activity cutoff; empty result; refresh and request
failure; actual server response parsed through the client schema. Check the real
component at 350px and desktop widths in Turkish and English.
An older API without the additive total field still renders its list; the client
omits the unknown total rather than presenting a loaded page as the whole count.

The additional galaxy HUD request only emphasizes the numeric daily activity value
with bold, brighter text. The 24-hour scope and surrounding copy remain the same.
