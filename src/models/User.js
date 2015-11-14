const Errors = require('common-errors');
const validator = require('../validator.js');
const { getAudience, get: getConfig } = require('../config.js');

/**
 * Defines default user class
 * @namespace {User}
 */
module.exports = class User {

  constructor(id, attributes = {}) {
    if (!id) {
      throw new Errors.ValidationError('must include id', 400, 'arguments[0]');
    }

    if (!attributes || typeof attributes !== 'object') {
      throw new Errors.ValidationError('attributes must be an object', 400, 'arguments[1]');
    }

    this.data = {
      id,
      attributes,
    };

    const result = validator.validateSync('User', this.data);
    if (result.error) {
      throw result.error;
    }
  }

  get id() {
    return this.data.id;
  }

  isAdmin() {
    const { roles } = this.data.attributes;
    return roles && roles.indexOf('admin') !== -1;
  }

  /**
   * Serializes object into json:api output
   * @param  {Boolean} host - resource location
   * @return {Object}
   */
  serialize(host) {
    const user = {
      type: 'user',
      id: this.data.id,
      attributes: this.data.attributes,
    };

    if (host) {
      const config = getConfig();
      user.links = {
        self: config.host + config.attachPoint + '/' + encodeURIComponent(user.id),
      };
    }

    return user;
  }

  static transform(data, host) {
    const user = User.deserialize(data);
    return user.serialize(host);
  }

  static deserialize(data) {
    return new User(data.username, data.metadata[getAudience()]);
  }
};
