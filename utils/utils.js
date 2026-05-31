const db = require('./db');

async function createId() {
    while (true) {
        const id = Math.floor(Math.random() * 10000000000000000);
        const [result] = await db.execute(`SELECT 1 AS x FROM sets WHERE id = ? LIMIT 1`, [id]);
        if (!result[0]) return id;
    }
}

module.exports = { createId };
