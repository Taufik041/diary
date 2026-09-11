# Diary

A private digital diary. Pages look like a pastel scrapbook — handwriting,
tilted photos, washi tape — and are fully editable on desktop and phone.
Next.js (App Router), Neon Postgres, Cloudinary, deployed on Vercel. Single
admin, no signup, no ORM. See `SPEC.md` for the build spec.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in the six variables.
   Generate `AUTH_SECRET` with `openssl rand -hex 32`.
3. `npm run dev`
4. Open `/admin`, sign in with `ADMIN_PASSWORD`, press **Set up database**.
   That creates the tables and seeds a diary with its first spread.

## How it fits together

- **Every page is an 800 × 1100 coordinate space**, scaled to fit with one CSS
  transform. Layout never reflows; a saved page looks identical at any size.
- **The whole site is private.** `/` and `/admin` render the sign-in screen
  without a valid admin cookie (HMAC-signed with `AUTH_SECRET`, 30 days).
  Every `/api/admin/*` handler checks it too.
- **Autosave**: each page's `elements` jsonb is saved ~800ms after the last
  change (`PUT /api/admin/pages/:id`), with retry and a flush when the tab is
  hidden. There is no save button.
- **Photos** are resized in the browser (longest side 2000px, JPEG), then
  uploaded direct to Cloudinary with a server-issued signature. The API
  secret is only read by `/api/admin/upload-sign`.

## Database layout

Both tables live in a dedicated **`diary` schema**, not `public`, so the
database can be shared with other projects. To remove everything:
`DROP SCHEMA diary CASCADE;`

## Environment

| variable | purpose |
| --- | --- |
| `DATABASE_URL` | Neon pooled connection string |
| `ADMIN_PASSWORD` | the sign-in password |
| `AUTH_SECRET` | HMAC key for the admin cookie |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | signed direct uploads |

## Notes

`Diary app design system/` holds the Claude Design reference (`.dc.html` plus
`support.js`). It is source material only — nothing in `app/` imports from it.
