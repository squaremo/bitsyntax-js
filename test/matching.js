var match = require('../lib/interp').match;
var parse = require('../lib/parse').parse;
var compile = require('../lib/compile').compile;
var assert = require('assert');


var INT_TESTS = [
    ['n:8',
     [[[255], 255]]],
    ['n:8/signed',
     [[[255], -1]]],
    ['n:1/unit:8',
     [[[129], 129]]],
    ['n:1/unit:8-signed',
     [[[129], -127]]],

    ['n:16',
     [[[1, 255], 511]]],
    ['n:16/signed',
     [[[255, 65], -191]]],
    ['n:16/little',
     [[[255, 1], 511]]],
    ['n:16/signed-little',
     [[[65, 255], -191]]],

    ['n:32',
     [[[45, 23, 97, 102], 756506982]]],
    ['n:32/signed',
     [[[245, 23, 97, 102], -183017114]]],
    ['n:32/little',
     [[[245, 23, 97, 102], 1717639157]]],
    ['n:32/signed-little',
     [[[245, 23, 97, 129], -2124343307]]],
    
    ['n:4/signed-little-unit:8',
     [[[245, 23, 97, 129], -2124343307]]]
];

suite("Integer",
      function() {

        INT_TESTS.forEach(function(p) {
          var pattern = parse(p[0]);
          var cpattern = compile(p[0]);
          p[1].forEach(function(tc) {
            test(p[0], function() {
              assert.deepEqual({n: tc[1]}, match(pattern, new Buffer(tc[0])));
            });
            test(p[0], function() {
              assert.deepEqual({n: tc[1]}, cpattern(new Buffer(tc[0])));
            });
          });
        });
      });


// test cases largely constructed in Erlang using e.g.,
// Pi = math:pi(), <<Pi:32/float>>.
FLOAT_TESTS = [
  ['n:32/float',
   [[[64,73,15,219], Math.PI],
    [[0, 0, 0, 0], 0.0 ]]],

  ['n:64/float',
   [[[64,9,33,251,84,68,45,24], Math.PI],
    [[0, 0, 0, 0, 0, 0, 0, 0], 0.0]]],

  ['n:32/float-little',
   [[[219, 15, 73, 64], Math.PI],
    [[0, 0, 0, 0], 0.0]]],

  ['n:64/float-little',
   [[[24, 45, 68, 84, 251, 33, 9, 64], Math.PI],
    [[0, 0, 0, 0, 0, 0, 0, 0], 0.0]]],
  
  ['n:4/float-unit:8',
   [[[64,73,15,219], Math.PI],
    [[0, 0, 0, 0], 0.0]]]
];

suite("Float",
      function() {
        var precision = 0.00001;
        FLOAT_TESTS.forEach(function(p) {
          var pattern = parse(p[0]);
          var cpattern = compile(p[0]);
          p[1].forEach(function(tc) {
            test(p[0], function() {
              var m = match(pattern, new Buffer(tc[0]));
              assert.ok(m.n !== undefined);
              assert.ok(Math.abs(tc[1] - m.n) < precision);
            });
            test(p[0], function() {
              var m = cpattern(new Buffer(tc[0]));
              assert.ok(m.n !== undefined);
              assert.ok(Math.abs(tc[1] - m.n) < precision);
            });
          });
        });
      });

BINARY_TESTS = [
  ['n:0/unit:8-binary', []],
  ['n:1/unit:8-binary', [93]],
  ['n:5/unit:8-binary', [1, 2, 3, 4, 5]],
  ['n:32/unit:1-binary', [255, 254, 253, 252]]
];

suite("Binary",
      function() {
        BINARY_TESTS.forEach(function(p) {
          var pattern = parse(p[0]);
          var cpattern = compile(p[0]);
          var prest = p[0] + ', _/binary';
          var patternrest = parse(prest);
          var cpatternrest = compile(prest);
          test(p[0], function() {
            assert.deepEqual({n: new Buffer(p[1])},
                             match(pattern, new Buffer(p[1])));
            assert.deepEqual({n: new Buffer(p[1])},
                             cpattern(new Buffer(p[1])));
          });
          test(prest, function() {
            var plusgarbage = p[1].concat([5, 98, 23, 244]);
            assert.deepEqual({n: new Buffer(p[1])},
                             match(patternrest, new Buffer(plusgarbage)));
            assert.deepEqual({n: new Buffer(p[1])},
                             cpatternrest(new Buffer(plusgarbage)));
          });
        });
      });
