# Lumina

AI video ad generator. Drop a product still, approve a 15–30 second script, then produce a vertical MP4: picture, voice, and composite.

## Architecture

- `/app/(marketing)` — conversion landing (hero, how it works, pricing, FAQ)
- `/app/(app)` — protected dashboard, create, billing, generation results (redirects to `/login` if signed out)
- `/app/(app)/generations/[id]` — video player, download, script, and live progress
- `/app/(auth)/login` — Google OAuth and email magic link
- `/app/(auth)/callback` — OAuth / magic-link code exchange
- `/app/api` — generate-script, generate-video, generate-voiceover, composite, Stripe webhook
- `/lib/pipeline` — script, video, voice, composite
- `/lib/supabase/server.ts` — `createServerClient` (`@supabase/ssr`)
- `/lib/supabase/client.ts` — `createBrowserClient`
- `/lib/supabase/schema.sql` — Postgres tables, signup trigger, RLS
- `/lib/stripe/client.ts` — Stripe server SDK (test secret key)
- `/lib/stripe` — checkout, customer, price catalogs
- `/types/database.ts` — Supabase schema types
- `/types/pipeline.ts` — generation job types

Stack: Next.js 15 (App Router), TypeScript, Tailwind CSS + shadcn/ui, Supabase (auth, Postgres, Storage — optional in demo mode), Stripe credit packs, Anthropic Claude, Runway Gen-4.5, ElevenLabs.

## Run locally

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Open [http://127.0.0.1:43127](http://127.0.0.1:43127).

Demo mode is on by default. Use **Continue with a demo studio** to get 3 credits. Script, picture, and voice run on local stand-ins (Claude-style copy, ffmpeg Ken Burns, espeak-ng) until you add API keys.

You need `ffmpeg` on the PATH for mock picture and composite. Voice mock also uses `espeak-ng`.

## Auth

`/login` supports Google OAuth and an email magic link. New accounts get a `profiles` row with **3 free credits** via the `handle_new_user` trigger on `auth.users`.

In the Supabase dashboard:

1. Enable Google and Email (OTP) providers
2. Add `{APP_URL}/callback` to Redirect URLs (example: `http://127.0.0.1:43127/callback`)

Protected app routes live under `/app/(app)` and send unauthenticated users to `/login`.

## Pipeline

1. `POST /api/generate-script` — Claude writes HOOK / BODY / CTA (free, no credit)
2. You edit and approve the script
3. `POST /api/generate-video` — deducts 1 credit, then Runway picture, ElevenLabs voice, and ffmpeg composite in one request (60–120s). The studio polls `GET /api/ads/:id` (or `GET /api/generate-video?generationId=`) for status.
4. Failures refund the credit, set status `failed`, and store `error_message`

| Step | Function | Provider | Fallback |
|------|----------|----------|----------|
| Picture | `generateVideo(imageUrl, prompt)` | Runway Gen-4.5 `image_to_video`, poll up to 3 min | ffmpeg Ken Burns |
| Voice | `generateVoiceover(script, voiceId?)` | ElevenLabs, Rachel (`21m00Tcm4TlvDq8ikWAM`), stability 0.5 / similarity 0.75 | espeak-ng → mp3 |
| Composite | `compositeVideo(videoUrl, audioUrl)` | ffmpeg `-c:v copy -c:a aac -shortest` | re-encode + loop video to cover audio |

Credits: `credits < 1` returns **402**. One credit is deducted when picture starts. The final MP4 is stored in the `ads` bucket and returned as a signed URL valid for 7 days.

## Production env

Set `DEMO_MODE=false` and fill in:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (Stripe webhook credit grants)
- `ANTHROPIC_API_KEY`
- `RUNWAY_API_KEY`
- `ELEVENLABS_API_KEY`
- `STRIPE_SECRET_KEY` (use `sk_test_...`)
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (`pk_test_...`)
- `SESSION_SECRET`
- `NEXT_PUBLIC_APP_URL`

Optional Stripe price IDs (created automatically on first checkout if omitted):

- `STRIPE_PRICE_1_CREDIT`
- `STRIPE_PRICE_3_CREDITS`
- `STRIPE_PRICE_5_CREDITS`

Run `lib/supabase/schema.sql` (same as `supabase/migrations/001_init.sql`) in the Supabase SQL editor. That creates `profiles`, `generations`, and `purchases`, the signup trigger, RLS, and the `ads` storage bucket.

Stripe webhook: `https://your-domain/api/webhook/stripe`. Forward events locally with `stripe listen --forward-to http://127.0.0.1:43127/api/webhook/stripe`. The handler is idempotent on `purchases.stripe_session_id`.

Vercel: this app expects a Node runtime with `ffmpeg` for composite. The hosted AI providers still run without it; local demo composite will not.

## Credits

| Pack      | Credits | Price |
|----------|---------|-------|
| 1 credit | 1       | $15   |
| 3 credits | 3       | $29   |
| 5 credits | 5       | $49   |

Checkout is one-time (`mode: payment`), not a subscription. Without Stripe keys, buying a pack credits the demo ledger immediately.
