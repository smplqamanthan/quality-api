import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(cors());

// ------------------- DATABASE -------------------
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// ------------------- API -------------------
app.get("/api/data", (req, res) => {
  const { startDate, endDate, lotId } = req.query;

  let query = "";
  let params = [];

  if (lotId) {
    const lots = lotId.split(",").map(l => l.trim());
    const placeholders = lots.map(() => "?").join(",");
    query = `SELECT * FROM uqe_data WHERE LotID IN (${placeholders})`;
    params = lots;
  } else if (startDate && endDate) {
    query = "SELECT * FROM uqe_data WHERE ShiftStartTime BETWEEN ? AND ?";
    params = [`${startDate} 00:00:00`, `${endDate} 23:59:59`];
  } else {
    return res.json([]);
  }

  console.log("Running query:", query, params);

  db.query(query, params, (err, results) => {
    if (err) {
      console.error("DB error:", err);
      return res.json({ error: "Database query failed" });
    }
    res.json(Array.isArray(results) ? results : []);
  });
});

// ------------------- Unique Article Numbers API -------------------
// Returns distinct ArticleNumber values that match query `q` (case- and space-insensitive)
app.get("/api/unique-article-numbers", (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.json([]);

  // Normalize query: lowercase and remove all spaces
  const normalized = q.toLowerCase().replace(/\s+/g, "");

  const sql = `
    SELECT DISTINCT ArticleNumber
    FROM uqe_data
    WHERE REPLACE(LOWER(COALESCE(ArticleNumber, '')), ' ', '') LIKE ?
    ORDER BY ArticleNumber ASC
    LIMIT 200
  `;

  db.query(sql, ["%" + normalized + "%"], (err, rows) => {
    if (err) {
      console.error("DB error (unique-article-numbers):", err);
      return res.json([]);
    }
    const uniquesByNormalized = new Map();
    (rows || []).forEach(r => {
      const raw = r.ArticleNumber;
      if (raw === null || raw === undefined) return;
      const original = String(raw).trim();
      if (!original) return;
      const key = original.toLowerCase().replace(/\s+/g, "");
      if (!uniquesByNormalized.has(key)) {
        uniquesByNormalized.set(key, original);
      }
    });
    res.json(Array.from(uniquesByNormalized.values()));
  });
});

// ------------------- Data by Article Numbers API -------------------
// Fetch rows matching one or more Article Numbers (case/space-insensitive)
app.get("/api/data-by-article", (req, res) => {
  const raw = String(req.query.articles || "").trim();
  if (!raw) return res.json([]);
  const articles = raw.split(",").map(s => s.trim()).filter(Boolean);
  if (!articles.length) return res.json([]);

  const normalized = articles.map(s => s.toLowerCase().replace(/\s+/g, ""));
  const placeholders = normalized.map(() => "?").join(",");
  const sql = `
    SELECT *
    FROM uqe_data
    WHERE REPLACE(LOWER(COALESCE(ArticleNumber, '')), ' ', '') IN (${placeholders})
  `;

  db.query(sql, normalized, (err, rows) => {
    if (err) {
      console.error("DB error (data-by-article):", err);
      return res.json([]);
    }
    res.json(Array.isArray(rows) ? rows : []);
  });
});

// ------------------- Restart API -------------------
app.post("/api/restart", async (req, res) => {
  try {
    const response = await fetch(
      `https://api.render.com/v1/services/${process.env.RENDER_SERVICE_ID}/restart`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.RENDER_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    if (response.ok) {
      const data = await response.json();
      console.log("✅ Service restart triggered:", data);
      res.json({ message: "Service restart triggered successfully" });
    } else {
      console.error("❌ Restart failed", response.status);
      res.status(response.status).json({ error: "Failed to restart service" });
    }
  } catch (err) {
    console.error("❌ Error calling Render API", err);
    res.status(500).json({ error: "Error calling Render API" });
  }
});


// ------------------- SERVER -------------------
const PORT = process.env.PORT || 9000; // default aligned with frontend
app.listen(PORT, "0.0.0.0", () => {
  console.log(`API running at http://localhost:${PORT}`);
});