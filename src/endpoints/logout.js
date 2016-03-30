const config = require('../config.js');
const { getRoute, getTimeout, getAudience } = config;
const ROUTE_NAME = 'logout';
const is = require('is');

/**
 * @api {post} /logout Invalidates JWT token
 * @apiVersion 1.0.0
 * @apiName Logout
 * @apiGroup Users
 * @apiPermission users
 *
 * @apiDescription Invalidates JWT token of an authenticated user, effectively logging the user out
 *
 * @apiHeader (Authorization) {String} Authorization JWT :accessToken
 * @apiHeaderExample Authorization-Example:
 * 		"Authorization: JWT myreallyniceandvalidjsonwebtoken"
 *
 * @apiExample {curl} Example usage:
 *     curl -i -X POST -H 'Accept-Version: *' -H 'Accept: application/vnd.api+json' \
 *       "https://api-users.sandbox.matic.ninja/api/users/logout"
 *
 * @apiSuccessExample {json} Success:
 * 		HTTP/1.1 204 No Content
 */
exports.post = {
  path: '/logout',
  middleware: ['auth'],
  handlers: {
    '1.0.0': function logout(req, res, next) {
      const message = {
        jwt: req.user.jwt,
        audience: getAudience(),
      };

      return req.amqp
        .publishAndWait(getRoute(ROUTE_NAME), message, { timeout: getTimeout(ROUTE_NAME) })
        .then(function sendResponse() {
          if (is.fn(res.setCookie)) {
            res.setCookie('jwt', '', { ...config.cookies, maxAge: 0, expires: new Date(1) });
          }

          res.send(204);
        })
        .asCallback(next);
    },
  },
};
