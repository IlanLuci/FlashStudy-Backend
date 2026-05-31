const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const db = require('../../utils/db');

const authRouter = new express.Router();

const { auth, noauth } = require('../../middleware/auth');

const EMAIL_RE = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

function splitIdList(str) {
    if (!str) return [];
    return str.split(',').filter(s => s !== '');
}

authRouter.get('/check', auth, async (req, res) => {
    const [user] = await db.execute(
        `SELECT sets, notes FROM accounts WHERE username = ? LIMIT 1`,
        [req.user.username]
    );

    if (!user[0]) {
        res.status(400).send();
        return console.log('invalid username in token');
    }

    res.status(200).send({
        username: req.user.username,
        sets: splitIdList(user[0].sets),
        notes: splitIdList(user[0].notes),
    });
});

authRouter.get('/profile', auth, async (req, res) => {
    try {
        const [userRows] = await db.execute(
            `SELECT sets, notes FROM accounts WHERE username = ? LIMIT 1`,
            [req.user.username]
        );

        if (!userRows[0]) return res.status(400).send();

        const setIds = splitIdList(userRows[0].sets);
        const noteIds = splitIdList(userRows[0].notes);

        const [setRows, noteRows] = await Promise.all([
            setIds.length ? db.query(`SELECT id, name, q_items, completions FROM sets WHERE id IN (?)`, [setIds]).then(r => r[0]) : Promise.resolve([]),
            noteIds.length ? db.query(`SELECT id, title FROM notes WHERE id IN (?)`, [noteIds]).then(r => r[0]) : Promise.resolve([]),
        ]);

        const setMap = new Map(setRows.map(r => [String(r.id), r]));
        const noteMap = new Map(noteRows.map(r => [String(r.id), r]));

        const sets = setIds.map(id => {
            const r = setMap.get(String(id));
            if (!r) return null;
            return {
                id: String(r.id),
                name: r.name,
                completions: r.completions,
                questions_count: r.q_items ? r.q_items.split(',').length : 0,
            };
        }).filter(Boolean);

        const notes = noteIds.map(id => {
            const r = noteMap.get(String(id));
            if (!r) return null;
            return { id: String(r.id), title: r.title };
        }).filter(Boolean);

        res.status(200).send({ username: req.user.username, sets, notes });
    } catch (err) {
        console.log(err);
        if (!res.headersSent) res.status(500).send();
    }
});

authRouter.post('/register', noauth, async (req, res) => {
    try {
        const { username, email, password, confirm_password } = req.body;

        if (!(email && password && username && confirm_password)) {
            return res.status(400).send('All inputs are required');
        }
        if (password != confirm_password) {
            return res.status(400).send('Passwords do not match');
        }
        if (username.length < 3 || username.length > 12) {
            return res.status(400).send('Username must be between 3 and 12 characters');
        }
        if (password.length < 8 || password.length > 32) {
            return res.status(400).send('Password must be between 8 and 32 characters');
        }
        if (!EMAIL_RE.test(email)) {
            return res.status(400).send('Invalid email address');
        }

        const lowerEmail = email.toLowerCase();

        const [taken] = await db.execute(
            `SELECT username, email FROM accounts WHERE username = ? OR email = ? LIMIT 2`,
            [username, lowerEmail]
        );

        for (const row of taken) {
            if (row.username === username) return res.status(400).send('Username is already in use');
            if (row.email === lowerEmail) return res.status(400).send('Email is already in use');
        }

        const token = jwt.sign({ username, email }, process.env.TOKEN_KEY, { expiresIn: '30d' });
        const encryptedPassword = await bcrypt.hash(password, 10);

        await db.execute(
            `INSERT INTO accounts (username, email, password, tokens, sets, notes) VALUES (?, ?, ?, ?, ?, ?)`,
            [username, lowerEmail, encryptedPassword, token, '', '']
        );

        res.cookie('jwt', token, { httpOnly: true, sameSite: 'lax' });
        res.status(201).send();
    } catch (err) {
        console.log(err);
        if (!res.headersSent) res.status(500).send();
    }
});

authRouter.post('/login', noauth, async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!(email && password)) {
            return res.status(400).send('All inputs are required');
        }

        const lowerEmail = email.toLowerCase();
        const [result] = await db.execute(
            `SELECT username, password FROM accounts WHERE email = ? LIMIT 1`,
            [lowerEmail]
        );

        if (!result[0]) {
            return res.status(400).send('Invalid email or password');
        }

        const compared = await bcrypt.compare(password, result[0].password);
        if (!compared) {
            return res.status(400).send('Invalid password');
        }

        const token = jwt.sign({ username: result[0].username, email: lowerEmail }, process.env.TOKEN_KEY, { expiresIn: '30d' });

        await db.execute(`UPDATE accounts SET tokens = ? WHERE email = ?`, [token, lowerEmail]);

        res.cookie('jwt', token, { httpOnly: true, sameSite: 'lax' });
        res.status(201).send();
    } catch (err) {
        console.log(err);
        if (!res.headersSent) res.status(500).send();
    }
});

authRouter.get('/logout', auth, async (req, res) => {
    try {
        res.clearCookie('jwt');
        res.status(200).send();
    } catch (err) {
        console.log(err);
    }
});

module.exports = authRouter;
