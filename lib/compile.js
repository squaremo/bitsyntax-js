// Compile patterns to recognisers

require('buffer-more-ints');

var parse = require('./parse').parse;
var interp = require('./interp'),
  parse_int = interp.parse_int,
  parse_float = interp.parse_float;

function bits_expr(segment) {
  if (typeof segment.size === 'string') {
    return var_name(segment.size) + " * " + segment.unit;
  }
  else {
    return segment.size * segment.unit;
  }
}

function get_number(segment) {
  var expr = "bits = " + bits_expr(segment) + ";\n";
  var parser = (segment.type === 'integer') ? 'parse_int' : 'parse_float';
  var be = segment.bigendian, sg = segment.signed;
  return expr +
    "byteoffset = offset / 8; offset += bits\n" +
    "if (offset > binsize) { return false; }\n" +
    "else { result = " + parser +
    "(bin, byteoffset, bits, " + be + ", " + sg + "); }\n";
}

function get_binary(segment) {
  var expr = "byteoffset = offset / 8;\n";
  if (segment.size === true) {
    return expr + "offset = binsize;\n" +
      "result = bin.slice(byteoffset);\n";
  }
  else {
    expr += "bits = " + bits_expr(segment) + ";\n";
    expr += "offset += bits;\n";
    return expr + "if (offset > binsize) { return false; }\n" +
      "else { result = bin.slice(byteoffset, byteoffset + bits / 8); }\n";
  }
}

function get_string(segment) {
  var expr = "byteoffset = offset / 8;\n";
  var strlen = segment.value.length;
  var strlenbits = strlen * 8;
  expr += "offset += " + strlenbits + ";\n";
  return expr + "if (offset > binsize) { return false; }\n" +
    "else { result = bin.toString(byteoffset, byteoffset + " + strlen + "); }\n";
}

function skip_bits(segment) {
  if (typeof segment.size === 'string') {
    // Damn. Have to look up the size.
    var lookup = "var skipbits = " + var_name(segment.size) +
      " * " + segment.unit + ";\n";
    var test = "if (offset + skipbits > binsize) { return false; }\n" +
      "else { offset += skipbits; }\n";
    return lookup + test;
  }
  else if (segment.size === true) {
    return "if (offset % 8 === 0) { offset = binsize; }\n" +
      "else { return false; }\n";
  }
  else {
    var bits = segment.unit * segment.size;
    return "if (offset + " + bits + " > binsize) { return false; }\n" +
      "else { offset += " + bits + "; }\n";
  }
}

function match_seg(segment) {
  if (segment.name === '_') {
    return skip_bits(segment);
  }
  else {
    var assign_result;
    switch (segment.type) {
    case 'integer':
    case 'float':
      assign_result = get_number(segment);
      break;
    case 'binary':
      assign_result = get_binary(segment);
      break;
    case 'string':
      assign_result = get_string(segment);
      break;
    }
    var handle_result = "if (result === false) { return false; }\n";
    if (segment.name) {
      handle_result += "else { " + var_name(segment.name) + " = result; }\n";
    }
    else {
      var repr = JSON.stringify(segment.value);
      handle_result += "else if (result != " + repr + ") { return false; }\n";
    }
    return assign_result + handle_result;
  }
}

function var_name(name) {
  return  'var_' + name;
}

function variables(segments) {
  var names = [];
  for (var i = 0; i < segments.length; i++) {
    name = segments[i].name;
    if (name && name !== '_') {
      names.push(name);
    }
    name = segments[i].size;
    if (typeof name === 'string') {
      names.push(name);
    }
  }
  return names;
}

function compile_pattern(segments) {

  var len = segments.length;
  var func =
    "return function(binary, vars) {\n" +
    "var bin = binary, scope = vars || {};\n" +
    "var offset = 0, binsize = bin.length * 8;\n" +
    "var bits, result, byteoffset;\n";
  var varnames = variables(segments);
  var bindings = "";
  for (var v = 0; v < varnames.length; v++) {
    var name = varnames[v];
    func += "var " + var_name(name) + " = scope['" + name + "'];\n";
    bindings += "bindings['" + name + "'] = " + var_name(name) + ";\n";
  }

  for (var i = 0; i < len; i++) {
    var segment = segments[i];
    func += "// " + JSON.stringify(segment) + "\n";
    func += match_seg(segment);
  }

  func += "if (offset == binsize) {\n" +
    "var bindings = {};\n" + bindings +
    "return bindings; }\n";
  func += "else { return false; }\n";
  func += "}\n";

  return new Function('parse_int', 'parse_float', func)(parse_int, parse_float);
}

module.exports.compile_pattern = compile_pattern;
module.exports.compile = function(str) {
  str = (arguments.length > 1) ? [].join.call(arguments, ',') : str;
  var p = parse(str);
  return compile_pattern(p);
};
