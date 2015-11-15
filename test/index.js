const ld = require('lodash');
const Promise = require('bluebird');
const Errors = require('common-errors');
const { expect } = require('chai');
const restify = require('restify');
const formatters = require('restify-formatter-jsonapi');
const enableDestroy = require('server-destroy');
const bunyan = require('bunyan');
const sinon = require('sinon');
const PORT = 18080;
const FAMILY = 'users';
const PREFIX = '/api';

// init the test client
const client = restify.createJsonClient({
  url: `http://127.0.0.1:${PORT}`,
  version: '*',
});
client.headers.accept = 'application/vnd.api+json';

describe('Unit Tests', function testSuite() {
  const UsersRestify = require('../src');

  beforeEach(function start(done) {
    this.amqp = {
      publishAndWait: sinon.stub(),
    };
    this.server = restify.createServer({
      formatters,
      log: bunyan.createLogger({
        level: 'warn',
        name: 'request',
        stream: process.stdout,
      }),
    });
    this.server.use(restify.acceptParser([ 'application/vnd.api+json', 'application/octet-stream' ]));
    this.server.use(restify.queryParser({ mapParams: false }));
    this.server.use(restify.gzipResponse());
    this.server.use(restify.conditionalRequest());
    this.server.use(restify.bodyParser({
      maxBodySize: process.env.CS_SERVER_MAX_BODY_SIZE || '10mb',
      mapParams: false,
    }));
    this.server.use(restify.requestLogger());
    this.server.use((req, res, next) => {
      req.amqp = this.amqp;
      next();
    });

    this.server.listen(PORT, done);
    enableDestroy(this.server);
  });

  it('should attach routes', function test() {
    UsersRestify.attach(this.server);
    expect(Object.keys(this.server.router.reverse)).to.have.length.gt(0);
  });

  describe('test routes', function testRoutesSuite() {
    beforeEach(function attachRoutes() {
      UsersRestify.attach(this.server, FAMILY, PREFIX);
    });

    describe('POST / [register]', function registerUserTests() {
      it('returns BadRequest on invalid payload', function test(done) {
        client.post(`${PREFIX}/${FAMILY}`, { bad: 'payload' }, function resp(err, req, res, body) {
          try {
            expect(res.headers['content-type']).to.be.eq('application/vnd.api+json');
            expect(err.name).to.be.eq('BadRequestError');
            expect(err.statusCode).to.be.eq(400);
            expect(body.meta).to.have.ownProperty('id');
            expect(body.meta).to.have.ownProperty('timers');
            expect(body.errors).to.have.length.of(1);
            expect(body.errors[0].status).to.be.eq('ValidationError');
            expect(body.errors[0].code).to.be.eq(400);
            expect(body.errors[0].code).to.be.eq(400);
            expect(body.errors[0].title).to.be.eq('route "register" validation failed');
            expect(body.errors[0]).to.have.ownProperty('detail');
          } catch (e) {
            return done(e);
          }
          done();
        });
      });

      it('responds with empty body and code 202 on correct payload as a sign of needed activation', function test(done) {
        this.amqp.publishAndWait.returns(Promise.resolve({ requiresActivation: true }));
        const user = {
          data: {
            type: 'user',
            id: 'vitaly@example.com',
            attributes: {
              password: '11112222',
              passwordRepeat: '11112222',
              firstName: 'Vitaly',
              lastName: 'Aminev',
            },
          },
        };
        client.post(`${PREFIX}/${FAMILY}`, user, (err, req, res, body) => {
          try {
            expect(err).to.be.eq(null);
            expect(res.statusCode).to.be.eq(202);
            expect(body).to.be.deep.eq({});
            expect(this.amqp.publishAndWait.calledWithExactly('users.register', {
              username: user.data.id,
              password: user.data.attributes.password,
              metadata: {
                firstName: user.data.attributes.firstName,
                lastName: user.data.attributes.lastName,
              },
              activate: false,
              audience: '*.localhost',
              ipaddress: '::ffff:127.0.0.1',
            }, { timeout: 5000 })).to.be.eq(true);
          } catch (e) {
            return done(e);
          }
          done();
        });
      });
    });

    describe('POST /activate', function activateSuite() {
      it('returns BadRequest on invalid payload', function test(done) {
        client.post(`${PREFIX}/${FAMILY}/activate`, {}, function resp(err, req, res, body) {
          try {
            expect(err).to.be.not.eq(null);
            expect(res.statusCode).to.be.eq(400);
            expect(err.name).to.be.eq('BadRequestError');
            expect(body.errors[0].status).to.be.eq('ValidationError');
            expect(body.errors[0].title).to.be.eq('validation token must be present in query.token');
            expect(body.errors[0].code).to.be.eq(400);
          } catch (e) {
            return done(e);
          }

          done();
        });
      });

      it('returns error on invalid activation token', function test(done) {
        const pr = Promise.reject(new Errors.HttpStatusError(403, 'could not decode token'));
        pr.catch(ld.noop);

        this.amqp.publishAndWait.returns(pr);

        client.post(`${PREFIX}/${FAMILY}/activate?token=invalidtoken`, {}, (err, req, res, body) => {
          try {
            expect(err).to.be.not.eq(null);
            expect(res.statusCode).to.be.eq(403);
            expect(body.errors[0].status).to.be.eq('HttpStatusError');
            expect(body.errors[0].title).to.be.eq('HttpStatusError: could not decode token');
            expect(body.errors[0].code).to.be.eq(403);
            expect(this.amqp.publishAndWait.calledWithExactly('users.activate', {
              token: 'invalidtoken',
              audience: '*.localhost',
              namespace: 'activate',
            }, { timeout: 5000 })).to.be.eq(true);
          } catch (e) {
            return done(e);
          }

          done();
        });
      });

      it('returns user on successful actiaftion', function test(done) {
        this.amqp.publishAndWait.returns(Promise.resolve({
          jwt: 'nicetoken',
          user: {
            username: 'v@example.com',
            metadata: {
              '*.localhost': {
                super: 'man',
                oops: true,
              },
            },
          },
        }));

        client.post(`${PREFIX}/${FAMILY}/activate?token=validtoken`, {}, (err, req, res, body) => {
          try {
            expect(err).to.be.eq(null);
            expect(res.statusCode).to.be.eq(200);
            expect(body).to.have.ownProperty('meta');
            expect(body).to.have.ownProperty('data');
            expect(body).to.have.ownProperty('links');
            expect(body).to.not.have.ownProperty('errors');
            expect(body.meta).to.have.ownProperty('jwt');
            expect(body.data).to.be.deep.eq({
              type: 'user',
              id: 'v@example.com',
              attributes: {
                super: 'man',
                oops: true,
              },
              links: {
                self: 'http://localhost:8080/api/users/v%40example.com',
              },
            });
            expect(this.amqp.publishAndWait.calledWithExactly('users.activate', {
              token: 'validtoken',
              audience: '*.localhost',
              namespace: 'activate',
            }, { timeout: 5000 })).to.be.eq(true);
          } catch (e) {
            return done(e);
          }

          done();
        });
      });
    });

    describe('POST /challenge', function challengeSuite() {
      it('rejects to send a challenge when id is missing', function test(done) {
        client.post(`${PREFIX}/${FAMILY}/challenge`, {}, (err, req, res, body) => {
          try {
            expect(err).to.not.be.eq(null);
            expect(res.statusCode).to.be.eq(400);
            expect(body).to.have.ownProperty('errors');
            expect(body.errors[0].status).to.be.eq('ValidationError');
            expect(body.errors[0].title).to.be.eq('route "challenge" validation failed');
            expect(body.errors[0]).to.have.ownProperty('detail');
          } catch (e) {
            return done(e);
          }

          done();
        });
      });

      it('requests challenge when payload is correct', function test(done) {
        const message = {
          data: {
            type: 'user',
            id: 'v@example.com',
          },
        };

        this.amqp.publishAndWait.returns(Promise.resolve(true));

        client.post(`${PREFIX}/${FAMILY}/challenge`, message, (err, req, res, body) => {
          try {
            expect(err).to.be.eq(null);
            expect(res.statusCode).to.be.eq(202);
            expect(body).to.be.deep.eq({});
            expect(this.amqp.publishAndWait.calledWithExactly('users.challenge', { type: 'email', username: message.data.id }, { timeout: 5000 })).to.be.eq(true);
          } catch (e) {
            return done(e);
          }

          done();
        });
      });
    });

    describe('POST /ban', function banSuite() {
      const message = {
        data: {
          type: 'user',
          id: 'v@example.com',
          attributes: {
            ban: true,
          },
        },
      };

      it('reject to ban when user is not authenicated', function test(done) {
        client.patch(`${PREFIX}/${FAMILY}/ban`, message, (err, req, res, body) => {
          try {
            expect(err).to.not.be.eq(null);
            expect(res.statusCode).to.be.eq(401);
            expect(body.errors[0].status).to.be.eq('HttpStatusError');
            expect(body.errors[0].title).to.be.eq('HttpStatusError: authorization required');
          } catch (e) {
            return done(e);
          }

          done();
        });
      });

      it('reject to ban when user is not an admin', function test(done) {
        this.amqp.publishAndWait
          .withArgs('users.verify', { token: 'notadmin', audience: '*.localhost', remoteip: '::ffff:127.0.0.1' })
          .returns(Promise.resolve({
            username: 'v@notadmin.com',
            metadata: {
              '*.localhost': {
                roles: [],
              },
            },
          }));

        client.patch(`${PREFIX}/${FAMILY}/ban?jwt=notadmin`, message, (err, req, res, body) => {
          try {
            expect(err).to.not.be.eq(null);
            expect(res.statusCode).to.be.eq(403);
            expect(body.errors[0].status).to.be.eq('HttpStatusError');
            expect(body.errors[0].title).to.be.eq('HttpStatusError: you are not authorized to perform this action');
          } catch (e) {
            return done(e);
          }

          done();
        });
      });

      it('able to ban user when we have enough rights', function test(done) {
        this.amqp.publishAndWait
          .withArgs('users.verify', { token: 'admin', audience: '*.localhost', remoteip: '::ffff:127.0.0.1' })
          .returns(Promise.resolve({
            username: 'v@admin.com',
            metadata: {
              '*.localhost': {
                roles: [ 'admin' ],
              },
            },
          }))
          .withArgs('users.ban', { type: 'email', username: message.data.id, ban: true, remoteip: '::ffff:127.0.0.1', whom: 'v@admin.com' }, { timeout: 5000 })
          .returns(Promise.resolve(true));

        client.patch(`${PREFIX}/${FAMILY}/ban?jwt=admin`, message, (err, req, res, body) => {
          try {
            expect(err).to.be.eq(null);
            expect(res.statusCode).to.be.eq(204);
            expect(body).to.be.deep.eq({});
            expect(this.amqp.publishAndWait.calledTwice).to.be.eq(true);
          } catch (e) {
            return done(e);
          }

          done();
        });
      });
    });

    describe('GET /me', function meSuite() {
      it('rejects to return data when JWT token is invalid', function test(done) {
        client.get(`${PREFIX}/${FAMILY}/me`, (err, req, res, body) => {
          try {
            expect(err).to.not.be.eq(null);
            expect(res.statusCode).to.be.eq(401);
            expect(body.errors[0].status).to.be.eq('HttpStatusError');
            expect(body.errors[0].title).to.be.eq('HttpStatusError: authorization required');
          } catch (e) {
            return done(e);
          }

          done();
        });
      });

      it('returns user data when JWT token is valid', function test(done) {
        this.amqp.publishAndWait
          .withArgs('users.verify', { token: 'validtoken', audience: '*.localhost', remoteip: '::ffff:127.0.0.1' })
          .returns(Promise.resolve({
            username: 'v@user.com',
            metadata: {
              '*.localhost': {
                roles: [],
                firstName: 'Vitaly',
                lastName: 'Aminev',
              },
            },
          }));

        client.get(`${PREFIX}/${FAMILY}/me?jwt=validtoken`, (err, req, res, body) => {
          try {
            expect(err).to.be.eq(null);
            expect(res.statusCode).to.be.eq(200);
            expect(body.data.type).to.be.eq('user');
            expect(body.data.id).to.be.eq('v@user.com');
            expect(body.data.attributes).to.be.deep.eq({
              roles: [],
              firstName: 'Vitaly',
              lastName: 'Aminev',
            });
            expect(this.amqp.publishAndWait.calledOnce).to.be.eq(true);
          } catch (e) {
            return done(e);
          }

          done();
        });
      });
    });

    describe('GET /:id', function getIdSuite() {
      const path = `${PREFIX}/${FAMILY}/${encodeURIComponent('niceuser@example.com')}`;

      it('rejects to get information about other user because one is not authenicated', function test(done) {
        client.get(path, (err, req, res, body) => {
          try {
            expect(err).to.not.be.eq(null);
            expect(res.statusCode).to.be.eq(401);
            expect(body.errors[0].status).to.be.eq('HttpStatusError');
            expect(body.errors[0].title).to.be.eq('HttpStatusError: authorization required');
          } catch (e) {
            return done(e);
          }

          done();
        });
      });

      it('rejects to get information about other user, because one is not an admin', function test(done) {
        this.amqp.publishAndWait
          .withArgs('users.verify', { token: 'notadmin', audience: '*.localhost', remoteip: '::ffff:127.0.0.1' })
          .returns(Promise.resolve({
            username: 'v@user.com',
            metadata: {
              '*.localhost': {
                roles: [],
                firstName: 'Vitaly',
                lastName: 'Aminev',
              },
            },
          }));

        client.get(`${path}?jwt=notadmin`, (err, req, res, body) => {
          try {
            expect(err).to.not.be.eq(null);
            expect(res.statusCode).to.be.eq(403);
            expect(body.errors[0].status).to.be.eq('HttpStatusError');
            expect(body.errors[0].title).to.be.eq('HttpStatusError: you can only get information about yourself via /me endpoint');
          } catch (e) {
            return done(e);
          }

          done();
        });
      });

      it('returns information about other user when admin is requesting it', function test(done) {
        this.amqp.publishAndWait
          .withArgs('users.verify', { token: 'admin', audience: '*.localhost', remoteip: '::ffff:127.0.0.1' }, { timeout: 2000 })
          .returns(Promise.resolve({
            username: 'v@user.com',
            metadata: {
              '*.localhost': {
                roles: [ 'admin' ],
                firstName: 'Vitaly',
                lastName: 'Aminev',
              },
            },
          }))
          .withArgs('users.getMetadata', { username: 'niceuser@example.com', audience: '*.localhost' }, { timeout: 5000 })
          .returns(Promise.resolve({
            '*.localhost': {
              roles: [],
              firstName: 'Niceuser',
              lastName: 'Borkovich',
            },
          }));

        client.get(`${path}?jwt=admin`, (err, req, res, body) => {
          try {
            expect(err).to.be.eq(null);
            expect(res.statusCode).to.be.eq(200);
            expect(body.data.type).to.be.eq('user');
            expect(body.data.id).to.be.eq('niceuser@example.com');
            expect(body.data.attributes).to.be.deep.eq({
              roles: [],
              firstName: 'Niceuser',
              lastName: 'Borkovich',
            });
            expect(this.amqp.publishAndWait.calledTwice).to.be.eq(true);
          } catch (e) {
            return done(e);
          }

          done();
        });
      });
    });

    describe('POST /login', function loginTestSuite() {
      const path = `${PREFIX}/${FAMILY}/login`;

      it('rejects authentication with incorrect payload', function test(done) {
        client.post(path, {}, (err, req, res, body) => {
          try {
            expect(err).to.not.be.eq(null);
            expect(res.statusCode).to.be.eq(400);
            expect(body.errors[0].status).to.be.eq('ValidationError');
            expect(body.errors[0].code).to.be.eq(400);
          } catch (e) {
            return done(e);
          }

          done();
        });
      });

      it('rejects authentication with incorrect username and password', function test(done) {
        const msg = { data: { type: 'user', id: 'v@example.com', attributes: { password: 'notreal' } } };
        const pr = Promise.reject(new Errors.HttpStatusError(403, 'incorrect password'));
        pr.catch(ld.noop);

        this.amqp.publishAndWait
          .withArgs('users.login', {
            username: msg.data.id, audience: '*.localhost', password: msg.data.attributes.password, remoteip: '::ffff:127.0.0.1',
          }, { timeout: 5000 })
          .returns(pr);

        client.post(path, msg, (err, req, res, body) => {
          try {
            expect(err).to.not.be.eq(null);
            expect(res.statusCode).to.be.eq(403);
            expect(body.errors[0].status).to.be.eq('HttpStatusError');
            expect(body.errors[0].title).to.be.eq('HttpStatusError: incorrect password');
          } catch (e) {
            return done(e);
          }

          done();
        });
      });

      it('authenticates on correct username and password', function test(done) {
        const msg = { data: { type: 'user', id: 'v@example.com', attributes: { password: 'realpassword' } } };

        this.amqp.publishAndWait
          .withArgs('users.login', {
            username: msg.data.id, audience: '*.localhost', password: msg.data.attributes.password, remoteip: '::ffff:127.0.0.1',
          }, { timeout: 5000 })
          .returns(Promise.resolve({
            jwt: 'nicetoken',
            user: {
              username: msg.data.id,
              metadata: {
                '*.localhost': {
                  roles: [],
                  firstName: 'niceDude',
                  lastName: 'notReally',
                },
              },
            },
          }));

        client.post(path, msg, (err, req, res, body) => {
          try {
            expect(err).to.be.eq(null);
            expect(res.statusCode).to.be.eq(200);
            expect(body.data.type).to.be.eq('user');
            expect(body.data.id).to.be.eq(msg.data.id);
            expect(body.data.attributes).to.be.deep.eq({
              roles: [],
              firstName: 'niceDude',
              lastName: 'notReally',
            });
          } catch (e) {
            return done(e);
          }

          done();
        });
      });
    });
  });

  afterEach(function teardown() {
    this.server.destroy();
  });
});
