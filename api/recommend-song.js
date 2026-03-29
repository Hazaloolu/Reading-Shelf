export async function getSongRecommendation(title, note) {
  const context = note ? `Title: "${title}"\nWhy saved: "${note}"` : `Title: "${title}"`;

  const prompt = `You are a music curator. Based on this article or essay, recommend one song that fits its mood, theme, or subject matter.

${context}

Reply with ONLY a valid JSON object in this exact format, no markdown, no backticks, no extra text:
{
  "song": "Song Title",
  "artist": "Artist Name",
  "reason": "One sentence explaining why this song fits the article."
}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 300,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || `Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

  if (!raw) throw new Error('Empty response from Gemini.');

  const clean = raw.replace(/```json\n?|```\n?/g, '').trim();
  return JSON.parse(clean);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  const { title, note } = req.body;
  if (!title) return res.status(400).json({ error: 'Article title is required.' });

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not set on the server.' });
  }

  try {
    const recommendation = await getSongRecommendation(title, note);
    return res.status(200).json(recommendation);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
