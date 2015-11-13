const ld = require('lodash');
const defaultOpts = {
  prefix: 'users',
  postfix: {
    register: 'register',
  },
  timeouts: {
    register: 5000,
  },
  audience: '*.localhost',
  trustProxy: false,
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
