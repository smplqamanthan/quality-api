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
app.get("/api/data", async (req, res) => {
  const { startDate, endDate, lotId } = req.query;

  try {
    let query = supabase.from("uqe_data");

    if (lotId) {
      const lots = lotId.split(",").map((l) => l.trim());
      query = query.in("LotID", lots);
    } else if (startDate && endDate) {
      query = query
        .gte("ShiftStartTime", `${startDate} 00:00:00`)
        .lte("ShiftStartTime", `${endDate} 23:59:59`);
    } else {
      return res.json([]);
    }

    const { data, error } = await query.select("*");

    if (error) {
      console.error("Supabase query error:", error);
      return res.json({ error: "Database query failed" });
    }
    res.json(data || []);
  } catch (err) {
    console.error("Unexpected error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ------------------- Unique Article Numbers API -------------------
app.get("/api/unique-article-numbers", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.json([]);

  try {
    // Use ILIKE in Supabase to search case-insensitive
    const { data: rows, error } = await supabase
      .from("uqe_data")
      .select("ArticleNumber")
      .ilike("ArticleNumber", `%${q}%`)
      .limit(200);

    if (error) {
      console.error("Supabase error (unique-article-numbers):", error);
      return res.json([]);
    }

    const uniques = Array.from(
      new Set((rows || []).map((r) => r.ArticleNumber.trim()))
    );

    res.json(uniques);
  } catch (err) {
    console.error("Unexpected error:", err);
    res.status(500).json([]);
  }
});

// ------------------- Data by Article Numbers API -------------------
app.get("/api/data-by-article", async (req, res) => {
  const raw = String(req.query.articles || "").trim();
  if (!raw) return res.json([]);
  const articles = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (!articles.length) return res.json([]);

  try {
    // Use Postgres LOWER for case-insensitive match
    const normalizedArticles = articles.map((a) => a.toLowerCase());
    const { data, error } = await supabase
      .from("uqe_data")
      .select("*")
      .in("ArticleNumber", normalizedArticles);

    if (error) {
      console.error("Supabase error (data-by-article):", error);
      return res.json([]);
    }

    res.json(data || []);
  } catch (err) {
    console.error("Unexpected error:", err);
    res.status(500).json([]);
  }
});

// ------------------- Restart API -------------------
app.post("/api/restart", async (req, res) => {
  try {
    const response = await fetch(
      `https://api.render.com/v1/services/${process.env.RENDER_SERVICE_ID}/restart`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RENDER_API_KEY}`,
          "Content-Type": "application/json",
        },
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
const PORT = process.env.PORT || 9000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`API running at http://localhost:${PORT}`);
});
