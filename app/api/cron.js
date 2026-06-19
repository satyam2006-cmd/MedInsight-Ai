export default async function handler(req, res) {
  // 1. Verify Vercel's secret to make sure random people don't trigger it
  const authHeader = req.headers['authorization'];
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 2. This triggers your Hugging Face space backend to ping Supabase
    const hfResponse = await fetch('https://hf.space', {
      method: 'GET',
      headers: { 'accept': 'application/json' }
    });
    
    const data = await hfResponse.json();
    return res.status(200).json({ ok: true, hf_backend_response: data });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
}
