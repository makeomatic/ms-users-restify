const auth = require('./auth.js');

module.exports = function conditionalAuth(req, res, next) {
  auth(req, res, function authenticated() {
    // ignore error and continue
    next();
  });
};
