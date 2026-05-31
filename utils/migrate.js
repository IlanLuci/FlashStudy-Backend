const db = require('./db');

const desiredTables = [
    {
        name: 'refresh_tokens',
        ddl: `CREATE TABLE refresh_tokens (
            id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            token_hash CHAR(64) NOT NULL,
            username VARCHAR(64) NOT NULL,
            expires_at DATETIME NOT NULL,
            revoked TINYINT(1) NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uk_token_hash (token_hash),
            KEY idx_username (username),
            KEY idx_expires (expires_at)
        )`,
    },
];

const desiredIndexes = [
    { table: 'accounts', name: 'idx_username',     cols: 'username(64)',  unique: true  },
    { table: 'accounts', name: 'idx_email',        cols: 'email(191)',    unique: true  },
    { table: 'sets',     name: 'idx_sets_id',      cols: 'id',            unique: true  },
    { table: 'sets',     name: 'idx_completions',  cols: 'completions',   unique: false },
    { table: 'sets',     name: 'idx_sets_creator', cols: 'creator(64)',   unique: false },
    { table: 'notes',    name: 'idx_notes_id',     cols: 'id',            unique: true  },
    { table: 'notes',    name: 'idx_notes_creator',cols: 'creator(64)',   unique: false },
];

async function indexExists(table, name) {
    const [rows] = await db.query(
        `SELECT 1 FROM information_schema.statistics
         WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?
         LIMIT 1`,
        [table, name]
    );
    return rows.length > 0;
}

async function tableExists(table) {
    const [rows] = await db.query(
        `SELECT 1 FROM information_schema.tables
         WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1`,
        [table]
    );
    return rows.length > 0;
}

async function runMigrations() {
    if (process.env.SKIP_MIGRATIONS === '1') {
        console.log('[migrate] SKIP_MIGRATIONS=1 — skipping');
        return;
    }

    console.log('[migrate] starting');
    const start = Date.now();

    for (const t of desiredTables) {
        if (await tableExists(t.name)) continue;
        console.log(`[migrate] CREATE TABLE ${t.name}`);
        try {
            await db.query(t.ddl);
            console.log(`[migrate] ok: table ${t.name}`);
        } catch (err) {
            console.error(`[migrate] FAILED creating ${t.name}:`, err.code || err.message);
        }
    }

    const seenTables = {};
    for (const idx of desiredIndexes) {
        if (seenTables[idx.table] === undefined) {
            seenTables[idx.table] = await tableExists(idx.table);
        }
        if (!seenTables[idx.table]) {
            console.log(`[migrate] table ${idx.table} not found — skipping ${idx.name}`);
            continue;
        }

        if (await indexExists(idx.table, idx.name)) {
            continue;
        }

        const ddl = `ALTER TABLE \`${idx.table}\` ADD ${idx.unique ? 'UNIQUE ' : ''}INDEX \`${idx.name}\` (${idx.cols})`;
        console.log(`[migrate] ${ddl}`);
        try {
            await db.query(ddl);
            console.log(`[migrate] ok: ${idx.name}`);
        } catch (err) {
            if (err.code === 'ER_DUP_ENTRY' || err.code === 'ER_DUP_KEYNAME') {
                console.log(`[migrate] skip (already present or dup data): ${idx.name} — ${err.code}`);
            } else {
                console.error(`[migrate] FAILED: ${idx.name}`, err.code || err.message);
            }
        }
    }

    console.log(`[migrate] done in ${Date.now() - start}ms`);
}

module.exports = { runMigrations };
