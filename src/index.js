const ld = require('lodash');
const files = require('./adapter.js');

/**
 * Raw file references
 * @type {Object}
 */
exports.files = files;

/**
 * Use this function to configure routes
 * @return {Function}
 */
exports.config = require('./config.js').init;

/**
 * Accepts restify server instance and attaches handlers
 * @param  {RestifyServer} server
 * @param  {String}        family
 */
exports.attach = function attach(server, family = 'users', prefix = '/api') {
  ld.forOwn(files, function attachRoute(file, name) {
    ld.forOwn(file, function iterateOverProperties(props, method) {
      ld.forOwn(props.handler, function iterateOverVersionedHandler(handler, versionString) {
        server[method]({
          name: `${family}.${name}`,
          path: `${prefix}/${family}/${props.path}`,
          version: versionString.split(','),
        }, handler);
      });
    });
  });
};
