// quality.js
import express from "express";
import cors from "cors";
import mysql from "mysql2";

const app = express();

// ------------------- MIDDLEWARE -------------------
app.use(cors()); // Allow frontend fetch
app.use(express.json()); // parse JSON

// ------------------- DATABASE -------------------
// Use environment variables for sensitive info
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 4000,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: true }
});

// Test database connection on startup
db.connect(err => {
  if (err) {
    console.error("❌ Failed to connect to TiDB:", err);
  } else {
    console.log("✅ Connected to TiDB Cloud successfully");
  }
});

// ------------------- API ENDPOINTS -------------------
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
    return res.json([]); // always return an array
  }

  console.log("Running query:", query, params);

  db.query(query, params, (err, results) => {
    if (err) {
      console.error("DB error:", err);
      return res.status(500).json({ error: "Database query failed" });
    }

    res.json(Array.isArray(results) ? results : []);
  });
});

// ------------------- SERVER -------------------
const PORT = process.env.PORT || 9000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 API running on port ${PORT}`);
});
