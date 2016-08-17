const Errors = require('common-errors');
const validator = require('../validator.js');

const config = require('../config.js');
const { getAudience, getRoute, getTimeout } = config;
const ROUTE_NAME = 'updateMetadata';

/**
 * @api {patch} /:id Updates user's data
 * @apiVersion 1.0.0
 * @apiName UpdateMetadata
 * @apiGroup Users
 * @apiPermission user|admin
 *
 * @apiDescription Updates user's associated data, if user is an admin - he/she can change this data
 * for any of the existing users. However, ordinary user can
 * only change the data for her/himself. For that case :id param my equal `me`
 *
 * @apiHeader (Authorization) {String} Authorization JWT :accessToken
 * @apiHeaderExample Authorization-Example:
 * 		"Authorization: JWT myreallyniceandvalidjsonwebtoken"
 *
 * @apiParam (Params) {String} id username, for ordinary user must be `me`. Admin can use any applicable username here
 *
 * @apiParam (Body) {Object}            data                        data container
 * @apiParam (Body) {String="user"}     data.type                   data type
 * @apiParam (Body) {Object}            data.attributes             data attributes container
 * @apiParam (Body) {String{1..150}}    data.attributes.firstName   user's first name
 * @apiParam (Body) {String{1..150}}    data.attributes.lastName    user's surname
 * @apiParam (Body) {String{1..150}}    data.attributes.companyName user's company name
 * @apiParam (Body) {String{1..250}}    data.attributes.additionalInformation additional information for user/company
 * @apiParam (Body) {String{3}}         data.attributes.country     user's country in ISO3 format, ex: "USA"
 * @apiParam (Body) {String}            data.attributes.plan        when plan is changed by these means, it only reflects a
 * new name, nothing else is changed
 * @apiParam (Body) {String="female", "male", "other"}    data.attributes.gender    user's gender
 * @apiParam (Body) {String="YYYY.MM.DD"}                 data.attributes.birthday  user's birthday, eg. 1955.10.23
 * @apiParam (Body) {String{6..20}}                       data.attributes.phone     user's phone number
 * @apiParam (Body) {String[]="companyName", "country", "city", "gender", "birthday", "phone"} data.remove fields that should be removed from metadata
 *
 * @apiExample {curl} Example usage (admin):
 *     curl -i -X PATCH -H 'Accept-Version: *' -H 'Accept: application/vnd.api+json' \
 *       -H 'Accept-Encoding: gzip, deflate' \
 *       -H 'Content-Type: application/vnd.api+json' \
 *       -H 'Authroziation: JWT nicerealtoken' \
 *       "https://api-users.sandbox.matic.ninja/api/users/v%40example.com" \
 *       -d '{
 *         "data": {
 *           "type": "user",
 *           "attributes": {
 *             "firstName": "Vitaly",
 *             "lastName": "Nordstrom",
 *             "companyName": "LasVatos, LLC",
 *             "country": "USA",
 *             "city": "Las Vegas",
 *             "gender": "male",
 *             "birthday": "1934.09.25",
 *             "modelPrice": 120.5,
 *             "plan": "special-super-plan"
 *           },
 *           "remove": [ "phone" ],
 *           "incr": {
 *           		"models": 10
 *           }
 *         }
 *       }'
 *
 * @apiExample {curl} Example usage (user):
 *     curl -i -X PATCH -H 'Accept-Version: *' -H 'Accept: application/vnd.api+json' \
 *       -H 'Accept-Encoding: gzip, deflate' \
 *       -H 'Content-Type: application/vnd.api+json' \
 *       -H 'Authroziation: JWT nicerealtoken' \
 *       "https://api-users.sandbox.matic.ninja/api/users/me" \
 *       -d '{
 *         "data": {
 *           "type": "user",
 *           "attributes": {
 *             "companyName": "Greenvich",
 *             "country": "RUS"
 *           },
 *           "remove": [ "phone", "birthday" ]
 *         }
 *       }'
 *
 * @apiUse UnauthorizedError
 * @apiUse ForbiddenResponse
 * @apiUse ValidationError
 * @apiUse UserNotFoundError
 * @apiUse PreconditionFailedError
 * @apiUse LockedError
 *
 * @apiSuccessExample {json} Success-Response:
 *     HTTP/1.1 204 No Content
 *
 */
exports.patch = {
  path: '/:id',
  middleware: ['auth'],
  handlers: {
    '1.0.0': function updateUser(req, res, next) {
      const { amqp, log } = req;

      return validator.validate('update', req.body)
        .then(function validatedBody(body) {
          const { data } = body;
          const inputId = req.params.id;
          const id = inputId === 'me' ? req.user.id : inputId;
          const isAdmin = req.user.isAdmin();
          const { attributes, remove, incr } = data;

          if (!isAdmin && (inputId !== 'me' || incr || (attributes && attributes.plan))) {
            throw new Errors.HttpStatusError(403, 'insufficient right to perform this operation');
          }

          const message = {
            username: id,
            audience: getAudience(),
            metadata: {},
          };

          if (attributes) {
            message.metadata.$set = attributes;
          }

          if (remove) {
            message.metadata.$remove = remove;
          }

          if (incr) {
            message.metadata.$incr = incr;
          }

          return amqp
            .publishAndWait(getRoute(ROUTE_NAME), message, { timeout: getTimeout(ROUTE_NAME) })
            .then(reply => {
              log.debug('updateMetadata response:', reply);
              res.send(204);
            });
        })
        .asCallback(next);
    },
  },
};
