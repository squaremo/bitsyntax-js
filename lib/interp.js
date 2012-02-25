// Interpreter for bit syntax AST.
// Grammar:
//
// pattern   := segment ("," segment)*
// segment   := (value | var) (":" size)? ("/" specifier ("-" specifier)*)?
// var       := "_" | identifier
// size      := integer | var
// specifier := "little" | "big" | "signed" | "unsigned" | "unit" ":" 0..256 | type
// type      := "integer" | "binary" | "float"
//
// where integer has the obvious meaning, and identifier is anything
// other than "_" that fits the JavaScript identifier specification.
//
// TODO default specifiers, restrictions on specifiers, tail match,
// free variables.

// We'll use an object to represent each segment, and an array of
// segments for a pattern. We won't try to optimise for groups of
// patterns; we'll just step through each to see if it works. We rely
// a prior step to validate that it's a valid pattern.

// ? compile to intermediate instructions ?

// A segment looks like
// {
//    type: string,
//    size: integer | true, // true means 'all remaining'
//    name: string | null, // (may be '_')
//    value: value | null, // either name OR value
//    unit: integer,
//    signed: boolean,
//    bigendian: boolean
// }


var debug = (process.env.DEBUG) ?
  function(s) { console.log(s); } : function () {};

function base_parse_int(binary, byteoffset, sizeinbits, bigendian, signed) {
  var size = sizeinbits / 8;
  var raw = 0, buffer = binary.slice(byteoffset);
  if (bigendian) {
    var s = size - 1;
    for (var i = 0; i < size; i++) {
      raw += (buffer[i] << ((s - i) * 8));
    }
  }
  else {
    for (var i = 0; i < size; i++) {
      raw += (buffer[i] << (i * 8));
    } while (++i < size);
  }
  if (signed) {
    var msb = Math.pow(2, sizeinbits - 1);
    if (raw > msb) {
      raw = -((msb * 2) - raw);
    }
  }
  return raw;
}

function node0_6_parse_int(bin, off, sizeinbits, bigendian, signed) {
  switch (sizeinbits) {
  case 8:
    return (signed) ?
      bin.readInt8(off) :
      bin.readUInt8(off);
  case 16:
    if (bigendian) {
      return (signed) ? bin.readInt16BE(off) : bin.readUInt16BE(off);
    }
    else {
      return (signed) ? bin.readInt16LE(off) : bin.readUInt16LE(off);
    }
  case 32:
    if (bigendian) {
      return (signed) ? bin.readInt32BE(off) : bin.readUInt32BE(off);
    }
    else {
      return (signed) ? bin.readInt32LE(off) : bin.readUInt32LE(off);
    }
  default:
    return base_parse_int(bin, off, sizeinbits, bigendian, signed);
  }
}

var parse_int = (Buffer.prototype.readInt8) ?
  node0_6_parse_int : base_parse_int;
if (process.env.DEBUG || process.env.TEST) {
  module.exports.parse_int = parse_int;
}

function node0_6_parse_float(bin, off, sizeinbits, bigendian) {
  switch (sizeinbits) {
  case 32:
    return (bigendian) ? bin.readFloatBE(off) : bin.readFloatLE(off);
  case 64:
    return (bigendian) ? bin.readDoubleBE(off) : bin.readDoubleLE(off);
  default:
    throw "Floats must be 32- or 64-bit";
  }
}

function jspack_parse_float(bin0, off, sizeinbits, bigendian) {
  var bytes;
  var format;
  var bin = bin0.slice(off);
  switch (sizeinbits) {
  case 32:
    bytes = new Array(4);
    bytes[0] = bin[0];
    bytes[1] = bin[1];
    bytes[2] = bin[2];
    bytes[3] = bin[3];
    format = 'f';
    break;
  case 64:
    bytes = new Array(8);
    bytes[0] = bin[0];
    bytes[1] = bin[1];
    bytes[2] = bin[2];
    bytes[3] = bin[3];
    bytes[4] = bin[4];
    bytes[5] = bin[5];
    bytes[6] = bin[6];
    bytes[7] = bin[7];
    format = 'd';
    break;
  default:
    throw "Floats must be 32- or 64-bit";
  }
  format = ((bigendian) ? '>' : '<') + format;
  return require('jspack').jspack.Unpack(format, bytes, 0);
}

// It probably makes little odds in speed whether we use jspack or
// in-built functions; however, if I can avoid a dependency that's
// good, and it may be that the in-built functions are reimplemented
// in C in the future.

var parse_float = (Buffer.prototype.readFloatBE) ?
  node0_6_parse_float : jspack_parse_float;


function size_of(segment, bound) {
  var size = segment.size;
  if (typeof size === 'string') {
    return bound[size];
  }
  else {
    return size;
  }
}

function new_scope(env) {
  function scope() {};
  scope.prototype = env;
  return new scope();
}

function bindings(scope) {
  var s = {};
  for (var k in scope) {
    if (scope.hasOwnProperty(k)) {
      s[k] = scope[k];
    }
  }
  return s;
}

function match(pattern, binary, boundvars) {
  var offset = 0, vars = new_scope(boundvars);
  var binsize = binary.length * 8;

  function skip_bits(segment) {
    debug("skip bits"); debug(segment);
    var size = size_of(segment, vars);
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
    debug("get_integer"); debug(segment);
    // let's do only multiples of eight bits for now
    var unit = segment.unit, size = size_of(segment, vars);
    var bitsize = size * unit;
    var byteoffset = offset / 8; // NB assumes aligned
    offset += bitsize;
    if (bitsize % 8 > 0 || (offset > binsize)) {
      return false;
    }
    else {
      return parse_int(binary, byteoffset, bitsize,
                       segment.bigendian, segment.signed);
    }
  }

  function get_float(segment) {
    debug("get_float"); debug(segment);
    var unit = segment.unit; var size = size_of(segment, vars);
    var bitsize = size * unit;
    var byteoffset = offset / 8; // assume aligned
    offset += bitsize;
    if (offset > binsize) {
      return false;
    }
    else {
      return parse_float(binary, byteoffset, bitsize, segment.bigendian);
    }
  }

  function get_binary(segment) {
    debug("get_binary"); debug(segment);
    var unit = segment.unit, size = size_of(segment, vars);
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

  var patternlen = pattern.length;
  for (var i = 0;  i < patternlen; i++) {
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
      case 'float':
        result = get_float(segment);
        break;
      case 'binary':
        result = get_binary(segment);
        break;
      }

      if (result === false) {
        return false;
      }
      else if (segment.name) {
        vars[segment.name] = result;
      }
      else if (segment.value != result) {
        return false;
      }
    }
  }
  if (offset == binsize) {
    return bindings(vars);
  }
  else {
    return false;
  }
}

module.exports.match = match;
module.exports.parse_int = parse_int;
module.exports.parse_float = parse_float;
