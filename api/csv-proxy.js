// Vercel serverless function — proxies Google Sheets CSV to avoid CORS
export default async function handler(req, res) {
  const url = req.query.url
  if (!url) {
    return res.status(400).json({ error: "Missing url param" })
  }

  // Only allow Google Sheets published CSV URLs
  if (!url.startsWith("https://docs.google.com/spreadsheets/") && 
      !url.startsWith("https://doc-") ) {
    return res.status(403).json({ error: "URL not allowed" })
  }

  try {
    const upstream = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    })
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: "Upstream error" })
    }
    const text = await upstream.text()
    res.setHeader("Content-Type", "text/csv; charset=utf-8")
    res.setHeader("Cache-Control", "public, max-age=300") // 5 min cache
    res.setHeader("Access-Control-Allow-Origin", "*")
    return res.status(200).send(text)
  } catch (err) {
    return res.status(500).json({ error: String(err) })
  }
}
