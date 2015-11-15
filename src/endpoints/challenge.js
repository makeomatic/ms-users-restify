const validator = require('../validator.js');
const { getRoute, getTimeout } = require('../config.js');

const ROUTE_NAME = 'challenge';

exports.post = {
  path: '/challenge',
  handlers: {
    '1.0.0': function requestChallenge(req, res, next) {
      const { log, amqp } = req;

      log.debug('requesting to get a challenge');

      return validator
        .filter('challenge', req.body)
        .then(function attemptToRegister(body) {
          const message = {
            type: 'email',
            username: body.data.id,
          };

          return amqp.publishAndWait(getRoute(ROUTE_NAME), message, { timeout: getTimeout(ROUTE_NAME) })
            .then(() => {
              res.send(202);
            });
        })
        .asCallback(next);
    },
  },
};
