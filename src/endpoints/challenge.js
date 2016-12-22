const validator = require('../validator.js');
const { getRoute, getTimeout } = require('../config.js');

const ROUTE_NAME = 'challenge';

/**
 * @api {post} /challenge Request validation challenge
 * @apiVersion 1.0.0
 * @apiName RequestValidation
 * @apiGroup Users
 * @apiPermission none
 *
 * @apiDescription Asks server to send an email, containing validation token again
 *
 * @apiParam (Body) {Object}        data       data container
 * @apiParam (Body) {String="user"} data.type  data type
 * @apiParam (Body) {String}        data.id    username id
 *
 * @apiExample {curl} Example usage:
 *     curl -i -X POST -H 'Accept-Version: *' -H 'Accept: application/vnd.api+json' -H 'Accept-Encoding: gzip, deflate' \
 *     -H 'Content-Type: application/vnd.api+json' "https://api-users.sandbox.matic.ninja/api/users/challenge" \
 *     -d '{
 *       "data": {
 *         "type": "user",
 *         "id": "v@example.com"
 *       }
 *     }'
 *
 * @apiUse ValidationError
 * @apiUse UserNotFoundError
 * @apiUse PreconditionFailedError
 * @apiUse TooManyRequestsError
 *
 * @apiSuccessExample {json} Success-Response:
 *     HTTP/1.1 202 Accepted
 */
exports.post = {
  path: '/challenge',
  handlers: {
    '1.0.0': function requestChallenge(req, res, next) {
      return validator
        .filter('challenge', req.body)
        .then(function attemptToRegister(body) {
          const message = {
            type: 'email',
            username: body.data.id,
          };

          return req.amqp.publishAndWait(getRoute(ROUTE_NAME), message, { timeout: getTimeout(ROUTE_NAME) })
            .then(() => {
              res.send(202);
            });
        })
        .asCallback(next);
    },
  },
};
