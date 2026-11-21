
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "POST required"
    });
  }

  const {
    botToken,
    guildId,
    channelId,
    title,
    description,
    color,
    footer,
    image,
    thumbnail
  } = req.body || {};

  const clean = (v, max) =>
    typeof v === "string" ? v.trim().slice(0, max) : "";

  if (!botToken || !guildId || !channelId) {
    return res.status(400).json({
      success: false,
      error: "Bot token, guild ID and channel ID required"
    });
  }

  if (!/^\d{17,20}$/.test(guildId) ||
      !/^\d{17,20}$/.test(channelId)) {
    return res.status(400).json({
      success: false,
      error: "Invalid Discord IDs"
    });
  }

  const t = clean(title, 256);
  const d = clean(description, 4096);
  const f = clean(footer, 2048);

  if (!t && !d) {
    return res.status(400).json({
      success: false,
      error: "Title or description required"
    });
  }

  function safeURL(value) {
    if (!value) return undefined;
    try {
      const u = new URL(value);
      return u.protocol === "https:" ? u.href : undefined;
    } catch {
      return undefined;
    }
  }

  const img = safeURL(image);
  const thumb = safeURL(thumbnail);

  if ((image && !img) || (thumbnail && !thumb)) {
    return res.status(400).json({
      success: false,
      error: "Invalid HTTPS image URL"
    });
  }

  const embedColor =
    /^#[0-9a-fA-F]{6}$/.test(color || "")
      ? parseInt(color.slice(1), 16)
      : 0x35BDF2;

  try {
    const headers = {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json"
    };

    // Verify server access
    const guildResponse = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}`,
      { headers }
    );

    if (!guildResponse.ok) {
      return res.status(403).json({
        success: false,
        error: "Bot cannot access this server"
      });
    }

    // Verify channel belongs to server
    const channelResponse = await fetch(
      `https://discord.com/api/v10/channels/${channelId}`,
      { headers }
    );

    if (!channelResponse.ok) {
      return res.status(400).json({
        success: false,
        error: "Channel not accessible"
      });
    }

    const channelData = await channelResponse.json();

    if (
      channelData.guild_id !== guildId ||
      ![0, 5].includes(channelData.type)
    ) {
      return res.status(403).json({
        success: false,
        error: "Invalid server channel"
      });
    }

    // Send embed
    const discordResponse = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          embeds: [{
            ...(t && { title: t }),
            ...(d && { description: d }),
            color: embedColor,
            ...(f && { footer: { text: f } }),
            ...(img && { image: { url: img } }),
            ...(thumb && { thumbnail: { url: thumb } })
          }],
          allowed_mentions: {
            parse: []
          }
        })
      }
    );

    const data = await discordResponse.json();

    if (!discordResponse.ok) {
      return res.status(discordResponse.status).json({
        success: false,
        error: data.message || "Discord send failed"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Embed sent successfully!",
      messageId: data.id,
      guildId,
      channelId
    });

  } catch (error) {
    console.error("Send API error:", error);

    return res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
};
