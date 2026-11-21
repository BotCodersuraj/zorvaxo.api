
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "POST method required"
    });
  }

  const {
    botToken,
    guildId,
    channelId,
    message,
    title,
    description,
    color,
    footer,
    image,
    thumbnail
  } = req.body || {};

  // Required fields
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
      botToken.length > 200 ||
      !botToken.trim()) {
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

    // Verify bot can access the specified guild
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

    // Verify channel belongs to specified guild
    const channelResponse = await fetch(
      `https://discord.com/api/v10/channels/${channelId}`,
      { headers }
    );

    if (!channelResponse.ok) {
      return res.status(400).json({
        success: false,
        error: "Channel not found or inaccessible"
      });
    }

    const channelData = await channelResponse.json();

    if (channelData.guild_id !== guildId ||
        ![0, 5].includes(channelData.type)) {
      return res.status(403).json({
        success: false,
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

    // Send announcement
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
        error: result.message || "Discord send failed"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Announcement sent!",
      messageId: result.id,
      guildId,
      channelId
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
};
