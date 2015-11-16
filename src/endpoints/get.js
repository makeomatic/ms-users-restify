const User = require('../models/User.js');
const Errors = require('common-errors');
const { getRoute, getAudience, getTimeout, get: getConfig } = require('../config.js');
const ROUTE_NAME = 'getMetadata';

/**
 * @api {get} /:id Get user object
 * @apiVersion 1.0.0
 * @apiName GetUser
 * @apiGroup Users
 * @apiPermission admin
 *
 * @apiDescription Returns user object and it's metadata by user'd id
 *
 * @apiHeader (Authorization) {String} Authorization JWT :accessToken
 * @apiHeaderExample Authorization-Example:
 * 		"Authorization: JWT myreallyniceandvalidjsonwebtoken"
 *
 * @apiParam (Params) {String} id username to be returned
 *
 * @apiExample {curl} Example usage:
 *     curl -i -H 'Accept-Version: *' -H 'Accept: application/vnd.api+json' -H 'Accept-Encoding: gzip, deflate' \
 *       -H 'Content-Type: applicaion/vnd.api+json' -H "Authorization: JWT realjwttoken" \
 *       "https://api-users.sandbox.matic.ninja/api/users/v%40example.com"
 *
 * @apiUse UnauthorizedError
 * @apiUse ForbiddenResponse
 * @apiUse UserNotFoundError
 *
 * @apiSuccess (Code 200) {Object} meta              response meta information
 * @apiSuccess (Code 200) {String} meta.id           request id
 * @apiSuccess (Code 200) {Object} data              response data
 * @apiSuccess (Code 200) {String} data.type         response data type - always `user`
 * @apiSuccess (Code 200) {String} data.id           username, always an email
 * @apiSuccess (Code 200) {Object} data.attributes   user attributes
 * @apiSuccess (Code 200) {Object} data.links        user links
 * @apiSuccess (Code 200) {String} data.links.self   link to the user resource
 *
 * @apiSuccessExample {json} Success-User:
 * 		HTTP/1.1 200 OK
 * 		{
 * 			"meta": {
 * 				"id": "request-id",
 * 			},
 * 			"data": {
 * 				"type": "user",
 * 				"id": "user@example.com",
 * 				"attributes": {
 * 					"firstName": "Anna",
 * 					"lastName": "Maria"
 * 				},
 * 				"links": {
 * 					"self": "https://localhost:443/api/users/user%40example.com"
 * 				}
 * 			}
 * 		}
 *
 */
exports.get = {
  path: '/:id',
  middleware: [ 'auth' ],
  handlers: {
    '1.0.0': function me(req, res, next) {
      const config = getConfig();
      if (req.params.id === 'me') {
        return next(`${config.family}.me.get`);
      }

      if (!req.user.isAdmin()) {
        return next(new Errors.HttpStatusError(403, 'you can only get information about yourself via /me endpoint'));
      }

      const message = {
        username: req.params.id,
        audience: getAudience(),
      };

      return req.amqp
        .publishAndWait(getRoute(ROUTE_NAME), message, { timeout: getTimeout(ROUTE_NAME) })
        .then(reply => {
          res.send(User.transform({
            username: message.username,
            metadata: reply,
          }));
        })
        .asCallback(next);
    },
  },
};
