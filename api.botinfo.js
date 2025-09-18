import fetch from "node-fetch";

export default async function handler(req, res) {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ ok: false, description: "Please provide bot token as ?token=YOUR_BOT_TOKEN" });
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await response.json();

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ ok: false, description: error.message });
  }
}