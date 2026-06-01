const db = require('./db');

const NY_TZ = 'America/New_York';

const NY_DATE_FMT = new Intl.DateTimeFormat('en-CA', {
    timeZone: NY_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
});

const NY_TIME_FMT = new Intl.DateTimeFormat('en-US', {
    timeZone: NY_TZ,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
});

function todayInNY() {
    return NY_DATE_FMT.format(new Date());
}

function msUntilNextEODNY() {
    const parts = Object.fromEntries(
        NY_TIME_FMT.formatToParts(new Date())
            .filter(p => p.type !== 'literal')
            .map(p => [p.type, parseInt(p.value, 10)])
    );
    let h = parts.hour;
    if (h === 24) h = 0;
    const nowSec = h * 3600 + parts.minute * 60 + parts.second;
    const eodSec = 23 * 3600 + 59 * 60;
    let delta = eodSec - nowSec;
    if (delta <= 0) delta += 24 * 3600;
    return delta * 1000;
}

async function recordDailySnapshot() {
    try {
        const [rows] = await db.execute(
            `SELECT
                (SELECT COUNT(*) FROM accounts) AS accounts,
                (SELECT COUNT(*) FROM sets)     AS sets,
                (SELECT COUNT(*) FROM notes)    AS notes`
        );
        const { accounts, sets, notes } = rows[0];
        await db.execute(
            `INSERT INTO usage_stats (date, accounts, sets, notes)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                accounts = VALUES(accounts),
                sets     = VALUES(sets),
                notes    = VALUES(notes)`,
            [todayInNY(), accounts, sets, notes]
        );
    } catch (err) {
        console.error('[stats] recordDailySnapshot failed:', err.code || err.message);
    }
}

function scheduleEOD() {
    const ms = msUntilNextEODNY();
    setTimeout(async () => {
        await recordDailySnapshot();
        scheduleEOD();
    }, ms);
}

function startDailyScheduler() {
    recordDailySnapshot();
    scheduleEOD();
}

module.exports = { recordDailySnapshot, startDailyScheduler, todayInNY };
