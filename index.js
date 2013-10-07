module.exports.parse = require('./lib/parse').parse;
module.exports.match = require('./lib/interp').match;
module.exports.construct = require('./lib/constructor').construct;
module.exports.write = require('./lib/constructor').write;

module.exports.matcher = require('./lib/compile').compile;
module.exports.builder = require('./lib/constructor').builder;
