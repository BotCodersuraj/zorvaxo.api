
module.exports = async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  // Browser preflight
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "POST method required"
    });
  }

  const {
    botToken, guildId, channelId,
    message, title, description,
    color, footer, image, thumbnail
  } = req.body || {};

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

  if (typeof botToken !== "string" ||
      botToken.length > 200 || !botToken.trim()) {
    return res.status(400).json({
      success: false,
      error: "Invalid bot token"
    });
  }

  const clean = (v, max) =>
    typeof v === "string" ? v.trim().slice(0, max) : "";

  const embedTitle = clean(title, 256);
  const embedDescription = clean(description || message, 4096);
  const embedFooter = clean(footer, 2048);

  if (!embedTitle && !embedDescription) {
    return res.status(400).json({
      success: false,
      error: "Title or description required"
    });
  }

  const validUrl = value => {
    if (!value) return undefined;
    try {
      const url = new URL(value);
      return url.protocol === "https:" ? url.href : undefined;
    } catch {
      return undefined;
    }
  };

  const imageUrl = validUrl(image);
  const thumbUrl = validUrl(thumbnail);

  if ((image && !imageUrl) || (thumbnail && !thumbUrl)) {
    return res.status(400).json({
      success: false,
      error: "Images must use valid HTTPS URLs"
    });
  }

  const embedColor = /^#[0-9a-fA-F]{6}$/.test(color || "")
    ? parseInt(color.slice(1), 16)
    : 0x35BDF2;

  try {
    const headers = {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json"
    };

    // Verify guild
    const guildResponse = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}`,
      { headers }
    );

    if (!guildResponse.ok) {
      const detail = await guildResponse.text();
      return res.status(403).json({
        success: false,
        stage: "GUILD_CHECK",
        error: "Bot cannot access this server",
        discordStatus: guildResponse.status,
        details: detail.slice(0, 1500)
      });
    }

    // Verify channel
    const channelResponse = await fetch(
      `https://discord.com/api/v10/channels/${channelId}`,
      { headers }
    );

    if (!channelResponse.ok) {
      const detail = await channelResponse.text();
      return res.status(400).json({
        success: false,
        stage: "CHANNEL_CHECK",
        error: "Channel not found or inaccessible",
        discordStatus: channelResponse.status,
        details: detail.slice(0, 1500)
      });
    }

    const channelData = await channelResponse.json();

    if (channelData.guild_id !== guildId ||
        ![0, 5].includes(channelData.type)) {
      return res.status(403).json({
        success: false,
        stage: "CHANNEL_VALIDATION",
        error: "Invalid channel for this server"
      });
    }

    const embed = {
      ...(embedTitle && { title: embedTitle }),
      ...(embedDescription && { description: embedDescription }),
      color: embedColor,
      ...(embedFooter && { footer: { text: embedFooter } }),
      ...(imageUrl && { image: { url: imageUrl } }),
      ...(thumbUrl && { thumbnail: { url: thumbUrl } })
    };

    // Send Discord message
    const sendResponse = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          embeds: [embed],
          allowed_mentions: { parse: [] }
        })
      }
    );

    const result = await sendResponse.json();

    if (!sendResponse.ok) {
      return res.status(sendResponse.status).json({
        success: false,
        stage: "DISCORD_SEND",
        error: result.message || "Discord send failed",
        discordStatus: sendResponse.status,
        details: result
      });
    }

    return res.status(200).json({
      success: true,
      stage: "COMPLETE",
      message: "Announcement sent!",
      messageId: result.id,
      guildId,
      channelId
    });

  } catch (error) {
    console.error("ZORVAXO API ERROR:", error);

    return res.status(500).json({
      success: false,
      stage: "SERVER_ERROR",
      error: error.message || "Internal server error"
    });
  }
};
