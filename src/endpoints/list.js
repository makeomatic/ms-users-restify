const Promise = require('bluebird');
const validator = require('../validator.js');
const Errors = require('common-errors');
const config = require('../config.js');
const { getRoute, getAudience, getTimeout } = config;
const ld = require('lodash').runInContext();
const { stringify: qs } = require('querystring');
const hasOwnProperty = Object.prototype.hasOwnProperty;

// current route
const ROUTE_NAME = 'list';

// adds all mixins
ld.mixin(require('mm-lodash'));

/**
 * @api {get} / List user objects
 * @apiVersion 1.0.0
 * @apiName GetUserObjects
 * @apiGroup Users
 * @apiPermission admin
 *
 * @apiDescription Returns list of user objects, allows filtering by multiple metadata fields, sorting by a single field in ASC/DESC fashion and
 * paginating over them
 *
 * @apiHeader (Authorization) {String} Authorization JWT :accessToken
 * @apiHeaderExample Authorization-Example:
 * 		"Authorization: JWT myreallyniceandvalidjsonwebtoken"
 *
 * @apiExample {curl} Example usage:
 *     curl -i -H 'Accept-Version: *' -H 'Accept: application/vnd.api+json' -H 'Accept-Encoding: gzip, deflate' \
 *       -H 'Content-Type: application/vnd.api+json' -H "Authorization: JWT realjwttoken" \
 *       "https://api-users.sandbox.matic.ninja/api/users"
 *
 * @apiUse UnauthorizedError
 * @apiUse ForbiddenResponse
 * @apiUse ValidationError
 *
 * @apiParam (Query) {Number{0..}} [offset] how many users to skip
 * @apiParam (Query) {Number{1..100}} [limit] how many users to return per page
 * @apiParam (Query) {String} [filter] `encodeURIComponent(JSON.stringify(filterObject))`,
 * 																		pass it as value. `#` - filters by username, other keys - by allowed
 * 																		metadata
 * @apiParam (Query) {String} [sortBy] `encodeURIComponent(sortBy)`, if not specified, sorts by username,
 * 																		otherwise by metadata field passed here
 * @apiParam (Query) {String="ASC","DESC"} [order]  sorting order, defaults to "ASC", case-insensitive
 *
 * @apiSuccess (Code 200) {Object}   meta              response meta information
 * @apiSuccess (Code 200) {String}   meta.id           request id
 * @apiSuccess (Code 200) {Number}   meta.page         current page we are looking at
 * @apiSuccess (Code 200) {Number}   meta.pages        total number of pages
 * @apiSuccess (Code 200) {Number}   meta.cursor       set as offset for the next page
 * @apiSuccess (Code 200) {Object[]} data              response data
 * @apiSuccess (Code 200) {String}   data.type         response data type - always `user`
 * @apiSuccess (Code 200) {String}   data.id           username, always an email
 * @apiSuccess (Code 200) {Object}   data.attributes   user attributes
 * @apiSuccess (Code 200) {Object}   data.links        user links
 * @apiSuccess (Code 200) {String}   data.links.self   link to the current resource
 * @apiSuccess (Code 200) {String}   links             links
 * @apiSuccess (Code 200) {String}   links.self        link to the current page
 * @apiSuccess (Code 200) {String}   links.next        link to the next page
 *
 * @apiSuccessExample {json} Success-Users:
 * 		HTTP/1.1 200 OK
 * 		{
 * 			"meta": {
 * 				"id": "request-id",
 * 				"page": 10,
 * 				"pages": 10
 * 			},
 * 			"data": [{
 * 				"type": "user",
 * 				"id": "user@example.com",
 * 				"attributes": {
 * 					"firstName": "Anna",
 * 					"lastName": "Maria"
 * 				},
 * 				"links": {
 * 					"self": "https://localhost:443/api/users/user%40example.com"
 * 				}
 * 			}],
 * 			"links": {
 * 				"self": "https://localhost:443/api/users?cursor=91&limit=10"
 * 			}
 * 		}
 *
 */
exports.get = {
  path: '/',
  middleware: ['conditional-auth'],
  handlers: {
    '1.0.0': function list(req, res, next) {
      return Promise
      .try(function verify() {
        const { order, filter, offset, limit, sortBy } = req.query;
        const parsedFilter = filter && JSON.parse(decodeURIComponent(filter)) || undefined;
        const isPublic = req.user && req.user.isAdmin() ? hasOwnProperty.call(req.query, 'pub') : true;

        return ld.compactObject({
          order: (order || 'ASC').toUpperCase(),
          offset: offset && +offset || undefined,
          limit: limit && +limit || 10,
          filter: parsedFilter || {},
          criteria: sortBy && decodeURIComponent(sortBy) || undefined,
          audience: getAudience(),
          public: isPublic,
        });
      })
      .catch(function validationError(err) {
        req.log.error('input error', err);
        throw new Errors.HttpStatusError(400, 'query.filter and query.sortBy must be uri encoded, and query.filter must be a valid JSON object');
      })
      .then(function validateMessage(message) {
        return validator.validate(ROUTE_NAME, message);
      })
      .then(function askAMQP(message) {
        return Promise.join(
          req.amqp.publishAndWait(getRoute(ROUTE_NAME), message, { timeout: getTimeout(ROUTE_NAME) }),
          message
        );
      })
      .spread(function remapAnswer(answer, message) {
        const { page, pages, cursor } = answer;
        const { order, filter, offset, limit, criteria: sortBy } = message;
        const selfQS = {
          order,
          limit,
          offset: offset || 0,
          sortBy,
          filter: encodeURIComponent(JSON.stringify(filter)),
        };

        res.meta = { page, pages };

        const base = config.host + config.users.attachPoint;
        res.links = {
          self: `${base}?${qs(selfQS)}`,
        };

        if (page < pages) {
          const nextQS = Object.assign({}, selfQS, { offset: cursor });
          res.meta.cursor = cursor;
          res.links.next = `${base}?${qs(nextQS)}`;
        }

        const { User } = config.models;
        res.send(answer.users.map(function remapUser(user) {
          return User.transform({ username: user.id, public: message.public, metadata: user.metadata });
        }));
      })
      .asCallback(next);
    },
  },
};
