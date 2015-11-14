const glob = require('glob');
const path = require('path');
const debug = require('debug')('ms-users-restify:adapter');

function loadModule(container) {
  return function loader(file) {
    debug('loaded file %s', file);
    const parts = file.split('/');
    const name = path.basename(parts.pop(), '.js');
    container[name] = require(file);
  };
}

// load files
const files = exports.files = {};
glob.sync('./endpoints/*.js', { cwd: __dirname })
  .forEach(loadModule(files));

// load middleware
const middleware = exports.middleware = {};
glob.sync('./middleware/*.js', { cwd: __dirname })
  .forEach(loadModule(middleware));
