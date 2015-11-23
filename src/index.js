const path = require('path');
const config = require('./config.js');
const utils = require('restify-utils');

/**
 * Exports .attach function as main one
 * Exports .endpoints object
 * Exports .middleware object
 */
module.exports = exports = utils.attach(
  config,
  path.resolve(__dirname, './endpoints'),
  path.resolve(__dirname, './middleware')
);

/**
 * Use this function to configure routes
 * @return {Function}
 */
exports.reconfigure = config.reconfigure;
