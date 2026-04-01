const db = require('../db');

async function createId() {
    // create unique id for set
    let id = Math.floor(Math.random() * 10000000000000000);

    // check to unsure id is unique
    let [result] = await db.execute(`SELECT * FROM sets WHERE id = ?`, [id]);

    // if not unique generate a new id
    if (result[0]) {
        return await createId();
    } else {
        return id;
    }
}

module.exports = { createId };