import fs from 'fs';
import path from 'path';
import express from 'express';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { GoogleGenAI } from '@google/genai';
import compression from 'compression';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

const log = (step, message) => console.log(`[${new Date().toISOString()}] [${step}] ${message}`);
log('INIT', 'Professional SQL Engine starting...');

app.use(compression());
app.use(express.json({ limit: '200mb' }));

const DATA_DIR = path.join(__dirname, 'data', 'config');
const DOCUMENTS_DIR = path.join(__dirname, 'media', 'files');
const DB_PATH = path.join(DATA_DIR, 'database.sqlite');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DOCUMENTS_DIR)) fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 30000');

// 1. Relational Schema Definition
db.exec(`
  CREATE TABLE IF NOT EXISTS app_config (key TEXT PRIMARY KEY, value TEXT);
  
  CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, name TEXT, identifier TEXT, accountTypeId TEXT);
  CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, name TEXT, parentId TEXT);
  CREATE TABLE IF NOT EXISTS payees (id TEXT PRIMARY KEY, name TEXT, parentId TEXT, userId TEXT, notes TEXT);
  CREATE TABLE IF NOT EXISTS tags (id TEXT PRIMARY KEY, name TEXT, color TEXT);
  CREATE TABLE IF NOT EXISTS transaction_types (id TEXT PRIMARY KEY, name TEXT, balanceEffect TEXT, isDefault INTEGER);
  CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT, isDefault INTEGER);
  
  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    date TEXT,
    description TEXT,
    amount REAL,
    categoryId TEXT,
    accountId TEXT,
    typeId TEXT,
    payeeId TEXT,
    userId TEXT,
    tagIds TEXT,
    notes TEXT,
    location TEXT,
    sourceFilename TEXT,
    originalDescription TEXT,
    originalDate TEXT,
    originalAmount REAL,
    linkGroupId TEXT,
    isParent INTEGER,
    metadata TEXT
  );
  
  CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date);
  CREATE INDEX IF NOT EXISTS idx_tx_desc ON transactions(description);
  
  CREATE TABLE IF NOT EXISTS files_meta (id TEXT PRIMARY KEY, original_name TEXT, disk_filename TEXT, mime_type TEXT, size INTEGER, created_at TEXT);
`);

// Migration to add original tracking columns if they were missing
try {
    db.prepare("SELECT originalDate FROM transactions LIMIT 1").get();
} catch (e) {
    log('MIGRATE', 'Adding original tracking columns to transactions table...');
    db.exec(`
        ALTER TABLE transactions ADD COLUMN originalDate TEXT;
        ALTER TABLE transactions ADD COLUMN originalAmount REAL;
    `);
    // Backfill: If original fields are null, use the current values as the source of truth
    db.exec(`
        UPDATE transactions SET 
            originalDate = date, 
            originalAmount = amount 
        WHERE originalDate IS NULL;
    `);
}

// 2. Migration Logic: Shred old JSON blobs into rows
const migrate = () => {
  const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='app_storage'").get();
  if (!tableExists) return;

  log('MIGRATE', 'Old storage detected. Starting data shredding...');
  const rows = db.prepare('SELECT key, value FROM app_storage').all();
  
  db.transaction(() => {
    for (const row of rows) {
      try {
        const data = JSON.parse(row.value);
        if (!Array.isArray(data)) {
          db.prepare('INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?)').run(row.key, row.value);
          continue;
        }

        log('MIGRATE', `Shredding ${data.length} items from key: ${row.key}`);
        if (row.key === 'transactions') {
          const stmt = db.prepare(`INSERT OR REPLACE INTO transactions (id, date, description, amount, categoryId, accountId, typeId, payeeId, userId, tagIds, notes, location, sourceFilename, originalDescription, originalDate, originalAmount, linkGroupId, isParent, metadata) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
          data.forEach(tx => stmt.run(tx.id, tx.date, tx.description, tx.amount, tx.categoryId, tx.accountId, tx.typeId, tx.payeeId, tx.userId, JSON.stringify(tx.tagIds || []), tx.notes, tx.location, tx.sourceFilename, tx.originalDescription || tx.description, tx.originalDate || tx.date, tx.originalAmount || tx.amount, tx.linkGroupId, tx.isParent ? 1 : 0, JSON.stringify(tx.metadata || {})));
        } else if (['accounts', 'categories', 'payees', 'tags', 'users', 'transaction_types'].includes(row.key)) {
          const tableName = row.key === 'transaction_types' ? 'transaction_types' : row.key;
          const columns = Object.keys(data[0]).join(',');
          const placeholders = Object.keys(data[0]).map(() => '?').join(',');
          const stmt = db.prepare(`INSERT OR REPLACE INTO ${tableName} (${columns}) VALUES (${placeholders})`);
          data.forEach(item => stmt.run(...Object.values(item)));
        }
      } catch (e) {
        log('MIGRATE_ERR', `Failed to migrate ${row.key}: ${e.message}`);
      }
    }
    db.exec('ALTER TABLE app_storage RENAME TO app_storage_old');
  })();
  log('MIGRATE', 'Migration complete.');
};
migrate();

// 3. Optimized API Endpoints
app.get('/api/boot', (req, res) => {
  const data = {
    accounts: db.prepare('SELECT * FROM accounts').all(),
    categories: db.prepare('SELECT * FROM categories').all(),
    payees: db.prepare('SELECT * FROM payees').all(),
    tags: db.prepare('SELECT * FROM tags').all(),
    transactionTypes: db.prepare('SELECT * FROM transaction_types').all(),
    users: db.prepare('SELECT * FROM users').all(),
    config: db.prepare('SELECT * FROM app_config').all().reduce((acc, r) => ({...acc, [r.key]: JSON.parse(r.value)}), {})
  };
  res.json(data);
});

app.get('/api/transactions', (req, res) => {
  const { limit = 50, offset = 0, search = '', startDate, endDate } = req.query;
  let query = 'SELECT * FROM transactions WHERE 1=1';
  const params = [];
  if (search) {
    query += ' AND (description LIKE ? OR notes LIKE ? OR originalDescription LIKE ?)';
    const searchParam = `%${search}%`;
    params.push(searchParam, searchParam, searchParam);
  }
  if (startDate) { query += ' AND date >= ?'; params.push(startDate); }
  if (endDate) { query += ' AND date <= ?'; params.push(endDate); }
  query += ' ORDER BY date DESC, id DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));
  try {
    const items = db.prepare(query).all(...params).map(tx => ({
        ...tx,
        tagIds: JSON.parse(tx.tagIds || '[]'),
        metadata: JSON.parse(tx.metadata || '{}'),
        isParent: !!tx.isParent
    }));
    const countQuery = query.split('ORDER BY')[0].replace('SELECT *', 'SELECT COUNT(*) as total');
    const total = db.prepare(countQuery).get(...params.slice(0, -2)).total;
    res.json({ items, total });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/stats', (req, res) => {
  const { startDate, endDate } = req.query;
  const query = `
    SELECT tt.balanceEffect, SUM(t.amount) as total
    FROM transactions t
    JOIN transaction_types tt ON t.typeId = tt.id
    WHERE t.isParent = 0 
    ${startDate ? 'AND t.date >= ?' : ''}
    ${endDate ? 'AND t.date <= ?' : ''}
    GROUP BY tt.balanceEffect
  `;
  const params = [];
  if (startDate) params.push(startDate);
  if (endDate) params.push(endDate);
  res.json(db.prepare(query).all(...params));
});

app.post('/api/transactions/bulk', (req, res) => {
  const txs = req.body;
  const stmt = db.prepare(`INSERT OR REPLACE INTO transactions (id, date, description, amount, categoryId, accountId, typeId, payeeId, userId, tagIds, notes, location, sourceFilename, originalDescription, originalDate, originalAmount, linkGroupId, isParent, metadata) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insertMany = db.transaction((data) => {
    for (const tx of data) stmt.run(tx.id, tx.date, tx.description, tx.amount, tx.categoryId, tx.accountId, tx.typeId, tx.payeeId, tx.userId, JSON.stringify(tx.tagIds || []), tx.notes, tx.location, tx.sourceFilename, tx.originalDescription || tx.description, tx.originalDate || tx.date, tx.originalAmount || tx.amount, tx.linkGroupId, tx.isParent ? 1 : 0, JSON.stringify(tx.metadata || {}));
  });
  insertMany(txs);
  res.json({ success: true, count: txs.length });
});

app.delete('/api/transactions/:id', (req, res) => {
    db.prepare('DELETE FROM transactions WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

app.post('/api/data/:table', (req, res) => {
    const table = req.params.table;
    const data = req.body;
    if (['accounts', 'categories', 'payees', 'tags', 'users', 'transaction_types'].includes(table)) {
        const columns = Object.keys(data).join(',');
        const placeholders = Object.keys(data).map(() => '?').join(',');
        db.prepare(`INSERT OR REPLACE INTO ${table} (${columns}) VALUES (${placeholders})`).run(...Object.values(data));
        res.json({ success: true });
    } else {
        db.prepare('INSERT INTO app_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(table, JSON.stringify(data));
        res.json({ success: true });
    }
});

app.post('/api/ai/generate', async (req, res) => {
    try {
        const { model, contents, config } = req.body;
        if (!process.env.API_KEY) throw new Error("API_KEY missing.");
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({ model, contents, config });
        res.json({ text: response.text });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/files/:id', (req, res) => {
  const { id } = req.params;
  const name = req.headers['x-filename'] || 'file.bin';
  try {
    const diskName = `${Date.now()}_${name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    fs.writeFileSync(path.join(DOCUMENTS_DIR, diskName), req.body);
    db.prepare('INSERT OR REPLACE INTO files_meta VALUES (?, ?, ?, ?, ?, ?)').run(id, name, diskName, req.headers['content-type'], req.body.length, new Date().toISOString());
    res.json({ success: true });
  } catch (e) { res.status(500).send(e.message); }
});

app.get('/api/files/:id', (req, res) => {
  const meta = db.prepare('SELECT * FROM files_meta WHERE id = ?').get(req.params.id);
  if (!meta) return res.status(404).send('Not found');
  res.sendFile(path.join(DOCUMENTS_DIR, meta.disk_filename));
});

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, '0.0.0.0', () => log('READY', `Server listening on ${PORT}`));