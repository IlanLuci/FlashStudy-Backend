const express = require('express');

const db = require('../../utils/db');

const notesRouter = new express.Router();

const { auth } = require('../../middleware/auth');

const notesPerPage = 8;


notesRouter.post('/create', auth, async (req, res) => {
    try {
        // expect a string, string, and string
        const { title, subject, note } = req.body;

        // check that both title and subject are provided
        if (!(title && subject)) {
            return res.status(400).send('title and subject are required');
        }

        // create unique id for note
        let id = await createId();

        // save note data and add note to creator's account
        await db.execute(`INSERT INTO notes (id, title, subject, creator, note) VALUES (?, ?, ?, ?, ?)`, [id, title, subject, req.user.username, note]);
        await db.execute(`UPDATE accounts SET notes = concat(notes , ?) WHERE username = ?`, [id + ',', req.user.username]);
        
        res.status(201).send(id.toString());
    } catch(err) {
        console.log(err);
    }
});

notesRouter.get('/get/:id', async (req, res) => {
    try {
        // get note from given id
        let [result] = await db.execute(`SELECT * FROM notes WHERE id = ?`, [req.params.id]);

        // return error if given note id is invalid
        if (!result[0]) return res.status(400).send('invalid note id');

        // collect all note data and send it back to frontend
        let note = { title: result[0].title, subject: result[0].subject, creator: result[0].creator, note: result[0].note };

        res.status(201).send(note);
    } catch(err) {
        console.log(err);
    }
});

notesRouter.post('/edit', auth, async (req, res) => {
    try {
        //expect a string, string, string, json object
        const { title, subject, note, id } = req.body;
        
        // get note id given and user from db
        //change noteRes to make more efficient? just needs to check if note exists
        let [noteRes] = await db.execute(`SELECT id FROM notes WHERE id = ?`, [id]);
        let [userRes] = await db.execute(`SELECT notes FROM accounts WHERE username = ?`, [req.user.username]);

        // check that note id is valid, user is valid, and user owns the note
        if (!noteRes[0]) return res.status(400).send('invalid note id');
        if (!userRes[0]) return res.status(400).send('error fetching user');
        if (!userRes[0].notes.includes(id)) return res.status(400).send('you cannot edit a note you do not own');

        // check that both title and subject are provided
        if (!(title && subject)) {
            return res.status(400).send('title and subject are required');
        }

        await db.execute(`UPDATE notes SET title = ?, subject = ?, note = ? WHERE id = ?`, [title, subject, note, id]);
        
        res.status(201).send();
    } catch(err) {
        console.log(err);
    }
});

notesRouter.post('/delete', auth, async (req, res) => {
    try {
        //expect a string, string, string, string, array of string, array of string
        const { id } = req.body;

        // get note id given and user from db
        //change noteRes to make more efficient? just needs to check if note exists
        let [noteRes] = await db.execute(`SELECT id FROM notes WHERE id = ?`, [id]);
        let [userRes] = await db.execute(`SELECT notes FROM accounts WHERE username = ?`, [req.user.username]);

        // check that note id is valid, user is valid, and user owns the note
        if (!noteRes[0]) return res.status(400).send('invalid note id');
        if (!userRes[0]) return res.status(400).send('error fetching user');
        if (!userRes[0].notes.includes(id)) return res.status(400).send('you cannot edit a note you do not own');

        let notes = userRes[0].notes.split(',');
        notes.splice(notes.indexOf(id.toString()), 1);

        await db.execute(`DELETE FROM notes WHERE id = ?`, [id]);
        await db.execute(`UPDATE accounts SET notes = ? WHERE username = ?`, [notes.join(','), req.user.username]);

        res.status(201).send();
    } catch(err) {
        console.log(err);
    }
});

notesRouter.post('/search', async (req, res) => {
    try {
        // expect an int and a string
        const { order, query } = req.body;

        if (query == '') {
            return res.status(400).send('query is required');
        }

        // get note id given and user from db
        let [noteRes] = await db.execute(`SELECT id, creator, title, subject FROM notes WHERE title LIKE ? LIMIT ?`, [`%${query}%`, order * notesPerPage]);

        let notes = [];
        
        for (let x = (order - 1) * (notesPerPage); x < order * notesPerPage; x += 1) {
            if (!noteRes[x]) break;
            
            notes.push({ id: noteRes[x].id, creator: noteRes[x].creator, title: noteRes[x].title, subject: noteRes[x].subject });
        }

        if (notes.length == 0) {
            return res.status(201).send('all notes are displayed');
        }

        res.status(201).send(notes);
    } catch(err) {
        console.log(err);
    }
});

async function createId() {
    //create unique id for note
    let id = Math.floor(Math.random() * 10000000000000000);

    //check to unsure id is unique
    let [result] = await db.execute(`SELECT * FROM notes WHERE id = ?`, [id]);

    // if not unique generate a new id
    if (result[0]) {
        return await createId();
    } else {
        return id;
    }
}

module.exports = notesRouter;