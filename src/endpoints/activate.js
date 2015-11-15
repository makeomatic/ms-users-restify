const Errors = require('common-errors');
const User = require('../models/User.js');
const { getRoute, getTimeout, getAudience, get: getConfig } = require('../config.js');

const ROUTE_NAME = 'activate';

exports.post = {
  path: '/activate',
  handlers: {
    '1.0.0': function requestActivate(req, res, next) {
      const config = getConfig();
      const token = req.query[config.queryTokenField];

      if (!token) {
        return next(new Errors.ValidationError('validation token must be present in query.token', 400, 'query.token'));
      }

      req.log.debug('attempting to activate user with token %s', token);

      const message = {
        token,
        audience: getAudience(),
        namespace: 'activate',
      };

      return req.amqp.publishAndWait(getRoute(ROUTE_NAME), message, { timeout: getTimeout(ROUTE_NAME) })
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
