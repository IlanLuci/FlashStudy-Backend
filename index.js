const cookieParser = require('cookie-parser');
const express = require('express');
const cors = require('cors');
const compression = require('compression');

require('dotenv').config();

const authRouter = require('./routes/v1/auth_router');
const setsRouter = require('./routes/v1/sets_router');
const notesRouter = require('./routes/v1/notes_router');
const adminRouter = require('./routes/admin_router');
const { runMigrations } = require('./utils/migrate');

const app = express();
const port = 5001;

app.use(compression());
app.use(express.json({ limit: '512kb' }));
app.use(cookieParser());
app.use(cors({
    origin: process.env.ALLOWED_DOMAINS.split(' '),
    credentials: true,
    maxAge: 86400,
}));

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.use('/v1/auth', authRouter);
app.use('/v1/sets', setsRouter);
app.use('/v1/notes', notesRouter);
app.use('/admin', adminRouter);

(async () => {
    try {
        await runMigrations();
    } catch (err) {
        console.error('[migrate] uncaught:', err);
    }
    app.listen(port, () => {
        console.log(`App listening on port ${port}`);
    });
})();
