
const util = require("minecraft-server-util");
const net = require("net");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "GET method only"
    });
  }

  const host = String(req.query.server_ip || "").trim();
  const edition = String(req.query.edition || "java").toLowerCase();

  const defaultPort = edition === "bedrock" ? 19132 : 25565;
  const port = Number(req.query.server_port || defaultPort);

  // VALIDATION
  if (!host || host.length > 253 ||
      !/^[a-zA-Z0-9.:-]+$/.test(host) ||
      host === "localhost" ||
      net.isIP(host) === 0 && !/^[a-zA-Z0-9.-]+$/.test(host)) {
    return res.status(400).json({
      success: false,
      error: "Invalid server_ip"
    });
  }

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return res.status(400).json({
      success: false,
      error: "Invalid server_port"
    });
  }

  if (!["java", "bedrock"].includes(edition)) {
    return res.status(400).json({
      success: false,
      error: "Edition must be java or bedrock"
    });
  }

  try {
    const start = Date.now();

    const result = edition === "bedrock"
      ? await util.statusBedrock(host, port, { timeout: 5000 })
      : await util.status(host, port, { timeout: 5000 });

    const response = {
      success: true,
      server: {
        host,
        port,
        edition,
        online: true
      },

      players: {
        online: result.players.online,
        max: result.players.max,
        sample: result.players.sample || []
      },

      version: {
        name: result.version?.name || null,
        protocol: result.version?.protocol ?? null
      },

      motd: {
        raw: result.motd?.raw || "",
        clean: result.motd?.clean || "",
        html: result.motd?.html || ""
      },

      ping: result.roundTripLatency ?? Date.now() - start,

      favicon: result.favicon || null,

      extra: edition === "bedrock" ? {
        gameMode: result.gameMode || null,
        gameModeID: result.gameModeID ?? null,
        serverGUID: result.serverGUID || null,
        serverID: result.serverID || null,
        portIPv4: result.portIPv4 ?? null,
        portIPv6: result.portIPv6 ?? null
      } : {
        srvRecord: result.srvRecord || null
      },

      updatedAt: new Date().toISOString()
    };

    return res.status(200).json(response);

  } catch (error) {
    return res.status(200).json({
      success: true,
      server: {
        host,
        port,
        edition,
        online: false
      },
      players: {
        online: 0,
        max: 0,
        sample: []
      },
      version: null,
      motd: null,
      ping: null,
      favicon: null,
      error: "Server is offline or did not respond",
      updatedAt: new Date().toISOString()
    });
  }
};
