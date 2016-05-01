const validator = require('../validator.js');
const proxyaddr = require('proxy-addr');
const config = require('../config.js');
const ROUTE_NAME = 'alias';
const { getRoute, getTimeout } = config;

/**
 * @api {patch} /me/alias Adds alias to a given user
 * @apiVersion 1.0.0
 * @apiName AliasUser
 * @apiGroup Users
 * @apiPermission user
 *
 * @apiDescription Assigns an alias for a current user
 *
 * @apiHeader (Authorization) {String} Authorization JWT :accessToken
 * @apiHeaderExample Authorization-Example:
 * 		"Authorization: JWT myreallyniceandvalidjsonwebtoken"
 *
 * @apiParam (Params) {String} id username we are trying to lock/unlock
 *
 * @apiParam (Body) {Object}        data                      container
 * @apiParam (Body) {String="user"} data.type                 we are modifying this object type, must be 'user'
 * @apiParam (Body) {Object}        data.attributes           container for attributes
 * @apiParam (Body) {String{3..15}} data.attributes.alias     chosen alias, symbols allowed: [a-z.0-9]{3,15}, forced to lowerCase()
 *
 * @apiExample {curl} Example usage:
 *     curl -i -X PATCH -H 'Accept-Version: *' -H 'Accept: application/vnd.api+json' \
 *       -H 'Accept-Encoding: gzip, deflate' -H 'Authorization: JWT realjwttoken' \
 *       -H 'Content-Type: application/vnd.api+json' \
 *       "https://api-users.sandbox.matic.ninja/api/users/me/alias" \
 *       -d '{
 *         "data": {
 *           "type": "user",
 *           "attributes": {
 *             "alias": "bond007"
 *           }
 *         }
 *       }'
 *
 * @apiUse ValidationError
 * @apiUse UnauthorizedError
 * @apiUse ForbiddenResponse
 * @apiUse UserNotFoundError
 * @apiUse ConflictError
 * @apiUse PreconditionFailedError
 * @apiUse ExpectationFailedError
 * @apiUse LockedError
 *
 * @apiSuccessExample {json} Success-Response:
 *     HTTP/1.1 204 No Content
 */
exports.patch = {
  path: '/me/alias',
  middleware: ['auth'],
  handlers: {
    '1.0.0': function requestBan(req, res, next) {
      return validator
        .filter(ROUTE_NAME, req.body)
        .then(function attemptToRegister(body) {
          const { data } = body;
          const { attributes } = data;
          const message = {
            username: req.user.id,
            alias: attributes.alias.toLowerCase(),
            remoteip: proxyaddr(req, config.trustProxy),
          };

          return req.amqp
            .publishAndWait(getRoute(ROUTE_NAME), message, { timeout: getTimeout(ROUTE_NAME) })
            .then(() => {
              res.send(204);
            });
        })
        .asCallback(next);
    },
  },
};
