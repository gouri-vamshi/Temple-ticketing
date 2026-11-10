# Sri Hanuman Sri Ramalingeshwara Devalayam — Online Pooja Website

This is a deployable Next.js + Supabase web application. It is designed for both devotees and temple staff:
- Devotees do not need an account or sign-in. They open the website, enter their details, add family members and submit a pooja booking.
- A printable ticket is shown immediately after booking, with a database-generated receipt number such as `LTmpl_00001`, `LTmpl_00002`, etc.
- Staff sign in to search booking history, update payment status, configure pooja prices and upload media.
- English/Telugu language toggle.
- Responsive layout for phones, tablets and desktop.

## Important: not live until connected and deployed
This source package is not itself a public website. It needs a Supabase project and a hosting deployment. No credentials, domain, or hosting account were supplied, so the app cannot be published under a live URL yet.

## 1. Create the database
1. Create a project at https://supabase.com
2. Open **SQL Editor → New query**.
3. Paste and run all contents of `supabase/schema.sql`.
4. In **Authentication → Providers**, enable Email.
5. In **Authentication → Users**, create a staff user with email/password.
6. In **Table Editor → staff_profiles**, insert a row:
   - `user_id`: the UUID of the staff user you just created
   - `full_name`: staff member's name
   - `role`: `admin`
   Only users listed in `staff_profiles` can open the staff dashboard.

## 2. Add connection keys
1. In Supabase, open **Project Settings → API**.
2. Copy Project URL and anon/public key.
3. Copy `.env.example` to `.env.local`.
4. Fill in:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
   ```

## 3. Run locally / build
Requires Node.js 20 or newer:
```bash
npm install
npm run dev
```
Open http://localhost:3000. For production:
```bash
npm run build
npm run start
```

## 4. Publish online
1. Push this project to a private GitHub repository.
2. Import it into https://vercel.com (New Project).
3. Add the two environment variables from `.env.local` in Vercel Project Settings → Environment Variables.
4. Deploy. Vercel gives you an HTTPS website URL.
5. Add your own domain later if desired.

## 5. Set pooja prices
Staff login → Temple Staff → Pooja setup. The five required poojas are preloaded with ₹0 until the temple sets the correct prices.

## Current scope and integration notes
- Online bookings and receipt number generation are implemented through a database RPC.
- Public devotees do not sign in. Shared booking history remains private for a later staff/admin phase; no public booking-history lookup is exposed.
- Payment is recorded manually (Cash / UPI / Other; Paid / Pending); no payment gateway is connected.
- Media upload stores photos/videos in Supabase Storage. The current UI shows uploaded media links; automated WhatsApp Business and SMS delivery are not connected. WhatsApp can share a link manually; SMS must use a secure link, not an attachment. A provider and consent/recipient workflow are required for automated messaging.
- Receipt print is currently browser print; a formatted individual receipt page can be added next.
- Public booking is open to anyone. Do not put highly sensitive personal information in optional notes.
- For production use, configure Supabase backups, staff access, privacy notice, anti-spam/rate limiting and domain/SSL.
