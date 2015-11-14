const Errors = require('common-errors');
const validator = require('../validator.js');
const proxyaddr = require('proxy-addr');
const { getRoute, getTimeout, get: getConfig } = require('../config.js');

exports.patch = {
  path: '/ban',
  middleware: [ 'auth' ],
  handlers: {
    '1.0.0': function requestBan(req, res, next) {
      if (!req.isAdmin()) {
        throw new Errors.HttpStatusError(403, 'you are not authorized to perform this action');
      }

      const { log, amqp } = req;
      const config = getConfig();
      const ROUTE_NAME = 'ban';

      log.debug('requesting to (un)ban a user');

      return validator.filter(ROUTE_NAME, req.body)
        .then(function attemptToRegister(body) {
          const message = {
            type: 'email',
            username: body.data.id,
            ban: body.data.attributes.action === 'ban',
            remoteip: proxyaddr(req, config.trustProxy),
            whom: req.user.id,
            reason: body.data.attributes.reason,
          };

          return amqp
            .publishAndWait(getRoute(ROUTE_NAME), message, { timeout: getTimeout(ROUTE_NAME) })
            .then(() => {
              res.send(204);
            });
        })
        .asCallback(next);
    },
  },
};
