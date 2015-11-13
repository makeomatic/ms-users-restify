const ld = require('lodash');
const Errors = require('common-errors');
const countryData = require('countryjs');
const validator = require('../validator.js');
const proxyaddr = require('proxy-addr');
const { getRoute, getTimeout, getAudience, get } = require('../config.js');

const ROUTE_NAME = 'register';

/**
 * Transform body into ms-users message
 * @param  {Request} req
 * @param  {Object}  body
 * @return {Object}
 */
function transformBody(req, input) {
  req.log.debug('attempting transformation', input);

  const body = input.data.attributes;
  const { password, passwordRepeat } = body;
  if (password !== passwordRepeat) {
    throw new Errors.ValidationError('supplied passwords do not match', 400, '["data.password","data.passwordRepeat"]');
  }

  const { country } = body;
  if (country && !countryData.info(country, 'ISO3')) {
    const err = 'country name must be specified as ISO3. Please refer to https://github.com/therebelrobot/countryjs#info for a complete list of codes';
    throw new Errors.ValidationError(err, 400, 'data.country');
  }

  return {
    username: body.username,
    password,
    metadata: ld.pick(body, [ 'firstName', 'lastName', 'companyName', 'country', 'city', 'gender', 'birthday', 'phone' ]),
    activate: false,
    audience: getAudience(),
    ipaddress: proxyaddr(req, get().trustProxy),
  };
}

exports.post = {
  path: '/',
  handlers: {
    '1.0.0': function registerUser(req, res, next) {
      const { log, amqp } = req;

      log.debug('attempt to register user');

      return validator.filter('register', req.body)
        .then(function filteredBody(body) {
          return transformBody(req, body);
        })
        .then(function attemptToRegister(message) {
          return amqp.publishAndWait(getRoute(ROUTE_NAME), message, { timeout: getTimeout(ROUTE_NAME) })
            .then(reply => {
              if (reply.requiresActivation) {
                res.send(202);
              } else {
                res.statusCode = 201;
                res.meta = { jwt: reply.jwt };
                return {
                  type: 'user',
                  id: reply.user.username,
                  attributes: reply.user.metadata,
                };
              }
            });
        })
        .asCallback(next);
    },
  },
};
