
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

// 1. Key-Value Store for JSON Data (Transactions, Settings, etc.)
db.exec(`
  CREATE TABLE IF NOT EXISTS app_storage (
    key TEXT PRIMARY KEY,
    value TEXT
  )
`);

// 2. File Store for Blobs (PDFs, Images)
db.exec(`
  CREATE TABLE IF NOT EXISTS file_storage (
    id TEXT PRIMARY KEY,
    name TEXT,
    mimeType TEXT,
    data BLOB
  )
`);

// Prepare statements
const getStmt = db.prepare('SELECT value FROM app_storage WHERE key = ?');
const getAllStmt = db.prepare('SELECT key, value FROM app_storage');
const upsertStmt = db.prepare(`
  INSERT INTO app_storage (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);

const insertFileStmt = db.prepare('INSERT OR REPLACE INTO file_storage (id, name, mimeType, data) VALUES (?, ?, ?, ?)');
const getFileStmt = db.prepare('SELECT name, mimeType, data FROM file_storage WHERE id = ?');
const deleteFileStmt = db.prepare('DELETE FROM file_storage WHERE id = ?');

// Increase limit for file uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.raw({ type: 'application/octet-stream', limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// --- JSON API Routes ---

app.get('/api/data', (req, res) => {
  try {
    const rows = getAllStmt.all();
    const data = {};
    for (const row of rows) {
      try {
        data[row.key] = JSON.parse(row.value);
      } catch (parseError) {
        data[row.key] = [];
      }
    }
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Failed to read database' });
  }
});

app.post('/api/data/:key', (req, res) => {
  const { key } = req.params;
  try {
    const jsonValue = JSON.stringify(req.body);
    upsertStmt.run(key, jsonValue);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to save data' });
  }
});

// --- File API Routes ---

// Upload a file
app.post('/api/files/:id', (req, res) => {
  const { id } = req.params;
  const filename = req.headers['x-filename'] || 'unknown';
  const mimeType = req.headers['content-type'] || 'application/octet-stream';
  
  // req.body is a Buffer because of express.raw()
  try {
    insertFileStmt.run(id, filename, mimeType, req.body);
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to save file' });
  }
});

// Download a file
app.get('/api/files/:id', (req, res) => {
  const { id } = req.params;
  try {
    const file = getFileStmt.get(id);
    if (!file) {
      return res.status(404).send('File not found');
    }
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${file.name}"`);
    res.send(file.data);
  } catch (e) {
    console.error(e);
    res.status(500).send('Error retrieving file');
  }
});

// Delete a file
app.delete('/api/files/:id', (req, res) => {
  const { id } = req.params;
  try {
    deleteFileStmt.run(id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// SPA Fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
