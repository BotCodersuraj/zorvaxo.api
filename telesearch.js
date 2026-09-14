export default function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  const query = String(req.query.q || "").trim();

  if (!query) {
    return res.status(400).json({
      success: false,
      error: "Search query is required",
      example: "/api/search?q=crypto"
    });
  }

  const encoded = encodeURIComponent(query);

  const results = [
    {
      name: `${query} Search`,
      url: `https://www.google.com/search?q=${encoded}`
    },
    {
      name: `${query} Channels`,
      url: `https://www.google.com/search?q=${encodeURIComponent(query + " Telegram channels")}`
    },
    {
      name: `${query} Community`,
      url: `https://www.google.com/search?q=${encodeURIComponent(query + " community")}`
    }
  ];

  return res.status(200).json({
    success: true,
    query: query,
    count: results.length,
    results: results
  });
}