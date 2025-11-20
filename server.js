
import fs from 'fs';
import path from 'path';
import express from 'express';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Data Configuration
const DATA_DIR = path.join(__dirname, 'data', 'config');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Ensure data directory and file exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, '{}', 'utf8');
}

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.get('/api/data', (req, res) => {
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    res.json(JSON.parse(data || '{}'));
  } catch (e) {
    console.error("Error reading DB:", e);
    res.status(500).json({ error: 'Failed to read database' });
  }
});

app.post('/api/data/:key', (req, res) => {
  const { key } = req.params;
  const value = req.body;
  
  try {
    let data = {};
    try {
        const fileContent = fs.readFileSync(DB_FILE, 'utf8');
        data = JSON.parse(fileContent || '{}');
    } catch (readError) {
        // If file is corrupted or empty, start fresh
        data = {};
    }

    data[key] = value;
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    res.json({ success: true });
  } catch (e) {
    console.error("Error writing DB:", e);
    res.status(500).json({ error: 'Failed to save data' });
  }
});

// SPA Fallback (Serve index.html for any other route)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Database file: ${DB_FILE}`);
});
