# Digital Diary — Build Spec

A private digital diary / journaling web app. Pages look like a real pastel
scrapbook: handwriting, tilted photos, washi tape, paper texture. Fully
editable on both desktop and phone.

Design reference: `Diary.dc.html` (static mockup — extract tokens from it,
do not copy its markup into the app).

---

## Stack

- Next.js (App Router), TypeScript
- Neon Postgres
- Cloudinary for media — server-signed uploads, direct from browser
- Deployed on Vercel
- Admin gated by `ADMIN_PASSWORD` + HMAC-signed cookie (`AUTH_SECRET`)

All free tier. Same shape as my existing projects.

---

## Core architectural decision

**The page is a fixed coordinate space of 800 × 1100.** Every element is
positioned absolutely in those coordinates. The whole page is scaled to fit
the viewport with a single CSS transform.

Layout does **not** reflow responsively. This is deliberate. Do not attempt
flexbox/grid reflow of page content — a saved layout must look identical at
every screen size, only smaller.

Desktop renders two pages side by side as a spread with a gutter shadow.
Mobile renders one page at a time. Pages are stored individually either way.

---

## Data model

```
Diary
  id, title, created_at

Page
  id, diary_id, index, background (enum), elements (jsonb)

Element (inside the jsonb array)
  id
  type: 'photo' | 'text' | 'tape' | 'clip'
  x, y, w, h          // in 800x1100 page coordinates
  rotation            // degrees, float
  z                   // layer order

  // type: 'photo'
  src                 // cloudinary url
  frame: 'polaroid' | 'thin' | 'rounded'
  caption?            // polaroid only

  // type: 'text'
  content
  style: 'plain' | 'card'
  fontFamily: 'caveat' | 'cormorant' | 'mono'
  fontSize, color, align

  // type: 'tape'
  variant             // index into the tape preset list

  // type: 'clip'
  (no extra fields)
```

Get this right first. The renderer and editor both sit on top of it, and
changing it later means rebuilding everything above.

---

## Build order

1. **Element data model + read-only renderer.** A saved page renders
   correctly at any viewport size. No editing at all yet.
2. **Selection and direct manipulation.** One finger / mouse drag to move.
   Two fingers pinch to resize and rotate. Snapping guides.
3. **Bottom sheet (mobile) / side panel (desktop)** with per-element controls.
4. **Full-screen text editor.**
5. **Cloudinary upload with client-side image resize.**
6. **Page navigation, add / duplicate / delete page, thumbnail grid.**
7. Undo/redo.

Step 1 is the unglamorous one and the one that must not be rushed.

---

## Interaction model

Use `react-moveable` + `react-selecto`. They handle touch natively.

**Coarse placement is direct manipulation. Anything precise goes through the
sheet.** Drag to roughly position, then use the sheet for exact values.

- `touch-action: none` on the canvas.
- One finger on a selected element drags it. Two fingers pan/zoom the page.
- Touch targets minimum 44px.
- Snapping: centre lines, page edges, and other elements' edges. This matters
  much more on touch than on desktop — it compensates for finger imprecision.
- New elements drop in at a random rotation between -3° and +3°.

**Text editing never happens inline.** Tapping a text element opens a
full-screen editor: large textarea at top, font/size/colour/align controls
below, Done button. The canvas is not visible. This sidesteps the on-screen
keyboard covering the element entirely — do not attempt an inline
`contentEditable` on the canvas with a visualViewport workaround.

Sheet controls per element: typeface, size, colour, alignment, rotation
slider, layer up/down, duplicate, delete, and nudge buttons for pixel-level
positioning.

---

## Design tokens

```css
--ground:      #EFE6D9;  /* app background around the book */
--page:        #F7E7E7;  /* page blush */
--page-alt:    #FBF6EE;  /* cream page variant */
--card:        #F6E5E5;  /* note-card ground */
--cover:       #A99C90;  /* book cover greige */
--cover-edge:  #DFD2C2;

--ink:         #6B534A;  /* primary text — never pure black */
--ink-soft:    #8C766B;  /* secondary text */
--ink-faint:   #A2907F;  /* captions, mono labels */

--accent:      #94A98E;  /* sage — used sparingly */
--accent-soft: #A9BCA2;
--accent-tint: #E9EFE6;
--rose:        #D9C4C4;
--rose-deep:   #B98A8A;
```

Paper fibre texture (no image asset needed):

```css
--fibre: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='f'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23f)'/%3E%3C/svg%3E");
/* background-size: 160px 160px */
```

### Typography

- **Body / handwriting:** Caveat, weights 400–600. Generous line height,
  slightly loose letter spacing.
- **Headings & chrome:** Cormorant Garamond, italic, weights 300–600.
- **UI micro-labels:** IBM Plex Mono, 11–12px, letter-spacing `.09em`–`.16em`,
  uppercase. Used for things like `12 PAGES · SEPT 2026`, `86 / 400`,
  `TYPEFACE`.

Load via `next/font`. Do not add further families.

### Shadows

Always brown-tinted, never black. Two layers — close contact shadow plus
diffuse ambient:

```css
--shadow-sm:  0 1px 4px rgba(107,83,74,.18);
--shadow-el:  0 2px 5px rgba(107,83,74,.16), 0 10px 22px rgba(107,83,74,.10);
--shadow-md:  0 2px 6px rgba(107,83,74,.18), 0 12px 26px rgba(107,83,74,.10);
--shadow-lg:  0 4px 12px rgba(107,83,74,.16), 0 24px 50px rgba(107,83,74,.14);
```

Every element on the page casts one. That is what makes items read as
physical objects resting on paper rather than pasted images.

### Rotation

Nothing is perfectly straight. Observed range in the design: 0.3° to 3.4°,
both directions. Even the app chrome sits at about -0.4°.

---

## Element presets

**Photo frames**
- `polaroid` — white border, noticeably thicker at the bottom, optional
  handwritten caption in that lower band
- `thin` — narrow white border
- `rounded` — rounded corners, no border

**Text styles**
- `plain` — handwriting straight onto the page, no background
- `card` — pale ground with a hairline border, like a note tucked in

**Tape** — semi-transparent strips, rotated, rendered *above* whatever they
are taping. Diagonal stripe:
```css
background: repeating-linear-gradient(45deg, #E4D7CD 0 10px, #D8CBC0 10px 20px);
```
Gingham:
```css
background:
  repeating-linear-gradient(0deg,  rgba(199,168,168,.42) 0 10px, transparent 10px 20px),
  repeating-linear-gradient(90deg, rgba(199,168,168,.42) 0 10px, transparent 10px 20px),
  rgba(253,247,244,.55);
```
Provide ~6 variants across stripe widths and the rose/greige/sage tints.

**Clip** — a single SVG paperclip, sits over the page edge.

---

## Out of scope for v1

- Illustrated stickers (teddy bears, lamps, etc). The design must hold up on
  photos, type and tape alone. Stickers slot in later as just another element
  type — transparent PNG, tilt, shadow — with no data model change.
- Pen / freehand drawing.
- PDF export.
- Multi-user accounts. Single admin, gated site.
- Page-flip animation. Simple transition for now.

---

## Notes

- Resize images client-side before upload. Phone photos are 4–8MB and there
  will be a lot of them.
- Autosave, debounced. No explicit save button.
- The empty-page state needs designing before it gets built — it is the first
  thing seen on every new page and must not be a dashed grey rectangle.
