// Parse patterns in string form into the form we use for interpreting
// (and later, for compiling).

var peg = require('pegjs'),
ast = require('./pattern'),
path = require('path');

var grammar = require('fs').readFileSync(
  path.join(path.dirname(module.filename), 'grammar.pegjs')).toString();
var parser = peg.buildParser(grammar);

function parse_pattern(string) {
  var segments = parser.parse(string);
  for (var i=0, len = segments.length; i < len; i++) {
    var s = segments[i];
    if (s.string != undefined) {
      segments[i] = ast.string(s.string);
    }
    else if (s.value != undefined) {
      segments[i] = ast.value(s.value, s.size, s.specifiers);
    }
    else if (s.name != undefined) {
      segments[i] = ast.variable(s.name, s.size, s.specifiers);
    }
    else {
      throw "Unknown segment " + s;
    }
  }
  return segments;
}

module.exports.parse = function(str) {
  str = (arguments.length > 1) ? [].join.call(arguments, ',') : str;
  return parse_pattern(str);
};
