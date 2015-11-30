const config = require('../config.js');
const { getRoute, getTimeout, getAudience } = config;
const ROUTE_NAME = 'logout';

exports.post = {
  path: '/logout',
  middleware: [ 'auth' ],
  handlers: {
    '1.0.0': function logout(req, res, next) {
      const message = {
        jwt: req.user.jwt,
        audience: getAudience(),
      };

      return req.amqp
        .publishAndWait(getRoute(ROUTE_NAME), message, { timeout: getTimeout(ROUTE_NAME) })
        .then(function sendResponse() {
          res.send(204);
        })
        .asCallback(next);
    },
  },
};
