const ld = require('lodash');
const proxyaddr = require('proxy-addr');
const defaultOpts = {
  prefix: 'users',
  postfix: {
    register: 'register',
    activate: 'activate',
    ban: 'ban',
    updatePassword: 'updatePassword',
    requestPassword: 'requestPassword',
    login: 'login',
    challenge: 'challenge',
    verify: 'verify',
    getMetadata: 'getMetadata',
    updateMetadata: 'updateMetadata',
  },
  timeouts: {
    register: 5000,
    activate: 5000,
    updatePassword: 5000,
    requestPassword: 5000,
    ban: 5000,
    login: 5000,
    challenge: 5000,
    verify: 2000,
    getMetadata: 5000,
    updateMetadata: 5000,
  },
  audience: '*.localhost',
  trustProxy: 'loopback',
  host: 'http://localhost:8080',
  queryTokenField: 'token',
};

let config = ld.merge({}, defaultOpts);

/**
 * Returns configuration instance
 * @return {Object}
 */
exports.get = function get() {
  return config;
};

/**
 * Reinit configuration for routes
 * @param  {Object} conf
 */
exports.init = function init(conf = {}) {
  config = ld.merge({}, defaultOpts, conf);
  config.trustProxy = typeof config.trustProxy === 'function' ? config.trustProxy : proxyaddr.compile(config.trustProxy);
};

/**
 * Helper for resolving microservice routes
 * @param  {String} name
 * @return {String}
 */
exports.getRoute = function getRoute(name) {
  return config.prefix + '.' + config.postfix[name];
};

/**
 * Returns timeout for a route
 * @param  {String} name
 * @return {Number}
 */
exports.getTimeout = function getTimeout(name) {
  return config.timeouts[name];
};

/**
 * Helper to get audience
 * @return {String}
 */
exports.getAudience = function getAudience() {
  return config.audience;
};
