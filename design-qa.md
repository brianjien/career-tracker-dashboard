# SaaS Experience Refresh QA

- Source evidence:
  - `/var/folders/sb/y1lyt_h97b973k4rywjbw40c0000gn/T/codex-clipboard-67029549-49f3-4d0d-ad42-5ef8fb923bd5.png`
  - `/var/folders/sb/y1lyt_h97b973k4rywjbw40c0000gn/T/codex-clipboard-0179ce53-6a00-4319-bd2f-3ad8a9a1075d.png`
- Implementation evidence:
  - `qa-artifacts/saas-landing-desktop.png`
  - `qa-artifacts/saas-landing-mobile.png`
  - `qa-artifacts/saas-search-desktop.png`
  - `qa-artifacts/saas-mobile-search.png`
- Verified viewports: default desktop and 390 x 844 mobile.
- Verified states: public start page, sign-in and registration dialogs, expanded and collapsed sidebar, expanded and collapsed search filters, and F-1 review queue.

## Findings

- No actionable P0, P1, or P2 visual issues remain.
- The public start page exposes the product before authentication and leaves the next content band visible in the first viewport.
- The desktop sidebar transitions between 220px and 78px without page overflow; icon labels remain available through accessible names and native titles.
- Search controls stay on one row on mobile, while the expanded filter panel stacks into a readable single column.
- The F-1 review queue excludes known no-sponsorship and citizenship restrictions. OPT, CPT, and sponsorship filters remain strict evidence filters and may correctly return zero results when sources do not state those terms.
- Registration and Google sign-in controls fit within the mobile bottom sheet without horizontal scrolling.
- Desktop and mobile document widths equal their viewport client widths; no body-level horizontal overflow was observed.
- Browser console inspection found no new errors or warnings on the public start page.

## Patches Made During QA

- Reduced the mobile hero and product preview so the workflow section is visible in the first viewport.
- Corrected Google button sizing inside the mobile registration sheet.
- Removed sidebar brand wrapping at the 220px desktop breakpoint.
- Kept the mobile live-search field and filter button on the same row.
- Added local-storage fallbacks for browsers that block sidebar preference persistence.

final result: passed
