// Interpreter for bit syntax AST.
// Grammar:
//
// pattern   := segment segment*
// segment   := (value | var) (":" size)? ("/" specifier ("-" specifier)*)?
// var       := "_" | identifier
// size      := integer
// specifier := "little" | "big" | "signed" | "unsigned" | "unit" ":" 0..256 | type
// type      := "integer" | "binary" | "float" | "utf8"
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
//    size: integer | "all",
//    name: string | null, // (may be '_')
//    value: value | null, // either name OR value
//    unit: integer,
//    signed: boolean,
//    bigendian: boolean
// }

var FAIL = false;

function parse_int(binary, byteoffset, sizeinbits, bigendian, signed) {
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
    msb = Math.pow(2, sizeinbits - 1);
    if (raw > msb) {
      raw = -((msb * 2) - raw);
    }
  }
  return raw;
}
if (process.env.DEBUG || process.env.TEST) {
  module.exports.parse_int = parse_int;
}

function match(pattern, binary, freevars) {
  var offset = 0, boundvars = {};
  var binsize = binary.length * 8;

  function skip_bits(segment) {
    if (segment.size === 'all') {
      if (offset % 8 === 0) {
        offset = binsize;
        return true;
      }
      else {
        return false;
      }
    }

    var bits = segment.unit * segment.size;
    if (offset + bits > binsize) {
      return false;
    }
    else {
      offset += bits;
    }
  }

  function get_integer(segment) {
    // let's do only multiples of eight bits for now
    var unit = segment.unit, size = segment.size;
    var bitsize = size * unit;
    if (bitsize % 8 > 0 || ((offset + bitsize) > binsize)) {
      return false;
    }
    else {
      var byteoffset = offset / 8; // NB assumes aligned
      // TODO is using a switch faster
      // TODO use buffer 'int16...' etc. methods if possible
      offset += size * unit;
      return parse_int(binary, byteoffset, bitsize, segment.bigendian, segment.signed);
    }
  }

  function get_binary(segment) {
    var unit = segment.unit, size = segment.size;
    var byteoffset = offset / 8; // NB alignment
    if (segment.size == 'all') {
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

  for (i in pattern) {
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
    return boundvars;
  }
  else {
    return FAIL;
  }
}

module.exports.match = match;
