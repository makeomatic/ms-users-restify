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
