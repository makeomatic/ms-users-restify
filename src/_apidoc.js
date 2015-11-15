/**
 * @apiDefine ValidationError
 *
 * @apiError (Error) {Object}    meta
 * @apiError (Error) {String}    meta.id
 * @apiError (Error) {Object[]}  errors
 * @apiError (Error) {String}    errors.status
 * @apiError (Error) {String}    errors.title
 * @apiError (Error) {String}    errors.code
 * @apiError (Error) {Object[]}  errors.detail
 * @apiError (Error) {String}    errors.detail.text
 * @apiError (Error) {String}    errors.detail.code
 * @apiError (Error) {String}    errors.detail.field
 *
 * @apiErrorExample {json} Error-Response:
 * 		HTTP/1.1 400 BadRequest
 * 		{
 * 			"meta": {
 * 				"id": "request-id"
 * 			},
 * 			"errors": [{
 * 				"status": "ValidationError",
 * 				"code": 400,
 * 				"title": "short description of the errors",
 * 				"detail": [{
 * 					"text": "invalid input type",
 * 					"code": 400,
 * 					"field": "data.type"
 * 				}]
 * 			}]
 * 		}
 */

/**
 * @apiDefine UnauthorizedError
 *
 * @apiError (Error) {Object}    meta
 * @apiError (Error) {String}    meta.id
 * @apiError (Error) {Object[]}  errors
 * @apiError (Error) {String}    errors.status
 * @apiError (Error) {String}    errors.title
 * @apiError (Error) {String}    errors.code
 *
 * @apiErrorExample {json} Error-Response:
 * 		HTTP/1.1 401 Unauthorized
 * 		{
 * 			"meta": {
 * 				"id": "request-id"
 * 			},
 * 			"errors": [{
 * 				"status": "HttpStatusError",
 * 				"code": 401,
 * 				"title": "you must authorize to use this endpoint",
 * 			}]
 * 		}
 */

/**
 * @apiDefine UserAuthResponse
 *
 * @apiSuccess (200) {Object} meta              response meta information
 * @apiSuccess (200) {String} meta.id           request id
 * @apiSuccess (200) {String} meta.jwt          jsonwebtoken to be used for further authentication
 * @apiSuccess (200) {Object} data              response data
 * @apiSuccess (200) {String} data.type         response data type - always `user`
 * @apiSuccess (200) {String} data.id           username, always an email
 * @apiSuccess (200) {Object} data.attributes   user attributes
 * @apiSuccess (200) {Object} data.links        user links
 * @apiSuccess (200) {String} data.links.self   link to the user resource
 *
 * @apiSuccessExample {json} Success-Response:
 * 		HTTP/1.1 200 OK
 * 		{
 * 			"meta": {
 * 				"id": "request-id",
 * 				"jwt": "jsonwebtoken"
 * 			},
 * 			"data": {
 * 				"type": "user",
 * 				"id": "user@example.com",
 * 				"attributes": {
 * 					"firstName": "Anna",
 * 					"lastName": "Maria"
 * 				},
 * 				"links": {
 * 					"self": "https://localhost:443/api/users/user%40example.com"
 * 				}
 * 			}
 * 		}
 */
