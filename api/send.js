import { createClient } from '@supabase/supabase-js';
import { getSongRecommendation } from './recommend-song.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Pick the next article to send (least sent, random tiebreak)
function pickArticle(articles) {
  let pool = articles.filter(a => a.sent_count === 0);
  if (!pool.length) {
    // All articles sent at least once — reset cycle
    pool = [...articles];
  }
  const min = Math.min(...pool.map(a => a.sent_count));
  const candidates = pool.filter(a => a.sent_count === min);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// Send via UltraMsg
async function sendViaUltraMsg(instance, token, phone, message) {
  const url = `https://api.ultramsg.com/${instance}/messages/chat`;
  const body = new URLSearchParams({
    token,
    to: phone.replace(/\D/g, ''),
    body: message,
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = await res.json();
  const sent = data.sent === 'true' || data.sent === true || !!data.id;
  return { sent, raw: data };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  // Load config
  const { data: cfg, error: cfgErr } = await supabase
    .from('config')
    .select('*')
    .eq('id', 1)
    .single();

  if (cfgErr || !cfg) {
    return res.status(400).json({ error: 'WhatsApp is not configured yet. Go to the Setup tab.' });
  }
  if (!cfg.phone || !cfg.instance || !cfg.token) {
    return res.status(400).json({ error: 'Incomplete WhatsApp setup. Check phone, instance, and token.' });
  }

  // Load articles
  const { data: articles, error: artErr } = await supabase
    .from('articles')
    .select('*')
    .order('created_at', { ascending: false });

  if (artErr) return res.status(500).json({ error: artErr.message });
  if (!articles?.length) {
    return res.status(400).json({ error: 'No articles on the shelf. Add some first.' });
  }

  // Pick article
const article = pickArticle(articles);

// Get song recommendation directly from Gemini
  let songSection = '';
  if (process.env.GEMINI_API_KEY) {
    try {
      const song = await getSongRecommendation(article.title, article.note);
      if (song.song && song.artist) {
        songSection = `\n\n🎵 *Song for the read*\n${song.song} — ${song.artist}\n_${song.reason || ''}_`;
      }
    } catch (e) {
      console.error('Song recommendation failed:', e.message);
    }
  }

  
// Build message
const msg = `📖 *Your essay/article read for the day*\n\n*${article.title}*\n\n${article.link || ''}${songSection}\n\n_The Reading Shelf_`;

  // Send
  const { sent, raw } = await sendViaUltraMsg(cfg.instance, cfg.token, cfg.phone, msg);

  if (!sent) {
    return res.status(500).json({
      error: 'UltraMsg failed to send.',
      detail: raw?.error || raw?.message || JSON.stringify(raw),
    });
  }

  // Update sent_count on this article
  await supabase
    .from('articles')
    .update({ sent_count: article.sent_count + 1 })
    .eq('id', article.id);

  // Record last sent in config
  const today = new Date().toISOString().slice(0, 10);
  await supabase
    .from('config')
    .update({ last_sent_date: today, last_sent_id: article.id })
    .eq('id', 1);

  return res.status(200).json({ success: true, article });
}
