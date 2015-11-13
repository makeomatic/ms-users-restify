const ld = require('lodash');
const files = require('./adapter.js');
const debug = require('debug')('ms-users-restify:attach');

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
  debug('attaching with family %s and prefix %s', family, prefix);
  ld.forOwn(files, function attachRoute(file, name) {
    debug('attaching file %s', name);
    ld.forOwn(file, function iterateOverProperties(props, method) {
      debug('  attaching method %s and path %s', method, props.path);
      ld.forOwn(props.handlers, function iterateOverVersionedHandler(handler, versionString) {
        debug('    attaching handler for version %s', versionString);
        server[method]({
          name: `${family}.${name}`,
          path: `${prefix}/${family + props.path}`,
          version: versionString.split(','),
        }, handler);
      });
    });
  });
};
