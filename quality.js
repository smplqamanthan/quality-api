import express from "express";
import cors from "cors";
import mysql from "mysql2";
import fetch from "node-fetch"; // <== add this

const app = express();
app.use(cors());

// ------------------- DATABASE -------------------
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: true }
});

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
const PORT = process.env.PORT || 9000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`API running at http://localhost:${PORT}`);
});
