
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

app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        if (duration > 500) {
            console.log(`[SLOW REQ] ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
        }
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

const initDb = () => {
    try {
        db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL');
        db.pragma('synchronous = NORMAL');
        db.pragma('busy_timeout = 5000');
        createTables();
        runMigrations();
        ensureSeedData();
    } catch (dbErr) { console.error("[DB] ENGINE STARTUP FAILURE:", dbErr.message); }
};

const createTables = () => {
    db.exec(`
        CREATE TABLE IF NOT EXISTS app_storage (key TEXT PRIMARY KEY, value TEXT);
        CREATE TABLE IF NOT EXISTS files_meta (id TEXT PRIMARY KEY, original_name TEXT, disk_filename TEXT, mime_type TEXT, size INTEGER, created_at TEXT, parent_id TEXT);
        CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, name TEXT, parent_id TEXT);
        CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, name TEXT, identifier TEXT, account_type_id TEXT, parsing_profile TEXT);
        CREATE TABLE IF NOT EXISTS account_types (id TEXT PRIMARY KEY, name TEXT, is_default INTEGER);
        CREATE TABLE IF NOT EXISTS transaction_types (id TEXT PRIMARY KEY, name TEXT, balance_effect TEXT, color TEXT);
        CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT, is_default INTEGER DEFAULT 0);
        CREATE TABLE IF NOT EXISTS counterparties (id TEXT PRIMARY KEY, name TEXT, parent_id TEXT, notes TEXT, user_id TEXT);
        CREATE TABLE IF NOT EXISTS locations (id TEXT PRIMARY KEY, name TEXT, city TEXT, state TEXT, country TEXT);
        CREATE TABLE IF NOT EXISTS tags (id TEXT PRIMARY KEY, name TEXT, color TEXT);
        CREATE TABLE IF NOT EXISTS rule_categories (id TEXT PRIMARY KEY, name TEXT, is_default INTEGER DEFAULT 0);
        CREATE TABLE IF NOT EXISTS transaction_tags (transaction_id TEXT, tag_id TEXT, PRIMARY KEY (transaction_id, tag_id));
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
        CREATE TABLE IF NOT EXISTS reconciliation_rules (
            id TEXT PRIMARY KEY,
            name TEXT,
            rule_category_id TEXT,
            priority INTEGER DEFAULT 0,
            skip_import INTEGER DEFAULT 0,
            is_ai_draft INTEGER DEFAULT 0,
            logic_json TEXT
        );
    `);
};

const runMigrations = () => {
    const tableExists = (name) => db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name);
    const getColumns = (name) => db.prepare(`PRAGMA table_info(${name})`).all();

    db.transaction(() => {
        if (!tableExists('counterparties')) db.exec("CREATE TABLE counterparties (id TEXT PRIMARY KEY, name TEXT, parent_id TEXT, notes TEXT, user_id TEXT)");
        
        const fileCols = getColumns('files_meta');
        if (!fileCols.some(c => c.name === 'parent_id')) db.exec("ALTER TABLE files_meta ADD COLUMN parent_id TEXT");

        const accCols = getColumns('accounts');
        if (!accCols.some(c => c.name === 'parsing_profile')) db.exec("ALTER TABLE accounts ADD COLUMN parsing_profile TEXT");
    })();
};

const ensureSeedData = () => {
    try {
        const typeCount = db.prepare("SELECT COUNT(*) as count FROM transaction_types").get().count;
        if (typeCount < 6) {
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
        if (userCount === 0) db.prepare("INSERT INTO users (id, name, is_default) VALUES (?, ?, ?)").run('user_primary', 'Primary User', 1);
        const categoryCount = db.prepare("SELECT COUNT(*) as count FROM categories").get().count;
        if (categoryCount === 0) db.prepare("INSERT INTO categories (id, name) VALUES (?, ?)").run('cat_other', 'Other');
        const insertRuleCat = db.prepare("INSERT OR REPLACE INTO rule_categories (id, name, is_default) VALUES (?, ?, ?)");
        db.transaction(() => {
            insertRuleCat.run('rcat_desc', 'Description', 0);
            insertRuleCat.run('rcat_loc', 'Location', 0);
            insertRuleCat.run('rcat_manual', 'Manual Rule', 1);
            insertRuleCat.run('rcat_other', 'Other', 0);
        })();
    } catch (err) { console.error("[DB] Seeder Error:", err.message); }
};

initDb();

/**
 * AUTOMATED BACKUP ENGINE - Now Asynchronous
 */
const runAutomatedBackup = async () => {
    const row = db.prepare("SELECT value FROM app_storage WHERE key = ?").get('systemSettings');
    if (!row || !row.value) return;

    let settings;
    try { settings = JSON.parse(row.value); } catch(e) { return; }
    
    const config = settings.backupConfig;
    if (!config || !config.enabled || config.frequency === 'never') return;

    const lastRun = config.lastRun ? new Date(config.lastRun) : new Date(0);
    const now = new Date();
    let shouldRun = false;

    if (config.frequency === 'daily') {
        shouldRun = (now - lastRun) > 24 * 60 * 60 * 1000;
    } else if (config.frequency === 'weekly') {
        shouldRun = (now - lastRun) > 7 * 24 * 60 * 60 * 1000;
    } else if (config.frequency === 'monthly') {
        shouldRun = (now - lastRun) > 30 * 24 * 60 * 60 * 1000;
    }

    if (shouldRun) {
        // Run in next tick to not block the current request
        setImmediate(async () => {
            console.log(`[BACKUP] Initializing background ${config.frequency} preservation...`);
            const logs = config.logs || [];
            const addLog = (action, details, status = 'success') => {
                logs.unshift({ id: Math.random().toString(36).substring(7), timestamp: new Date().toISOString(), action, details, status });
                if (logs.length > 10) logs.pop();
            };

            try {
                const data = { exportDate: new Date().toISOString(), version: '0.6.0', type: 'automated_snapshot' };
                const tables = ['transactions', 'accounts', 'categories', 'tags', 'counterparties', 'reconciliation_rules', 'rule_categories', 'users', 'locations', 'transaction_types'];
                tables.forEach(t => { try { data[t] = db.prepare(`SELECT * FROM ${t}`).all(); } catch(e) {} });
                
                const storageRows = db.prepare("SELECT key, value FROM app_storage").all();
                storageRows.forEach(r => { try { data[r.key] = JSON.parse(r.value); } catch(e) {} });

                const backupId = `bkp_${Date.now()}`;
                const originalName = `autobackup_${now.toISOString().split('T')[0]}.json`;
                const diskFilename = `${Date.now()}_${originalName}`;
                const content = JSON.stringify(data, null, 2);
                
                fs.writeFileSync(path.join(DOCUMENTS_DIR, diskFilename), content);

                db.prepare('INSERT INTO files_meta (id, original_name, disk_filename, mime_type, size, created_at, parent_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
                .run(backupId, originalName, diskFilename, 'application/json', content.length, new Date().toISOString(), 'folder_system_backups');

                addLog('Backup Created', `Institutional logic preserved in ${originalName}. Registered in Vault.`, 'success');

                const backups = db.prepare("SELECT * FROM files_meta WHERE parent_id = 'folder_system_backups' ORDER BY created_at DESC").all();
                if (backups.length > config.retentionCount) {
                    const toDelete = backups.slice(config.retentionCount);
                    toDelete.forEach(b => {
                        const fullPath = path.join(DOCUMENTS_DIR, b.disk_filename);
                        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
                        db.prepare('DELETE FROM files_meta WHERE id = ?').run(b.id);
                        addLog('Policy Cleanup', `Removed expired snapshot: ${b.original_name}`, 'success');
                    });
                }

                settings.backupConfig = { ...config, lastRun: now.toISOString(), lastBackupDate: now.toISOString(), logs };
                db.prepare('INSERT OR REPLACE INTO app_storage (key, value) VALUES (?, ?)').run('systemSettings', JSON.stringify(settings));
                console.log("[BACKUP] Background preservation complete.");
            } catch (err) {
                console.error("[BACKUP] Routine failed:", err.message);
                addLog('Failure', `Snapshot routine aborted: ${err.message}`, 'failure');
                settings.backupConfig = { ...config, lastRun: now.toISOString(), logs };
                db.prepare('INSERT OR REPLACE INTO app_storage (key, value) VALUES (?, ?)').run('systemSettings', JSON.stringify(settings));
            }
        });
    }
};

/**
 * RECONCILIATION RULES ENDPOINTS
 */
app.post('/api/reconciliation-rules', (req, res) => {
    try {
        const rule = req.body;
        if (!rule || !rule.id) return res.status(400).json({ error: "Missing rule identity" });
        
        db.prepare(`
            INSERT INTO reconciliation_rules (id, name, rule_category_id, priority, skip_import, is_ai_draft, logic_json)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                rule_category_id = excluded.rule_category_id,
                priority = excluded.priority,
                skip_import = excluded.skip_import,
                is_ai_draft = excluded.is_ai_draft,
                logic_json = excluded.logic_json
        `).run(
            rule.id, 
            rule.name, 
            rule.ruleCategoryId || null, 
            rule.priority || 0, 
            rule.skipImport ? 1 : 0, 
            rule.isAiDraft ? 1 : 0, 
            JSON.stringify(rule)
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/reconciliation-rules/:id', (req, res) => {
    try {
        db.prepare('DELETE FROM reconciliation_rules WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/transactions/:id', (req, res) => {
    try {
        db.prepare('DELETE FROM transactions WHERE id = ?').run(req.params.id);
        db.prepare('DELETE FROM transaction_tags WHERE transaction_id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/transactions/delete-batch', (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "IDs array required" });
        
        const deleteTx = db.prepare('DELETE FROM transactions WHERE id = ?');
        const deleteTags = db.prepare('DELETE FROM transaction_tags WHERE transaction_id = ?');
        
        db.transaction((targetIds) => {
            for (const id of targetIds) {
                deleteTx.run(id);
                deleteTags.run(id);
            }
        })(ids);
        
        res.json({ success: true, count: ids.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/transactions', (req, res) => {
    try {
        const { limit = 50, offset = 0, sortKey = 'date', sortDir = 'DESC', search, startDate, endDate, userId } = req.query;
        let filterQuery = ` WHERE 1=1`; 
        const values = [];
        if (search) {
            filterQuery += ` AND (t.description LIKE ? OR t.notes LIKE ? OR t.original_description LIKE ?)`;
            const s = `%${search}%`;
            values.push(s, s, s);
        }
        if (startDate) { filterQuery += ` AND t.date >= ?`; values.push(startDate); }
        if (endDate) { filterQuery += ` AND t.date <= ?`; values.push(endDate); }
        if (userId) { filterQuery += ` AND t.user_id = ?`; values.push(userId); }
        
        const dataQuery = `
            SELECT t.*, GROUP_CONCAT(tg.tag_id) as tagIds 
            FROM transactions t
            LEFT JOIN transaction_tags tg ON t.id = tg.transaction_id
            ${filterQuery}
            GROUP BY t.id
            ORDER BY t.${sortKey} ${sortDir}
            LIMIT ? OFFSET ?
        `;
        const rows = db.prepare(dataQuery).all(...values, parseInt(limit), parseInt(offset));
        const totalCount = db.prepare(`SELECT COUNT(*) as count FROM transactions t ${filterQuery}`).get(...values).count;
        
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
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/transactions/batch', (req, res) => {
    try {
        const txs = req.body;
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
                insert.run(tx.id, tx.date, tx.description, tx.amount, tx.categoryId, tx.accountId, tx.typeId, tx.counterpartyId || null, tx.locationId || null, tx.userId || null, tx.location || null, tx.notes || null, tx.originalDescription || null, tx.sourceFilename || null, tx.linkGroupId || null, tx.isParent ? 1 : 0, tx.parentTransactionId || null, tx.isCompleted ? 1 : 0, JSON.stringify(tx.appliedRuleIds || []), JSON.stringify(tx.metadata || {}));
                tagClear.run(tx.id);
                if (tx.tagIds) tx.tagIds.forEach(tid => tagInsert.run(tx.id, tid));
            }
        })(txs);
        res.json({ success: true, count: txs.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/analytics/summary', (req, res) => {
    try {
        const { startDate, endDate, search } = req.query;
        let where = ` 
            WHERE 1=1 
            AND (
                t.is_parent = 0 
                OR t.id NOT IN (SELECT DISTINCT parent_transaction_id FROM transactions WHERE parent_transaction_id IS NOT NULL)
            )
        `;
        const values = [];
        if (startDate) { where += ` AND t.date >= ?`; values.push(startDate); }
        if (endDate) { where += ` AND t.date <= ?`; values.push(endDate); }
        if (search) { where += ` AND t.description LIKE ?`; values.push(`%${search}%`); }

        const query = `
            SELECT 
                SUM(CASE WHEN tt.balance_effect = 'incoming' AND t.type_id != 'type_investment' THEN t.amount ELSE 0 END) as incoming,
                SUM(CASE WHEN tt.balance_effect = 'outgoing' AND t.type_id != 'type_investment' THEN t.amount ELSE 0 END) as outgoing,
                SUM(CASE WHEN tt.balance_effect = 'neutral' THEN t.amount ELSE 0 END) as neutral,
                SUM(CASE WHEN t.type_id = 'type_investment' THEN t.amount ELSE 0 END) as investments,
                SUM(CASE WHEN t.type_id = 'type_donation' THEN t.amount ELSE 0 END) as donations
            FROM transactions t
            JOIN transaction_types tt ON t.type_id = tt.id
            ${where}
        `;
        const summary = db.prepare(query).get(...values);
        res.json({
            incoming: summary.incoming || 0,
            outgoing: summary.outgoing || 0,
            neutral: summary.neutral || 0,
            investments: summary.investments || 0,
            donations: summary.donations || 0
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/analytics/breakdown', (req, res) => {
    try {
        const { type, startDate, endDate, search } = req.query;
        let where = ` 
            WHERE 1=1 
            AND (
                t.is_parent = 0 
                OR t.id NOT IN (SELECT DISTINCT parent_transaction_id FROM transactions WHERE parent_transaction_id IS NOT NULL)
            )
        `;
        const values = [];
        if (startDate) { where += ` AND t.date >= ?`; values.push(startDate); }
        if (endDate) { where += ` AND t.date <= ?`; values.push(endDate); }
        if (search) { where += ` AND t.description LIKE ?`; values.push(`%${search}%`); }
        
        if (type === 'inflow') where += ` AND tt.balance_effect = 'incoming' AND t.type_id != 'type_investment'`;
        else if (type === 'outflow') where += ` AND tt.balance_effect = 'outgoing' AND t.type_id != 'type_investment'`;
        else if (type === 'investments') where += ` AND t.type_id = 'type_investment'`;

        const query = `
            SELECT 
                COALESCE(p.name, t.description) as label,
                SUM(t.amount) as amount
            FROM transactions t
            JOIN transaction_types tt ON t.type_id = tt.id
            LEFT JOIN counterparties p ON t.counterparty_id = p.id
            ${where}
            GROUP BY label
            ORDER BY amount DESC
            LIMIT 15
        `;
        const items = db.prepare(query).all(...values);
        const total = items.reduce((s, i) => s + i.amount, 0);
        res.json({ 
            items: items.map(i => ({ ...i, percentage: total > 0 ? (i.amount / total) * 100 : 0 })),
            total 
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/data', async (req, res) => {
  try {
    runAutomatedBackup(); // Fire and forget
    const rows = db.prepare('SELECT key, value FROM app_storage').all();
    const data = {};
    for (const row of rows) {
      try { data[row.key] = JSON.parse(row.value); } catch (e) { data[row.key] = null; }
    }
    data.reconciliationRules = db.prepare("SELECT logic_json FROM reconciliation_rules").all().map(r => JSON.parse(r.logic_json));
    data.categories = db.prepare("SELECT id, name, parent_id AS parentId FROM categories").all();
    data.ruleCategories = db.prepare("SELECT id, name, is_default AS isDefault FROM rule_categories").all().map(r => ({...r, isDefault: !!r.isDefault}));
    data.accounts = db.prepare("SELECT id, name, identifier, account_type_id AS accountTypeId, parsing_profile AS parsingProfile FROM accounts").all().map(a => ({
        ...a,
        parsingProfile: a.parsingProfile ? JSON.parse(a.parsingProfile) : undefined
    }));
    data.accountTypes = db.prepare("SELECT id, name, is_default AS isDefault FROM account_types").all().map(a => ({...a, isDefault: !!a.isDefault}));
    data.users = db.prepare("SELECT id, name, is_default AS isDefault FROM users").all().map(u => ({...u, isDefault: !!u.isDefault}));
    data.counterparties = db.prepare("SELECT id, name, parent_id AS parentId, notes, user_id AS userId FROM counterparties").all();
    data.locations = db.prepare("SELECT id, name, city, state, country FROM locations").all();
    data.tags = db.prepare("SELECT * FROM tags").all();
    data.transactionTypes = db.prepare("SELECT id, name, balance_effect as balanceEffect, color FROM transaction_types").all();
    data.businessDocuments = db.prepare("SELECT * FROM files_meta").all().map(f => ({ ...f, uploadDate: f.created_at, parentId: f.parent_id }));
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/data/:key', (req, res) => {
  try {
    const key = req.params.key;
    const value = req.body;
    
    db.prepare('INSERT INTO app_storage (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, JSON.stringify(value));
    
    if (key === 'categories') {
        db.prepare('DELETE FROM categories').run();
        const insert = db.prepare('INSERT INTO categories (id, name, parent_id) VALUES (?, ?, ?)');
        db.transaction((items) => items.forEach(i => insert.run(i.id, i.name, i.parentId || null)))(value);
    } else if (key === 'accounts') {
        db.transaction((items) => {
            db.prepare('DELETE FROM accounts').run();
            const insert = db.prepare('INSERT INTO accounts (id, name, identifier, account_type_id, parsing_profile) VALUES (?, ?, ?, ?, ?)');
            items.forEach(i => {
                const accTypeId = i.accountTypeId || i.account_type_id;
                const profile = i.parsingProfile || i.parsing_profile;
                insert.run(i.id, i.name, i.identifier, accTypeId, profile ? JSON.stringify(profile) : null);
            });
        })(value);
    } else if (key === 'users') {
        db.prepare('DELETE FROM users').run();
        const insert = db.prepare('INSERT INTO users (id, name, is_default) VALUES (?, ?, ?)');
        db.transaction((items) => items.forEach(i => insert.run(i.id, i.name, i.isDefault ? 1 : 0)))(value);
    } else if (key === 'counterparties') {
        db.prepare('DELETE FROM counterparties').run();
        const insert = db.prepare('INSERT INTO counterparties (id, name, parent_id, notes, user_id) VALUES (?, ?, ?, ?, ?)');
        db.transaction((items) => items.forEach(i => insert.run(i.id, i.name, i.parentId || null, i.notes || null, i.userId || null)))(value);
    } else if (key === 'locations') {
        db.prepare('DELETE FROM locations').run();
        const insert = db.prepare('INSERT INTO locations (id, name, city, state, country) VALUES (?, ?, ?, ?, ?)');
        db.transaction((items) => items.forEach(i => insert.run(i.id, i.name, i.city || null, i.state || null, i.country || null)))(value);
    } else if (key === 'tags') {
        db.prepare('DELETE FROM tags').run();
        const insert = db.prepare('INSERT INTO tags (id, name, color) VALUES (?, ?, ?)');
        db.transaction((items) => items.forEach(i => insert.run(i.id, i.name, i.color)))(value);
    } else if (key === 'transactionTypes') {
        db.prepare('DELETE FROM transaction_types').run();
        const insert = db.prepare('INSERT INTO transaction_types (id, name, balance_effect, color) VALUES (?, ?, ?, ?)');
        db.transaction((items) => items.forEach(i => insert.run(i.id, i.name, i.balanceEffect, i.color)))(value);
    } else if (key === 'ruleCategories') {
        db.prepare('DELETE FROM rule_categories').run();
        const insert = db.prepare('INSERT INTO rule_categories (id, name, is_default) VALUES (?, ?, ?)');
        db.transaction((items) => items.forEach(i => insert.run(i.id, i.name, i.isDefault ? 1 : 0)))(value);
    }

    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/diagnose', (req, res) => {
    try {
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
        const stats = tables.map(t => ({
            table: t.name,
            rowCount: db.prepare(`SELECT COUNT(*) as count FROM ${t.name}`).get().count
        }));
        res.json({ tables: stats, timestamp: new Date().toISOString() });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/audit-integrity', (req, res) => {
    try {
        const orphans = db.prepare(`
            SELECT * FROM transactions 
            WHERE parent_transaction_id IS NOT NULL 
            AND parent_transaction_id NOT IN (SELECT id FROM transactions)
        `).all();

        const emptyParents = db.prepare(`
            SELECT * FROM transactions 
            WHERE is_parent = 1 
            AND id NOT IN (SELECT DISTINCT parent_transaction_id FROM transactions WHERE parent_transaction_id IS NOT NULL)
        `).all();

        const brokenLinks = db.prepare(`
            SELECT * FROM transactions 
            WHERE link_group_id IS NOT NULL 
            AND link_group_id NOT IN (SELECT DISTINCT link_group_id FROM transactions WHERE is_parent = 1)
        `).all();

        const today = new Date().toISOString().split('T')[0];
        const futureDates = db.prepare(`
            SELECT * FROM transactions
            WHERE date > ?
        `).all(today);

        res.json({
            orphans,
            emptyParents,
            brokenLinks,
            futureDates
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/repair', (req, res) => {
    try {
        createTables();
        runMigrations();
        ensureSeedData();
        
        db.transaction(() => {
            db.exec(`
                UPDATE transactions 
                SET is_parent = 0 
                WHERE is_parent = 1 
                AND id NOT IN (SELECT DISTINCT parent_transaction_id FROM transactions WHERE parent_transaction_id IS NOT NULL)
            `);
            
            const dupSignatures = db.prepare(`
                SELECT date, amount, original_description, account_id, COUNT(*) as cnt 
                FROM transactions 
                WHERE is_parent = 0 
                GROUP BY date, amount, original_description, account_id 
                HAVING cnt > 1
            `).all();

            for (const sig of dupSignatures) {
                const matches = db.prepare(`
                    SELECT id FROM transactions 
                    WHERE date = ? AND amount = ? AND original_description = ? AND account_id = ?
                    ORDER BY id ASC
                `).all(sig.date, sig.amount, sig.original_description, sig.account_id);
                
                if (matches.length > 1) {
                    const toDelete = matches.slice(1);
                    const del = db.prepare('DELETE FROM transactions WHERE id = ?');
                    toDelete.forEach(m => del.run(m.id));
                }
            }
        })();

        res.json({ success: true, message: "System core normalized and logical orphans rebalanced." });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/reset', (req, res) => {
    try {
        const { entities } = req.body;
        const targetAll = entities.includes('all');
        
        db.transaction(() => {
            if (targetAll || entities.includes('transactions')) {
                db.exec('DELETE FROM transactions');
                db.exec('DELETE FROM transaction_tags');
            }
            if (targetAll || entities.includes('reconciliationRules')) db.exec('DELETE FROM reconciliation_rules');
            if (targetAll || entities.includes('categories')) db.exec('DELETE FROM categories');
            if (targetAll || entities.includes('accounts')) db.exec('DELETE FROM accounts');
            if (targetAll || entities.includes('counterparties')) db.exec('DELETE FROM counterparties');
            if (targetAll || entities.includes('tags')) db.exec('DELETE FROM tags');
            if (targetAll || entities.includes('financialGoals')) db.prepare('DELETE FROM app_storage WHERE key = ?').run('financialGoals');
            if (targetAll || entities.includes('businessProfile')) db.prepare('DELETE FROM app_storage WHERE key = ?').run('businessProfile');
            
            if (targetAll) db.exec('DELETE FROM app_storage');
        })();
        ensureSeedData();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/files/:id', (req, res) => {
  const { id } = req.params;
  const rawFilename = req.headers['x-filename'] || 'unknown.bin';
  const mimeType = req.headers['content-type'] || 'application/octet-stream';
  try {
    const diskFilename = `${Date.now()}_${rawFilename.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    fs.writeFileSync(path.join(DOCUMENTS_DIR, diskFilename), req.body);
    db.prepare('INSERT OR REPLACE INTO files_meta (id, original_name, disk_filename, mime_type, size, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, rawFilename, diskFilename, mimeType, req.body.length, new Date().toISOString());
    res.json({ success: true });
  } catch (e) { res.status(500).send(e.message); }
});

app.get('/api/files/:id', (req, res) => {
  try {
    const meta = db.prepare('SELECT * FROM files_meta WHERE id = ?').get(req.params.id);
    if (!meta) return res.status(404).send('Metadata entry not found');
    const fullPath = path.join(DOCUMENTS_DIR, meta.disk_filename);
    if (fs.existsSync(fullPath)) {
        res.setHeader('Content-Type', meta.mime_type);
        res.sendFile(fullPath);
    } else res.status(404).send('File missing');
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
