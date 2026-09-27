// server.js – Express wrapper for the Stock Analysis Dashboard
import express from "express";
import dotenv from "dotenv";
import fetchStockData from "./src/api/fetchStockData.js"; // Adjust path if needed

dotenv.config({ path: ".env.production" });

const app = express();
const PORT = process.env.PORT || 4000;

// Simple health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Stock data endpoint – expects a ticker symbol, e.g. /api/stock/AAPL
app.get("/api/stock/:symbol", async (req, res) => {
  try {
    const data = await fetchStockData(req.params.symbol);
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch data" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Hermes‑wrapped server listening on http://localhost:${PORT}`);
});
