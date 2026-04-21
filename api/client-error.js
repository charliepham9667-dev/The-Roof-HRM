export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }

  try {
    const body = req.body || {}
    console.error("[client-error]", {
      type: body.type || "unknown",
      message: body.message || "No message",
      path: body.path || "unknown",
      timestamp: body.timestamp || new Date().toISOString(),
    })
  } catch (error) {
    console.error("[client-error] failed to parse payload", error)
  }

  res.status(204).end()
}
