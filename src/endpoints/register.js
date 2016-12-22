const ld = require('lodash');
const Errors = require('common-errors');
const countryData = require('countryjs');
const validator = require('../validator.js');
const proxyaddr = require('proxy-addr');
const config = require('../config.js');

const { getRoute, getTimeout, getAudience } = config;

// constants
const ROUTE_NAME = 'register';
const WHITE_LIST = [
  'firstName',
  'lastName',
  'companyName',
  'addressLine1',
  'addressLine2',
  'zipCode',
  'city',
  'state',
  'country',
  'gender',
  'birthday',
  'phone',
  'website',
  'org',
  'shortDescription',
  'longDescription',
];

/**
 * Transform body into ms-users message
 * @param  {Request} req
 * @param  {Object}  body
 * @return {Object}
 */
function transformBody(req, input) {
  req.log.debug('attempting transformation', input);

  const body = input.data;
  const { attributes } = body;
  const { password } = attributes;
  const { autoGeneratePassword } = config;

  if (autoGeneratePassword === true && password) {
    throw new Errors.ValidationError('password is auto-generated, do not pass it', 400);
  }

  if (autoGeneratePassword === false && !password) {
    throw new Errors.ValidationError('password must be provided', 400);
  }

  const { country } = body;
  if (country && !countryData.info(country, 'ISO3')) {
    const err = `country name must be specified as ISO3.
    Please refer to https://github.com/therebelrobot/countryjs#info for a complete list of codes`;
    throw new Errors.ValidationError(err, 400, 'data.country');
  }

  const message = {
    username: body.id,
    metadata: ld.pick(attributes, WHITE_LIST),
    activate: config.usersRequireActivate !== true || !password,
    audience: getAudience(),
    ipaddress: proxyaddr(req, config.trustProxy),
  };

  if (password) {
    message.password = password;
  }

  if (attributes.alias) {
    message.alias = attributes.alias.toLowerCase();
  }

  // BC, remap additionalInformation to longDescription if it is not provided
  if (attributes.additionalInformation && !message.metadata.longDescription) {
    message.metadata.longDescription = attributes.additionalInformation;
  }

  return message;
}

/**
 * @api {post} / Registers new user
 * @apiVersion 1.0.0
 * @apiName Register
 * @apiGroup Users
 * @apiPermission none
 *
 * @apiDescription Registers user in the system and send email validation request, so that the user can activate the account
 *
 * @apiParam (Body) {Object}                         data                           data container
 * @apiParam (Body) {String="user"}                  data.type                      data type
 * @apiParam (Body) {String{6..50}}                  data.id                        new username, always an email
 * @apiParam (Body) {Object}                         data.attributes                attributes container
 * @apiParam (Body) {String{6..50}}                  data.attributes.password       user's password
 * @apiParam (Body) {String{6..50}}                  data.attributes.passwordRepeat make sure that user typed in the same password
 * @apiParam (Body) {String{1..150}}                 data.attributes.firstName      user's given name
 * @apiParam (Body) {String{1..150}}                 data.attributes.lastName       user's surname
 * @apiParam (Body) {String{3..15}}                  data.attributes.alias        user's alias
 * @apiParam (Body) {String="female","male","other"} [data.attributes.gender]       user's gender
 * @apiParam (Body) {String="YYYY.MM.DD"}            [data.attributes.birthday]     birthday in the format of YYYY.MM.DD
 * @apiParam (Body) {String{6..20}}                  [data.attributes.phone]        user's phone, no validation
 * @apiParam (Body) {String{1..150}}                 [data.attributes.companyName] user's company name
 * @apiParam (Body) {String{1..155}}                 [data.attributes.shortDescription]    company's short description
 * @apiParam (Body) {String{1..250}}                 [data.attributes.longDescription]     company's long description
 * @apiParam (Body) {String}                         [data.attributes.website]     user's website
 * @apiParam (Body) {String{1..50}}                  [data.attributes.addressLine1]        user's address line #1
 * @apiParam (Body) {String{1..50}}                  [data.attributes.addressLine2]        user's address line #2
 * @apiParam (Body) {String{1..50}}                  [data.attributes.city]        user's city
 * @apiParam (Body) {String{1..15}}                  [data.attributes.zipCode]     user's zipCode
 * @apiParam (Body) {String{2}}                      [data.attributes.state]       user's state 2-letter code, ex: "AL"
 * @apiParam (Body) {String{3}}                      [data.attributes.country]     user's country in ISO3 format, ex: "USA"
 *
 * @apiExample {curl} Example usage:
 *     curl -i -X POST -H 'Accept-Version: *' -H 'Accept: application/vnd.api+json' \
 *       -H 'Accept-Encoding: gzip, deflate' \
 *       -H 'Content-Type: application/vnd.api+json' \
 *       "https://api-sandbox.cappasity.matic.ninja/api/users" \
 *       -d '{
 *         "data": {
 *           "type": "user",
 *           "id": "v@example.com",
 *           "attributes": {
 *             "password": "somerealpassword",
 *             "passwordRepeat": "somerealpassword",
 *             "firstName": "Vitaly",
 *             "lastName": "Nordstrom",
 *             "companyName": "LasVatos, LLC",
 *             "country": "USA",
 *             "city": "Las Vegas",
 *             "gender": "male",
 *             "birthday": "1934.09.25",
 *             "phone": "(440)0000000",
 *             "alias": "bond007"
 *           }
 *         }
 *       }'
 *
 * @apiUse ValidationError
 * @apiUse PreconditionFailedError
 * @apiUse ForbiddenResponse
 * @apiUse TooManyRequestsError
 *
 * @apiSuccessExample {json} Success-Response:
 * 		HTTP/1.1 202 Accepted
 */
exports.post = {
  path: '/',
  handlers: {
    '1.0.0': function registerUser(req, res, next) {
      return validator
        .filter('register', req.body)
        .then(function filteredBody(body) {
          return transformBody(req, body);
        })
        .then(function attemptToRegister(message) {
          return req.amqp.publishAndWait(getRoute(ROUTE_NAME), message, { timeout: getTimeout(ROUTE_NAME) })
            .then(reply => {
              if (reply.requiresActivation) {
                res.send(202);
                return false;
              }

              res.meta = { jwt: reply.jwt };
              res.links = {
                self: config.host + req.path(),
              };

              res.send(201, config.models.User.transform(reply.user, true));
              return false;
            });
        })
        .asCallback(next);
    },
  },
};
