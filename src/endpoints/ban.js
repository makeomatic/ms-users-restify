const Errors = require('common-errors');
const validator = require('../validator.js');
const proxyaddr = require('proxy-addr');
const config = require('../config.js');

const ROUTE_NAME = 'ban';
const { getRoute, getTimeout } = config;

/**
 * @api {patch} /:id/ban Bans or unbans specified user
 * @apiVersion 1.0.0
 * @apiName BanUser
 * @apiGroup Users
 * @apiPermission admin
 *
 * @apiDescription Locks or unlocks account of the specified user based on the body payload
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
 * @apiParam (Body) {Boolean}       data.attributes.ban       when `true` - locks account, when `false` - unlocks it
 * @apiParam (Body) {String{1..}}   [data.attributes.reason]  optional reason for this action
 *
 * @apiExample {curl} Example usage:
 *     curl -i -X PATCH -H 'Accept-Version: *' -H 'Accept: application/vnd.api+json' \
 *       -H 'Accept-Encoding: gzip, deflate' -H 'Authorization: JWT realjwttoken' \
 *       -H 'Content-Type: application/vnd.api+json' \
 *       "https://api-users.sandbox.matic.ninja/api/users/v%40example.com/ban" \
 *       -d '{
 *         "data": {
 *           "type": "user",
 *           "attributes": {
 *             "ban": true,
 *             "reason": "fraudulent activity"
 *           }
 *         }
 *       }'
 *
 * @apiUse ValidationError
 * @apiUse UnauthorizedError
 * @apiUse ForbiddenResponse
 * @apiUse UserNotFoundError
 *
 * @apiSuccessExample {json} Success-Response:
 *     HTTP/1.1 204 No Content
 */
exports.patch = {
  path: '/:id/ban',
  middleware: ['auth'],
  handlers: {
    '1.0.0': function requestBan(req, res, next) {
      if (!req.user.isAdmin()) {
        return next(new Errors.HttpStatusError(403, 'you are not authorized to perform this action'));
      }

      if (req.params.id === req.user.id) {
        return next(new Errors.HttpStatusError(406, 'you can not (un)lock your own account'));
      }

      return validator.filter(ROUTE_NAME, req.body)
        .then(function attemptToRegister(body) {
          const { data } = body;
          const { attributes } = data;
          const message = {
            type: 'email',
            username: req.params.id,
            ban: attributes.ban,
            remoteip: proxyaddr(req, config.trustProxy),
            whom: req.user.id,
          };

          if ('reason' in attributes) {
            message.reason = attributes.reason;
          }

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
