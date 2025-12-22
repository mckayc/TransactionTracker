
import fs from 'fs';
import path from 'path';
import express from 'express';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Directories
const DATA_DIR = path.resolve(__dirname, 'data', 'config');
const DOCUMENTS_DIR = path.resolve(__dirname, 'media', 'files');
const DB_PATH = path.join(DATA_DIR, 'database.sqlite');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DOCUMENTS_DIR)) fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

// --- DB Schema ---
db.exec(`CREATE TABLE IF NOT EXISTS app_storage (key TEXT PRIMARY KEY, value TEXT)`);
db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    categoryId TEXT,
    accountId TEXT,
    typeId TEXT,
    payeeId TEXT,
    userId TEXT,
    tagIds TEXT,
    notes TEXT,
    location TEXT,
    originalDescription TEXT,
    isParent INTEGER DEFAULT 0,
    parentTransactionId TEXT,
    linkGroupId TEXT
  )
`);
db.exec(`CREATE TABLE IF NOT EXISTS files_meta (id TEXT PRIMARY KEY, original_name TEXT, disk_filename TEXT, mime_type TEXT, size INTEGER, created_at TEXT)`);

// --- API ---
app.use(express.json({ limit: '100mb' }));
app.use(express.raw({ type: '*/*', limit: '100mb' }));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.get('/api/transactions', (req, res) => {
    try {
        const { limit = 50, offset = 0, search = '', startDate = '', endDate = '' } = req.query;
        let query = `SELECT * FROM transactions WHERE 1=1`;
        const params = [];
        if (search) { query += ` AND (description LIKE ? OR notes LIKE ?)`; params.push(`%${search}%`, `%${search}%`); }
        if (startDate) { query += ` AND date >= ?`; params.push(startDate); }
        if (endDate) { query += ` AND date <= ?`; params.push(endDate); }
        
        const total = db.prepare(query.replace('SELECT *', 'SELECT COUNT(*) as total')).get(...params).total;
        query += ` ORDER BY date DESC LIMIT ? OFFSET ?`;
        params.push(Number(limit), Number(offset));

        const rows = db.prepare(query).all(...params).map(row => ({
            ...row,
            tagIds: JSON.parse(row.tagIds || '[]'),
            isParent: row.isParent === 1
        }));
        res.json({ data: rows, total });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/transactions/bulk', (req, res) => {
    try {
        const txs = Array.isArray(req.body) ? req.body : [];
        const upsert = db.prepare(`
            INSERT INTO transactions (id, date, description, amount, categoryId, accountId, typeId, payeeId, userId, tagIds, notes, location, originalDescription, isParent, parentTransactionId, linkGroupId)
            VALUES (@id, @date, @description, @amount, @categoryId, @accountId, @typeId, @payeeId, @userId, @tagIds, @notes, @location, @originalDescription, @isParent, @parentTransactionId, @linkGroupId)
            ON CONFLICT(id) DO UPDATE SET date=excluded.date, description=excluded.description, amount=excluded.amount, categoryId=excluded.categoryId, accountId=excluded.accountId, typeId=excluded.typeId, tagIds=excluded.tagIds
        `);
        const transaction = db.transaction((items) => {
            for (const item of items) {
                upsert.run({ ...item, tagIds: JSON.stringify(item.tagIds || []), isParent: item.isParent ? 1 : 0 });
            }
        });
        transaction(txs);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/transactions', (req, res) => {
    try {
        const { ids } = req.body;
        const del = db.prepare(`DELETE FROM transactions WHERE id = ?`);
        const transaction = db.transaction((list) => { for (const id of list) del.run(id); });
        transaction(ids);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/data/:key', (req, res) => {
    const row = db.prepare('SELECT value FROM app_storage WHERE key = ?').get(req.params.key);
    res.json(row ? JSON.parse(row.value) : null);
});

app.post('/api/data/:key', (req, res) => {
    db.prepare('INSERT INTO app_storage (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(req.params.key, JSON.stringify(req.body));
    res.json({ success: true });
});

app.post('/api/files/:id', (req, res) => {
    const { id } = req.params;
    const filename = req.headers['x-filename'] || id;
    const diskFilename = `${id}_${Date.now()}`;
    fs.writeFileSync(path.join(DOCUMENTS_DIR, diskFilename), req.body);
    db.prepare(`INSERT INTO files_meta (id, original_name, disk_filename, mime_type, size, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(id, String(filename), diskFilename, req.headers['content-type'], req.body.length, new Date().toISOString());
    res.json({ success: true });
});

app.get('/api/files/:id', (req, res) => {
    const meta = db.prepare('SELECT * FROM files_meta WHERE id = ?').get(req.params.id);
    if (!meta) return res.status(404).send("Not found");
    res.setHeader('Content-Type', meta.mime_type);
    res.sendFile(path.join(DOCUMENTS_DIR, meta.disk_filename));
});

// --- Frontend ---
// Serve static files from root or dist if it exists
if (fs.existsSync(path.join(__dirname, 'dist'))) {
    app.use(express.static(path.join(__dirname, 'dist')));
}
app.use(express.static(__dirname));

// Catch-all to serve index.html for SPA routing
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not Found' });
    const indexFile = path.join(__dirname, 'index.html');
    if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
    } else {
        res.status(404).send("GUI not found. Please ensure index.html exists in the root.");
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
