const ld = require('lodash');
const proxyaddr = require('proxy-addr');

/**
 * Default configuration object
 * @type {Object}
 */
const config = {
  users: {
    prefix: 'users',
    postfix: {
      register: 'register',
      activate: 'activate',
      ban: 'ban',
      updatePassword: 'updatePassword',
      requestPassword: 'requestPassword',
      login: 'login',
      logout: 'logout',
      challenge: 'challenge',
      verify: 'verify',
      getMetadata: 'getMetadata',
      updateMetadata: 'updateMetadata',
      list: 'list',
    },
    timeouts: {
      register: 5000,
      activate: 5000,
      updatePassword: 5000,
      requestPassword: 5000,
      ban: 5000,
      login: 5000,
      logout: 5000,
      challenge: 5000,
      verify: 2000,
      getMetadata: 5000,
      updateMetadata: 5000,
      list: 5000,
    },
    audience: '*.localhost',
  },
  trustProxy: 'loopback',
  host: 'http://localhost:8080',
  queryTokenField: 'token',
  usersRequireActivate: true,
  generateNewPassword: false,
};

/**
 * Returns configuration instance
 * @return {Object}
 */
module.exports = exports = config;

/**
 * Reinit configuration for routes
 * @param  {Object} conf
 */
exports.reconfigure = function init(conf = {}) {
  ld.merge(config, conf);
  config.trustProxy = typeof config.trustProxy === 'function' ? config.trustProxy : proxyaddr.compile(config.trustProxy);
};

/**
 * Helper for resolving microservice routes
 * @param  {String} name
 * @return {String}
 */
exports.getRoute = function getRoute(name) {
  const { users } = config;
  return [ users.prefix, users.postfix[name]].join('.');
};

/**
 * Returns timeout for a route
 * @param  {String} name
 * @return {Number}
 */
exports.getTimeout = function getTimeout(name) {
  return config.users.timeouts[name];
};

/**
 * Helper to get audience
 * @return {String}
 */
exports.getAudience = function getAudience() {
  return config.users.audience;
};
