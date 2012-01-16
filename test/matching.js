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

suite("Float",
      function() {

        function close(desc, pattern, bytes, num, precision) {
          // Assume variable to test is 'n'
          return test(desc, function() {
            var m = match(pattern, new Buffer(bytes), {});
            //console.log("Math.abs(" + num + " - " + m.n + ")");
            assert.ok(Math.abs(num - m.n) < precision);
          });
        }

        function matches(size, flags, testcases) {
          testcases.forEach(function(testcase) {
            return close(quote(pattern_str('float', size, flags)),
                         [v('n', size, flags.concat('float'))],
                         testcase[0], testcase[1], 0.00001); // close enough
          });
        }

        // test cases largely constructed in Erlang using e.g.,
        // Pi = math:pi(), <<Pi:32/float>>.

        matches(32, [], [
          [ [64,73,15,219], Math.PI ],
          [ [0, 0, 0, 0], 0.0 ]
        ]);

        matches(64, [], [
          [ [64,9,33,251,84,68,45,24], Math.PI ],
          [ [0, 0, 0, 0, 0, 0, 0, 0], 0.0 ]
        ]);

        matches(32, ['little'], [
          [ [219, 15, 73, 64], Math.PI ],
          [ [0, 0, 0, 0], 0.0 ]
        ]);

        matches(64, ['little'], [
          [ [ 24, 45, 68, 84, 251, 33, 9, 64 ] , Math.PI ],
          [ [0, 0, 0, 0, 0, 0, 0, 0], 0.0 ]
        ]);

        matches(4, ['unit:8'], [
          [ [64,73,15,219], Math.PI ],
          [ [0, 0, 0, 0], 0.0 ]
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
