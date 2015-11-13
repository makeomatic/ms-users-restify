const glob = require('glob');
const path = require('path');

// load files
const files = {};
glob.sync('./endpoints/*.js', { cwd: __dirname })
  .forEach(function loadModules(file) {
    const parts = file.split('/');
    const name = path.basename(parts.pop(), '.js');
    files[name] = require(file);
  });

module.exports = files;
