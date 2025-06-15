const express = require('express');
const path = require('path');

const db = require('../utils/db');

const adminRouter = new express.Router();

const auth = (req, res, next) =>
{
    const reject = () =>
    {
        res.setHeader('www-authenticate', 'Basic');
        res.sendStatus(401);
    };

    const authorization = req.headers.authorization;

    // if no auth information is provided, reject
    if (!authorization)
    {
        return reject();
    }
    
    // parse user and password from auth data
    const [username, password] = Buffer.from(authorization.replace('Basic ', ''), 'base64').toString().split(':');

    // determine if user is signing in as an admin or owner and validate password
    if (username === 'admin' && password === process.env.ADMIN_PASSWORD)
    {
        req.permissions = username;
        return next();
    }

    // if username/password is incorrect, reject login
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

adminRouter.get('/total/accounts', auth, async (req, res) =>
{
    let [accountsRes] = await db.execute('select COUNT(username) from accounts');

    res.status(200).json({ count: accountsRes[0]['COUNT(username)'] });
});
adminRouter.get('/total/sets', auth, async (req, res) =>
{
    let [setsRes] = await db.execute('select COUNT(id) from sets');

    res.status(200).json({ count: setsRes[0]['COUNT(id)'] });
});
adminRouter.get('/total/notes', auth, async (req, res) =>
{
    let [notesRes] = await db.execute('select COUNT(id) from notes');

    res.status(200).json({ count: notesRes[0]['COUNT(id)'] });
});

module.exports = adminRouter;