const jwt = require('jsonwebtoken');

const config = process.env;

const auth = (req, res, next) => {
  if (!req.body) return res.status(403).send('A token is required for authentication');
  
  const token = req.body.token || req.query.token || req.headers['x-access-token'];

  if (!token) {
    return res.status(403).send('A token is required for authentication');
  }
  try {
    const decoded = jwt.verify(token, config.TOKEN_KEY);
    req.user = decoded;
  } catch (err) {
    return res.status(401).send('Invalid Token');
  }
  return next();
};

const noauth = (req, res, next) => {
  const token = req.body.token || req.query.token || req.headers['x-access-token'];

  if (!token) {
    return next();
  }
  try {
    const decoded = jwt.verify(token, config.TOKEN_KEY);
    req.user = decoded;
  } catch (err) {
    return next();
  }
  
  return res.status(403).send('You cannot access this while logged into your account');
};

module.exports = { auth: auth, noauth: noauth };