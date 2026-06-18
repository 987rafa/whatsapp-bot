const fs = require('fs');
const path = require('path');
const { DB_PATH } = require('./database');

const BACKUP_DIR = path.join(__dirname, '../../data/backups');

fs.mkdirSync(BACKUP_DIR, { recursive: true });

function doBackup() {
  try {
    if (!fs.existsSync(DB_PATH)) return;
    const date = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const backupPath = path.join(BACKUP_DIR, `bot_${date}.db`);
    fs.copyFileSync(DB_PATH, backupPath);
    console.log(`💾 Backup: ${backupPath}`);

    // Keep only last 10 backups
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.db'))
      .map(f => ({ name: f, time: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
      .sort((a, b) => b.time - a.time);

    while (files.length > 10) {
      const old = files.pop();
      fs.unlinkSync(path.join(BACKUP_DIR, old.name));
    }
  } catch (err) {
    console.error('Backup error:', err.message);
  }
}

function startBackupScheduler() {
  doBackup();
  setInterval(doBackup, 6 * 60 * 60 * 1000); // every 6 hours
  console.log('💾 Backups automáticos cada 6h');
}

module.exports = { startBackupScheduler, doBackup };
