const ld = require('lodash');
const data = require('./adapter.js');
const debug = require('debug')('ms-users-restify:attach');

/**
 * Raw file references
 * @type {Object}
 */
exports.files = data.files;

/**
 * Raw middleware references
 * @type {Object}
 */
exports.middleware = data.middleware;

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
  exports.config({ attachPoint: `${prefix}/${family}`, family });

  debug('attaching with family %s and prefix %s', family, prefix);
  ld.forOwn(data.files, function attachRoute(file, name) {
    debug('attaching file %s', name);
    ld.forOwn(file, function iterateOverProperties(props, method) {
      debug('  attaching method %s and path %s', method, props.path);
      ld.forOwn(props.handlers, function iterateOverVersionedHandler(handler, versionString) {
        debug('    attaching handler for version %s', versionString);
        const args = [
          {
            name: `${family}.${name}.${method}`,
            path: `${prefix}/${family + props.path}`,
            version: versionString.split(','),
          },
        ];
        if (props.middleware) {
          props.middleware.forEach(function attachMiddleware(middlewareName) {
            debug('      pushed middleware %s', middlewareName);
            args.push(data.middleware[middlewareName]);
          });
        }
        args.push(handler);
        server[method].apply(server, args);
      });
    });
  });
};
