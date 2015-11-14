const validator = require('../validator.js');
const proxyaddr = require('proxy-addr');
const User = require('../models/User.js');
const { getRoute, getTimeout, getAudience, get: getConfig } = require('../config.js');

const ROUTE_NAME = 'login';

exports.post = {
  path: '/login',
  handlers: {
    '1.0.0': function login(req, res, next) {
      const config = getConfig();

      req.log.debug('attempting to login');

      return validator.validate(ROUTE_NAME, req.body)
        .then(function requestAuth(body) {
          const message = {
            username: body.data.id,
            audience: getAudience(),
            password: body.data.attributes.password,
            remoteip: proxyaddr(req, config.trustProxy),
          };

          return req.amqp.publishAndWait(getRoute(ROUTE_NAME), message, { timeout: getTimeout(ROUTE_NAME) });
        })
        .then(reply => {
          res.meta = { jwt: reply.jwt };
          res.links = {
            self: config.host + req.path(),
          };

          res.send(User.transform(reply.user, true));
        })
        .asCallback(next);
    },
  },
};
