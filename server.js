
import fs from 'fs';
import path from 'path';
import express from 'express';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Configuration for directories
const DATA_DIR = path.join(__dirname, 'data', 'config');
const DOCUMENTS_DIR = path.join(__dirname, 'media', 'files');
const DB_PATH = path.join(DATA_DIR, 'database.sqlite');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DOCUMENTS_DIR)) fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -128000'); // 128MB cache

// --- Database Schema ---

// 1. Key-Value for metadata
db.exec(`CREATE TABLE IF NOT EXISTS app_storage (key TEXT PRIMARY KEY, value TEXT)`);

// 2. Relational table for Transactions (Scaling to millions)
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
    tagIds TEXT, -- Stored as JSON string
    notes TEXT,
    location TEXT,
    originalDescription TEXT,
    isParent INTEGER DEFAULT 0,
    parentTransactionId TEXT,
    linkGroupId TEXT
  )
`);

// High-performance indexes
db.exec(`CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_tx_amount ON transactions(amount)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_tx_description ON transactions(description)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_tx_linkgroup ON transactions(linkGroupId)`);

// 3. Metadata for uploaded files
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

// --- Migration Logic: JSON Blob to Relational ---
const migrateLegacyData = () => {
    const legacyData = db.prepare('SELECT value FROM app_storage WHERE key = ?').get('transactions');
    if (legacyData) {
        try {
            const txs = JSON.parse(legacyData.value);
            if (Array.isArray(txs) && txs.length > 0) {
                console.log(`Migrating ${txs.length} legacy transactions to relational schema...`);
                const insert = db.prepare(`
                    INSERT OR IGNORE INTO transactions (id, date, description, amount, categoryId, accountId, typeId, payeeId, userId, tagIds, notes, location, originalDescription, isParent, parentTransactionId, linkGroupId)
                    VALUES (@id, @date, @description, @amount, @categoryId, @accountId, @typeId, @payeeId, @userId, @tagIds, @notes, @location, @originalDescription, @isParent, @parentTransactionId, @linkGroupId)
                `);
                const transaction = db.transaction((items) => {
                    for (const item of items) {
                        insert.run({
                            ...item,
                            tagIds: JSON.stringify(item.tagIds || []),
                            isParent: item.isParent ? 1 : 0
                        });
                    }
                });
                transaction(txs);
                db.prepare('DELETE FROM app_storage WHERE key = ?').run('transactions');
                console.log('Migration complete.');
            }
        } catch (e) { console.error("Migration failed", e); }
    }
};
migrateLegacyData();

// --- API Implementation ---

app.use(express.json({ limit: '100mb' }));
app.use(express.raw({ type: '*/*', limit: '100mb' }));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', database: DB_PATH }));

// 1. Relational Transactions API
app.get('/api/transactions', (req, res) => {
    try {
        const { 
            limit = 50, offset = 0, 
            search = '', startDate = '', endDate = '', 
            sort = 'date', order = 'desc',
            categoryIds, typeIds, accountIds, userIds, payeeIds
        } = req.query;

        let query = `SELECT * FROM transactions WHERE 1=1`;
        const params = [];

        if (search) {
            query += ` AND (description LIKE ? OR amount LIKE ? OR notes LIKE ? OR location LIKE ?)`;
            const s = `%${search}%`;
            params.push(s, s, s, s);
        }
        if (startDate) { query += ` AND date >= ?`; params.push(startDate); }
        if (endDate) { query += ` AND date <= ?`; params.push(endDate); }
        
        const addInClause = (field, values) => {
            if (values) {
                const list = values.split(',');
                query += ` AND ${field} IN (${list.map(() => '?').join(',')})`;
                params.push(...list);
            }
        };
        addInClause('categoryId', categoryIds);
        addInClause('typeId', typeIds);
        addInClause('accountId', accountIds);
        addInClause('userId', userIds);
        addInClause('payeeId', payeeIds);

        const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
        const total = db.prepare(countQuery).get(...params).total;

        query += ` ORDER BY ${sort} ${order === 'asc' ? 'ASC' : 'DESC'}`;
        query += ` LIMIT ? OFFSET ?`;
        params.push(Number(limit), Number(offset));

        const rows = db.prepare(query).all(...params).map(row => ({
            ...row,
            tagIds: JSON.parse(row.tagIds || '[]'),
            isParent: row.isParent === 1
        }));

        res.json({ data: rows, total, limit: Number(limit), offset: Number(offset) });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/transactions/bulk', (req, res) => {
    try {
        const txs = Array.isArray(req.body) ? req.body : [];
        if (txs.length === 0) return res.json({ success: true, count: 0 });

        const upsert = db.prepare(`
            INSERT INTO transactions (id, date, description, amount, categoryId, accountId, typeId, payeeId, userId, tagIds, notes, location, originalDescription, isParent, parentTransactionId, linkGroupId)
            VALUES (@id, @date, @description, @amount, @categoryId, @accountId, @typeId, @payeeId, @userId, @tagIds, @notes, @location, @originalDescription, @isParent, @parentTransactionId, @linkGroupId)
            ON CONFLICT(id) DO UPDATE SET
                date=excluded.date, description=excluded.description, amount=excluded.amount, categoryId=excluded.categoryId,
                accountId=excluded.accountId, typeId=excluded.typeId, payeeId=excluded.payeeId, userId=excluded.userId,
                tagIds=excluded.tagIds, notes=excluded.notes, location=excluded.location, originalDescription=excluded.originalDescription,
                isParent=excluded.isParent, parentTransactionId=excluded.parentTransactionId, linkGroupId=excluded.linkGroupId
        `);
        
        const transaction = db.transaction((items) => {
            for (const item of items) {
                upsert.run({
                    ...item,
                    tagIds: JSON.stringify(item.tagIds || []),
                    isParent: item.isParent ? 1 : 0
                });
            }
        });
        transaction(txs);
        res.json({ success: true, count: txs.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/transactions', (req, res) => {
    const { ids } = req.body;
    if (!ids || !ids.length) return res.status(400).send("No IDs");
    try {
        const del = db.prepare(`DELETE FROM transactions WHERE id = ?`);
        const transaction = db.transaction((list) => { for (const id of list) del.run(id); });
        transaction(ids);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 2. Standard Key-Value API
app.get('/api/data/:key', (req, res) => {
    try {
        const row = db.prepare('SELECT value FROM app_storage WHERE key = ?').get(req.params.key);
        if (!row) return res.json(null);
        res.type('json').send(row.value);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/data/:key', (req, res) => {
    try {
        db.prepare('INSERT INTO app_storage (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
          .run(req.params.key, JSON.stringify(req.body));
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 3. File Storage API (Document Vault)
app.post('/api/files/:id', (req, res) => {
    const { id } = req.params;
    const filename = req.headers['x-filename'] || id;
    const contentType = req.headers['content-type'] || 'application/octet-stream';
    const diskFilename = `${id}_${Date.now()}`;
    const fullPath = path.join(DOCUMENTS_DIR, diskFilename);

    try {
        // req.body contains the raw binary if using raw parser
        fs.writeFileSync(fullPath, req.body);

        db.prepare(`
            INSERT INTO files_meta (id, original_name, disk_filename, mime_type, size, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET 
                original_name=excluded.original_name, 
                disk_filename=excluded.disk_filename, 
                mime_type=excluded.mime_type, 
                size=excluded.size
        `).run(id, String(filename), diskFilename, contentType, req.body.length, new Date().toISOString());

        res.json({ success: true, id });
    } catch (e) {
        console.error(e);
        res.status(500).send(e.message);
    }
});

app.get('/api/files/:id', (req, res) => {
    const { id } = req.params;
    try {
        const meta = db.prepare('SELECT * FROM files_meta WHERE id = ?').get(id);
        if (!meta) return res.status(404).send("File not found");

        const fullPath = path.join(DOCUMENTS_DIR, meta.disk_filename);
        if (!fs.existsSync(fullPath)) return res.status(404).send("File contents missing on disk");

        res.setHeader('Content-Type', meta.mime_type);
        res.setHeader('Content-Disposition', `attachment; filename="${meta.original_name}"`);
        res.sendFile(fullPath);
    } catch (e) {
        res.status(500).send(e.message);
    }
});

app.delete('/api/files/:id', (req, res) => {
    const { id } = req.params;
    try {
        const meta = db.prepare('SELECT * FROM files_meta WHERE id = ?').get(id);
        if (meta) {
            const fullPath = path.join(DOCUMENTS_DIR, meta.disk_filename);
            if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
            db.prepare('DELETE FROM files_meta WHERE id = ?').run(id);
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).send(e.message);
    }
});

// Serve static files from root
app.use(express.static(__dirname));

// Fallback to index.html for SPA routing (MUST be last)
app.get('*', (req, res) => {
    // Safety check for API routes - if it starts with /api but didn't match anything above, 404
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    // Serve index.html for all other routes to let React Router/Client-side routing handle it
    const indexFile = path.join(__dirname, 'index.html');
    if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
    } else {
        res.status(404).send("Frontend index.html not found. Please build the app.");
    }
});

app.listen(PORT, () => console.log(`FinParser Server active on http://localhost:${PORT}`));
