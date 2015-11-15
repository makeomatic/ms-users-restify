const Errors = require('common-errors');
const proxyaddr = require('proxy-addr');
const User = require('../models/User.js');
const { getRoute, getTimeout, getAudience, get: getConfig } = require('../config.js');

// cached vars
const isArray = Array.isArray;
const ROUTE_NAME = 'verify';

module.exports = function registerUser(req, res, next) {
  const { amqp, headers, query } = req;
  const { authorization } = headers;
  const config = getConfig();
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
    .then(reply => {
      req.user = User.deserialize(reply);
      req.log = req.log.child({ user: req.user.id });
    })
    .asCallback(next);
};
