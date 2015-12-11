const Errors = require('common-errors');
const config = require('../config.js');
const { getAudience, getRoute, getTimeout } = config;
const ROUTE_NAME = 'activate';

/**
 * @api {post} /activate Activate registered user
 * @apiVersion 1.0.0
 * @apiName ActivateUser
 * @apiGroup Users
 * @apiPermission none
 *
 * @apiDescription Attempts to activate the user, and, if successful, returns authentication token and activated user info
 *
 * @apiParam (Query) {String} token Token from the user's email
 *
 * @apiExample {curl} Example usage:
 *   curl -i -X POST -H 'Accept-Version: *' -H 'Accept: application/vnd.api+json' -H 'Accept-Encoding: gzip, deflate' \
 *     "https://api-users.sandbox.matic.ninja/api/users/activate?token=xxx"
 *
 * @apiUse UserAuthResponse
 * @apiUse ValidationError
 *
 */
exports.post = {
  path: '/activate',
  handlers: {
    '1.0.0': function requestActivate(req, res, next) {
      const token = req.query[config.queryTokenField];
      const { User } = config.models;

      if (!token) {
        return next(new Errors.ValidationError(`validation token must be present in query.${config.queryTokenField}`, 400, `query.${config.queryTokenField}`));
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
