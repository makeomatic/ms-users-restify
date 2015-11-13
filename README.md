# Restify transport adapter for ms-users

## Install

`npm i ms-users-restify -S`

## Usage

```js
// server - restify server instance

const users = require('ms-users-restify');
const family = 'users';
const prefix = '/api';

// update configuration singleton
users.config({ prefix: 'niceusers', postfix: {
  register: 'oh-not-so-fast'
}});

// attaches handlers
users.attach(server, family, prefix);
```
