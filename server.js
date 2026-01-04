
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

// Internal Logger Helper
const log = (step, message) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${step}] ${message}`);
};

const startTime = Date.now();
log('INIT', 'FinParser Server starting up...');

// 1. DATA CONFIGURATION
const DATA_DIR = path.join(__dirname, 'data', 'config');
const DOCUMENTS_DIR = path.join(__dirname, 'media', 'files');
const DB_PATH = path.join(DATA_DIR, 'database.sqlite');
const PUBLIC_DIR = path.join(__dirname, 'public');

log('FS', `Validating environment directories...`);
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    log('FS', `Created Data directory at ${DATA_DIR}`);
}
if (!fs.existsSync(DOCUMENTS_DIR)) {
    fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });
    log('FS', `Created Documents directory at ${DOCUMENTS_DIR}`);
}
if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

// 2. DATABASE INITIALIZATION
let db;
try {
    log('DB', `Connecting to SQLite: ${DB_PATH}`);
    db = new Database(DB_PATH);
    
    log('DB', `Setting Pragmas (WAL mode, 10s timeout)...`);
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 10000'); 
    
    log('DB', `Checking/Creating table schemas...`);
    db.exec(`
      CREATE TABLE IF NOT EXISTS app_storage (key TEXT PRIMARY KEY, value TEXT);
      CREATE TABLE IF NOT EXISTS files_meta (id TEXT PRIMARY KEY, original_name TEXT, disk_filename TEXT, mime_type TEXT, size INTEGER, created_at TEXT);
    `);
    log('DB', `Database engine is ready.`);
} catch (dbErr) {
    log('CRITICAL', `Database initialization failed: ${dbErr.message}`);
    process.exit(1);
}

const upsertAppStorage = db.prepare('INSERT INTO app_storage (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
const getAllAppStorage = db.prepare('SELECT key, value FROM app_storage');
const getSpecificAppStorage = db.prepare('SELECT value FROM app_storage WHERE key = ?');
const insertFileMeta = db.prepare('INSERT OR REPLACE INTO files_meta (id, original_name, disk_filename, mime_type, size, created_at) VALUES (?, ?, ?, ?, ?, ?)');
const getFileMeta = db.prepare('SELECT * FROM files_meta WHERE id = ?');
const deleteFileMeta = db.prepare('DELETE FROM files_meta WHERE id = ?');

// 3. MIDDLEWARE
log('API', `Configuring middleware (JSON limit: 200mb)...`);
app.use(express.json({ limit: '200mb' })); 
app.use('/api/files', express.raw({ type: '*/*', limit: '100mb' }));

// Health endpoint for Docker/Proxy
app.get('/api/health', (req, res) => res.status(200).json({ status: 'live', timestamp: new Date().toISOString() }));

// 4. JSON API ROUTES
app.get('/api/data', (req, res) => {
  const fetchStart = Date.now();
  try {
    const rows = getAllAppStorage.all();
    const data = {};
    let parseErrors = 0;
    
    for (const row of rows) {
      try { 
          data[row.key] = JSON.parse(row.value); 
      } catch (e) { 
          data[row.key] = null; 
          parseErrors++;
      }
    }
    const duration = Date.now() - fetchStart;
    log('API', `GET /api/data: Retreived ${rows.length} keys in ${duration}ms. ${parseErrors > 0 ? `Warnings: ${parseErrors} parse errors.` : ''}`);
    res.json(data);
  } catch (e) { 
    console.error("[DB] Failed to read all data:", e);
    res.status(500).json({ error: 'Database is busy. Refreshing may help.' }); 
  }
});

app.get('/api/data/:key', (req, res) => {
    try {
        const row = getSpecificAppStorage.get(req.params.key);
        if (!row) return res.status(404).json({ error: 'Not found' });
        res.json(JSON.parse(row.value));
    } catch (e) { 
        console.error(`[DB] Failed to fetch key ${req.params.key}:`, e);
        res.status(500).json({ error: 'Database error' }); 
    }
});

app.post('/api/data/:key', (req, res) => {
  try {
    upsertAppStorage.run(req.params.key, JSON.stringify(req.body));
    res.json({ success: true });
  } catch (e) { 
      console.error(`[DB] Save error for ${req.params.key}:`, e);
      res.status(500).json({ error: 'Database locked or full. Please wait a moment.' }); 
  }
});

app.post('/api/admin/reset', (req, res) => {
    try {
        log('ADMIN', "DB PURGE COMMAND RECEIVED");
        const purge = db.transaction(() => {
            db.prepare('DELETE FROM app_storage').run();
            db.prepare('DELETE FROM files_meta').run();
        });
        purge();
        
        const files = fs.readdirSync(DOCUMENTS_DIR);
        for (const file of files) fs.unlinkSync(path.join(DOCUMENTS_DIR, file));
        log('ADMIN', "Database and file storage cleared successfully.");
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'Database reset failed.' }); }
});

// 5. AI PROXY ROUTES
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

// 6. FILE API ROUTES
app.post('/api/files/:id', (req, res) => {
  const { id } = req.params;
  const rawFilename = req.headers['x-filename'] || 'unknown.bin';
  const mimeType = req.headers['content-type'] || 'application/octet-stream';
  try {
    const diskFilename = `${Date.now()}_${rawFilename.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    fs.writeFileSync(path.join(DOCUMENTS_DIR, diskFilename), req.body);
    insertFileMeta.run(id, rawFilename, diskFilename, mimeType, req.body.length, new Date().toISOString());
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
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// 7. START LISTENING
app.use(express.static(PUBLIC_DIR));
app.get('*', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

const serverInstance = app.listen(PORT, '0.0.0.0', () => {
    const startupDuration = Date.now() - startTime;
    log('READY', `FinParser Server listening on port ${PORT}`);
    log('READY', `Total startup time: ${startupDuration}ms`);
});
