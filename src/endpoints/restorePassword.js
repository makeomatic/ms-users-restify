const Promise = require('bluebird');
const Errors = require('common-errors');
const validator = require('../validator.js');
const proxyaddr = require('proxy-addr');
const auth = Promise.promisify(require('../middleware/auth.js'));
const { getRoute, getTimeout, get: getConfig } = require('../config.js');

/**
 * @api {post} /reset Request to reset password
 * @apiVersion 1.0.0
 * @apiName RequestToResetPassword
 * @apiGroup Users
 * @apiPermission none
 *
 * @apiDescription Requests an email to reset user's password
 *
 * @apiParam (Body) {Object}        data      data container
 * @apiParam (Body) {String="user"} data.type data type
 * @apiParam (Body) {String}        data.id   username
 *
 * @apiExample {curl} Example usage:
 *     curl -i -X POST -H 'Accept-Version: *' -H 'Accept: application/vnd.api+json' \
 *       -H 'Accept-Encoding: gzip, deflate' \
 *       -H 'Content-Type: applicaion/vnd.api+json' \
 *       "https://api-users.sandbox.matic.ninja/api/users/reset" \
 *       -d '{
 *         "data": {
 *           "type": "user",
 *           "id": "v@example.com"
 *         }
 *       }'
 *
 * @apiUse UserNotFoundError
 * @apiUse PreconditionFailedError
 * @apiUse LockedError
 *
 * @apiSuccessExample {json} Success-Response:
 * 		HTTP/1.1 202 Accepted
 */
exports.post = {
  path: '/reset',
  handlers: {
    '1.0.0': function requestReset(req, res, next) {
      const { log, amqp } = req;
      const config = getConfig();
      const ROUTE_NAME = 'requestPassword';

      log.debug('requesting to reset a password');

      return validator.filter(ROUTE_NAME, req.body)
        .then(function attemptToRegister(body) {
          const message = {
            type: 'email',
            username: body.data.id,
            remoteip: proxyaddr(req, config.trustProxy),
          };

          return amqp
            .publishAndWait(getRoute(ROUTE_NAME), message, { timeout: getTimeout(ROUTE_NAME) })
            .then(() => {
              res.send(202);
            });
        })
        .asCallback(next);
    },
  },
};

/**
 * @api {patch} /reset Change password
 * @apiVersion 1.0.0
 * @apiName ResetPassword
 * @apiGroup Users
 * @apiPermission none|user
 *
 * @apiDescription allows user to change password based on the token, received in the email, or based on the currentPassword and valid JWT token
 *
 * @apiParam (Body - when unauthorized) {Object}        data                           data container
 * @apiParam (Body - when unauthorized) {String="user"} data.type                      data type
 * @apiParam (Body - when unauthorized) {Object}        data.attributes                data attributes
 * @apiParam (Body - when unauthorized) {String}        data.attributes.token          reset token from the email
 * @apiParam (Body - when unauthorized) {String{6..50}} data.attributes.password       new password
 * @apiParam (Body - when unauthorized) {String{6..50}} data.attributes.passwordRepeat new password confirmation
 *
 * @apiExample {curl} Example usage unauthorized:
 *     curl -i -X PATCH -H 'Accept-Version: *' -H 'Accept: application/vnd.api+json' \
 *       -H 'Accept-Encoding: gzip, deflate' \
 *       -H 'Content-Type: applicaion/vnd.api+json' \
 *       "https://api-users.sandbox.matic.ninja/api/users/reset" \
 *       -d '{
 *         "data": {
 *           "type": "user",
 *           "attributes": {
 *             "password": "somerealpassword",
 *             "passwordRepeat": "somerealpassword",
 *             "token": "realresettoken"
 *           }
 *         }
 *       }'
 *
 * @apiHeader (Authorization) {String} [Authorization] JWT :accessToken
 * @apiHeaderExample Authorization-Example:
 * 		"Authorization: JWT myreallyniceandvalidjsonwebtoken"
 *
 * @apiParam (Body - authorized) {Object}        data                            data container
 * @apiParam (Body - authorized) {String="user"} data.type                       data type
 * @apiParam (Body - authorized) {Object}        data.attributes                 data attributes
 * @apiParam (Body - authorized) {String{6..50}} data.attributes.currentPassword currently used password
 * @apiParam (Body - authorized) {String{6..50}} data.attributes.password        new password
 * @apiParam (Body - authorized) {String{6..50}} data.attributes.passwordRepeat  new password confirmation
 *
 * @apiExample {curl} Example usage authorized:
 *     curl -i -X PATCH -H 'Accept-Version: *' -H 'Accept: application/vnd.api+json' \
 *       -H 'Accept-Encoding: gzip, deflate' \
 *       -H 'Content-Type: applicaion/vnd.api+json' \
 *       -H 'Authroziation: JWT myrealusertoken' \
 *       "https://api-users.sandbox.matic.ninja/api/users/reset" \
 *       -d '{
 *         "data": {
 *           "type": "user",
 *           "attributes": {
 *             "password": "somerealpassword",
 *             "passwordRepeat": "somerealpassword",
 *             "currentPassword": "realcurrentpassword"
 *           }
 *         }
 *       }'
 *
 * @apiUse UnauthorizedError
 * @apiUse ForbiddenResponse
 * @apiUse UserNotFoundError
 * @apiUse ValidationError
 * @apiUse PreconditionFailedError
 *
 * @apiSuccessExample {json} Success-Response:
 *     HTTP/1.1 204 No Content
 */
exports.patch = {
  path: '/reset',
  handlers: {
    '1.0.0': function validateReset(req, res, next) {
      const config = getConfig();
      const ROUTE_NAME = 'updatePassword';

      req.log.debug('requesting to restore a password');

      return validator.filter('resetPassword', req.body)
        .then(function attemptToRegister(body) {
          const attr = body.data.attributes;
          if (attr.password !== attr.passwordRepeat) {
            throw new Errors.ValidationError('data.attributes.password must match data.attributes.passwordRepeat', 400);
          }

          const message = {
            newPassword: attr.password,
            remoteip: proxyaddr(req, config.trustProxy),
          };

          if (attr.token) {
            message.resetToken = attr.token;
            return message;
          }

          return auth(req, res).then(function userIsAuthenticated() {
            message.currentPassword = attr.currentPassword;
            message.username = req.user.id;
            return message;
          });
        })
        .then(function updateBackend(message) {
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
