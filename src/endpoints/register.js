const ld = require('lodash');
const User = require('../models/User.js');
const Errors = require('common-errors');
const countryData = require('countryjs');
const validator = require('../validator.js');
const proxyaddr = require('proxy-addr');
const { getRoute, getTimeout, getAudience, get: getConfig } = require('../config.js');

const ROUTE_NAME = 'register';

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
  const { password, passwordRepeat } = attributes;
  if (password !== passwordRepeat) {
    throw new Errors.ValidationError('supplied passwords do not match', 400, '["data.password","data.passwordRepeat"]');
  }

  const { country } = body;
  if (country && !countryData.info(country, 'ISO3')) {
    const err = 'country name must be specified as ISO3. Please refer to https://github.com/therebelrobot/countryjs#info for a complete list of codes';
    throw new Errors.ValidationError(err, 400, 'data.country');
  }

  return {
    username: body.id,
    password,
    metadata: ld.pick(attributes, [ 'firstName', 'lastName', 'companyName', 'country', 'city', 'gender', 'birthday', 'phone' ]),
    activate: false,
    audience: getAudience(),
    ipaddress: proxyaddr(req, getConfig().trustProxy),
  };
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
 * @apiParam (Body) {String{1..150}}                 data.attributes.companyName    user's company name
 * @apiParam (Body) {String{3}}                      [data.attributes.country]      ISO3 country code, e.g "USA" or "RUS"
 * @apiParam (Body) {String{1..150}}                 [data.attributes.city]         free-form input city name
 * @apiParam (Body) {String="female","male","other"} [data.attributes.gender]       user's gender
 * @apiParam (Body) {String="YYYY.MM.DD"}            [data.attributes.birthday]     birthday in the format of YYYY.MM.DD
 * @apiParam (Body) {String{6..20}}                  [data.attributes.phone]        user's phone, no validation
 *
 * @apiExample {curl} Example usage:
 *     curl -i -X POST -H 'Accept-Version: *' -H 'Accept: application/vnd.api+json' \
 *       -H 'Accept-Encoding: gzip, deflate' \
 *       -H 'Content-Type: applicaion/vnd.api+json' \
 *       "https://api-users.sandbox.matic.ninja/api/users" \
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
 *             "phone": "(440)0000000"
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
      const { log, amqp } = req;
      const config = getConfig();

      log.debug('attempt to register user');

      return validator.filter('register', req.body)
        .then(function filteredBody(body) {
          return transformBody(req, body);
        })
        .then(function attemptToRegister(message) {
          return amqp.publishAndWait(getRoute(ROUTE_NAME), message, { timeout: getTimeout(ROUTE_NAME) })
            .then(reply => {
              if (reply.requiresActivation) {
                return res.send(202);
              }

              res.meta = { jwt: reply.jwt };
              res.links = {
                self: config.host + req.path(),
              };

              res.send(201, User.transform(reply.user, true));
            });
        })
        .asCallback(next);
    },
  },
};
