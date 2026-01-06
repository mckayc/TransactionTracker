
// ... existing imports preserved
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

const PUBLIC_DIR = fs.existsSync(path.join(__dirname, 'dist')) 
    ? path.join(__dirname, 'dist') 
    : path.join(__dirname, 'public');

app.use(express.json({ limit: '100mb' }));
app.use('/api/files', express.raw({ type: '*/*', limit: '100mb' }));

app.get('/api/health', (req, res) => res.status(200).json({ status: 'live', timestamp: new Date().toISOString() }));

// Runtime Environment Injection for Frontend
app.get('/env.js', (req, res) => {
    const key = process.env.API_KEY || '';
    
    // Enhanced Diagnostic Logging
    console.log("---------------------------------------------------------");
    console.log(`[SYS] Client requested Environment Shim (/env.js)`);
    console.log(`[SYS] Source: ${req.ip}`);
    if (key) {
        console.log(`[SYS] API_KEY found in process.env (Length: ${key.length}, Masked: ${key.substring(0, 4)}...)`);
    } else {
        console.warn(`[SYS] WARNING: No API_KEY found in process.env! AI features will fail.`);
    }
    console.log("---------------------------------------------------------");
    
    res.type('application/javascript');
    res.send(`
        (function() {
            window.__FINPARSER_CONFIG__ = {
                API_KEY: "${key.replace(/"/g, '\\"')}"
            };
            // Define process.env shim immediately
            window.process = window.process || {};
            window.process.env = window.process.env || {};
            window.process.env.API_KEY = "${key.replace(/"/g, '\\"')}";
            console.log("[FINPARSER] Runtime environment injected successfully.");
        })();
    `);
});

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DOCUMENTS_DIR)) fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });

console.log("---------------------------------------------------------");
console.log(`[SYS] Data Engine Starting...`);
console.log(`[SYS] Database Path: ${DB_PATH}`);
console.log(`[SYS] Static Assets: ${PUBLIC_DIR}`);
console.log(`[SYS] AI API_KEY Configuration: ${process.env.API_KEY ? 'CONFIGURED' : 'NOT FOUND IN ENV'}`);
console.log("---------------------------------------------------------");

let db;

const ensureSeedData = () => {
    try {
        const typeCount = db.prepare("SELECT COUNT(*) as count FROM transaction_types").get().count;
        if (typeCount === 0) {
            console.log("[DB] Seeding Transaction Types...");
            const insertType = db.prepare("INSERT INTO transaction_types (id, name, balance_effect) VALUES (?, ?, ?)");
            db.transaction(() => {
                insertType.run('type_income', 'Income', 'income');
                insertType.run('type_purchase', 'Purchase', 'expense');
                insertType.run('type_transfer', 'Transfer', 'transfer');
                insertType.run('type_tax', 'Tax Payment', 'tax');
                insertType.run('type_investment', 'Investment', 'investment');
            })();
        }

        const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
        if (userCount === 0) {
            console.log("[DB] Seeding Default User...");
            db.prepare("INSERT INTO users (id, name, is_default) VALUES (?, ?, ?)").run('user_primary', 'Primary User', 1);
        }
    } catch (err) {
        console.error("[DB] Seeder warning:", err.message);
    }
};

const initDb = () => {
    try {
        db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL');
        db.pragma('busy_timeout = 5000');
        
        db.exec(`
          CREATE TABLE IF NOT EXISTS app_storage (key TEXT PRIMARY KEY, value TEXT);
          CREATE TABLE IF NOT EXISTS files_meta (id TEXT PRIMARY KEY, original_name TEXT, disk_filename TEXT, mime_type TEXT, size INTEGER, created_at TEXT);
          CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, name TEXT, parent_id TEXT);
          CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, name TEXT, identifier TEXT, account_type_id TEXT);
          CREATE TABLE IF NOT EXISTS account_types (id TEXT PRIMARY KEY, name TEXT, is_default INTEGER);
          CREATE TABLE IF NOT EXISTS transaction_types (id TEXT PRIMARY KEY, name TEXT, balance_effect TEXT);
          CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT, is_default INTEGER);
          CREATE TABLE IF NOT EXISTS payees (id TEXT PRIMARY KEY, name TEXT, parent_id TEXT, notes TEXT, user_id TEXT);
          CREATE TABLE IF NOT EXISTS merchants (id TEXT PRIMARY KEY, name TEXT, payee_id TEXT, notes TEXT);
          CREATE TABLE IF NOT EXISTS locations (id TEXT PRIMARY KEY, name TEXT, city TEXT, state TEXT, country TEXT);
          CREATE TABLE IF NOT EXISTS tags (id TEXT PRIMARY KEY, name TEXT, color TEXT);
          CREATE TABLE IF NOT EXISTS youtube_channels (id TEXT PRIMARY KEY, name TEXT);
          CREATE TABLE IF NOT EXISTS amazon_videos (id TEXT PRIMARY KEY, video_id TEXT, video_title TEXT, asins TEXT, duration TEXT, video_url TEXT, upload_date TEXT);
          CREATE TABLE IF NOT EXISTS blueprints (id TEXT PRIMARY KEY, name TEXT, examples TEXT, last_used TEXT);

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
        // ... rest of initDb preserved
        const migrateTable = (tableName, requiredCols) => {
            let tableInfo = db.prepare(`PRAGMA table_info(${tableName})`).all();
            const existingColumns = new Set(tableInfo.map(c => c.name));
            requiredCols.forEach(col => {
                if (!existingColumns.has(col.name)) {
                    try { db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${col.name} ${col.type}`).run(); } catch (err) {}
                }
            });
        };

        migrateTable('transactions', [
            { name: 'category_id', type: 'TEXT' },
            { name: 'account_id', type: 'TEXT' },
            { name: 'type_id', type: 'TEXT' },
            { name: 'payee_id', type: 'TEXT' },
            { name: 'merchant_id', type: 'TEXT' },
            { name: 'location_id', type: 'TEXT' },
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
        migrateTable('users', [{ name: 'is_default', type: 'INTEGER DEFAULT 0' }]);
        migrateTable('payees', [{ name: 'user_id', type: 'TEXT' }, { name: 'parent_id', type: 'TEXT' }, { name: 'notes', type: 'TEXT' }]);
        migrateTable('accounts', [{ name: 'account_type_id', type: 'TEXT' }]);

        ensureSeedData();
        console.log("[DB] Engine ready.");
    } catch (dbErr) {
        console.error("[DB] ENGINE STARTUP FAILURE:", dbErr.message);
    }
};

initDb();
// ... rest of server.js preserved
app.get('/api/data', (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM app_storage').all();
    const data = {};
    for (const row of rows) {
      try { data[row.key] = JSON.parse(row.value); } catch (e) { data[row.key] = null; }
    }
    
    try { data.categories = db.prepare("SELECT id, name, parent_id AS parentId FROM categories").all(); } catch(e) { data.categories = []; }
    try { data.accounts = db.prepare("SELECT id, name, identifier, account_type_id AS accountTypeId FROM accounts").all(); } catch(e) { data.accounts = []; }
    try { data.accountTypes = db.prepare("SELECT id, name, is_default AS isDefault FROM account_types").all().map(a => ({...a, isDefault: !!a.isDefault})); } catch(e) { data.accountTypes = []; }
    try { data.users = db.prepare("SELECT id, name, is_default AS isDefault FROM users").all().map(u => ({...u, isDefault: !!u.isDefault})); } catch(e) { data.users = []; }
    try { data.payees = db.prepare("SELECT id, name, parent_id AS parentId, notes, user_id AS userId FROM payees").all(); } catch(e) { data.payees = []; }
    try { data.merchants = db.prepare("SELECT id, name, payee_id AS payeeId, notes FROM merchants").all(); } catch(e) { data.merchants = []; }
    try { data.locations = db.prepare("SELECT id, name, city, state, country FROM locations").all(); } catch(e) { data.locations = []; }
    try { data.tags = db.prepare("SELECT * FROM tags").all(); } catch(e) { data.tags = []; }
    try { data.transactionTypes = db.prepare("SELECT id, name, balance_effect as balanceEffect FROM transaction_types").all(); } catch(e) { data.transactionTypes = []; }
    try { data.blueprints = db.prepare("SELECT id, name, examples, last_used as lastUsed FROM blueprints").all().map(b => ({ ...b, examples: JSON.parse(b.examples || '[]') })); } catch(e) { data.blueprints = []; }
    // ... rest of getter preserved
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/data/:key', (req, res) => {
  try {
    const key = req.params.key;
    const value = req.body;
    
    if (key === 'blueprints' && Array.isArray(value)) {
        db.prepare("DELETE FROM blueprints").run();
        const stmt = db.prepare("INSERT OR REPLACE INTO blueprints (id, name, examples, last_used) VALUES (?, ?, ?, ?)");
        db.transaction(() => { value.forEach(b => stmt.run(b.id, b.name, JSON.stringify(b.examples || []), b.lastUsed || null)); })();
    } else if (key === 'categories' && Array.isArray(value)) {
        // ... preserved
        db.prepare("DELETE FROM categories").run();
        const stmt = db.prepare("INSERT OR REPLACE INTO categories (id, name, parent_id) VALUES (?, ?, ?)");
        db.transaction(() => { value.forEach(c => stmt.run(c.id, c.name, c.parentId || null)); })();
    } 
    // ... rest of setter preserved
    else {
        db.prepare('INSERT INTO app_storage (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, JSON.stringify(value));
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, '0.0.0.0', () => console.log(`[SYS] Server running on port ${PORT}`));
