const Errors = require('common-errors');
const config = require('../config.js');

const ROUTE_NAME = 'remove';
const { getRoute, getTimeout } = config;

/**
 * @api {post} /:username/remove Removes specified user
 * @apiVersion 1.0.0
 * @apiName RemoveUser
 * @apiGroup Users
 * @apiPermission admin
 *
 * @apiDescription Locks or unlocks account of the specified user based on the body payload
 *
 * @apiHeader (Authorization) {String} Authorization JWT :accessToken
 * @apiHeaderExample Authorization-Example:
 *     "Authorization: JWT myreallyniceandvalidjsonwebtoken"
 *
 * @apiParam (Params) {String} username username we are trying to remove
 *
 * @apiExample {curl} Example usage:
 *     curl -i -X POST -H 'Accept-Version: *' -H 'Accept: application/vnd.api+json' \
 *       -H 'Authorization: JWT realjwttoken' \
 *       "https://api-users.sandbox.matic.ninja/api/users/v%40example.com/remove"
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
  path: '/:username/remove',
  middleware: ['auth'],
  handlers: {
    '1.0.0': function requestRemoval(req, res, next) {
      if (!req.user.isAdmin()) {
        return next(new Errors.HttpStatusError(403, 'you are not authorized to perform this action'));
      }

      const { username } = req.params;

      return req.amqp
        .publishAndWait(getRoute(ROUTE_NAME), { username }, { timeout: getTimeout(ROUTE_NAME) })
        .then(() => {
          res.send(204);
          return false;
        })
        .asCallback(next);
    },
  },
};
