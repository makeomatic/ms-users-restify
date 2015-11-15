const Errors = require('common-errors');
const validator = require('../validator.js');
const { getAudience, getRoute, getTimeout } = require('../config.js');

const ROUTE_NAME = 'updateMetadata';

exports.patch = {
  path: '/:id',
  middleware: [ 'auth' ],
  handlers: {
    '1.0.0': function updateUser(req, res, next) {
      const { amqp, log } = req;

      return validator.validate('update', req.body)
        .then(function validatedBody(body) {
          const { data } = body;
          const inputId = req.params.id;
          const id = inputId === 'me' ? req.user.id : inputId;

          if (inputId !== 'me' && !req.user.isAdmin()) {
            throw new Errors.HttpStatusError(403, 'insufficient right to perform this operation');
          }

          const message = {
            username: id,
            audience: getAudience(),
            metadata: {},
          };

          const { attributes, remove } = data;

          if (attributes) {
            message.metadata.$set = attributes;
          }

          if (remove) {
            message.metadata.$remove = remove;
          }

          return amqp
            .publishAndWait(getRoute(ROUTE_NAME), message, { timeout: getTimeout(ROUTE_NAME) })
            .then(reply => {
              log.debug('updateMetadata response:', reply);
              res.send(204);
            });
        })
        .asCallback(next);
    },
  },
};
