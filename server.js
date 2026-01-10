
import fs from 'fs';
import path from 'path';
import express from 'express';
import { fileURLToPath } from 'url';
import os from 'os';
import Database from 'better-sqlite3';

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

// Request Logging Middleware
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[REQ] ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
    });
    next();
});

app.use(express.json({ limit: '100mb' }));
app.use('/api/files', express.raw({ type: '*/*', limit: '100mb' }));

app.get('/api/health', (req, res) => res.status(200).json({ status: 'live', timestamp: new Date().toISOString() }));

app.get('/env.js', (req, res) => {
    const key = process.env.API_KEY || '';
    res.type('application/javascript');
    res.send(`
        (function() {
            window.__FINPARSER_CONFIG__ = {
                API_KEY: "${key.replace(/"/g, '\\"')}"
            };
            window.process = window.process || {};
            window.process.env = window.process.env || {};
            window.process.env.API_KEY = "${key.replace(/"/g, '\\"')}";
            console.log("[FINPARSER] Runtime environment injected successfully.");
        })();
    `);
});

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DOCUMENTS_DIR)) fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });

let db;

/**
 * MIGRATION ENGINE
 * Resolves inconsistencies identified in the System Manifesto
 */
const runMigrations = () => {
    console.log("[MIGRATE] Checking system integrity...");
    
    const tableExists = (name) => db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name);
    const getColumns = (name) => db.prepare(`PRAGMA table_info(${name})`).all();

    db.transaction(() => {
        // 1. Standardize Transaction Types
        if (tableExists('transaction_types')) {
            const cols = getColumns('transaction_types');
            if (cols.some(c => c.name === 'balanceEffect') && !cols.some(c => c.name === 'balance_effect')) {
                console.log("[MIGRATE] Standardizing transaction_types columns...");
                db.exec("ALTER TABLE transaction_types RENAME COLUMN balanceEffect TO balance_effect");
            }
        }

        // 2. Consolidate Payees/Merchants into Counterparties
        if (!tableExists('counterparties')) {
             console.log("[MIGRATE] Initializing counterparties table...");
             db.exec("CREATE TABLE counterparties (id TEXT PRIMARY KEY, name TEXT, parent_id TEXT, notes TEXT, user_id TEXT)");
        }

        if (tableExists('payees')) {
            console.log("[MIGRATE] Migrating legacy payees...");
            db.exec("INSERT OR IGNORE INTO counterparties (id, name, parent_id, notes, user_id) SELECT id, name, parentId, notes, userId FROM payees");
            db.exec("DROP TABLE payees");
        }

        if (tableExists('merchants')) {
            console.log("[MIGRATE] Migrating legacy merchants...");
            db.exec("INSERT OR IGNORE INTO counterparties (id, name, notes) SELECT id, name, notes FROM merchants");
            db.exec("DROP TABLE merchants");
        }

        // 3. Fix Casing in Core Tables
        const fixCasing = (table, oldCol, newCol) => {
            if (!tableExists(table)) return;
            const cols = getColumns(table);
            if (cols.some(c => c.name === oldCol) && !cols.some(c => c.name === newCol)) {
                console.log(`[MIGRATE] Renaming ${table}.${oldCol} -> ${newCol}`);
                db.exec(`ALTER TABLE ${table} RENAME COLUMN ${oldCol} TO ${newCol}`);
            }
        };

        fixCasing('accounts', 'accountTypeId', 'account_type_id');
        fixCasing('categories', 'parentId', 'parent_id');
        fixCasing('users', 'isDefault', 'is_default');

        // 4. Critical: Fix Transactions table schema drift
        if (tableExists('transactions')) {
            const cols = getColumns('transactions');
            if (!cols.some(c => c.name === 'applied_rule_ids')) {
                console.log("[MIGRATE] Adding applied_rule_ids to transactions...");
                db.exec("ALTER TABLE transactions ADD COLUMN applied_rule_ids TEXT");
            }
        }
        
        // 5. Rule Categories Table & Migration
        if (!tableExists('rule_categories')) {
             console.log("[MIGRATE] Creating rule_categories table...");
             db.exec("CREATE TABLE rule_categories (id TEXT PRIMARY KEY, name TEXT, is_default INTEGER)");
        }
        
        // 6. Ensure Indexes exist for performance
        console.log("[MIGRATE] Verifying performance indexes...");
        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
            CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
            CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
            CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
            CREATE INDEX IF NOT EXISTS idx_transactions_link_group ON transactions(link_group_id);
            CREATE INDEX IF NOT EXISTS idx_transaction_tags_tx ON transaction_tags(transaction_id);
        `);
        
        // 7. Cleanup redundant storage
        if (tableExists('app_config')) {
            console.log("[MIGRATE] Retiring legacy app_config...");
            db.exec("INSERT OR IGNORE INTO app_storage (key, value) SELECT key, value FROM app_config");
            db.exec("DROP TABLE app_config");
        }
    })();
};

const createTables = () => {
    db.exec(`
        CREATE TABLE IF NOT EXISTS app_storage (key TEXT PRIMARY KEY, value TEXT);
        CREATE TABLE IF NOT EXISTS files_meta (id TEXT PRIMARY KEY, original_name TEXT, disk_filename TEXT, mime_type TEXT, size INTEGER, created_at TEXT);
        CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, name TEXT, parent_id TEXT);
        CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, name TEXT, identifier TEXT, account_type_id TEXT);
        CREATE TABLE IF NOT EXISTS account_types (id TEXT PRIMARY KEY, name TEXT, is_default INTEGER);
        CREATE TABLE IF NOT EXISTS transaction_types (id TEXT PRIMARY KEY, name TEXT, balance_effect TEXT, color TEXT);
        CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT, is_default INTEGER DEFAULT 0);
        CREATE TABLE IF NOT EXISTS counterparties (id TEXT PRIMARY KEY, name TEXT, parent_id TEXT, notes TEXT, user_id TEXT);
        CREATE TABLE IF NOT EXISTS counterparties (id TEXT PRIMARY KEY, name TEXT, parent_id TEXT, notes TEXT, user_id TEXT);
        CREATE TABLE IF NOT EXISTS locations (id TEXT PRIMARY KEY, name TEXT, city TEXT, state TEXT, country TEXT);
        CREATE TABLE IF NOT EXISTS tags (id TEXT PRIMARY KEY, name TEXT, color TEXT);
        CREATE TABLE IF NOT EXISTS rule_categories (id TEXT PRIMARY KEY, name TEXT, is_default INTEGER DEFAULT 0);

        CREATE TABLE IF NOT EXISTS transactions (
            id TEXT PRIMARY KEY,
            date TEXT,
            description TEXT,
            amount REAL,
            category_id TEXT,
            account_id TEXT,
            type_id TEXT,
            counterparty_id TEXT,
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
            applied_rule_ids TEXT,
            metadata TEXT
        );

        CREATE TABLE IF NOT EXISTS transaction_tags (
            transaction_id TEXT,
            tag_id TEXT,
            PRIMARY KEY (transaction_id, tag_id)
        );
      `);
};

const ensureSeedData = () => {
    try {
        const typeCount = db.prepare("SELECT COUNT(*) as count FROM transaction_types").get().count;
        if (typeCount < 6) {
            console.log("[DB] Seeding default transaction types...");
            const insertType = db.prepare("INSERT OR REPLACE INTO transaction_types (id, name, balance_effect, color) VALUES (?, ?, ?, ?)");
            db.transaction(() => {
                insertType.run('type_income', 'Income', 'incoming', 'text-emerald-600');
                insertType.run('type_purchase', 'Purchase', 'outgoing', 'text-rose-600');
                insertType.run('type_transfer', 'Transfer', 'neutral', 'text-indigo-600');
                insertType.run('type_tax', 'Tax Payment', 'outgoing', 'text-orange-600');
                insertType.run('type_investment', 'Investment', 'outgoing', 'text-purple-600');
                insertType.run('type_donation', 'Donation', 'outgoing', 'text-pink-600');
            })();
        }
        
        const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
        if (userCount === 0) {
            console.log("[DB] Seeding default user...");
            db.prepare("INSERT INTO users (id, name, is_default) VALUES (?, ?, ?)").run('user_primary', 'Primary User', 1);
        }

        const categoryCount = db.prepare("SELECT COUNT(*) as count FROM categories").get().count;
        if (categoryCount === 0) {
            console.log("[DB] Seeding default category...");
            db.prepare("INSERT INTO categories (id, name) VALUES (?, ?)").run('cat_other', 'Other');
        }
        
        // Seed new Manual Rule default
        console.log("[DB] Verifying rule categories...");
        const insertRuleCat = db.prepare("INSERT OR REPLACE INTO rule_categories (id, name, is_default) VALUES (?, ?, ?)");
        db.transaction(() => {
            // Remove 'rcat_all' as a selectable category if it exists
            db.prepare("DELETE FROM rule_categories WHERE id = ?").run('rcat_all');
            
            insertRuleCat.run('rcat_desc', 'Description', 0);
            insertRuleCat.run('rcat_loc', 'Location', 0);
            insertRuleCat.run('rcat_manual', 'Manual Rule', 1);
            insertRuleCat.run('rcat_other', 'Other', 0);
            
            // Clean up legacy rcat_user if it was seeded
            db.prepare("DELETE FROM rule_categories WHERE id = ?").run('rcat_user');
        })();

        const accountTypeCount = db.prepare("SELECT COUNT(*) as count FROM account_types").get().count;
        if (accountTypeCount === 0) {
            console.log("[DB] Seeding default account types...");
            const insertAT = db.prepare("INSERT INTO account_types (id, name, is_default) VALUES (?, ?, ?)");
            db.transaction(() => {
                insertAT.run('at_checking', 'Checking', 1);
                insertAT.run('at_savings', 'Savings', 0);
                insertAT.run('at_credit', 'Credit Card', 0);
            })();
        }
    } catch (err) {
        console.error("[DB] Seeder Error:", err.message);
    }
};

const initDb = () => {
    try {
        console.log(`[DB] Opening database at ${DB_PATH}`);
        db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL');
        db.pragma('busy_timeout = 5000');
        
        runMigrations(); // Fix schema drift first
        createTables();   // Ensure all tables exist
        ensureSeedData(); // Ensure core types exist
    } catch (dbErr) {
        console.error("[DB] ENGINE STARTUP FAILURE:", dbErr.message);
    }
};

initDb();

app.get('/api/admin/diagnose', (req, res) => {
    try {
        const tables = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
        const diagnostics = tables.map(t => {
            const count = db.prepare(`SELECT COUNT(*) as count FROM ${t.name}`).get().count;
            const columns = db.prepare(`PRAGMA table_info(${t.name})`).all();
            return {
                table: t.name,
                schema: t.sql,
                rowCount: count,
                columns: columns.map(c => ({ name: c.name, type: c.type }))
            };
        });
        res.json({
            status: 'healthy',
            databaseSize: fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0,
            tables: diagnostics,
            timestamp: new Date().toISOString()
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

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
            counterpartyId: r.counterparty_id,
            locationId: r.location_id,
            userId: r.user_id,
            originalDescription: r.original_description,
            sourceFilename: r.source_filename,
            linkGroupId: r.link_group_id,
            parentTransactionId: r.parent_transaction_id,
            appliedRuleIds: r.applied_rule_ids ? JSON.parse(r.applied_rule_ids) : []
        }));
        res.json({ data: results, total: totalCount });
    } catch (e) { 
        console.error("[API] Error fetching transactions:", e.message);
        res.status(500).json({ error: e.message }); 
    }
});

app.get('/api/analytics/summary', (req, res) => {
    try {
        const { filterQuery, values } = buildTxFilters(req.query);
        // Robust summary query returning distinct aggregates for the dashboard and ledger views
        const query = `
            SELECT 
                SUM(CASE WHEN tt.balance_effect = 'incoming' THEN t.amount ELSE 0 END) as incoming,
                SUM(CASE WHEN tt.balance_effect = 'outgoing' THEN t.amount ELSE 0 END) as outgoing,
                SUM(CASE WHEN tt.balance_effect = 'neutral' THEN t.amount ELSE 0 END) as neutral,
                SUM(CASE WHEN t.type_id = 'type_investment' THEN t.amount ELSE 0 END) as investments
            FROM transactions t
            JOIN transaction_types tt ON t.type_id = tt.id
            ${filterQuery}
        `;
        const result = db.prepare(query).get(...values);
        res.json({
            incoming: result.incoming || 0,
            outgoing: result.outgoing || 0,
            neutral: result.neutral || 0,
            investments: result.investments || 0
        });
    } catch (e) { 
        console.error("[API] Summary error:", e.message);
        res.status(500).json({ error: e.message }); 
    }
});

app.post('/api/transactions/batch', (req, res) => {
    try {
        const txs = req.body;
        console.log(`[DB] Batch inserting ${txs.length} transactions...`);
        const insert = db.prepare(`
            INSERT OR REPLACE INTO transactions (
                id, date, description, amount, category_id, account_id, type_id, 
                counterparty_id, location_id, user_id, location, notes, original_description, 
                source_filename, link_group_id, is_parent, parent_transaction_id, 
                is_completed, applied_rule_ids, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const tagClear = db.prepare("DELETE FROM transaction_tags WHERE transaction_id = ?");
        const tagInsert = db.prepare("INSERT INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?)");
        db.transaction((items) => {
            for (const tx of items) {
                insert.run(
                    tx.id, tx.date, tx.description, tx.amount, tx.categoryId, tx.accountId, tx.typeId,
                    tx.counterpartyId || null, tx.locationId || null, tx.userId || null, tx.location || null, tx.notes || null,
                    tx.originalDescription || null, tx.sourceFilename || null, tx.linkGroupId || null,
                    tx.isParent ? 1 : 0, tx.parentTransactionId || null, tx.isCompleted ? 1 : 0,
                    JSON.stringify(tx.appliedRuleIds || []),
                    JSON.stringify(tx.metadata || {})
                );
                tagClear.run(tx.id);
                if (tx.tagIds) tx.tagIds.forEach(tid => tagInsert.run(tx.id, tid));
            }
        })(txs);
        res.json({ success: true, count: txs.length });
    } catch (e) { 
        console.error("[DB] Batch transaction error:", e.message);
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
    
    try { data.categories = db.prepare("SELECT id, name, parent_id AS parentId FROM categories").all(); } catch(e) { data.categories = []; }
    try { data.ruleCategories = db.prepare("SELECT id, name, is_default AS isDefault FROM rule_categories").all().map(r => ({...r, isDefault: !!r.isDefault})); } catch(e) { data.ruleCategories = []; }
    try { data.accounts = db.prepare("SELECT id, name, identifier, account_type_id AS accountTypeId FROM accounts").all(); } catch(e) { data.accounts = []; }
    try { data.accountTypes = db.prepare("SELECT id, name, is_default AS isDefault FROM account_types").all().map(a => ({...a, isDefault: !!a.isDefault})); } catch(e) { data.accountTypes = []; }
    try { data.users = db.prepare("SELECT id, name, is_default AS isDefault FROM users").all().map(u => ({...u, isDefault: !!u.isDefault})); } catch(e) { data.users = []; }
    try { data.counterparties = db.prepare("SELECT id, name, parent_id AS parentId, notes, user_id AS userId FROM counterparties").all(); } catch(e) { data.counterparties = []; }
    try { data.locations = db.prepare("SELECT id, name, city, state, country FROM locations").all(); } catch(e) { data.locations = []; }
    try { data.tags = db.prepare("SELECT * FROM tags").all(); } catch(e) { data.tags = []; }
    try { data.transactionTypes = db.prepare("SELECT id, name, balance_effect as balanceEffect, color FROM transaction_types").all(); } catch(e) { data.transactionTypes = []; }
    
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/data/:key', (req, res) => {
  try {
    const key = req.params.key;
    const value = req.body;
    console.log(`[DB] Saving key '${key}'...`);
    
    if (key === 'categories' && Array.isArray(value)) {
        db.prepare("DELETE FROM categories").run();
        const stmt = db.prepare("INSERT OR REPLACE INTO categories (id, name, parent_id) VALUES (?, ?, ?)");
        db.transaction(() => { value.forEach(c => stmt.run(c.id, c.name, c.parentId || null)); })();
    } else if (key === 'ruleCategories' && Array.isArray(value)) {
        db.prepare("DELETE FROM rule_categories").run();
        const stmt = db.prepare("INSERT OR REPLACE INTO rule_categories (id, name, is_default) VALUES (?, ?, ?)");
        db.transaction(() => { value.forEach(rc => stmt.run(rc.id, rc.name, rc.isDefault ? 1 : 0)); })();
        ensureSeedData();
    } else if (key === 'accounts' && Array.isArray(value)) {
        db.prepare("DELETE FROM accounts").run();
        const stmt = db.prepare("INSERT OR REPLACE INTO accounts (id, name, identifier, account_type_id) VALUES (?, ?, ?, ?)");
        db.transaction(() => { value.forEach(a => stmt.run(a.id, a.name, a.identifier, a.accountTypeId || null)); })();
    } else if (key === 'accountTypes' && Array.isArray(value)) {
        db.prepare("DELETE FROM account_types").run();
        const stmt = db.prepare("INSERT OR REPLACE INTO account_types (id, name, is_default) VALUES (?, ?, ?)");
        db.transaction(() => { value.forEach(at => stmt.run(at.id, at.name, at.isDefault ? 1 : 0)); })();
    } else if (key === 'users' && Array.isArray(value)) {
        db.prepare("DELETE FROM users").run();
        const stmt = db.prepare("INSERT OR REPLACE INTO users (id, name, is_default) VALUES (?, ?, ?)");
        db.transaction(() => { value.forEach(u => stmt.run(u.id, u.name, u.isDefault ? 1 : 0)); })();
        ensureSeedData();
    } else if (key === 'transactionTypes' && Array.isArray(value)) {
        db.prepare("DELETE FROM transaction_types").run();
        const stmt = db.prepare("INSERT OR REPLACE INTO transaction_types (id, name, balance_effect, color) VALUES (?, ?, ?, ?)");
        db.transaction(() => { value.forEach(t => stmt.run(t.id, t.name, t.balanceEffect, t.color || null)); })();
        ensureSeedData();
    } else if (key === 'counterparties' && Array.isArray(value)) {
        db.prepare("DELETE FROM counterparties").run();
        const stmt = db.prepare("INSERT OR REPLACE INTO counterparties (id, name, parent_id, notes, user_id) VALUES (?, ?, ?, ?, ?)");
        db.transaction(() => { value.forEach(p => stmt.run(p.id, p.name, p.parentId || null, p.notes || null, p.userId || null)); })();
    } else if (key === 'locations' && Array.isArray(value)) {
        db.prepare("DELETE FROM locations").run();
        const stmt = db.prepare("INSERT OR REPLACE INTO locations (id, name, city, state, country) VALUES (?, ?, ?, ?, ?)");
        db.transaction(() => { value.forEach(l => stmt.run(l.id, l.name, l.city || null, l.state || null, l.country || null)); })();
    } else if (key === 'tags' && Array.isArray(value)) {
        db.prepare("DELETE FROM tags").run();
        const stmt = db.prepare("INSERT OR REPLACE INTO tags (id, name, color) VALUES (?, ?, ?)");
        db.transaction(() => { value.forEach(t => stmt.run(t.id, t.name, t.color)); })();
    } else {
        db.prepare('INSERT INTO app_storage (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, JSON.stringify(value));
    }
    res.json({ success: true });
  } catch (e) { 
      console.error(`[DB] Error saving '${req.params.key}':`, e.message);
      res.status(500).json({ error: e.message }); 
  }
});

app.post('/api/admin/reset', async (req, res) => {
    const { entities } = req.body || {};
    try {
        console.warn(`[ADMIN] Database reset requested for entities: ${entities || 'ALL'}`);
        if (!entities || entities.includes('all')) {
            if (db) db.close();
            if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
            initDb();
            return res.json({ success: true, message: "System purged." });
        }
        db.transaction(() => {
            if (entities.includes('transactions')) { db.prepare("DELETE FROM transactions").run(); db.prepare("DELETE FROM transaction_tags").run(); }
            if (entities.includes('accounts')) db.prepare("DELETE FROM accounts").run();
            if (entities.includes('accountTypes')) db.prepare("DELETE FROM account_types").run();
            if (entities.includes('categories')) db.prepare("DELETE FROM categories").run();
            if (entities.includes('ruleCategories')) db.prepare("DELETE FROM rule_categories").run();
            if (entities.includes('tags')) { db.prepare("DELETE FROM tags").run(); db.prepare("DELETE FROM transaction_tags").run(); }
            if (entities.includes('counterparties')) db.prepare("DELETE FROM counterparties").run();
            if (entities.includes('locations')) db.prepare("DELETE FROM locations").run();
            if (entities.includes('users')) db.prepare("DELETE FROM users WHERE is_default = 0").run();
            if (entities.includes('files_meta')) db.prepare("DELETE FROM files_meta").run();
            const storageKeys = { 'amazonMetrics': 'amazonMetrics', 'youtubeMetrics': 'youtubeMetrics', 'amazonVideos': 'amazonVideos', 'financialGoals': 'financialGoals', 'financialPlan': 'financialPlan', 'reconciliationRules': 'reconciliationRules', 'templates': 'templates', 'tasks': 'tasks', 'taskCompletions': 'taskCompletions', 'savedReports': 'savedReports', 'contentLinks': 'contentLinks', 'businessNotes': 'businessNotes' };
            entities.forEach(entity => { if (storageKeys[entity]) db.prepare("DELETE FROM app_storage WHERE key = ?").run(storageKeys[entity]); });
        })();
        ensureSeedData();
        db.pragma('vacuum');
        res.json({ success: true, message: "Selective purge complete." });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/repair', (req, res) => {
    try {
        console.log("[ADMIN] Executing system repair protocol...");
        runMigrations(); // Run renaming/consolidation logic
        createTables();   // Force ensure tables exist
        ensureSeedData(); // Force re-seed missing types
        res.json({ success: true, message: "Schema verified and core data seeded." });
    } catch (e) {
        console.error("[ADMIN] Repair failed:", e.message);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/files/:id', (req, res) => {
  const { id } = req.params;
  const rawFilename = req.headers['x-filename'] || 'unknown.bin';
  const mimeType = req.headers['content-type'] || 'application/octet-stream';
  try {
    const diskFilename = `${Date.now()}_${rawFilename.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    console.log(`[FILES] Uploading ${rawFilename} as ${diskFilename}`);
    fs.writeFileSync(path.join(DOCUMENTS_DIR, diskFilename), req.body);
    db.prepare('INSERT OR REPLACE INTO files_meta (id, original_name, disk_filename, mime_type, size, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, rawFilename, diskFilename, mimeType, req.body.length, new Date().toISOString());
    res.json({ success: true });
  } catch (e) { 
      console.error("[FILES] Upload failure:", e.message);
      res.status(500).send(e.message); 
  }
});

app.get('/api/files/:id', (req, res) => {
  try {
    const meta = db.prepare('SELECT * FROM files_meta WHERE id = ?').get(req.params.id);
    if (!meta) return res.status(404).send('Metadata entry not found');
    
    const fullPath = path.join(DOCUMENTS_DIR, meta.disk_filename);
    if (fs.existsSync(fullPath)) {
        res.setHeader('Content-Type', meta.mime_type);
        res.sendFile(fullPath);
    } else {
        console.error(`[FILES] Orphaned record: ${meta.original_name} metadata exists but file ${meta.disk_filename} is missing on disk.`);
        res.status(404).send('File missing on server storage');
    }
  } catch (e) { res.status(500).send('Error reading file'); }
});

app.delete('/api/files/:id', (req, res) => {
  try {
    const meta = db.prepare('SELECT * FROM files_meta WHERE id = ?').get(req.params.id);
    if (meta) { 
        const fullPath = path.join(DOCUMENTS_DIR, meta.disk_filename);
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
        db.prepare('DELETE FROM files_meta WHERE id = ?').run(req.params.id); 
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Failed to delete file' }); }
});

if (fs.existsSync(PUBLIC_DIR)) {
    app.use(express.static(PUBLIC_DIR));
    app.get('*', (req, res) => {
        const indexPath = path.join(PUBLIC_DIR, 'index.html');
        if (fs.existsSync(indexPath)) res.sendFile(indexPath);
        else res.status(404).send('Not found');
    });
}

app.listen(PORT, '0.0.0.0', () => console.log(`[SYS] Server running on port ${PORT}`));
