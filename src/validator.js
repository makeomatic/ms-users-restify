// include validator module
const Validator = require('ms-amqp-validation');

// init default schemas
const validator = new Validator(require('ms-users-schemas'));

// init extended schemas
validator.init('../schemas', false, true);

module.exports = validator;
