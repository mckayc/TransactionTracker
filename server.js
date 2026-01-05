
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

const DATA_DIR = path.join(__dirname, 'data', 'config');
const DOCUMENTS_DIR = path.join(__dirname, 'media', 'files');
const DB_PATH = path.join(DATA_DIR, 'database.sqlite');
const PUBLIC_DIR = path.join(__dirname, 'public');

app.use(express.json({ limit: '100mb' }));
app.use('/api/files', express.raw({ type: '*/*', limit: '100mb' }));

app.get('/api/health', (req, res) => res.status(200).json({ status: 'live', timestamp: new Date().toISOString() }));

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DOCUMENTS_DIR)) fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });
if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });

console.log("---------------------------------------------------------");
console.log(`[SYS] Data Engine Starting...`);
console.log(`[SYS] Database Path: ${DB_PATH}`);
console.log("---------------------------------------------------------");

let db;

const initDb = () => {
    try {
        db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL');
        db.pragma('busy_timeout = 5000');
        
        console.log("[DB] Initializing core tables...");
        
        db.exec(`
          CREATE TABLE IF NOT EXISTS app_storage (key TEXT PRIMARY KEY, value TEXT);
          CREATE TABLE IF NOT EXISTS files_meta (id TEXT PRIMARY KEY, original_name TEXT, disk_filename TEXT, mime_type TEXT, size INTEGER, created_at TEXT);
          CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, name TEXT, parent_id TEXT);
          CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, name TEXT, identifier TEXT, account_type_id TEXT);
          CREATE TABLE IF NOT EXISTS transaction_types (id TEXT PRIMARY KEY, name TEXT);
          CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT, is_default INTEGER);
          CREATE TABLE IF NOT EXISTS payees (id TEXT PRIMARY KEY, name TEXT, parent_id TEXT, notes TEXT, user_id TEXT);
          CREATE TABLE IF NOT EXISTS tags (id TEXT PRIMARY KEY, name TEXT, color TEXT);

          CREATE TABLE IF NOT EXISTS transactions (
              id TEXT PRIMARY KEY,
              date TEXT,
              description TEXT,
              amount REAL
          );

          CREATE TABLE IF NOT EXISTS transaction_tags (
              transaction_id TEXT,
              tag_id TEXT,
              PRIMARY KEY (transaction_id, tag_id)
          );
        `);

        // Migration Engine
        const migrateTable = (tableName, requiredCols) => {
            const tableInfo = db.prepare(`PRAGMA table_info(${tableName})`).all();
            const existingColumns = new Set(tableInfo.map(c => c.name));
            db.transaction(() => {
                requiredCols.forEach(col => {
                    if (!existingColumns.has(col.name)) {
                        db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${col.name} ${col.type}`).run();
                    }
                });
            })();
        };

        migrateTable('transactions', [
            { name: 'category_id', type: 'TEXT' },
            { name: 'account_id', type: 'TEXT' },
            { name: 'type_id', type: 'TEXT' },
            { name: 'payee_id', type: 'TEXT' },
            { name: 'user_id', type: 'TEXT' },
            { name: 'location', type: 'TEXT' },
            { name: 'notes', type: 'TEXT' },
            { name: 'original_description', type: 'TEXT' },
            { name: 'source_filename', type: 'TEXT' },
            { name: 'link_group_id', type: 'TEXT' },
            { name: 'is_parent', type: 'INTEGER DEFAULT 0' },
            { name: 'parent_transaction_id', type: 'TEXT' },
            { name: 'is_completed', type: 'INTEGER DEFAULT 0' },
            { name: 'metadata', type: 'TEXT' }
        ]);

        migrateTable('transaction_types', [{ name: 'balance_effect', type: 'TEXT' }]);

        // Seeder
        const typeCount = db.prepare("SELECT COUNT(*) as count FROM transaction_types").get().count;
        if (typeCount === 0) {
            const insertType = db.prepare("INSERT INTO transaction_types (id, name, balance_effect) VALUES (?, ?, ?)");
            db.transaction(() => {
                insertType.run('type_income', 'Income', 'income');
                insertType.run('type_purchase', 'Purchase', 'expense');
                insertType.run('type_transfer', 'Transfer', 'transfer');
                insertType.run('type_tax', 'Tax Payment', 'tax');
                insertType.run('type_investment', 'Investment', 'investment');
            })();
        }

        console.log("[DB] Engine ready.");
    } catch (dbErr) {
        console.error("[DB] CRITICAL ERROR:", dbErr.message);
    }
};

initDb();

const buildTxFilters = (params) => {
    const { search, startDate, endDate, accountIds, categoryIds, userId } = params;
    let filterQuery = ` WHERE 1=1 AND t.is_parent = 0`;
    const values = [];
    if (search) {
        filterQuery += ` AND (t.description LIKE ? OR t.notes LIKE ? OR t.original_description LIKE ?)`;
        const s = `%${search}%`;
        values.push(s, s, s);
    }
    if (startDate) { filterQuery += ` AND t.date >= ?`; values.push(startDate); }
    if (endDate) { filterQuery += ` AND t.date <= ?`; values.push(endDate); }
    if (userId) { filterQuery += ` AND t.user_id = ?`; values.push(userId); }
    if (accountIds) {
        const ids = accountIds.split(',');
        filterQuery += ` AND t.account_id IN (${ids.map(() => '?').join(',')})`;
        values.push(...ids);
    }
    if (categoryIds) {
        const ids = categoryIds.split(',');
        filterQuery += ` AND t.category_id IN (${ids.map(() => '?').join(',')})`;
        values.push(...ids);
    }
    return { filterQuery, values };
};

app.get('/api/transactions', (req, res) => {
    try {
        const { limit = 50, offset = 0, sortKey = 'date', sortDir = 'DESC' } = req.query;
        const { filterQuery, values } = buildTxFilters(req.query);
        const dataQuery = `
            SELECT t.*, GROUP_CONCAT(tg.tag_id) as tagIds 
            FROM transactions t
            LEFT JOIN transaction_tags tg ON t.id = tg.transaction_id
            ${filterQuery}
            GROUP BY t.id
            ORDER BY t.${sortKey} ${sortDir}
            LIMIT ? OFFSET ?
        `;
        const countQuery = `SELECT COUNT(*) as count FROM transactions t ${filterQuery}`;
        const rows = db.prepare(dataQuery).all(...values, parseInt(limit), parseInt(offset));
        const totalCount = db.prepare(countQuery).get(...values).count;
        const results = rows.map(r => ({
            ...r,
            tagIds: r.tagIds ? r.tagIds.split(',') : [],
            metadata: JSON.parse(r.metadata || '{}'),
            isParent: !!r.is_parent,
            isCompleted: !!r.is_completed,
            categoryId: r.category_id,
            accountId: r.account_id,
            typeId: r.type_id,
            payeeId: r.payee_id,
            userId: r.user_id,
            originalDescription: r.original_description,
            sourceFilename: r.source_filename,
            linkGroupId: r.link_group_id,
            parentTransactionId: r.parent_transaction_id
        }));
        res.json({ data: results, total: totalCount });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/analytics/summary', (req, res) => {
    try {
        const { filterQuery, values } = buildTxFilters(req.query);
        const query = `
            SELECT tt.balance_effect as effect, SUM(t.amount) as total
            FROM transactions t
            JOIN transaction_types tt ON t.type_id = tt.id
            ${filterQuery}
            GROUP BY tt.balance_effect
        `;
        const rows = db.prepare(query).all(...values);
        const summary = rows.reduce((acc, row) => {
            acc[row.effect] = row.total;
            return acc;
        }, {});
        res.json(summary);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/transactions/batch', (req, res) => {
    try {
        const txs = req.body;
        const insert = db.prepare(`
            INSERT OR REPLACE INTO transactions (
                id, date, description, amount, category_id, account_id, type_id, 
                payee_id, user_id, location, notes, original_description, 
                source_filename, link_group_id, is_parent, parent_transaction_id, 
                is_completed, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const tagClear = db.prepare("DELETE FROM transaction_tags WHERE transaction_id = ?");
        const tagInsert = db.prepare("INSERT INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?)");
        db.transaction((items) => {
            for (const tx of items) {
                insert.run(
                    tx.id, tx.date, tx.description, tx.amount, tx.categoryId, tx.accountId, tx.typeId,
                    tx.payeeId || null, tx.userId || null, tx.location || null, tx.notes || null,
                    tx.originalDescription || null, tx.sourceFilename || null, tx.linkGroupId || null,
                    tx.isParent ? 1 : 0, tx.parentTransactionId || null, tx.isCompleted ? 1 : 0,
                    JSON.stringify(tx.metadata || {})
                );
                tagClear.run(tx.id);
                if (tx.tagIds) tx.tagIds.forEach(tid => tagInsert.run(tx.id, tid));
            }
        })(txs);
        res.json({ success: true, count: txs.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/transactions/:id', (req, res) => {
    try {
        db.prepare("DELETE FROM transactions WHERE id = ?").run(req.params.id);
        db.prepare("DELETE FROM transaction_tags WHERE transaction_id = ?").run(req.params.id);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/data', (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM app_storage').all();
    const data = {};
    for (const row of rows) {
      try { data[row.key] = JSON.parse(row.value); } catch (e) { data[row.key] = null; }
    }
    data.categories = db.prepare("SELECT * FROM categories").all();
    data.accounts = db.prepare("SELECT * FROM accounts").all();
    data.users = db.prepare("SELECT * FROM users").all();
    data.payees = db.prepare("SELECT * FROM payees").all();
    data.tags = db.prepare("SELECT * FROM tags").all();
    data.transactionTypes = db.prepare("SELECT id, name, balance_effect as balanceEffect FROM transaction_types").all();
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/data/:key', (req, res) => {
  try {
    const key = req.params.key;
    const value = req.body;
    if (key === 'categories' && Array.isArray(value)) {
        db.prepare("DELETE FROM categories").run();
        const stmt = db.prepare("INSERT INTO categories (id, name, parent_id) VALUES (?, ?, ?)");
        value.forEach(c => stmt.run(c.id, c.name, c.parentId || null));
    } else if (key === 'accounts' && Array.isArray(value)) {
        db.prepare("DELETE FROM accounts").run();
        const stmt = db.prepare("INSERT INTO accounts (id, name, identifier, account_type_id) VALUES (?, ?, ?, ?)");
        value.forEach(a => stmt.run(a.id, a.name, a.identifier, a.accountTypeId));
    } else if (key === 'users' && Array.isArray(value)) {
        db.prepare("DELETE FROM users").run();
        const stmt = db.prepare("INSERT INTO users (id, name, is_default) VALUES (?, ?, ?)");
        value.forEach(u => stmt.run(u.id, u.name, u.isDefault ? 1 : 0));
    } else if (key === 'transactionTypes' && Array.isArray(value)) {
        db.prepare("DELETE FROM transaction_types").run();
        const stmt = db.prepare("INSERT INTO transaction_types (id, name, balance_effect) VALUES (?, ?, ?)");
        value.forEach(t => stmt.run(t.id, t.name, t.balanceEffect));
    } else {
        db.prepare('INSERT INTO app_storage (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, JSON.stringify(value));
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Admin Reset & Purge Route
app.post('/api/admin/reset', async (req, res) => {
    const { entities } = req.body || {};
    
    try {
        if (!entities || entities.includes('all')) {
            console.warn("[SYS] FULL FACTORY RESET");
            if (db) db.close();
            if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
            initDb();
            return res.json({ success: true, message: "System purged." });
        }

        console.warn(`[SYS] SELECTIVE PURGE: ${entities.join(', ')}`);
        
        db.transaction(() => {
            if (entities.includes('transactions')) {
                db.prepare("DELETE FROM transactions").run();
                db.prepare("DELETE FROM transaction_tags").run();
            }
            if (entities.includes('accounts')) db.prepare("DELETE FROM accounts").run();
            if (entities.includes('categories')) db.prepare("DELETE FROM categories").run();
            if (entities.includes('tags')) {
                db.prepare("DELETE FROM tags").run();
                db.prepare("DELETE FROM transaction_tags").run();
            }
            if (entities.includes('payees')) db.prepare("DELETE FROM payees").run();
            if (entities.includes('users')) db.prepare("DELETE FROM users WHERE is_default = 0").run();
            if (entities.includes('files_meta')) db.prepare("DELETE FROM files_meta").run();
            
            // Clean specific app_storage keys
            const storageKeys = {
                'amazonMetrics': 'amazonMetrics',
                'youtubeMetrics': 'youtubeMetrics',
                'amazonVideos': 'amazonVideos',
                'financialGoals': 'financialGoals',
                'financialPlan': 'financialPlan',
                'reconciliationRules': 'reconciliationRules',
                'templates': 'templates',
                'tasks': 'tasks',
                'taskCompletions': 'taskCompletions',
                'savedReports': 'savedReports',
                'contentLinks': 'contentLinks'
            };

            entities.forEach(entity => {
                if (storageKeys[entity]) {
                    db.prepare("DELETE FROM app_storage WHERE key = ?").run(storageKeys[entity]);
                }
            });
        })();

        // Shrink file size
        db.pragma('vacuum');
        res.json({ success: true, message: "Selective purge complete." });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/ai/generate', async (req, res) => {
    try {
        const { model, contents, config } = req.body;
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({ model, contents, config });
        res.json({ text: response.text, candidates: response.candidates });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/ai/stream', async (req, res) => {
    try {
        const { model, contents, config } = req.body;
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const responseStream = await ai.models.generateContentStream({ model, contents, config });
        res.setHeader('Content-Type', 'text/event-stream');
        for await (const chunk of responseStream) {
            res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
        }
        res.end();
    } catch (e) { res.status(500).end(); }
});

app.post('/api/files/:id', (req, res) => {
  const { id } = req.params;
  const rawFilename = req.headers['x-filename'] || 'unknown.bin';
  const mimeType = req.headers['content-type'] || 'application/octet-stream';
  try {
    const diskFilename = `${Date.now()}_${rawFilename.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    fs.writeFileSync(path.join(DOCUMENTS_DIR, diskFilename), req.body);
    db.prepare('INSERT OR REPLACE INTO files_meta (id, original_name, disk_filename, mime_type, size, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, rawFilename, diskFilename, mimeType, req.body.length, new Date().toISOString());
    res.json({ success: true });
  } catch (e) { res.status(500).send(e.message); }
});

app.get('/api/files/:id', (req, res) => {
  try {
    const meta = db.prepare('SELECT * FROM files_meta WHERE id = ?').get(req.params.id);
    if (!meta) return res.status(404).send('Not found');
    res.setHeader('Content-Type', meta.mime_type);
    res.sendFile(path.join(DOCUMENTS_DIR, meta.disk_filename));
  } catch (e) { res.status(500).send('Error'); }
});

app.delete('/api/files/:id', (req, res) => {
  try {
    const meta = db.prepare('SELECT * FROM files_meta WHERE id = ?').get(req.params.id);
    if (meta) {
        fs.unlinkSync(path.join(DOCUMENTS_DIR, meta.disk_filename));
        db.prepare('DELETE FROM files_meta WHERE id = ?').run(req.params.id);
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

app.use(express.static(PUBLIC_DIR));
app.get('*', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

app.listen(PORT, '0.0.0.0', () => console.log(`[SYS] Server running on port ${PORT}`));
