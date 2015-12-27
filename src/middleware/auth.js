const Errors = require('common-errors');
const proxyaddr = require('proxy-addr');
const config = require('../config.js');
const { getRoute, getTimeout, getAudience } = config;

// cached vars
const isArray = Array.isArray;
const ROUTE_NAME = 'verify';

module.exports = function authenticateUser(req, res, next) {
  const { amqp, headers, query } = req;
  const { authorization } = headers;
  let jwt;

  if (isArray(authorization)) {
    return next(new Errors.HttpStatusError(400, 'Must include only one authorization header'));
  }

  if (authorization && authorization.indexOf('JWT ') === 0) {
    jwt = authorization.slice(4);
  } else if (query.jwt) {
    jwt = query.jwt;
  } else if (query.state) {
    jwt = query.state;
  } else if (req.cookies && req.cookies.jwt) {
    jwt = req.cookies.jwt;
  } else {
    return next(new Errors.HttpStatusError(401, 'authorization required'));
  }

  const message = {
    token: jwt,
    audience: getAudience(),
    remoteip: proxyaddr(req, config.trustProxy),
  };

  return amqp
    .publishAndWait(getRoute(ROUTE_NAME), message, { timeout: getTimeout(ROUTE_NAME) })
    .then(function attachUserObject(reply) {
      const user = req.user = config.models.User.deserialize(reply);
      req.user.jwt = jwt;
      req.log = req.log.child({ user: user.id });
    })
    .asCallback(next);
};
