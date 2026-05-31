const { verifyAccessToken } = require('../utils/tokens');

const auth = (req, res, next) => {
    const token = req.cookies['jwt'];

    if (!token) {
        return res.status(401).send('A token is required for authentication');
    }
    try {
        req.user = verifyAccessToken(token);
    } catch (err) {
        return res.status(401).send('Invalid Token');
    }
    return next();
};

const noauth = (req, res, next) => {
    const token = req.cookies['jwt'];

    if (!token) return next();

    try {
        req.user = verifyAccessToken(token);
    } catch (err) {
        return next();
    }

    return res.status(403).send('You cannot access this while logged into your account');
};

module.exports = { auth, noauth };
