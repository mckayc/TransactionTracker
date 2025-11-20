
import fs from 'fs';
import path from 'path';
import express from 'express';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Data Configuration
const DATA_DIR = path.join(__dirname, 'data', 'config');
const DB_PATH = path.join(DATA_DIR, 'database.sqlite');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize SQLite Database
const db = new Database(DB_PATH);
// Create a simple Key-Value table to store the application state
db.exec(`
  CREATE TABLE IF NOT EXISTS app_storage (
    key TEXT PRIMARY KEY,
    value TEXT
  )
`);

// Prepare statements for better performance
const getStmt = db.prepare('SELECT value FROM app_storage WHERE key = ?');
const getAllStmt = db.prepare('SELECT key, value FROM app_storage');
const upsertStmt = db.prepare(`
  INSERT INTO app_storage (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// API Routes

// Load all data (matches the behavior of the previous JSON implementation)
app.get('/api/data', (req, res) => {
  try {
    const rows = getAllStmt.all();
    const data = {};
    
    // Reconstruct the full state object from rows
    for (const row of rows) {
      try {
        data[row.key] = JSON.parse(row.value);
      } catch (parseError) {
        console.error(`Failed to parse data for key ${row.key}`, parseError);
        data[row.key] = []; // Fallback
      }
    }
    
    res.json(data);
  } catch (e) {
    console.error("Error reading DB:", e);
    res.status(500).json({ error: 'Failed to read database' });
  }
});

// Save specific key (e.g., 'transactions', 'accounts')
app.post('/api/data/:key', (req, res) => {
  const { key } = req.params;
  const value = req.body;
  
  try {
    const jsonValue = JSON.stringify(value);
    upsertStmt.run(key, jsonValue);
    res.json({ success: true });
  } catch (e) {
    console.error(`Error writing ${key} to DB:`, e);
    res.status(500).json({ error: 'Failed to save data' });
  }
});

// SPA Fallback (Serve index.html for any other route)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`SQLite Database: ${DB_PATH}`);
});
