const express = require('express');

const db = require('../../utils/db');
const { createId } = require('../../utils/utils');

const notesRouter = new express.Router();

const { auth } = require('../../middleware/auth');

const notesPerPage = 8;


notesRouter.post('/create', auth, async (req, res) => {
    try {
        const { title, subject, note } = req.body;

        if (!(title && subject)) {
            return res.status(400).send('title and subject are required');
        }
        if (title.length < 3 || title.length > 50) {
            return res.status(400).send('title must be between 3 and 50 characters');
        }

        const id = await createId();

        await db.execute(
            `INSERT INTO notes (id, title, subject, creator, note) VALUES (?, ?, ?, ?, ?)`,
            [id, title, subject, req.user.username, note]
        );
        await db.execute(
            `UPDATE accounts SET notes = concat(notes , ?) WHERE username = ?`,
            [id + ',', req.user.username]
        );

        res.status(201).send(id.toString());
    } catch (err) {
        console.log(err);
        if (!res.headersSent) res.status(500).send();
    }
});

notesRouter.get('/get/:id', async (req, res) => {
    try {
        const [result] = await db.execute(
            `SELECT title, subject, creator, note, last_edited FROM notes WHERE id = ? LIMIT 1`,
            [req.params.id]
        );

        if (!result[0]) return res.status(400).send('invalid note id');

        const r = result[0];
        res.set('Cache-Control', 'public, max-age=30');
        res.status(201).send({
            title: r.title,
            subject: r.subject,
            creator: r.creator,
            note: r.note,
            last_edited: r.last_edited,
        });
    } catch (err) {
        console.log(err);
        if (!res.headersSent) res.status(500).send();
    }
});

notesRouter.post('/edit', auth, async (req, res) => {
    try {
        const { title, subject, note, id } = req.body;

        const [[noteRes], [userRes]] = await Promise.all([
            db.execute(`SELECT 1 AS x FROM notes WHERE id = ? LIMIT 1`, [id]),
            db.execute(`SELECT notes FROM accounts WHERE username = ? LIMIT 1`, [req.user.username]),
        ]);

        if (!noteRes[0]) return res.status(400).send('invalid note id');
        if (!userRes[0]) return res.status(400).send('error fetching user');
        if (!ownsId(userRes[0].notes, id)) return res.status(400).send('you cannot edit a note you do not own');

        if (!(title && subject)) {
            return res.status(400).send('title and subject are required');
        }
        if (title.length < 3 || title.length > 50) {
            return res.status(400).send('title must be between 3 and 50 characters');
        }

        await db.execute(
            `UPDATE notes SET title = ?, subject = ?, note = ?, last_edited = CURRENT_TIMESTAMP WHERE id = ?`,
            [title, subject, note, id]
        );

        res.status(201).send();
    } catch (err) {
        console.log(err);
        if (!res.headersSent) res.status(500).send();
    }
});

notesRouter.post('/delete', auth, async (req, res) => {
    try {
        const { id } = req.body;

        const [[noteRes], [userRes]] = await Promise.all([
            db.execute(`SELECT 1 AS x FROM notes WHERE id = ? LIMIT 1`, [id]),
            db.execute(`SELECT notes FROM accounts WHERE username = ? LIMIT 1`, [req.user.username]),
        ]);

        if (!noteRes[0]) return res.status(400).send('invalid note id');
        if (!userRes[0]) return res.status(400).send('error fetching user');
        if (!ownsId(userRes[0].notes, id)) return res.status(400).send('you cannot edit a note you do not own');

        const notes = (userRes[0].notes || '').split(',').filter(s => s !== '' && s !== id.toString());

        await Promise.all([
            db.execute(`DELETE FROM notes WHERE id = ?`, [id]),
            db.execute(`UPDATE accounts SET notes = ? WHERE username = ?`, [notes.join(',') + (notes.length ? ',' : ''), req.user.username]),
        ]);

        res.status(201).send();
    } catch (err) {
        console.log(err);
        if (!res.headersSent) res.status(500).send();
    }
});

notesRouter.post('/search', async (req, res) => {
    try {
        const { order, query } = req.body;

        if (query == '') {
            return res.status(400).send('query is required');
        }

        const page = Math.max(1, parseInt(order, 10) || 1);
        const offset = (page - 1) * notesPerPage;

        const [noteRes] = await db.execute(
            `SELECT id, creator, title, subject FROM notes WHERE title LIKE ? LIMIT ? OFFSET ?`,
            [`%${query}%`, notesPerPage, offset]
        );

        if (noteRes.length === 0) {
            return res.status(201).send('all notes are displayed');
        }

        res.status(201).send(noteRes.map(r => ({ id: r.id, creator: r.creator, title: r.title, subject: r.subject })));
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

module.exports = notesRouter;
