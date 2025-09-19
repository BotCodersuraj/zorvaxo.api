import fetch from "node-fetch";

export default async function handler(req, res) {
  try {
    // Dusre website ya API ka URL
    const url = "https://api.coindesk.com/v1/bpi/currentprice.json"; // example: Bitcoin price
    const response = await fetch(url);
    const data = await response.json();

    // Apni API se return kar do
    res.status(200).json({
      ok: true,
      source: url,
      data: data
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
} 