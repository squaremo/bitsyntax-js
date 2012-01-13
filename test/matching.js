var match = require('../lib/interp').match;
var v = require('../lib/pattern').variable;
var rest = require('../lib/pattern').rest;
var assert = require('assert');

function good(desc, pattern, bytes, bound) {
  return test(desc, function() {
    assert.deepEqual(bound, match(pattern, new Buffer(bytes), {}));
  });
}

function pattern_str(type, size, flags) {
  var p = "n:" + size + '/' + type;
  if (flags.length > 0) {
    p += '-'+(flags.join('-'));
  }
  return p;
}

function quote(str) {
  return ["'", "'"].join(str);
}

suite("Integer",
      function() {

        function matches(size, flags, testcases) {
          testcases.forEach(function(testcase) {
            return good(quote(pattern_str('integer', size, flags)),
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

suite("Binary",
      function() {

        function matches(testcases) {
          testcases.forEach(function(testcase) {
            var size = testcase[0];
            var flags = ['unit:'+testcase[1]];
            var desc = pattern_str('binary', size, flags);
            var descrest = [desc, "_/binary"].join(", ");
            var plusgarbage = testcase[2].concat([6, 7, 9, 255]);
            flags.push('binary');
            good(quote(desc),
                 [v('n', size, flags)],
                 testcase[2], {'n': new Buffer(testcase[2])});
            good(quote(descrest),
                 [v('n', size, flags), rest()],
                 plusgarbage, {'n': new Buffer(testcase[2])});
                });
        }

        matches([
          // size, unit, bytes ( expected -> bytes back in a buffer )
          [ 0, 8, [] ],
          [ 1, 8, [93] ],
          [ 5, 8, [1, 2, 3, 4, 5] ],
          [ 32, 1, [255, 254, 253, 252] ]
        ]);
      });
