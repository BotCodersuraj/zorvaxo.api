const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, "cloud-db.json");

// ---------- DATABASE ----------

function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    const initialDB = {
      users: [],
      sessions: []
    };

    fs.writeFileSync(
      DB_FILE,
      JSON.stringify(initialDB, null, 2)
    );
  }

  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}

function saveDB(db) {
  fs.writeFileSync(
    DB_FILE,
    JSON.stringify(db, null, 2)
  );
}

// ---------- HELPERS ----------

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(12).toString("hex")}`;
}

function now() {
  return new Date().toISOString();
}

// ---------- HEALTH ----------

app.get("/", (req, res) => {
  res.json({
    success: true,
    service: "Own Cloud DB API",
    status: "online",
    time: now()
  });
});

// ---------- CREATE REGISTRATION SESSION ----------

app.post("/api/register/start", (req, res) => {
  const db = loadDB();

  const sessionId = id("session");

  const session = {
    id: sessionId,
    status: "waiting",
    telegram_id: null,
    created_at: now(),
    expires_at: new Date(
      Date.now() + 10 * 60 * 1000
    ).toISOString()
  };

  db.sessions.push(session);
  saveDB(db);

  res.json({
    success: true,
    session_id: sessionId,
    status: "waiting",
    expires_at: session.expires_at
  });
});

// ---------- CHECK REGISTRATION STATUS ----------

app.get("/api/register/status/:sessionId", (req, res) => {
  const db = loadDB();

  const session = db.sessions.find(
    s => s.id === req.params.sessionId
  );

  if (!session) {
    return res.status(404).json({
      success: false,
      error: "Session not found"
    });
  }

  if (
    session.status === "waiting" &&
    new Date(session.expires_at) < new Date()
  ) {
    session.status = "expired";
    saveDB(db);
  }

  res.json({
    success: true,
    session_id: session.id,
    status: session.status,
    user_id: session.user_id || null
  });
});

// ---------- TELEGRAM CONFIRMATION ----------
// Bot/backend will call this after verifying Telegram user.

app.post("/api/register/confirm", (req, res) => {
  const {
    session_id,
    telegram_id,
    first_name,
    last_name,
    username,
    photo_url
  } = req.body;

  if (!session_id || !telegram_id) {
    return res.status(400).json({
      success: false,
      error: "session_id and telegram_id are required"
    });
  }

  const db = loadDB();

  const session = db.sessions.find(
    s => s.id === session_id
  );

  if (!session) {
    return res.status(404).json({
      success: false,
      error: "Registration session not found"
    });
  }

  if (session.status !== "waiting") {
    return res.status(400).json({
      success: false,
      error: "Session is not active"
    });
  }

  if (new Date(session.expires_at) < new Date()) {
    session.status = "expired";
    saveDB(db);

    return res.status(400).json({
      success: false,
      error: "Registration session expired"
    });
  }

  // Prevent duplicate Telegram accounts
  const existingUser = db.users.find(
    u => String(u.telegram_id) === String(telegram_id)
  );

  if (existingUser) {
    session.status = "already_registered";
    session.user_id = existingUser.id;

    saveDB(db);

    return res.json({
      success: true,
      status: "already_registered",
      user: existingUser
    });
  }

  // Create account
  const user = {
    id: id("user"),
    telegram_id: telegram_id,
    first_name: first_name || "",
    last_name: last_name || "",
    username: username || "",
    photo_url: photo_url || "",
    auth_provider: "telegram",
    created_at: now()
  };

  db.users.push(user);

  session.status = "completed";
  session.telegram_id = telegram_id;
  session.user_id = user.id;

  saveDB(db);

  res.json({
    success: true,
    status: "completed",
    user: user
  });
});

// ---------- GET USER ----------

app.get("/api/users/:telegramId", (req, res) => {
  const db = loadDB();

  const user = db.users.find(
    u =>
      String(u.telegram_id) ===
      String(req.params.telegramId)
  );

  if (!user) {
    return res.status(404).json({
      success: false,
      error: "User not found"
    });
  }

  res.json({
    success: true,
    user: user
  });
});

// ---------- DATABASE STATS ----------

app.get("/api/db/stats", (req, res) => {
  const db = loadDB();

  res.json({
    success: true,
    users: db.users.length,
    sessions: db.sessions.length
  });
});

// ---------- 404 ----------

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint not found"
  });
});

// ---------- START ----------

app.listen(PORT, () => {
  console.log(`Cloud DB API running on port ${PORT}`);
});