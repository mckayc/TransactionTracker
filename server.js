import fs from 'fs';
import path from 'path';
import express from 'express';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

const DATA_DIR = path.join(__dirname, 'data', 'config');
const DOCUMENTS_DIR = path.join(__dirname, 'media', 'files');
const DB_PATH = path.join(DATA_DIR, 'database.sqlite');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DOCUMENTS_DIR)) fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -128000'); // 128MB cache

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

// High-performance indexes for search and reporting
db.exec(`CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_tx_amount ON transactions(amount)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_tx_description ON transactions(description)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_tx_linkgroup ON transactions(linkGroupId)`);

db.exec(`CREATE TABLE IF NOT EXISTS files_meta (id TEXT PRIMARY KEY, original_name TEXT, disk_filename TEXT, mime_type TEXT, size INTEGER, created_at TEXT)`);

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
app.use(express.static(path.join(__dirname, 'public')));

// Fetch Transactions with Server-Side Filtering/Pagination
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
        
        // Multi-select lists (pass as comma separated strings in query)
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

        // Get Total Count for pagination info
        const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
        const total = db.prepare(countQuery).get(...params).total;

        // Sorting & Pagination
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

// Bulk Upsert Transactions
app.post('/api/transactions/bulk', (req, res) => {
    try {
        const txs = req.body;
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

// Standard Key-Value API
app.get('/api/data/:key', (req, res) => {
    const row = db.prepare('SELECT value FROM app_storage WHERE key = ?').get(req.params.key);
    if (!row) return res.json(null);
    res.type('json').send(row.value);
});
app.post('/api/data/:key', (req, res) => {
    db.prepare('INSERT INTO app_storage (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(req.params.key, JSON.stringify(req.body));
    res.json({ success: true });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, () => console.log(`Scaled Server on ${PORT}`));