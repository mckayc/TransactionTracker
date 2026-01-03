
import fs from 'fs';
import path from 'path';
import express from 'express';
import { fileURLToPath } from 'url';
import os from 'os';
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

// 2. IMMEDIATE MIDDLEWARE
app.use(express.json({ limit: '100mb' }));
// Scoped raw parser for files to avoid interfering with JSON data routes
app.use('/api/files', express.raw({ type: '*/*', limit: '100mb' }));

// Health endpoint for Docker/Proxy
app.get('/api/health', (req, res) => res.status(200).json({ status: 'live', timestamp: new Date().toISOString() }));

// 3. START LISTENING
const server = app.listen(PORT, '0.0.0.0', () => {
    const interfaces = os.networkInterfaces();
    const addresses = [];
    for (const k in interfaces) {
        for (const k2 in interfaces[k]) {
            const address = interfaces[k][k2];
            if (address.family === 'IPv4' && !address.internal) {
                addresses.push(address.address);
            }
        }
    }
    console.log(`🚀 FINPARSER SERVER ON PORT: ${PORT}`);
    console.log(`[DB] Using file: ${DB_PATH}`);
});

// 4. BACKGROUND INITIALIZATION
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DOCUMENTS_DIR)) fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });
if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });

let db;
try {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS app_storage (key TEXT PRIMARY KEY, value TEXT);
      CREATE TABLE IF NOT EXISTS files_meta (id TEXT PRIMARY KEY, original_name TEXT, disk_filename TEXT, mime_type TEXT, size INTEGER, created_at TEXT);
    `);
    console.log("[DB] Ready.");
} catch (dbErr) {
    console.error("[DB] Critical error:", dbErr);
}

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
    console.log(`[DB] Fetching all data (${rows.length} keys)`);
    const data = {};
    for (const row of rows) {
      try { data[row.key] = JSON.parse(row.value); } catch (e) { data[row.key] = null; }
    }
    res.json(data);
  } catch (e) { 
    console.error("[DB] Failed to read all data:", e);
    res.status(500).json({ error: 'Failed to read' }); 
  }
});

app.get('/api/data/:key', (req, res) => {
    try {
        console.log(`[DB] Fetching specific key: ${req.params.key}`);
        const row = getSpecificAppStorage.get(req.params.key);
        if (!row) return res.status(404).json({ error: 'Not found' });
        res.json(JSON.parse(row.value));
    } catch (e) { 
        console.error(`[DB] Failed to fetch key ${req.params.key}:`, e);
        res.status(500).json({ error: 'Failed to fetch' }); 
    }
});

app.post('/api/data/:key', (req, res) => {
  try {
    console.log(`[DB] Saving key: ${req.params.key}`);
    upsertAppStorage.run(req.params.key, JSON.stringify(req.body));
    res.json({ success: true });
  } catch (e) { 
      console.error(`[DB] Save error for ${req.params.key}:`, e);
      res.status(500).json({ error: 'Failed to save' }); 
  }
});

app.post('/api/admin/reset', (req, res) => {
    try {
        console.warn("[DB] PURGE COMMAND RECEIVED");
        db.prepare('DELETE FROM app_storage').run();
        db.prepare('DELETE FROM files_meta').run();
        const files = fs.readdirSync(DOCUMENTS_DIR);
        for (const file of files) fs.unlinkSync(path.join(DOCUMENTS_DIR, file));
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'Reset failed' }); }
});

// 6. AI PROXY ROUTES
app.post('/api/ai/generate', async (req, res) => {
    try {
        const { model, contents, config } = req.body;
        if (!process.env.API_KEY) throw new Error("Server API_KEY missing.");
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({ model, contents, config });
        res.json({ text: response.text, candidates: response.candidates });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/ai/stream', async (req, res) => {
    try {
        const { model, contents, config } = req.body;
        if (!process.env.API_KEY) throw new Error("Server API_KEY missing.");
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const responseStream = await ai.models.generateContentStream({ model, contents, config });
        res.setHeader('Content-Type', 'text/event-stream');
        for await (const chunk of responseStream) {
            res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
        }
        res.end();
    } catch (e) { res.status(500).end(); }
});

// 7. FILE API ROUTES
app.post('/api/files/:id', (req, res) => {
  const { id } = req.params;
  const rawFilename = req.headers['x-filename'] || 'unknown.bin';
  const mimeType = req.headers['content-type'] || 'application/octet-stream';
  try {
    const diskFilename = `${Date.now()}_${rawFilename.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    fs.writeFileSync(path.join(DOCUMENTS_DIR, diskFilename), req.body);
    insertFileMeta.run(id, rawFilename, diskFilename, mimeType, req.body.length, new Date().toISOString());
    console.log(`[FILE] Saved: ${rawFilename} as ${diskFilename}`);
    res.json({ success: true });
  } catch (e) { res.status(500).send(e.message); }
});

app.get('/api/files/:id', (req, res) => {
  try {
    const meta = getFileMeta.get(req.params.id);
    if (!meta) return res.status(404).send('Not found');
    res.setHeader('Content-Type', meta.mime_type);
    res.sendFile(path.join(DOCUMENTS_DIR, meta.disk_filename));
  } catch (e) { res.status(500).send('Error'); }
});

app.delete('/api/files/:id', (req, res) => {
  try {
    const meta = getFileMeta.get(req.params.id);
    if (meta) {
        fs.unlinkSync(path.join(DOCUMENTS_DIR, meta.disk_filename));
        deleteFileMeta.run(req.params.id);
        console.log(`[FILE] Deleted: ${meta.original_name}`);
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

app.use(express.static(PUBLIC_DIR));
app.get('*', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));
