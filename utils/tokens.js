const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_DAYS = 30;
const ACCESS_TOKEN_ALGO = 'HS256';

function signAccessToken(payload) {
    return jwt.sign(payload, process.env.TOKEN_KEY, {
        algorithm: ACCESS_TOKEN_ALGO,
        expiresIn: ACCESS_TOKEN_TTL,
    });
}

function verifyAccessToken(token) {
    return jwt.verify(token, process.env.TOKEN_KEY, { algorithms: [ACCESS_TOKEN_ALGO] });
}

function newRefreshToken() {
    return crypto.randomBytes(48).toString('base64url');
}

function hashRefreshToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function refreshExpiryDate() {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + REFRESH_TOKEN_TTL_DAYS);
    return d;
}

const ACCESS_COOKIE_OPTS = {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
};

const REFRESH_COOKIE_OPTS = {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/v1/auth/refresh',
    maxAge: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
};

const CLEAR_REFRESH_COOKIE_OPTS = {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/v1/auth/refresh',
};

module.exports = {
    ACCESS_TOKEN_TTL,
    REFRESH_TOKEN_TTL_DAYS,
    signAccessToken,
    verifyAccessToken,
    newRefreshToken,
    hashRefreshToken,
    refreshExpiryDate,
    ACCESS_COOKIE_OPTS,
    REFRESH_COOKIE_OPTS,
    CLEAR_REFRESH_COOKIE_OPTS,
};
