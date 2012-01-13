// Compile patterns to recognisers, and groups of patterns to dispatch
// procedures.

//var jsp = require('uglify-js').parser;
//var gen = require('uglify-js').uglify.gen_code;

var interp = require('./interp'),
  parse_int = interp.parse_int,
  size_of = interp.size_of,
  new_scope = interp.new_scope,
  bindings = interp.bindings;
var parse = require('./parse').parse;

var FAIL = false;

function compile_pattern(pattern) {
  function match(binary, env) {
    var offset = 0;
    var boundvars = new_scope(env);
    var binsize = binary.length * 8;

    function skip_bits(segment) {
      var size = size_of(segment, boundvars);
      if (size === true) {
        if (offset % 8 === 0) {
          offset = binsize;
          return true;
        }
        else {
          return false;
        }
      }

      var bits = segment.unit * size;
      if (offset + bits > binsize) {
        return false;
      }
      else {
        offset += bits;
      }
    }

    function get_integer(segment) {
      // let's do only multiples of eight bits for now
      var unit = segment.unit, size = size_of(segment, boundvars);
      var bitsize = size * unit;
      var byteoffset = offset / 8; // NB assumes aligned
      offset += size * unit;
      if (bitsize % 8 > 0 || (offset > binsize)) {
        return false;
      }
      else {
        return parse_int(binary, byteoffset, bitsize,
                         segment.bigendian, segment.signed);
      }
    }

    function get_binary(segment) {
      var unit = segment.unit, size = size_of(segment, boundvars);
      var byteoffset = offset / 8; // NB alignment

      if (size === true) {
        offset = binsize;
        return binary.slice(byteoffset);
      }
      else {
        var bitsize = size * unit;
        if (bitsize % 8 > 0 || (offset + bitsize) > binsize) {
          return false;
        }
        else {
          offset += bitsize;
          return binary.slice(byteoffset, byteoffset + bitsize / 8);
        }
      }
    }

    for (var i in pattern) {
      var segment = pattern[i];
      var result = false;
      if (segment.name === '_') {
        result = skip_bits(segment);
      }
      else {
        switch (segment.type) {
        case 'integer':
          result = get_integer(segment);
          break;
          // case 'float':
          //   result = get_float(segment);
          //   break;
        case 'binary':
          result = get_binary(segment);
          break;
        }
        if (result === false) {
          return FAIL;
        }
        else if (segment.name) {
          boundvars[segment.name] = result;
        }
        else if (segment.value != result) {
          return FAIL;
        }
      }
    }
    if (offset == binsize) {
      return bindings(boundvars);
    }
    else {
      return false;
    }
  }

  return new Function('match', "return function(binary, vars) { return match(binary, vars); };")(match);
}

module.exports.compile_pattern = compile_pattern;
module.exports.compile = function(str) {
  var p = parse(str);
  return compile_pattern(p);
};
