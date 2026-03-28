import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET — return config (never expose token/instance to frontend)
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('config')
      .select('phone, send_hour, send_minute, last_sent_date, last_sent_id')
      .eq('id', 1)
      .single();

    if (error) return res.status(200).json({}); // no config yet is fine
    return res.status(200).json(data || {});
  }

  // POST — save config
  if (req.method === 'POST') {
    const { phone, instance, token, send_hour, send_minute } = req.body;

    if (!phone || !instance || !token) {
      return res.status(400).json({ error: 'phone, instance, and token are required.' });
    }

    const payload = {
      id: 1,
      phone: phone.replace(/\D/g, ''), // strip non-digits
      instance,
      token,
      send_hour:   parseInt(send_hour   ?? 8),
      send_minute: parseInt(send_minute ?? 0),
    };

    const { error } = await supabase
      .from('config')
      .upsert(payload, { onConflict: 'id' });

    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({
      success: true,
      phone: payload.phone,
      send_hour: payload.send_hour,
      send_minute: payload.send_minute,
    });
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}
