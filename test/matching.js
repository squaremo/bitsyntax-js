var match = require('../lib/interp').match;
var v = require('../lib/pattern').variable;
var assert = require('assert');

function good(desc, pattern, bytes, bound) {
  return test(desc, function() {
    assert.deepEqual(bound, match(pattern, new Buffer(bytes), {}));
  });
}

suite("Integers",
      function() {
        good("uint8", [v('n', 8, [])], [255], {'n': 255});
        good("int8", [v('n', 8, ['signed'])], [255], {'n': -1});

        good("uint16BE", [v('n', 16, [])], [1, 255], {'n': 511});
        good("int16BE", [v('n', 16, ['signed'])], [255, 65], {'n': -191});
      });
