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
      res.setHeader('content-type', 'application/vnd.api+json');
      req.amqp = this.amqp;
      next();
    });
    this.server.on('after', restify.auditLogger({
      log: bunyan.createLogger({
        name: 'audit',
        stream: process.stderr,
      }),
    }));

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
        this.amqp.publishAndWait.returns(Promise.resolve());

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
    });
  });

  afterEach(function teardown() {
    this.server.destroy();
  });
});
