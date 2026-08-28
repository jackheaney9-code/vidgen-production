# Lumina

AI video ad generator. Drop a product still, approve a 15–30 second script, then produce a vertical MP4: picture, voice, and composite.

## Architecture

- `/app/(marketing)` — landing
- `/app/(app)/dashboard` — ads list and studio
- `/app/(app)/create` — new ad brief
- `/app/api` — generate-script, generate-video, generate-voiceover, composite, Stripe webhook
- `/lib/pipeline` — script, video, voice, composite
- `/lib/supabase` — browser and server clients
- `/lib/stripe` — server helpers and Stripe.js client
- `/types/database.ts` — Supabase schema
- `/types/pipeline.ts` — generation job types


- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (auth, Postgres, Storage) — optional in demo mode
- Stripe credit packs
- Anthropic Claude (scripts), Runway Gen-4.5 (video), ElevenLabs (voice)

## Run locally

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Open [http://127.0.0.1:43127](http://127.0.0.1:43127).

Demo mode is on by default. Use **Continue with a demo studio** to get 3 credits. Script, picture, and voice run on local stand-ins (Claude-style copy, ffmpeg Ken Burns, espeak-ng) until you add API keys.

You need `ffmpeg` on the PATH for mock picture and composite. Voice mock also uses `espeak-ng`.

## Pipeline

1. `POST /api/generate-script` — Claude (or mock) writes the ad
2. You edit and approve the script
3. `POST /api/generate-video` — deducts 1 credit, then Runway (or ffmpeg)
4. `POST /api/generate-voiceover` — ElevenLabs (or espeak-ng)
5. `POST /api/composite` — ffmpeg mux, store MP4, return a signed URL

If picture, voice, or composite fails, the credit is refunded. Generation is blocked with **402** when `credits <= 0`.

## Production env

Set `DEMO_MODE=false` and fill in:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (Stripe webhook credit grants)
- `ANTHROPIC_API_KEY`
- `RUNWAY_API_KEY`
- `ELEVENLABS_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SESSION_SECRET`

Run `supabase/migrations/001_init.sql` in the Supabase SQL editor. Create the `ads` storage bucket if the insert in that file is skipped.

Stripe webhook: `https://your-domain/api/webhook/stripe`.

Vercel: this app expects a Node runtime with `ffmpeg` for composite. The hosted AI providers still run without it; local demo composite will not.

## Credits

| Pack     | Credits | Price |
|----------|---------|-------|
| Spark    | 5       | $12   |
| Studio   | 15      | $29   |
| Campaign | 50      | $89   |

Without Stripe keys, buying a pack credits the demo ledger immediately.
