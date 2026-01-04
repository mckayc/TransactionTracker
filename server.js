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
log('INIT', 'Starting SQL Data Engine...');

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

// 1. Core Schema Setup
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
    isParent INTEGER DEFAULT 0,
    metadata TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date);
  CREATE TABLE IF NOT EXISTS files_meta (id TEXT PRIMARY KEY, original_name TEXT, disk_filename TEXT, mime_type TEXT, size INTEGER, created_at TEXT);
`);

// 2. Self-Healing Schema Patching
const patchSchema = () => {
  const columns = db.prepare("PRAGMA table_info(transactions)").all().map(c => c.name);
  const required = {
    sourceFilename: "TEXT",
    originalDescription: "TEXT",
    originalDate: "TEXT",
    originalAmount: "REAL",
    linkGroupId: "TEXT",
    isParent: "INTEGER DEFAULT 0",
    metadata: "TEXT"
  };

  db.transaction(() => {
    for (const [col, type] of Object.entries(required)) {
      if (!columns.includes(col)) {
        log('SCHEMA', `Patching missing column: ${col}`);
        try {
          db.exec(`ALTER TABLE transactions ADD COLUMN ${col} ${type}`);
          // Populate audit columns with current data if we just created them
          if (col === 'originalDate') db.exec(`UPDATE transactions SET originalDate = date WHERE originalDate IS NULL`);
          if (col === 'originalAmount') db.exec(`UPDATE transactions SET originalAmount = amount WHERE originalAmount IS NULL`);
          if (col === 'originalDescription') db.exec(`UPDATE transactions SET originalDescription = description WHERE originalDescription IS NULL`);
        } catch (e) {
          log('SCHEMA_ERR', `Failed to patch ${col}: ${e.message}`);
        }
      }
    }
  })();
};
patchSchema();

// 3. Migration Logic
const migrate = () => {
  const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='app_storage'").get();
  if (!tableExists) return;

  log('MIGRATE', 'Old storage detected. Shredding JSON blobs...');
  const rows = db.prepare('SELECT key, value FROM app_storage').all();
  
  db.transaction(() => {
    for (const row of rows) {
      try {
        const data = JSON.parse(row.value);
        if (!Array.isArray(data)) {
          db.prepare('INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?)').run(row.key, row.value);
          continue;
        }

        if (row.key === 'transactions') {
          const stmt = db.prepare(`INSERT OR REPLACE INTO transactions (id, date, description, amount, categoryId, accountId, typeId, payeeId, userId, tagIds, notes, location, sourceFilename, originalDescription, originalDate, originalAmount, linkGroupId, isParent, metadata) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
          data.forEach(tx => stmt.run(tx.id, tx.date, tx.description, tx.amount, tx.categoryId, tx.accountId, tx.typeId, tx.payeeId, tx.userId, JSON.stringify(tx.tagIds || []), tx.notes, tx.location, tx.sourceFilename, tx.originalDescription || tx.description, tx.originalDate || tx.date, tx.originalAmount || tx.amount, tx.linkGroupId, tx.isParent ? 1 : 0, JSON.stringify(tx.metadata || {})));
        } else if (['accounts', 'categories', 'payees', 'tags', 'users', 'transaction_types'].includes(row.key)) {
          const tableName = row.key === 'transaction_types' ? 'transaction_types' : row.key;
          if (data.length === 0) continue;
          const columns = Object.keys(data[0]).join(',');
          const placeholders = Object.keys(data[0]).map(() => '?').join(',');
          const stmt = db.prepare(`INSERT OR REPLACE INTO ${tableName} (${columns}) VALUES (${placeholders})`);
          data.forEach(item => stmt.run(...Object.values(item)));
        }
      } catch (e) {
        log('MIGRATE_ERR', `Failed ${row.key}: ${e.message}`);
      }
    }
    db.exec('ALTER TABLE app_storage RENAME TO app_storage_old');
  })();
  log('MIGRATE', 'Data shredded successfully.');
};
migrate();

// 4. Robust Endpoints
app.get('/api/boot', (req, res) => {
  log('API', 'Boot data requested');
  try {
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
  } catch (e) {
    log('API_ERR', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/transactions', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;
  const search = req.query.search || '';
  const startDate = req.query.startDate;
  const endDate = req.query.endDate;

  let where = ' WHERE 1=1';
  const params = [];

  if (search) {
    where += ' AND (description LIKE ? OR notes LIKE ? OR originalDescription LIKE ?)';
    const s = `%${search}%`; params.push(s, s, s);
  }
  if (startDate) { where += ' AND date >= ?'; params.push(startDate); }
  if (endDate) { where += ' AND date <= ?'; params.push(endDate); }
  
  try {
    const query = `SELECT * FROM transactions ${where} ORDER BY date DESC, id DESC LIMIT ${limit} OFFSET ${offset}`;
    const items = db.prepare(query)
      .all(...params)
      .map(tx => ({ 
        ...tx, 
        tagIds: JSON.parse(tx.tagIds || '[]'), 
        metadata: JSON.parse(tx.metadata || '{}'), 
        isParent: !!tx.isParent 
      }));
    
    const countQuery = `SELECT COUNT(*) as total FROM transactions ${where}`;
    const total = db.prepare(countQuery).get(...params).total;
    
    log('API', `Found ${items.length} transactions (Total: ${total})`);
    res.json({ items, total });
  } catch (e) { 
    log('API_ERR', `Tx Query Failed: ${e.message}`);
    res.status(500).json({ error: e.message }); 
  }
});

app.get('/api/stats', (req, res) => {
  const { startDate, endDate } = req.query;
  let where = ' WHERE t.isParent = 0';
  const params = [];
  if (startDate) { where += ' AND t.date >= ?'; params.push(startDate); }
  if (endDate) { where += ' AND t.date <= ?'; params.push(endDate); }

  try {
    const query = `
      SELECT tt.balanceEffect, SUM(t.amount) as total
      FROM transactions t
      JOIN transaction_types tt ON t.typeId = tt.id
      ${where}
      GROUP BY tt.balanceEffect
    `;
    res.json(db.prepare(query).all(...params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/transactions/bulk', (req, res) => {
  const txs = req.body;
  log('API', `Bulk updating ${txs.length} transactions`);
  const stmt = db.prepare(`INSERT OR REPLACE INTO transactions (id, date, description, amount, categoryId, accountId, typeId, payeeId, userId, tagIds, notes, location, sourceFilename, originalDescription, originalDate, originalAmount, linkGroupId, isParent, metadata) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  try {
    db.transaction((data) => {
      for (const tx of data) stmt.run(tx.id, tx.date, tx.description, tx.amount, tx.categoryId, tx.accountId, tx.typeId, tx.payeeId, tx.userId, JSON.stringify(tx.tagIds || []), tx.notes, tx.location, tx.sourceFilename, tx.originalDescription || tx.description, tx.originalDate || tx.date, tx.originalAmount || tx.amount, tx.linkGroupId, tx.isParent ? 1 : 0, JSON.stringify(tx.metadata || {}));
    })(txs);
    res.json({ success: true, count: txs.length });
  } catch (e) {
    log('API_ERR', `Bulk update failed: ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/transactions/:id', (req, res) => {
    db.prepare('DELETE FROM transactions WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

app.post('/api/data/:table', (req, res) => {
    const table = req.params.table;
    const data = req.body;
    try {
        if (['accounts', 'categories', 'payees', 'tags', 'users', 'transaction_types'].includes(table)) {
            const columns = Object.keys(data).join(',');
            const placeholders = Object.keys(data).map(() => '?').join(',');
            db.prepare(`INSERT OR REPLACE INTO ${table} (${columns}) VALUES (${placeholders})`).run(...Object.values(data));
            res.json({ success: true });
        } else {
            db.prepare('INSERT INTO app_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(table, JSON.stringify(data));
            res.json({ success: true });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/ai/generate', async (req, res) => {
    try {
        const { model, contents, config } = req.body;
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({ model, contents, config });
        res.json({ text: response.text });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/files/:id', (req, res) => {
  const { id } = req.params;
  const name = req.headers['x-filename'] || 'file.bin';
  const diskName = `${Date.now()}_${name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
  fs.writeFileSync(path.join(DOCUMENTS_DIR, diskName), req.body);
  db.prepare('INSERT OR REPLACE INTO files_meta VALUES (?, ?, ?, ?, ?, ?)').run(id, name, diskName, req.headers['content-type'], req.body.length, new Date().toISOString());
  res.json({ success: true });
});

app.get('/api/files/:id', (req, res) => {
  const meta = db.prepare('SELECT * FROM files_meta WHERE id = ?').get(req.params.id);
  if (!meta) return res.status(404).send('Not found');
  res.sendFile(path.join(DOCUMENTS_DIR, meta.disk_filename));
});

app.post('/api/admin/reset', (req, res) => {
    db.exec('DELETE FROM transactions');
    db.exec('DELETE FROM accounts');
    db.exec('DELETE FROM categories');
    db.exec('DELETE FROM payees');
    db.exec('DELETE FROM tags');
    db.exec('DELETE FROM app_config');
    res.json({ success: true });
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, '0.0.0.0', () => log('READY', `FinParser listening on ${PORT}`));
