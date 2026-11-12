
const util = require("minecraft-server-util");

module.exports = async (req, res) => {
  const host = process.env.MC_HOST;
  const port = Number(process.env.MC_PORT || 25565);

  if (!host) {
    return res.status(500).json({
      success: false,
      error: "Minecraft server not configured"
    });
  }

  try {
    const result = await util.status(host, port, {
      timeout: 5000
    });

    return res.status(200).json({
      success: true,
      server: "OverMC",
      online: true,
      players: {
        online: result.players.online,
        max: result.players.max
      },
      version: result.version.name,
      ping: result.roundTripLatency,
      updatedAt: new Date().toISOString()
    });

  } catch (error) {
    return res.status(200).json({
      success: true,
      server: "OverMC",
      online: false,
      players: {
        online: 0,
        max: 0
      },
      version: null,
      ping: null,
      updatedAt: new Date().toISOString()
    });
  }
};
