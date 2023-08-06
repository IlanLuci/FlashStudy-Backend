const bodyParser = require('body-parser');
const express = require('express');
const cors = require('cors');

const authRouter = require('./routes/v1/auth_router');
const setsRouter = require('./routes/v1/sets_router');
const notesRouter = require('./routes/v1/notes_router');

const app = express();
const port = 5001;

require('dotenv').config();

app.use(bodyParser.json());
app.use(cors());

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.use('/v1/auth', authRouter);
app.use('/v1/sets', setsRouter);
app.use('/v1/notes', notesRouter);

app.listen(port, () => {
    console.log(`App listening on port ${port}`);
});