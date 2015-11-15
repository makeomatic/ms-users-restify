const Promise = require('bluebird');
const Errors = require('common-errors');
const validator = require('../validator.js');
const proxyaddr = require('proxy-addr');
const auth = Promise.promisify(require('../middleware/auth.js'));
const { getRoute, getTimeout, get: getConfig } = require('../config.js');

exports.post = {
  path: '/restore',
  handlers: {
    '1.0.0': function requestReset(req, res, next) {
      const { log, amqp } = req;
      const config = getConfig();
      const ROUTE_NAME = 'requestPassword';

      log.debug('requesting to restore a password');

      return validator.filter(ROUTE_NAME, req.body)
        .then(function attemptToRegister(body) {
          const message = {
            type: 'email',
            username: body.data.id,
            remoteip: proxyaddr(req, config.trustProxy),
          };

          return amqp
            .publishAndWait(getRoute(ROUTE_NAME), message, { timeout: getTimeout(ROUTE_NAME) })
            .then(() => {
              res.send(202);
            });
        })
        .asCallback(next);
    },
  },
};

exports.patch = {
  path: '/reset',
  handlers: {
    '1.0.0': function validateReset(req, res, next) {
      const { log, amqp } = req;
      const config = getConfig();
      const ROUTE_NAME = 'updatePassword';

      log.debug('requesting to restore a password');

      return validator.filter('resetPassword', req.body)
        .then(function attemptToRegister(body) {
          const attr = body.data.attributes;
          if (attr.password !== attr.passwordRepeat) {
            throw new Errors.ValidationError('data.attributes.password must match data.attributes.passwordRepeat', 400);
          }

          const message = {
            newPassword: attr.password,
            remoteip: proxyaddr(req, config.trustProxy),
          };

          if (attr.token) {
            message.resetToken = attr.token;
            return message;
          }

          return auth(req, res).then(function userIsAuthenticated() {
            message.currentPassword = attr.currentPassword;
            message.username = req.user.id;
            return message;
          });
        })
        .then(function updateBackend(message) {
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
