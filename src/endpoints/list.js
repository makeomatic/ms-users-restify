const Promise = require('bluebird');
// const User = require('../models/User.js');
const Errors = require('common-errors');
// const { getRoute, getAudience, getTimeout, get: getConfig } = require('../config.js');

// const ROUTE_NAME = 'list';

exports.get = {
  path: '/',
  middleware: [ 'auth' ],
  handlers: {
    '1.0.0': function me(req, res, next) {
      return Promise.try(function verifyRights() {
        if (!req.user.isAdmin()) {
          throw new Errors.HttpStatusError(403, 'you can only get information about yourself');
        }

        throw new Errors.HttpStatusError(401, 'this is not implemented yet');
      })
      .asCallback(next);
    },
  },
};
