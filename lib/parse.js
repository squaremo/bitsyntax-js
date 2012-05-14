// Parse patterns in string form into the form we use for interpreting
// (and later, for compiling).

var ast = require('./pattern');

function compose() {
  var funcs = [].slice.call(arguments);
  return function(elem) {
    var result = elem;
    for (var i in funcs) {
      result = funcs[i](result);
    }
    return result;
  }
}

function map(array0, func) {
  var array = array0.slice();
  for (var i in array.slice()) {
    array[i] = func(array[i]);
  }
  return array;
}

function parse_pattern(string) {
  return map(
    string.split(','),
    compose(
      function(s) { return s.replace(/\s/g, ''); },
      parse_segment));
}

module.exports.parse = parse_pattern;

// From
// http://stackoverflow.com/questions/18082/validate-numbers-in-javascript-isnumeric
function isNumber(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

var PARTS = /^([_a-zA-Z0-9\.]*)(?:\:([a-zA-Z_0-9]+))?(?:\/([a-z0-9:-]*))?$/;
var STRING = /^"(([^"]|(\"))*)"$/;

function parse_segment(string) {
  var parts = STRING.exec(string);
  if (parts) {
    return ast.string(parts[1]);
  }
  parts = PARTS.exec(string);
  var nameOrValue = parts[1];
  var size = parts[2];
  var specifiers = (parts[3] || '').split('-');
  if (size !== undefined && isNumber(size)) {
    size = parseInt(size);
  }
  return ((isNumber(nameOrValue)) ?
          ast.value :
          ast.variable) (nameOrValue, size, specifiers);
}
