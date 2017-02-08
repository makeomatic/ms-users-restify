const { intersection } = require('lodash');
const { HttpStatusError } = require('common-errors');
const validator = require('../validator.js');
const config = require('../config.js');

const { getAudience, getRoute, getTimeout } = config;
const ROUTE_NAME = 'updateMetadata';

/* eslint-disable */
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
 * @apiParam (Body) {String{1..155}}    data.attributes.shortDescription    company's short description
 * @apiParam (Body) {String{1..250}}    data.attributes.longDescription     company's long description
 * @apiParam (Body) {String}            data.attributes.website     user's website
 * @apiParam (Body) {String{1..50}}     data.attributes.addressLine1        user's address line #1
 * @apiParam (Body) {String{1..50}}     data.attributes.addressLine2        user's address line #2
 * @apiParam (Body) {String{1..50}}     data.attributes.city        user's city
 * @apiParam (Body) {String{1..15}}     data.attributes.zipCode     user's zipCode
 * @apiParam (Body) {String{2}}         data.attributes.state       user's state 2-letter code, ex: "AL"
 * @apiParam (Body) {String{3}}         data.attributes.country     user's country in ISO3 format, ex: "USA"
 * @apiParam (Body) {String}            data.attributes.plan        when plan is changed by these means, it only reflects a
 * new name, nothing else is changed
 * @apiParam (Body) {String="female", "male", "other"}    data.attributes.gender    user's gender
 * @apiParam (Body) {String="YYYY.MM.DD"}                 data.attributes.birthday  user's birthday, eg. 1955.10.23
 * @apiParam (Body) {String{6..20}}                       data.attributes.phone     user's phone number
 * @apiParam (Body) {String[]="companyName", "country", "city", "gender", "birthday", "phone", "website", "addressLine1", "addressLine2", "state", "zipCode", "shortDescription", "longDescription"} data.remove fields that should be removed from metadata
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
/* eslint-enable */

const ORG_REQUIRED_PROPS = [
  'companyName',
  'addressLine1',
  'zipCode',
  'city',
  'country',
  'phone',
  'shortDescription',
  'longDescription',
];

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
          const isOrg = req.user.isOrg();
          const { attributes, remove, incr } = data;

          if (!isAdmin && (inputId !== 'me' || incr || (attributes && attributes.plan))) {
            throw new HttpStatusError(403, 'insufficient right to perform this operation');
          }

          const message = {
            username: id,
            audience: getAudience(),
            metadata: {},
          };

          if (attributes) {
            // BC
            if (attributes.additionalInformation) {
              if (!attributes.longDescription) {
                attributes.longDescription = attributes.additionalInformation;
              }

              delete attributes.additionalInformation;
            }

            message.metadata.$set = attributes;
          }

          if (remove) {
            if (isOrg) {
              const requiredPropsIn = intersection(remove, ORG_REQUIRED_PROPS);
              const hasRequiredProps = !!requiredPropsIn.length;

              if (hasRequiredProps) {
                throw new HttpStatusError(400,
                  `Could not remove required properties for organisation: ${requiredPropsIn.join(requiredPropsIn)}`
                );
              }
            }

            message.metadata.$remove = remove;
          }

          if (incr) {
            message.metadata.$incr = incr;
          }

          return amqp
            .publishAndWait(getRoute(ROUTE_NAME), message, { timeout: getTimeout(ROUTE_NAME) })
            .then((reply) => {
              log.debug('updateMetadata response:', reply);
              res.send(204);
            });
        })
        .asCallback(next);
    },
  },
};
