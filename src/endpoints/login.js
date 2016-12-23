const is = require('is');
const validator = require('../validator.js');
const proxyaddr = require('proxy-addr');
const config = require('../config.js');

const { getRoute, getTimeout, getAudience } = config;
const ROUTE_NAME = 'login';

/**
 * @api {post} /login Sign in
 * @apiVersion 1.0.0
 * @apiName Login
 * @apiGroup Users
 * @apiPermission none
 *
 * @apiDescription Authenticates user via it's username and password. Returns JWT token and associated user object on success.
 *
 * @apiParam (Body) {Object}        data                      data container
 * @apiParam (Body) {String="user"} data.type                 data type
 * @apiParam (Body) {String}        data.id                   username
 * @apiParam (Body) {Object}        data.attributes           data attributes container
 * @apiParam (Body) {String}        data.attributes.password  user password
 *
 * @apiExample {curl} Example usage:
 *     curl -i -X POST -H 'Accept-Version: *' -H 'Accept: application/vnd.api+json' \
 *       -H 'Accept-Encoding: gzip, deflate' \
 *       -H 'Content-Type: application/vnd.api+json' \
 *       "https://api-users.sandbox.matic.ninja/api/users/login" \
 *       -d '{
 *         "data": {
 *           "type": "user",
 *           "id": "v@example.com",
 *           "attributes": {
 *             "password": "somerealpassword"
 *           }
 *         }
 *       }'
 *
 * @apiUse ValidationError
 * @apiUse ForbiddenResponse
 * @apiUse UserNotFoundError
 * @apiUse PreconditionFailedError
 * @apiUse LockedError
 * @apiUse TooManyRequestsError
 *
 * @apiUse UserAuthResponse
 */
exports.post = {
  path: '/login',
  handlers: {
    '1.0.0': function login(req, res, next) {
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
          const jwt = reply.jwt;

          if (is.fn(res.setCookie)) {
            res.setCookie('jwt', jwt, config.cookies);
          }

          res.meta = { jwt };
          res.links = {
            self: config.host + req.path(),
          };

          res.send(config.models.User.transform(reply.user, true));
        })
        .asCallback(next);
    },
  },
};
