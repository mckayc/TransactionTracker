
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

// Initializing Database
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS app_storage (key TEXT PRIMARY KEY, value TEXT);
  CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      date TEXT,
      description TEXT,
      amount REAL,
      category_id TEXT,
      account_id TEXT,
      type_id TEXT,
      payee_id TEXT,
      merchant_id TEXT,
      location_id TEXT,
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
  CREATE TABLE IF NOT EXISTS blueprints (id TEXT PRIMARY KEY, name TEXT, examples TEXT, last_used TEXT);
`);

app.use(express.json({ limit: '100mb' }));

// 1. STATIC FILE SERVING (FIX FOR "Cannot GET /")
app.use(express.static(__dirname));

// 2. RUNTIME ENVIRONMENT SHIM
app.get('/env.js', (req, res) => {
    const key = process.env.API_KEY || '';
    res.type('application/javascript');
    res.send(`
        (function() {
            window.process = { env: { API_KEY: "${key.replace(/"/g, '\\"')}" } };
            window.__FINPARSER_CONFIG__ = { API_KEY: "${key.replace(/"/g, '\\"')}" };
        })();
    `);
});

// API ROUTES
app.get('/api/health', (req, res) => res.json({ status: 'live' }));

app.get('/api/data', (req, res) => {
    const rows = db.prepare('SELECT key, value FROM app_storage').all();
    const data = {};
    for (const row of rows) {
        try { data[row.key] = JSON.parse(row.value); } catch (e) { data[row.key] = null; }
    }
    try { data.blueprints = db.prepare("SELECT id, name, examples, last_used as lastUsed FROM blueprints").all().map(b => ({ ...b, examples: JSON.parse(b.examples || '[]') })); } catch(e) { data.blueprints = []; }
    res.json(data);
});

app.post('/api/data/:key', (req, res) => {
    const { key } = req.params;
    const value = req.body;
    if (key === 'blueprints' && Array.isArray(value)) {
        db.prepare("DELETE FROM blueprints").run();
        const stmt = db.prepare("INSERT OR REPLACE INTO blueprints (id, name, examples, last_used) VALUES (?, ?, ?, ?)");
        db.transaction(() => { value.forEach(b => stmt.run(b.id, b.name, JSON.stringify(b.examples || []), b.lastUsed || null)); })();
    } else {
        db.prepare('INSERT INTO app_storage (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, JSON.stringify(value));
    }
    res.json({ success: true });
});

// Transactional APIs
app.get('/api/transactions', (req, res) => {
    const { limit = 50, offset = 0, search = '', sortKey = 'date', sortDir = 'DESC' } = req.query;
    let query = `SELECT * FROM transactions WHERE description LIKE ? OR notes LIKE ? ORDER BY ${sortKey} ${sortDir} LIMIT ? OFFSET ?`;
    const countQuery = `SELECT COUNT(*) as total FROM transactions WHERE description LIKE ? OR notes LIKE ?`;
    const searchPattern = `%${search}%`;
    const total = db.prepare(countQuery).get(searchPattern, searchPattern).total;
    const data = db.prepare(query).all(searchPattern, searchPattern, limit, offset).map(tx => ({
        ...tx,
        isParent: !!tx.is_parent,
        isCompleted: !!tx.is_completed,
        categoryId: tx.category_id,
        accountId: tx.account_id,
        typeId: tx.type_id,
        payeeId: tx.payee_id,
        merchantId: tx.merchant_id,
        locationId: tx.location_id,
        userId: tx.user_id,
        linkGroupId: tx.link_group_id,
        parentTransactionId: tx.parent_transaction_id,
        originalDescription: tx.original_description,
        sourceFilename: tx.source_filename,
        metadata: tx.metadata ? JSON.parse(tx.metadata) : {}
    }));
    res.json({ data, total });
});

app.post('/api/transactions/batch', (req, res) => {
    const txs = req.body;
    const stmt = db.prepare(`INSERT OR REPLACE INTO transactions (id, date, description, amount, category_id, account_id, type_id, payee_id, merchant_id, location_id, user_id, location, notes, original_description, source_filename, link_group_id, is_parent, parent_transaction_id, is_completed, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    db.transaction(() => {
        for (const tx of txs) {
            stmt.run(tx.id, tx.date, tx.description, tx.amount, tx.categoryId, tx.accountId, tx.typeId, tx.payeeId, tx.merchantId, tx.locationId, tx.userId, tx.location, tx.notes, tx.originalDescription, tx.sourceFilename, tx.linkGroupId, tx.isParent ? 1 : 0, tx.parentTransactionId, tx.isCompleted ? 1 : 0, JSON.stringify(tx.metadata || {}));
        }
    })();
    res.json({ success: true });
});

app.get('/api/analytics/summary', (req, res) => {
    const { startDate } = req.query;
    const where = startDate ? `WHERE date >= '${startDate}'` : '';
    const query = `
        SELECT 
            SUM(CASE WHEN t.type_id IN (SELECT id FROM app_storage WHERE key='transactionTypes' AND value LIKE '%"balanceEffect":"income"%') THEN amount ELSE 0 END) as income,
            SUM(CASE WHEN t.type_id IN (SELECT id FROM app_storage WHERE key='transactionTypes' AND value LIKE '%"balanceEffect":"expense"%') THEN amount ELSE 0 END) as expense,
            SUM(CASE WHEN t.type_id IN (SELECT id FROM app_storage WHERE key='transactionTypes' AND value LIKE '%"balanceEffect":"tax"%') THEN amount ELSE 0 END) as tax,
            SUM(CASE WHEN t.type_id IN (SELECT id FROM app_storage WHERE key='transactionTypes' AND value LIKE '%"balanceEffect":"investment"%') THEN amount ELSE 0 END) as investment
        FROM transactions t ${where}
    `;
    // Note: The logic above is simplified. Ideally we'd join but app_storage is a JSON blob.
    // For now, return zeros or fallback to simple type checking.
    res.json({ income: 0, expense: 0, tax: 0, debt: 0, investment: 0, donation: 0, savings: 0 });
});

// CATCH-ALL ROUTE FOR SPA SUPPORT
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
