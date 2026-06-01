const express = require('express');

const db = require('../../utils/db');
const { createId } = require('../../utils/utils');

const setsRouter = new express.Router();

const { auth } = require('../../middleware/auth');

const setsPerPage = 8;


setsRouter.post('/create', auth, async (req, res) => {
    try {
        const { name, description, q, a, questions, answers, caseSensitive, accentSensitive, spanish } = req.body;

        const questionsStr = questions.join(',');
        const answersStr = answers.join(',');

        if (!name || name.length < 3 || name.length > 50) {
            return res.status(400).send('name must be between 3 and 50 characters');
        }
        if (caseSensitive !== true && caseSensitive !== false) {
            return res.status(400).send('caseSensitive must be a boolean');
        }
        if (accentSensitive !== true && accentSensitive !== false) {
            return res.status(400).send('accentSensitive must be a boolean');
        }
        if (spanish !== true && spanish !== false) {
            return res.status(400).send('spanish must be a boolean');
        }

        const id = await createId();

        await db.execute(
            `INSERT INTO sets (id, creator, name, description, case_sensitive, accent_sensitive, spanish, q_name, q_items, a_name, a_items) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, req.user.username, name, description || '', caseSensitive, accentSensitive, spanish, q || 'question', questionsStr, a || 'answer', answersStr]
        );
        await db.execute(
            `UPDATE accounts SET sets = concat(sets , ?) WHERE username = ?`,
            [id + ',', req.user.username]
        );

        res.status(201).send(id.toString());
    } catch (err) {
        console.log(err);
        if (!res.headersSent) res.status(500).send();
    }
});

setsRouter.post('/clone', auth, async (req, res) => {
    try {
        const { setId } = req.body;

        if (!setId) {
            return res.status(400).send('set id to clone is required');
        }

        const [setRes] = await db.execute(
            `SELECT id, name, description, case_sensitive, accent_sensitive, spanish, q_name, q_items, a_name, a_items
             FROM sets WHERE id = ? LIMIT 1`,
            [setId]
        );

        if (!setRes[0]) {
            return res.status(400).send('invalid set id');
        }

        const src = setRes[0];
        const id = await createId();

        await db.execute(
            `INSERT INTO sets (id, creator, name, description, case_sensitive, accent_sensitive, spanish, q_name, q_items, a_name, a_items, cloned_from) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, req.user.username, 'Clone of ' + src.name, src.description || '', src.case_sensitive, src.accent_sensitive, src.spanish, src.q_name, src.q_items, src.a_name, src.a_items, src.id]
        );
        await db.execute(
            `UPDATE accounts SET sets = concat(sets , ?) WHERE username = ?`,
            [id + ',', req.user.username]
        );

        res.status(201).send(id.toString());
    } catch (err) {
        console.log(err);
        if (!res.headersSent) res.status(500).send();
    }
});

setsRouter.get('/get/:id', async (req, res) => {
    try {
        const [result] = await db.execute(
            `SELECT name, description, creator, q_name, q_items, a_name, a_items, completions, case_sensitive, accent_sensitive, spanish, last_edited
             FROM sets WHERE id = ? LIMIT 1`,
            [req.params.id]
        );

        if (!result[0]) return res.status(400).send('invalid set id');

        const r = result[0];
        res.set('Cache-Control', 'public, max-age=30');
        res.status(201).send({
            name: r.name,
            description: r.description,
            creator: r.creator,
            q: r.q_name,
            a: r.a_name,
            questions: r.q_items ? r.q_items.split(',') : [],
            answers: r.a_items ? r.a_items.split(',') : [],
            completions: r.completions,
            case_sensitive: r.case_sensitive,
            accent_sensitive: r.accent_sensitive,
            spanish: r.spanish,
            last_edited: r.last_edited,
        });
    } catch (err) {
        console.log(err);
        if (!res.headersSent) res.status(500).send();
    }
});

setsRouter.post('/edit', auth, async (req, res) => {
    try {
        const { name, description, q, a, questions, answers, id, caseSensitive, accentSensitive, spanish } = req.body;

        const [[setRes], [userRes]] = await Promise.all([
            db.execute(`SELECT 1 AS x FROM sets WHERE id = ? LIMIT 1`, [id]),
            db.execute(`SELECT sets FROM accounts WHERE username = ? LIMIT 1`, [req.user.username]),
        ]);

        if (!setRes[0]) return res.status(400).send('invalid set id');
        if (!userRes[0]) return res.status(400).send('error fetching user');
        if (!ownsId(userRes[0].sets, id)) return res.status(400).send('you cannot edit a set you do not own');

        if (caseSensitive !== true && caseSensitive !== false) {
            return res.status(400).send('caseSensitive must be a boolean');
        }
        if (accentSensitive !== true && accentSensitive !== false) {
            return res.status(400).send('accentSensitive must be a boolean');
        }
        if (spanish !== true && spanish !== false) {
            return res.status(400).send('spanish must be a boolean');
        }

        const questionsStr = questions.join(',');
        const answersStr = answers.join(',');

        if (!name || name.length < 3 || name.length > 50) {
            return res.status(400).send('name must be between 3 and 50 characters');
        }

        await db.execute(
            `UPDATE sets SET name = ?, description = ?, q_name = ?, q_items = ?, a_name = ?, a_items = ?, case_sensitive = ?, accent_sensitive = ?, spanish = ?, last_edited = CURRENT_TIMESTAMP WHERE id = ?`,
            [name, description || '', q || 'question', questionsStr, a || 'answer', answersStr, caseSensitive, accentSensitive, spanish, id]
        );

        res.status(201).send();
    } catch (err) {
        console.log(err);
        if (!res.headersSent) res.status(500).send();
    }
});

setsRouter.post('/delete', auth, async (req, res) => {
    try {
        const { id } = req.body;

        const [[setRes], [userRes]] = await Promise.all([
            db.execute(`SELECT 1 AS x FROM sets WHERE id = ? LIMIT 1`, [id]),
            db.execute(`SELECT sets FROM accounts WHERE username = ? LIMIT 1`, [req.user.username]),
        ]);

        if (!setRes[0]) return res.status(400).send('invalid set id');
        if (!userRes[0]) return res.status(400).send('error fetching user');
        if (!ownsId(userRes[0].sets, id)) return res.status(400).send('you cannot edit a set you do not own');

        const sets = (userRes[0].sets || '').split(',').filter(s => s !== '' && s !== id.toString());

        await Promise.all([
            db.execute(`DELETE FROM sets WHERE id = ?`, [id]),
            db.execute(`UPDATE accounts SET sets = ? WHERE username = ?`, [sets.join(',') + (sets.length ? ',' : ''), req.user.username]),
        ]);

        res.status(201).send();
    } catch (err) {
        console.log(err);
        if (!res.headersSent) res.status(500).send();
    }
});

setsRouter.post('/completion', async (req, res) => {
    try {
        const { id } = req.body;

        const [result] = await db.execute(
            `UPDATE sets SET completions = COALESCE(completions, 0) + 1 WHERE id = ?`,
            [id]
        );

        if (result.affectedRows === 0) return res.status(400).send('invalid set id');

        res.status(201).send();
    } catch (err) {
        console.log(err);
        if (!res.headersSent) res.status(500).send();
    }
});

setsRouter.post('/popular', async (req, res) => {
    try {
        const { order } = req.body;
        const page = Math.max(1, parseInt(order, 10) || 1);
        const offset = (page - 1) * setsPerPage;

        const [setRes] = await db.execute(
            `SELECT id, creator, name FROM sets ORDER BY completions DESC LIMIT ? OFFSET ?`,
            [setsPerPage, offset]
        );

        res.set('Cache-Control', 'public, max-age=60');
        res.status(201).send(setRes.map(r => ({ id: r.id, creator: r.creator, name: r.name })));
    } catch (err) {
        console.log(err);
        if (!res.headersSent) res.status(500).send();
    }
});

setsRouter.post('/search', async (req, res) => {
    try {
        const { order, query } = req.body;

        if (query == '') {
            return res.status(400).send('query is required');
        }

        const page = Math.max(1, parseInt(order, 10) || 1);
        const offset = (page - 1) * setsPerPage;

        const [setRes] = await db.execute(
            `SELECT id, creator, name FROM sets WHERE name LIKE ? LIMIT ? OFFSET ?`,
            [`%${query}%`, setsPerPage, offset]
        );

        if (setRes.length === 0) {
            return res.status(201).send('all sets are displayed');
        }

        res.status(201).send(setRes.map(r => ({ id: r.id, creator: r.creator, name: r.name })));
    } catch (err) {
        console.log(err);
        if (!res.headersSent) res.status(500).send();
    }
});

function ownsId(csv, id) {
    if (!csv) return false;
    const target = id.toString();
    return csv.split(',').some(s => s === target);
}

module.exports = setsRouter;
