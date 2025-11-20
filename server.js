
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
// Store documents in a separate volume for easier access and management
const DOCUMENTS_DIR = path.join(__dirname, 'media', 'files');
const DB_PATH = path.join(DATA_DIR, 'database.sqlite');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(DOCUMENTS_DIR)) {
  fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });
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

// 2. Metadata Store for Files (actual content is now on disk)
db.exec(`
  CREATE TABLE IF NOT EXISTS files_meta (
    id TEXT PRIMARY KEY,
    original_name TEXT,
    disk_filename TEXT,
    mime_type TEXT,
    size INTEGER,
    created_at TEXT
  )
`);

// Prepared statements
const upsertAppStorage = db.prepare(`
  INSERT INTO app_storage (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);
const getAllAppStorage = db.prepare('SELECT key, value FROM app_storage');

const insertFileMeta = db.prepare('INSERT OR REPLACE INTO files_meta (id, original_name, disk_filename, mime_type, size, created_at) VALUES (?, ?, ?, ?, ?, ?)');
const getFileMeta = db.prepare('SELECT * FROM files_meta WHERE id = ?');
const deleteFileMeta = db.prepare('DELETE FROM files_meta WHERE id = ?');

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.raw({ type: 'application/octet-stream', limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Utility: Generate unique readable filename
const getSafeFilename = (dir, filename) => {
    // Sanitize basic filename to prevent directory traversal and weird chars
    let safeName = path.basename(filename).replace(/[^a-zA-Z0-9.\-_() ]/g, '_');
    if (safeName.length === 0) safeName = 'unnamed_file';
    
    const namePart = path.parse(safeName).name;
    const extPart = path.parse(safeName).ext;
    
    let finalName = safeName;
    let counter = 1;
    
    // If file exists, append (1), (2), etc. like Windows/Mac
    while (fs.existsSync(path.join(dir, finalName))) {
        finalName = `${namePart} (${counter})${extPart}`;
        counter++;
    }
    return finalName;
};

// --- JSON API Routes ---

app.get('/api/data', (req, res) => {
  try {
    const rows = getAllAppStorage.all();
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
    console.error(e);
    res.status(500).json({ error: 'Failed to read database' });
  }
});

app.post('/api/data/:key', (req, res) => {
  const { key } = req.params;
  try {
    const jsonValue = JSON.stringify(req.body);
    upsertAppStorage.run(key, jsonValue);
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to save data' });
  }
});

// --- File API Routes (Disk Storage) ---

app.post('/api/files/:id', (req, res) => {
  const { id } = req.params;
  const rawFilename = req.headers['x-filename'] || 'unknown.bin';
  const mimeType = req.headers['content-type'] || 'application/octet-stream';
  
  try {
    const buffer = req.body; // Buffer from express.raw
    if (!Buffer.isBuffer(buffer)) {
        return res.status(400).json({ error: 'Invalid file data' });
    }

    const diskFilename = getSafeFilename(DOCUMENTS_DIR, rawFilename);
    const filePath = path.join(DOCUMENTS_DIR, diskFilename);

    fs.writeFileSync(filePath, buffer);

    insertFileMeta.run(id, rawFilename, diskFilename, mimeType, buffer.length, new Date().toISOString());
    
    console.log(`Saved file: ${diskFilename} (ID: ${id})`);
    res.json({ success: true, filename: diskFilename });
  } catch (e) {
    console.error('Upload error:', e);
    res.status(500).json({ error: 'Failed to save file' });
  }
});

app.get('/api/files/:id', (req, res) => {
  const { id } = req.params;
  try {
    const meta = getFileMeta.get(id);
    
    if (!meta) {
        return res.status(404).send('File not found');
    }

    const filePath = path.join(DOCUMENTS_DIR, meta.disk_filename);
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).send('File content missing on disk');
    }

    res.setHeader('Content-Type', meta.mime_type);
    res.setHeader('Content-Disposition', `inline; filename="${meta.original_name}"`);
    res.sendFile(filePath);
  } catch (e) {
    console.error('Download error:', e);
    res.status(500).send('Error retrieving file');
  }
});

app.delete('/api/files/:id', (req, res) => {
  const { id } = req.params;
  try {
    const meta = getFileMeta.get(id);
    if (meta) {
        const filePath = path.join(DOCUMENTS_DIR, meta.disk_filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        deleteFileMeta.run(id);
    }
    res.json({ success: true });
  } catch (e) {
    console.error('Delete error:', e);
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
