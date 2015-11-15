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
        level: 'debug',
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

    describe('POST /', function registerUserTests() {
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
        client.post(`${PREFIX}/${FAMILY}`, user, function resp(err, req, res, body) {
          try {
            expect(err).to.be.eq(null);
            expect(res.statusCode).to.be.eq(202);
            expect(body).to.be.deep.eq({});
          } catch (e) {
            return done(e);
          }
          done();
        });
      });
    });

    describe('POST /validate', function activateSuite() {
      it('returns BadRequest on invalid payload', function test(done) {
        client.post(`${PREFIX}/${FAMILY}/validate`, {}, function resp(err, req, res, body) {
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
        this.amqp.publishAndWait.returns(Promise.reject(new Errors.HttpStatusError(403, 'could not decode token')));

        client.post(`${PREFIX}/${FAMILY}/validate?token=invalidtoken`, {}, function resp(err, req, res, body) {
          try {
            expect(err).to.be.not.eq(null);
            expect(res.statusCode).to.be.eq(403);
            expect(body.errors[0].status).to.be.eq('HttpStatusError');
            expect(body.errors[0].title).to.be.eq('HttpStatusError: could not decode token');
            expect(body.errors[0].code).to.be.eq(403);
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

        client.post(`${PREFIX}/${FAMILY}/validate?token=validtoken`, {}, function resp(err, req, res, body) {
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
