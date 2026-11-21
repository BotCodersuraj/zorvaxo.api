
module.exports = async (req, res) => {
  const started = Date.now();

  // =========================
  // 1. CORS CONFIGURATION
  // =========================
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
  res.setHeader("Cache-Control", "no-store");

  // =========================
  // 2. REQUEST LOGGER
  // =========================
  const requestId = Math.random().toString(36).slice(2, 10);

  console.log("[ZORVAXO]", {
    requestId,
    method: req.method,
    origin: req.headers.origin || "unknown",
    time: new Date().toISOString()
  });

  // =========================
  // 3. OPTIONS PREFLIGHT
  // =========================
  if (req.method === "OPTIONS") {
    console.log("[ZORVAXO] OPTIONS SUCCESS", requestId);
    return res.status(204).end();
  }

  // =========================
  // 4. GET HEALTH CHECK
  // =========================
  if (req.method === "GET") {
    return res.status(200).json({
      success: true,
      service: "ZORVAXO API",
      endpoint: "/api/channels",
      status: "ONLINE",
      methods: ["POST", "OPTIONS"],
      time: new Date().toISOString()
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
      requestId
    });
  }

  // =========================
  // 5. REQUEST BODY
  // =========================
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

  const fail = (status, stage, error, extra = {}) => {
    console.error("[ZORVAXO ERROR]", {
      requestId,
      stage,
      status,
      error
    });

    return res.status(status).json({
      success: false,
      requestId,
      stage,
      error,
      duration: Date.now() - started,
      ...extra
    });
  };

  // =========================
  // 6. VALIDATION
  // =========================
  if (!botToken || !guildId || !channelId) {
    return fail(
      400,
      "VALIDATION",
      "Bot token, guild ID and channel ID required"
    );
  }

  if (
    typeof guildId !== "string" ||
    typeof channelId !== "string" ||
    !/^\d{17,20}$/.test(guildId) ||
    !/^\d{17,20}$/.test(channelId)
  ) {
    return fail(400, "VALIDATION", "Invalid Discord IDs");
  }

  if (
    typeof botToken !== "string" ||
    !botToken.trim() ||
    botToken.length > 200
  ) {
    return fail(400, "VALIDATION", "Invalid bot token");
  }

  const clean = (value, max) =>
    typeof value === "string"
      ? value.trim().slice(0, max)
      : "";

  const embedTitle = clean(title, 256);
  const embedDescription = clean(description || message, 4096);
  const embedFooter = clean(footer, 2048);

  if (!embedTitle && !embedDescription) {
    return fail(
      400,
      "VALIDATION",
      "Title or description required"
    );
  }

  // =========================
  // 7. IMAGE VALIDATION
  // =========================
  const validUrl = value => {
    if (!value) return undefined;

    try {
      const parsed = new URL(value);

      if (parsed.protocol !== "https:") {
        return undefined;
      }

      return parsed.href;
    } catch {
      return undefined;
    }
  };

  const imageUrl = validUrl(image);
  const thumbnailUrl = validUrl(thumbnail);

  if (
    (image && !imageUrl) ||
    (thumbnail && !thumbnailUrl)
  ) {
    return fail(
      400,
      "IMAGE_VALIDATION",
      "Images must use valid HTTPS URLs"
    );
  }

  const embedColor =
    typeof color === "string" &&
    /^#[0-9a-fA-F]{6}$/.test(color)
      ? parseInt(color.slice(1), 16)
      : 0x35BDF2;

  // =========================
  // 8. DISCORD REQUEST
  // =========================
  try {
    const headers = {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json"
    };

    // GUILD CHECK
    console.log("[ZORVAXO] Checking guild", requestId);

    const guildResponse = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}`,
      { headers }
    );

    if (!guildResponse.ok) {
      const details = await guildResponse.text();

      return fail(
        403,
        "GUILD_CHECK",
        "Bot cannot access this server",
        {
          discordStatus: guildResponse.status,
          details: details.slice(0, 1500)
        }
      );
    }

    // CHANNEL CHECK
    console.log("[ZORVAXO] Checking channel", requestId);

    const channelResponse = await fetch(
      `https://discord.com/api/v10/channels/${channelId}`,
      { headers }
    );

    if (!channelResponse.ok) {
      const details = await channelResponse.text();

      return fail(
        400,
        "CHANNEL_CHECK",
        "Channel not found or inaccessible",
        {
          discordStatus: channelResponse.status,
          details: details.slice(0, 1500)
        }
      );
    }

    const channelData = await channelResponse.json();

    if (
      channelData.guild_id !== guildId ||
      ![0, 5].includes(channelData.type)
    ) {
      return fail(
        403,
        "CHANNEL_VALIDATION",
        "Invalid channel for this server"
      );
    }

    // BUILD EMBED
    const embed = {
      ...(embedTitle && { title: embedTitle }),
      ...(embedDescription && {
        description: embedDescription
      }),
      color: embedColor,
      ...(embedFooter && {
        footer: { text: embedFooter }
      }),
      ...(imageUrl && {
        image: { url: imageUrl }
      }),
      ...(thumbnailUrl && {
        thumbnail: { url: thumbnailUrl }
      })
    };

    // SEND MESSAGE
    console.log("[ZORVAXO] Sending embed", requestId);

    const sendResponse = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          embeds: [embed],
          allowed_mentions: {
            parse: []
          }
        })
      }
    );

    const responseText = await sendResponse.text();

    let result;

    try {
      result = JSON.parse(responseText);
    } catch {
      result = { message: responseText };
    }

    if (!sendResponse.ok) {
      return fail(
        sendResponse.status,
        "DISCORD_SEND",
        result.message || "Discord send failed",
        {
          discordStatus: sendResponse.status,
          details: result
        }
      );
    }

    // SUCCESS
    console.log("[ZORVAXO] SEND SUCCESS", requestId);

    return res.status(200).json({
      success: true,
      requestId,
      stage: "COMPLETE",
      message: "Announcement sent!",
      messageId: result.id,
      guildId,
      channelId,
      duration: Date.now() - started
    });

  } catch (error) {
    console.error("[ZORVAXO SERVER ERROR]", {
      requestId,
      message: error.message,
      stack: error.stack
    });

    return fail(
      500,
      "SERVER_ERROR",
      error.message || "Internal server error"
    );
  }
};
