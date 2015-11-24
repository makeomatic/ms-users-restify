// include validator module
const Validator = require('ms-validation');

module.exports = new Validator('../schemas', null, { removeAdditional: true });
