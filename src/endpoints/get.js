const Promise = require('bluebird');
const User = require('../models/User.js');
const Errors = require('common-errors');
const { getRoute, getAudience, getTimeout, get: getConfig } = require('../config.js');

const ROUTE_NAME = 'getMetadata';

exports.get = {
  path: '/:id',
  middleware: [ 'auth' ],
  handlers: {
    '1.0.0': function me(req, res, next) {
      const config = getConfig();
      if (req.params.id === 'me') {
        return next(`${config.family}.me.get`);
      }

      return Promise.try(function verifyRights() {
        if (!req.user.isAdmin()) {
          throw new Errors.HttpStatusError(403, 'you can only get information about yourself');
        }

        const message = {
          username: req.params.id,
          audience: getAudience(),
        };

        return req.amqp
          .publishAndWait(getRoute(ROUTE_NAME), message, { timeout: getTimeout(ROUTE_NAME) })
          .then(reply => {
            const user = new User(message.username, reply);
            res.send(user.serialize(true));
          });
      })
      .asCallback(next);
    },
  },
};
