/**
 * @api {get} /me Returns currently authorized user
 * @apiVersion 1.0.0
 * @apiName Me
 * @apiGroup Users
 * @apiPermission user
 *
 * @apiDescription Returns user object associated with a current authorization token
 *
 * @apiHeader (Authorization) {String} Authorization JWT :accessToken
 * @apiHeaderExample Authorization-Example:
 * 		"Authorization: JWT myreallyniceandvalidjsonwebtoken"
 *
 * @apiExample {curl} Example usage:
 *     curl -i -H 'Accept-Version: *' -H 'Accept: application/vnd.api+json' \
 *       -H 'Accept-Encoding: gzip, deflate' \
 *       -H 'Content-Type: applicaion/vnd.api+json' \
 *       -H 'Authroziation: JWT myrealjwttoken' \
 *       "https://api-users.sandbox.matic.ninja/api/users/me" \
 *
 * @apiUse ValidationError
 * @apiUse UnauthorizedError
 * @apiUse ForbiddenResponse
 *
 * @apiUse UserAuthResponse
 */
exports.get = {
  path: '/me',
  middleware: [ 'auth' ],
  handlers: {
    '1.0.0': function me(req, res, next) {
      res.send(req.user.serialize(true));
      next();
    },
  },
};
