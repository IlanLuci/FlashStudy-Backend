const express = require('express');

const db = require('../../utils/db');

const setsRouter = new express.Router();

const { auth } = require('../../middleware/auth');

const setsPerPage = 8;


setsRouter.post('/create', auth, async (req, res) => {
    try {
        //expect a string, string, string, string, array of string, array of string
        const { name, description, q, a, questions, answers } = req.body;

        // join array elements into a comma seperated string for db storage
        let questionsStr = questions.join(',');
        let answersStr = answers.join(',');

        // check that both name are provided
        if (!(name)) {
            return res.status(400).send('name is required');
        }

        // create unique id for set
        let id = await createId();

        // save set data and add set to creator's account
        await db.execute(`INSERT INTO sets (id, creator, name, description, case_sensitive, q_name, q_items, a_name, a_items) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, req.user.username, name, description || '', true, q || 'question', questionsStr, a || 'answer', answersStr]);
        await db.execute(`UPDATE accounts SET sets = concat(sets , ?) WHERE username = ?`, [id + ',', req.user.username]);
        
        res.status(201).send(id.toString());
    } catch(err) {
        console.log(err);
    }
});

setsRouter.get('/get/:id', async (req, res) => {
    try {
        // get set from given id
        let [result] = await db.execute(`SELECT * FROM sets WHERE id = ?`, [req.params.id]);

        // return error if given set id is invalid
        if (!result[0]) return res.status(400).send('invalid set id');

        // collect all set data and send it back to frontend
        let set = { name: result[0].name, description: result[0].description, creator: result[0].creator, q: result[0].q_name, a: result[0].a_name, questions: result[0].q_items.split(','), answers: result[0].a_items.split(','), completions: result[0].completions, case_sensitive: result[0].case_sensitive };

        res.status(201).send(set);
    } catch(err) {
        console.log(err);
    }
});

setsRouter.post('/edit', auth, async (req, res) => {
    try {
        //expect a string, string, string, string, array of string, array of string
        const { name, description, q, a, questions, answers, id } = req.body;

        // get set id given and user from db
        //change setRes to make more efficient? just needs to check if set exists
        let [setRes] = await db.execute(`SELECT id FROM sets WHERE id = ?`, [id]);
        let [userRes] = await db.execute(`SELECT sets FROM accounts WHERE username = ?`, [req.user.username]);

        // check that set id is valid, user is valid, and user owns the set
        if (!setRes[0]) return res.status(400).send('invalid set id');
        if (!userRes[0]) return res.status(400).send('error fetching user');
        if (!userRes[0].sets.includes(id)) return res.status(400).send('you cannot edit a set you do not own');

        // join array elements into a comma seperated string for db storage
        let questionsStr = questions.join(',');
        let answersStr = answers.join(',');

        // check that both name are provided
        if (!(name)) {
            return res.status(400).send('name is required');
        }

        await db.execute(`UPDATE sets SET name = ?, description = ?, q_name = ?, q_items = ?, a_name = ?, a_items = ? WHERE id = ?`, [name, description || '', q || 'question', questionsStr, a || 'answer', answersStr, id]);
        
        res.status(201).send();
    } catch(err) {
        console.log(err);
    }
});

setsRouter.post('/delete', auth, async (req, res) => {
    try {
        //expect a string, string, string, string, array of string, array of string
        const { id } = req.body;

        // get set id given and user from db
        //change setRes to make more efficient? just needs to check if set exists
        let [setRes] = await db.execute(`SELECT id FROM sets WHERE id = ?`, [id]);
        let [userRes] = await db.execute(`SELECT sets FROM accounts WHERE username = ?`, [req.user.username]);

        // check that set id is valid, user is valid, and user owns the set
        if (!setRes[0]) return res.status(400).send('invalid set id');
        if (!userRes[0]) return res.status(400).send('error fetching user');
        if (!userRes[0].sets.includes(id)) return res.status(400).send('you cannot edit a set you do not own');

        let sets = userRes[0].sets.split(',');
        sets.splice(sets.indexOf(id.toString()), 1);

        await db.execute(`DELETE FROM sets WHERE id = ?`, [id]);
        await db.execute(`UPDATE accounts SET sets = ? WHERE username = ?`, [sets.join(','), req.user.username]);

        res.status(201).send();
    } catch(err) {
        console.log(err);
    }
});

setsRouter.post('/completion', async (req, res) => {
    try {
        //expect a string, string, string, string, array of string, array of string
        const { id } = req.body;

        // get set id given and user from db
        let [setRes] = await db.execute(`SELECT * FROM sets WHERE id = ?`, [id]);

        // check that set id is valid, user is valid, and user owns the set
        if (!setRes[0]) return res.status(400).send('invalid set id');

        if (setRes[0].completions == null) setRes[0].completions = 0;
        setRes[0].completions += 1;

        await db.execute(`UPDATE sets SET completions = ? WHERE id = ?`, [setRes[0].completions, id]);

        res.status(201).send();
    } catch(err) {
        console.log(err);
    }
});

setsRouter.post('/popular', async (req, res) => {
    try {
        // expect an int
        const { order } = req.body;

        // get set id given and user from db
        let [setRes] = await db.execute(`SELECT id, creator, name FROM sets ORDER BY completions DESC LIMIT ?`, [order * setsPerPage]);

        let sets = [];

        for (let x = (order - 1) * (setsPerPage); x < order * setsPerPage; x += 1) {
            if (!setRes[x]) break;

            sets.push({ id: setRes[x].id, creator: setRes[x].creator, name: setRes[x].name });
        }

        res.status(201).send(sets);
    } catch(err) {
        console.log(err);
    }
});

setsRouter.post('/search', async (req, res) => {
    try {
        // expect an int and a string
        const { order, query } = req.body;

        if (query == '') {
            return res.status(400).send('query is required');
        }

        // get set id given and user from db
        let [setRes] = await db.execute(`SELECT id, creator, name FROM sets WHERE name LIKE ? LIMIT ?`, [`%${query}%`, order * setsPerPage]);

        let sets = [];
        
        for (let x = (order - 1) * (setsPerPage); x < order * setsPerPage; x += 1) {
            if (!setRes[x]) break;
            
            sets.push({ id: setRes[x].id, creator: setRes[x].creator, name: setRes[x].name });
        }

        if (sets.length == 0) {
            return res.status(201).send('all sets are displayed');
        }

        res.status(201).send(sets);
    } catch(err) {
        console.log(err);
    }
});

async function createId() {
    //create unique id for set
    let id = Math.floor(Math.random() * 10000000000000000);

    //check to unsure id is unique
    let [result] = await db.execute(`SELECT * FROM sets WHERE id = ?`, [id]);

    // if not unique generate a new id
    if (result[0]) {
        return await createId();
    } else {
        return id;
    }
}

module.exports = setsRouter;