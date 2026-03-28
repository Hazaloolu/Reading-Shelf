import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  // Protect endpoint — only Vercel's cron or requests with the correct secret can call this
  const authHeader = req.headers['authorization'];
  const querySecret = req.query.secret;
  const cronSecret = process.env.CRON_SECRET;

  const isVercelCron = authHeader === `Bearer ${cronSecret}`;
  const isManualCall = querySecret === cronSecret;

  if (!isVercelCron && !isManualCall) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  // Load config
  const { data: cfg, error: cfgErr } = await supabase
    .from('config')
    .select('phone, instance, token, send_hour, send_minute, last_sent_date')
    .eq('id', 1)
    .single();

  if (cfgErr || !cfg?.phone) {
    return res.status(200).json({ message: 'No config found. Skipping.' });
  }

  // Check if already sent today
  const today = new Date().toISOString().slice(0, 10);
  if (cfg.last_sent_date === today) {
    return res.status(200).json({ message: 'Already sent today. Skipping.' });
  }

  // Check if it is the right hour (UTC) to send
  // The vercel.json cron runs at 7:00 UTC by default (8 AM WAT for Nigeria)
  // You can change the cron schedule in vercel.json to match your preferred UTC time
  const nowUTC = new Date();
  const currentHour   = nowUTC.getUTCHours();
  const currentMinute = nowUTC.getUTCMinutes();
  const configuredHour   = cfg.send_hour   ?? 7;
  const configuredMinute = cfg.send_minute ?? 0;

  // Allow a 30-minute window in case of slight cron drift
  const configuredMinutes = configuredHour * 60 + configuredMinute;
  const currentMinutes    = currentHour   * 60 + currentMinute;
  const diff = Math.abs(currentMinutes - configuredMinutes);

  if (diff > 30) {
    return res.status(200).json({
      message: `Not send time. Configured: ${configuredHour}:${String(configuredMinute).padStart(2,'0')} UTC, Now: ${currentHour}:${String(currentMinute).padStart(2,'0')} UTC`,
    });
  }

  // Trigger the send endpoint
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

  const sendRes = await fetch(`${baseUrl}/api/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  const data = await sendRes.json();
  return res.status(sendRes.status).json(data);
}
