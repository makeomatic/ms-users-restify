exports.get = {
  path: '/me',
  middleware: [ 'auth' ],
  handlers: {
    '1.0.0': function me(req, res, next) {
      res.send(req.user.serialize(true));
      next();
    },
  },
};
