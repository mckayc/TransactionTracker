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
const DOCUMENTS_DIR = path.join(__dirname, 'media', 'files');
const DB_PATH = path.join(DATA_DIR, 'database.sqlite');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DOCUMENTS_DIR)) fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });

// Initialize SQLite Database with performance optimizations
const db = new Database(DB_PATH);
// Use Write-Ahead Logging for better concurrency and speed
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('temp_store = MEMORY');
db.pragma('cache_size = -64000'); // ~64MB cache

// 1. Key-Value Store for JSON Data
db.exec(`
  CREATE TABLE IF NOT EXISTS app_storage (
    key TEXT PRIMARY KEY,
    value TEXT
  )
`);

// 2. Metadata Store for Files
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

const upsertAppStorage = db.prepare('INSERT INTO app_storage (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
const getAllAppStorage = db.prepare('SELECT key, value FROM app_storage');
const insertFileMeta = db.prepare('INSERT OR REPLACE INTO files_meta (id, original_name, disk_filename, mime_type, size, created_at) VALUES (?, ?, ?, ?, ?, ?)');
const getFileMeta = db.prepare('SELECT * FROM files_meta WHERE id = ?');
const deleteFileMeta = db.prepare('DELETE FROM files_meta WHERE id = ?');

app.use(express.json({ limit: '100mb' }));
app.use(express.raw({ type: '*/*', limit: '100mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const getSafeFilename = (dir, filename) => {
    let safeName = path.basename(filename).replace(/[^a-zA-Z0-9.\-_() ]/g, '_');
    if (safeName.length === 0) safeName = 'unnamed_file';
    const namePart = path.parse(safeName).name;
    const extPart = path.parse(safeName).ext;
    let finalName = safeName;
    let counter = 1;
    while (fs.existsSync(path.join(dir, finalName))) {
        finalName = `${namePart} (${counter})${extPart}`;
        counter++;
    }
    return finalName;
};

// JSON API Routes
app.get('/api/data', (req, res) => {
  try {
    const rows = getAllAppStorage.all();
    const data = {};
    for (const row of rows) {
      try {
        data[row.key] = JSON.parse(row.value);
      } catch (e) { data[row.key] = []; }
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
    upsertAppStorage.run(key, JSON.stringify(req.body));
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to save data' });
  }
});

// File API Routes
app.post('/api/files/:id', (req, res) => {
  const { id } = req.params;
  const rawFilename = req.headers['x-filename'] || 'unknown.bin';
  const mimeType = req.headers['content-type'] || 'application/octet-stream';
  try {
    let buffer = req.body; 
    if (!Buffer.isBuffer(buffer)) {
        if (typeof buffer === 'object' && buffer !== null) buffer = Buffer.from(JSON.stringify(buffer, null, 2));
        else return res.status(400).json({ error: 'Invalid file data' });
    }
    const diskFilename = getSafeFilename(DOCUMENTS_DIR, rawFilename);
    fs.writeFileSync(path.join(DOCUMENTS_DIR, diskFilename), buffer);
    insertFileMeta.run(id, rawFilename, diskFilename, mimeType, buffer.length, new Date().toISOString());
    res.json({ success: true, filename: diskFilename });
  } catch (e) {
    console.error(`Upload error:`, e);
    res.status(500).send(`Failed to save file: ${e.message}`);
  }
});

app.get('/api/files/:id', (req, res) => {
  const { id } = req.params;
  try {
    const meta = getFileMeta.get(id);
    if (!meta) return res.status(404).send('File not found');
    const filePath = path.join(DOCUMENTS_DIR, meta.disk_filename);
    if (!fs.existsSync(filePath)) return res.status(404).send('Content missing');
    res.setHeader('Content-Type', meta.mime_type);
    res.setHeader('Content-Disposition', `inline; filename="${meta.original_name}"`);
    res.sendFile(filePath);
  } catch (e) { res.status(500).send('Error'); }
});

app.delete('/api/files/:id', (req, res) => {
  const { id } = req.params;
  try {
    const meta = getFileMeta.get(id);
    if (meta) {
        const filePath = path.join(DOCUMENTS_DIR, meta.disk_filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        deleteFileMeta.run(id);
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`Server on ${PORT}, Storage: ${DOCUMENTS_DIR}`));