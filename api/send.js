
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    password, channelId, embed
  } = req.body || {};

  if (!process.env.ADMIN_PASSWORD ||
      password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Invalid password" });
  }

  if (typeof channelId !== "string" ||
      !/^\d{17,20}$/.test(channelId)) {
    return res.status(400).json({ error: "Invalid channel ID" });
  }

  if (!embed || typeof embed !== "object" || Array.isArray(embed)) {
    return res.status(400).json({ error: "Invalid embed" });
  }

  const clean = (value, max) =>
    typeof value === "string" ? value.trim().slice(0, max) : "";

  const title = clean(embed.title, 256);
  const description = clean(embed.description, 4096);
  const footer = clean(embed.footer, 2048);

  if (!title && !description) {
    return res.status(400).json({
      error: "Title or description is required"
    });
  }

  const validURL = value => {
    if (!value) return undefined;
    try {
      const u = new URL(value);
      return u.protocol === "https:" ? u.href : undefined;
    } catch {
      return undefined;
    }
  };

  const color = /^#[0-9a-fA-F]{6}$/.test(embed.color || "")
    ? parseInt(embed.color.slice(1), 16)
    : 0x35BDF2;

  const image = validURL(embed.image);
  const thumbnail = validURL(embed.thumbnail);

  if ((embed.image && !image) ||
      (embed.thumbnail && !thumbnail)) {
    return res.status(400).json({
      error: "Image URLs must be valid HTTPS links"
    });
  }

  const token = process.env.DISCORD_BOT_TOKEN;
  const guild = process.env.DISCORD_GUILD_ID;

  if (!token || !guild) {
    return res.status(500).json({ error: "Discord config missing" });
  }

  try {
    // Verify destination belongs to configured server
    const channelResponse = await fetch(
      `https://discord.com/api/v10/channels/${channelId}`,
      { headers: { Authorization: `Bot ${token}` } }
    );

    if (!channelResponse.ok) {
      return res.status(400).json({ error: "Channel not accessible" });
    }

    const channel = await channelResponse.json();

    if (channel.guild_id !== guild ||
        ![0, 5].includes(channel.type)) {
      return res.status(403).json({
        error: "Channel is not an allowed OverMC text channel"
      });
    }

    const result = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          embeds: [{
            ...(title && { title }),
            ...(description && { description }),
            color,
            ...(footer && { footer: { text: footer } }),
            ...(image && { image: { url: image } }),
            ...(thumbnail && { thumbnail: { url: thumbnail } })
          }],
          allowed_mentions: { parse: [] }
        })
      }
    );

    const data = await result.json();

    if (!result.ok) {
      console.error("Discord error:", data);
      return res.status(result.status).json({
        error: data.message || "Discord rejected the message"
      });
    }

    return res.status(200).json({
      success: true,
      messageId: data.id,
      channelId: data.channel_id
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
