
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

let db;
try {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 5000');
    
    db.exec(`
      CREATE TABLE IF NOT EXISTS app_storage (key TEXT PRIMARY KEY, value TEXT);
      CREATE TABLE IF NOT EXISTS files_meta (id TEXT PRIMARY KEY, original_name TEXT, disk_filename TEXT, mime_type TEXT, size INTEGER, created_at TEXT);
      CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, name TEXT, parent_id TEXT);
      CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, name TEXT, identifier TEXT, account_type_id TEXT);
      CREATE TABLE IF NOT EXISTS transaction_types (id TEXT PRIMARY KEY, name TEXT, balance_effect TEXT);
      CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT, is_default INTEGER);
      CREATE TABLE IF NOT EXISTS payees (id TEXT PRIMARY KEY, name TEXT, parent_id TEXT, notes TEXT, user_id TEXT);
      CREATE TABLE IF NOT EXISTS tags (id TEXT PRIMARY KEY, name TEXT, color TEXT);

      CREATE TABLE IF NOT EXISTS transactions (
          id TEXT PRIMARY KEY,
          date TEXT,
          description TEXT,
          amount REAL,
          category_id TEXT,
          account_id TEXT,
          type_id TEXT,
          payee_id TEXT,
          user_id TEXT,
          location TEXT,
          notes TEXT,
          original_description TEXT,
          source_filename TEXT,
          link_group_id TEXT,
          is_parent INTEGER DEFAULT 0,
          parent_transaction_id TEXT,
          is_completed INTEGER DEFAULT 0,
          metadata TEXT
      );

      CREATE TABLE IF NOT EXISTS transaction_tags (
          transaction_id TEXT,
          tag_id TEXT,
          PRIMARY KEY (transaction_id, tag_id)
      );

      CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
      CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type_id);
    `);
} catch (dbErr) {
    console.error("[DB] Critical error:", dbErr);
}

// Helper to build WHERE clause from params
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

// --- DATA ROUTES ---

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
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/analytics/summary', (req, res) => {
    try {
        const { filterQuery, values } = buildTxFilters(req.query);
        const query = `
            SELECT 
                tt.balance_effect as effect,
                SUM(t.amount) as total
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
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/analytics/usage', (req, res) => {
    try {
        const categories = db.prepare(`SELECT category_id as id, COUNT(*) as count FROM transactions GROUP BY category_id`).all();
        const payees = db.prepare(`SELECT payee_id as id, COUNT(*) as count FROM transactions WHERE payee_id IS NOT NULL GROUP BY payee_id`).all();
        const tags = db.prepare(`SELECT tag_id as id, COUNT(*) as count FROM transaction_tags GROUP BY tag_id`).all();
        const accounts = db.prepare(`SELECT account_type_id as id, COUNT(*) as count FROM accounts GROUP BY account_type_id`).all();
        
        res.json({ categories, payees, tags, accounts });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
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

        const run = db.transaction((items) => {
            for (const tx of items) {
                insert.run(
                    tx.id, tx.date, tx.description, tx.amount, tx.categoryId, tx.accountId, tx.typeId,
                    tx.payeeId || null, tx.userId || null, tx.location || null, tx.notes || null,
                    tx.originalDescription || null, tx.sourceFilename || null, tx.linkGroupId || null,
                    tx.isParent ? 1 : 0, tx.parentTransactionId || null, tx.isCompleted ? 1 : 0,
                    JSON.stringify(tx.metadata || {})
                );
                tagClear.run(tx.id);
                if (tx.tagIds) {
                    tx.tagIds.forEach(tid => tagInsert.run(tx.id, tid));
                }
            }
        });
        run(txs);
        res.json({ success: true, count: txs.length });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
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
    data.transactionTypes = db.prepare("SELECT * FROM transaction_types").all();
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
    } else {
        db.prepare('INSERT INTO app_storage (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, JSON.stringify(value));
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

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

app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
