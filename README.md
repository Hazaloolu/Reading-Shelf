# The Reading Shelf

A personal reading list that sends you a daily WhatsApp article automatically.
Built with Vercel (hosting + cron), Supabase (database), and UltraMsg (WhatsApp).

---

## Stack

| Service   | Purpose                              | Cost         |
|-----------|--------------------------------------|--------------|
| Vercel    | Hosting, serverless API, cron job    | Free (Hobby) |
| Supabase  | Database (articles + config)         | Free tier    |
| UltraMsg  | WhatsApp message delivery            | Free trial   |

---

## Setup (one time, ~15 minutes)

### 1. Supabase

1. Go to https://supabase.com and create a project
2. Open the **SQL Editor** and paste the contents of `schema.sql`, then run it
3. Go to **Project Settings → API** and copy:
   - `Project URL` → this is your `SUPABASE_URL`
   - `service_role` secret key → this is your `SUPABASE_SERVICE_KEY`

### 2. UltraMsg

1. Go to https://ultramsg.com and create a free account
2. Create a new instance
3. Scan the QR code with your WhatsApp
4. From your instance dashboard, copy:
   - **Instance ID** (e.g. `instance12345`)
   - **Token**

### 3. Deploy to Vercel

1. Push this project to a GitHub repo
2. Go to https://vercel.com → New Project → import your repo
3. Add these **Environment Variables** in Vercel:

   | Variable               | Value                            |
   |------------------------|----------------------------------|
   | `SUPABASE_URL`         | Your Supabase project URL        |
   | `SUPABASE_SERVICE_KEY` | Your Supabase service_role key   |
   | `CRON_SECRET`          | Any random string you make up    |

4. Deploy. Vercel will give you a URL like `https://your-shelf.vercel.app`

### 4. Configure WhatsApp in the app

1. Open your deployed URL
2. Go to the **WhatsApp Setup** tab
3. Enter your phone number (e.g. `2348012345678` — no `+`, no spaces)
4. Enter your UltraMsg Instance ID and Token
5. Set your preferred daily send time in UTC (Nigeria is UTC+1, so 7:00 UTC = 8:00 AM Lagos)
6. Click **Save and Activate**, then **Send a Test Now** to confirm it works

---

## How the cron works

`vercel.json` schedules `/api/cron` to run at **7:00 AM UTC** every day.

The cron job:
1. Checks if an article was already sent today — if yes, skips
2. Checks if the current time matches your configured send time (within 30 minutes)
3. Calls `/api/send` which picks the next article and sends it via UltraMsg

To change the cron time, edit `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron",
      "schedule": "0 7 * * *"
    }
  ]
}
```
The schedule uses standard cron syntax in UTC. `0 7 * * *` = 7:00 AM UTC daily.

---

## Article rotation

- New articles (never sent) are always picked first
- Once every article has been sent at least once, the cycle resets
- The article with the lowest sent count is always prioritised
- Random tiebreaking when multiple articles have equal counts

---

## API Endpoints

| Method   | Path              | Description              |
|----------|-------------------|--------------------------|
| GET      | `/api/articles`   | List all articles        |
| POST     | `/api/articles`   | Add an article           |
| PATCH    | `/api/articles`   | Update an article        |
| DELETE   | `/api/articles`   | Delete an article        |
| GET      | `/api/config`     | Get config (no secrets)  |
| POST     | `/api/config`     | Save config              |
| POST     | `/api/send`       | Trigger a send manually  |
| GET      | `/api/cron`       | Cron endpoint (secured)  |
