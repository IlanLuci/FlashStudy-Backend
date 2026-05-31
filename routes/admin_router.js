const express = require('express');
const path = require('path');
const crypto = require('crypto');

const db = require('../utils/db');

const adminRouter = new express.Router();

function timingSafeStringEqual(a, b) {
    const aBuf = Buffer.from(String(a));
    const bBuf = Buffer.from(String(b));
    if (aBuf.length !== bBuf.length) {
        crypto.timingSafeEqual(aBuf, aBuf);
        return false;
    }
    return crypto.timingSafeEqual(aBuf, bBuf);
}

const auth = (req, res, next) =>
{
    const reject = () =>
    {
        res.setHeader('www-authenticate', 'Basic');
        res.sendStatus(401);
    };

    const authorization = req.headers.authorization;

    if (!authorization || !authorization.startsWith('Basic ')) {
        return reject();
    }

    let decoded;
    try {
        decoded = Buffer.from(authorization.slice(6), 'base64').toString();
    } catch {
        return reject();
    }
    const sep = decoded.indexOf(':');
    if (sep < 0) return reject();
    const username = decoded.slice(0, sep);
    const password = decoded.slice(sep + 1);

    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || '';

    if (timingSafeStringEqual(username, adminUser) && adminPass && timingSafeStringEqual(password, adminPass))
    {
        req.permissions = username;
        return next();
    }

    return reject();
};

adminRouter.get('/', auth, (req, res) =>
{
    res.sendFile(path.join(__dirname, `../admin.html`));
});

adminRouter.get('/favicon.png', auth, (req, res) =>
{
    res.sendFile(path.join(__dirname, `../favicon.png`));
});

adminRouter.get('/total', auth, async (req, res) =>
{
    const [rows] = await db.execute(
        `SELECT
            (SELECT COUNT(*) FROM accounts) AS accounts,
            (SELECT COUNT(*) FROM sets)     AS sets,
            (SELECT COUNT(*) FROM notes)    AS notes`
    );

    res.status(200).json({
        accounts: rows[0].accounts,
        sets:     rows[0].sets,
        notes:    rows[0].notes,
    });
});

adminRouter.get('/total/accounts', auth, async (req, res) =>
{
    let [accountsRes] = await db.execute('select COUNT(*) as c from accounts');
    res.status(200).json({ count: accountsRes[0].c });
});
adminRouter.get('/total/sets', auth, async (req, res) =>
{
    let [setsRes] = await db.execute('select COUNT(*) as c from sets');
    res.status(200).json({ count: setsRes[0].c });
});
adminRouter.get('/total/notes', auth, async (req, res) =>
{
    let [notesRes] = await db.execute('select COUNT(*) as c from notes');
    res.status(200).json({ count: notesRes[0].c });
});

module.exports = adminRouter;