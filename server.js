import fs from 'fs';
import path from 'path';
import express from 'express';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// 1. DATA CONFIGURATION
const DATA_DIR = path.join(__dirname, 'data', 'config');
const DOCUMENTS_DIR = path.join(__dirname, 'media', 'files');
const DB_PATH = path.join(DATA_DIR, 'database.sqlite');
const PUBLIC_DIR = path.join(__dirname, 'public');

// 2. IMMEDIATE MIDDLEWARE & HEALTH
app.use(express.json({ limit: '100mb' }));
app.use(express.raw({ type: '*/*', limit: '100mb' }));

// Health endpoint for Docker/Proxy - Respond immediately
app.get('/api/health', (req, res) => res.status(200).json({ status: 'live', timestamp: new Date().toISOString() }));

// 3. START LISTENING IMMEDIATELY
// This ensures the port is open and the browser doesn't get "Site cannot be reached"
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log("-----------------------------------------");
    console.log(`✅ SERVER PORT ${PORT} OPEN`);
    console.log("-----------------------------------------");
});

// 4. BACKGROUND INITIALIZATION
// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DOCUMENTS_DIR)) fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });
if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });

// Initialize SQLite Database
console.log("Initializing database...");
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS app_storage (
    key TEXT PRIMARY KEY,
    value TEXT
  )
`);

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
const getSpecificAppStorage = db.prepare('SELECT value FROM app_storage WHERE key = ?');
const insertFileMeta = db.prepare('INSERT OR REPLACE INTO files_meta (id, original_name, disk_filename, mime_type, size, created_at) VALUES (?, ?, ?, ?, ?, ?)');
const getFileMeta = db.prepare('SELECT * FROM files_meta WHERE id = ?');
const deleteFileMeta = db.prepare('DELETE FROM files_meta WHERE id = ?');

// 5. JSON API ROUTES
app.get('/api/data', (req, res) => {
  try {
    const rows = getAllAppStorage.all();
    const data = {};
    for (const row of rows) {
      try { data[row.key] = JSON.parse(row.value); } catch (e) { data[row.key] = []; }
    }
    res.json(data);
  } catch (e) { res.status(500).json({ error: 'Failed to read database' }); }
});

app.get('/api/data/:key', (req, res) => {
    const { key } = req.params;
    try {
        const row = getSpecificAppStorage.get(key);
        if (!row) return res.json(null);
        res.json(JSON.parse(row.value));
    } catch (e) { res.status(500).json({ error: 'Failed to fetch' }); }
});

app.post('/api/data/:key', (req, res) => {
  const { key } = req.params;
  try {
    upsertAppStorage.run(key, JSON.stringify(req.body));
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Failed to save' }); }
});

// 6. AI PROXY ROUTES
app.post('/api/ai/generate', async (req, res) => {
    try {
        const { model, contents, config } = req.body;
        if (!process.env.API_KEY) throw new Error("Server API_KEY is not configured.");
        
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({ model, contents, config });
        res.json({ text: response.text, candidates: response.candidates });
    } catch (e) {
        console.error("AI Error:", e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/ai/stream', async (req, res) => {
    try {
        const { model, contents, config } = req.body;
        if (!process.env.API_KEY) throw new Error("Server API_KEY is not configured.");

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const responseStream = await ai.models.generateContentStream({ model, contents, config });
        
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        for await (const chunk of responseStream) {
            res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
        }
        res.end();
    } catch (e) {
        console.error("AI Stream Error:", e);
        res.status(500).end();
    }
});

// 7. FILE API ROUTES
app.post('/api/files/:id', (req, res) => {
  const { id } = req.params;
  const rawFilename = req.headers['x-filename'] || 'unknown.bin';
  const mimeType = req.headers['content-type'] || 'application/octet-stream';
  try {
    let buffer = req.body; 
    if (!Buffer.isBuffer(buffer)) {
        if (typeof buffer === 'object' && buffer !== null) buffer = Buffer.from(JSON.stringify(buffer));
        else return res.status(400).send('Invalid data');
    }
    const diskFilename = `${Date.now()}_${rawFilename.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    fs.writeFileSync(path.join(DOCUMENTS_DIR, diskFilename), buffer);
    insertFileMeta.run(id, rawFilename, diskFilename, mimeType, buffer.length, new Date().toISOString());
    res.json({ success: true });
  } catch (e) { res.status(500).send(e.message); }
});

app.get('/api/files/:id', (req, res) => {
  const { id } = req.params;
  try {
    const meta = getFileMeta.get(id);
    if (!meta) return res.status(404).send('Not found');
    res.setHeader('Content-Type', meta.mime_type);
    res.sendFile(path.join(DOCUMENTS_DIR, meta.disk_filename));
  } catch (e) { res.status(500).send('Error'); }
});

app.delete('/api/files/:id', (req, res) => {
  const { id } = req.params;
  try {
    const meta = getFileMeta.get(id);
    if (meta) {
        fs.unlinkSync(path.join(DOCUMENTS_DIR, meta.disk_filename));
        deleteFileMeta.run(id);
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// 8. FINAL FRONTEND DELIVERY
app.use(express.static(PUBLIC_DIR));
app.get('*', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

console.log("✅ BACKGROUND INIT COMPLETE");
