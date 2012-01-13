var match = require('../lib/interp').match;
var v = require('../lib/pattern').variable;
var assert = require('assert');

function good(desc, pattern, bytes, bound) {
  return test(desc, function() {
    assert.deepEqual(bound, match(pattern, new Buffer(bytes), {}));
  });
}

suite("Integer",
      function() {

        function pattern_str(size, flags) {
          var p = "'n:" + size;
          if (flags.length > 0) {
              p += "/"+(flags.join('-'));
          }
          return p + "'";
        }

        function matches(size, flags, testcases) {
          testcases.forEach(function(testcase) {
            return good(pattern_str(size, flags),
                        [v('n', size, flags)],
                        testcase[0], {'n': testcase[1]});
          });
        }

        matches(8, [], [
          [ [255], 255 ]
        ]);
        matches(8, ['signed'], [
          [ [255], -1 ]
        ]);
        matches(1, ['unit:8'], [
          [ [129], 129 ],
        ]);
        matches(1, ['unit:8', 'signed'], [
          [ [129], -127 ]
        ]);

        matches(16, [], [
          [ [1, 255], 511 ]
        ]);
        matches(16, ['signed'], [
          [ [255, 65], -191 ]
        ]);
        matches(16, ['little'], [
          [ [255, 1], 511 ]
        ]);
        matches(16, ['signed', 'little'], [
          [ [65, 255], -191 ]
        ]);

        matches(32, [], [
          [ [45, 23, 97, 102], 756506982 ]
        ]);
        matches(32, ['signed'], [
          [ [245, 23, 97, 102], -183017114 ]
        ]);
        matches(32, ['little'], [
          [ [245, 23, 97, 102], 1717639157 ]
        ]);
        matches(32, ['signed', 'little'], [
          [ [245, 23, 97, 129], -2124343307 ]
        ]);
        matches(4, ['unit:8', 'signed', 'little'], [
          [ [245, 23, 97, 129], -2124343307 ]
        ]);

      });
