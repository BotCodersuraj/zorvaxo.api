
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { password } = req.body || {};

  if (!process.env.ADMIN_PASSWORD ||
      password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Invalid password" });
  }

  const token = process.env.DISCORD_BOT_TOKEN;
  const guild = process.env.DISCORD_GUILD_ID;

  if (!token || !guild) {
    return res.status(500).json({ error: "Discord config missing" });
  }

  try {
    const response = await fetch(
      `https://discord.com/api/v10/guilds/${guild}/channels`,
      {
        headers: { Authorization: `Bot ${token}` }
      }
    );

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Unable to load Discord channels"
      });
    }

    const data = await response.json();

    const channels = data
      .filter(c => c.type === 0 || c.type === 5)
      .map(c => ({
        id: c.id,
        name: c.name,
        type: c.type
      }));

    return res.status(200).json({ channels });

  } catch {
    return res.status(500).json({ error: "Server error" });
  }
};
