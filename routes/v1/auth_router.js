const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const db = require('../../utils/db');

const authRouter = new express.Router();

const { auth, noauth } = require('../../middleware/auth');

authRouter.get('/check', auth, async (req, res) => {
    let [user] = await db.execute(`SELECT * FROM accounts WHERE username = ?`, [req.user.username]);
  
    if (!user[0]) {
      res.status(400).send();
  
      return console.log('invalid username in token');
    }
  
    res.status(200).send({ username: req.user.username, sets: user[0].sets.split(','), notes: user[0].notes.split(',') });
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
        if (!email.match(/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/)) {
            return res.status(400).send('Invalid email address');
        }
        
        //check if username and/or email are in use
        let [usernameTaken] = await db.execute(`SELECT * FROM accounts WHERE username = ?`, [username]);
        let [emailTaken] = await db.execute(`SELECT * FROM accounts WHERE email = ?`, [email]);

        if (usernameTaken.length > 0) {
            return res.status(400).send('Username is already in use');
        }
        if (emailTaken.length > 0) {
            return res.status(400).send('Email is already in use');
        } 

        const token = jwt.sign({ username: username, email: email }, process.env.TOKEN_KEY, { expiresIn: '30d', });

        let encryptedPassword = await bcrypt.hash(password, 10);

        await db.execute(`INSERT INTO accounts (username, email, password, tokens, sets, notes) VALUES (?, ?, ?, ?, ?, ?)`, [username, email.toLowerCase(), encryptedPassword, token, '', '']);

        res.status(201).json({ token: token });
    } catch(err) {
        console.log(err);
    }
});

authRouter.post('/login', noauth, async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!(email && password)) {
            return res.status(400).send('All inputs are required');
        }

        let [result] = await db.execute(`SELECT * FROM accounts WHERE email = ?`, [email.toLowerCase()]);

        if (result[0]) {
            let compared = await bcrypt.compare(password, result[0].password)
            
            if (!compared) {
                return res.status(400).send('Invalid password');
            }

            const token = jwt.sign({ username: result[0].username, email: email }, process.env.TOKEN_KEY, { expiresIn: '30d' });

            await db.execute(`UPDATE accounts SET tokens = ? WHERE email = ?`, [token, email]);

            res.status(201).json({ token: token });
        }
    } catch(err) {
    console.log(err);
    }
});

authRouter.post('/logout', noauth, async (req, res) => {
    try {
        //logout logic
    } catch(err) {
        console.log(err);
    }
});

module.exports = authRouter;