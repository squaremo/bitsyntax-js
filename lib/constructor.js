// -*- js-indent-level: 2 -*-

// Constructors given patterns

// Interpret the pattern, writing values into a buffer
function write(buf, offset, pattern, bindings) {
  for (var i=0, len = pattern.length; i < len; i++) {
    var segment = pattern[i];
    switch (segment.type) {
    case 'string':
      var str = segment.value;
      buf.write(str, offset);
      offset += Buffer.byteLength(str);
      break;
    case 'binary':
      // must be a variable reference
      var bin = bindings[segment.name];
      var size = segment.size;
      size = (size === true) ? bin.length : size;
      bin.copy(buf, offset, 0, size);
      offset += size;
      break;
    case 'integer':
      writeInteger(segment, buf, offset, bindings);
      offset += (segment.size * segment.unit) / 8;
      break;
    case 'float':
      writeFloat(segment, buf, offset, bindings);
      offset += (segment.size * segment.unit) / 8;
      break;
    }
  }
  return offset;
}

function construct(pattern, bindings) {
  var bufsize = size_of(pattern, bindings);
  var buf = new Buffer(bufsize);
  write(buf, 0, pattern, bindings);
  return buf;
}

// size of the to-be-constructed binary, in bytes
function size_of(segments, bindings) {
  var size = 0;
  for (var i=0, len = segments.length; i < len; i++) {
    var segment = segments[i];
    if (segment.type === 'string') {
      size += segment.value.length; // FIXME encoding
    }
    else if (segment.size === true) {
      var val = bindings[segment.name];
      size += val.length;
    }
    else {
      size += (segment.size * segment.unit) / 8;
    }
  }
  return size;
}

// TODO in ff might use the noAssert argument to Buffer.write*() but
// need to check that it does the right thing wrt little-endian

function writeInteger(segment, buf, offset, bindings) {
  var value = (segment.name) ? bindings[segment.name] : segment.value;
  var size = segment.size * segment.unit, mod = segment.mod;
  if(mod){
    value = value * Math.pow(10, mod);
  }
  switch (size) {
  case 8:
    buf.writeUInt8(value, offset);
    break;
  case 16:
    (segment.bigendian) ?
      buf.writeUInt16BE(value, offset) :
      buf.writeUInt16LE(value, offset);
    break;
  case 32:
    (segment.bigendian) ?
      buf.writeUInt32BE(value, offset) :
      buf.writeUInt32LE(value, offset);
    break;
  case 64:
    (segment.bigendian) ?
      buf.writeUInt64BE(value, offset) :
      buf.writeUInt64LE(value, offset);
    break;
  default:
    throw new Error("integer size * unit must be 8, 16, 32 or 64");
  }
}

function writeFloat(segment, buf, offset, bindings) {
  var value = (segment.name) ? bindings[segment.name] : segment.value;
  var size = segment.size * segment.unit;
  if (size === 32) {
    (segment.bigendian) ?
      buf.writeFloatBE(value, offset) :
      buf.writeFloatLE(value, offset);
  }
  else if (size === 64) {
    (segment.bigendian) ?
      buf.writeDoubleBE(value, offset) :
      buf.writeDoubleLE(value, offset);
  }
  else {
    throw new Error("float size * unit must be 32 or 64");
  }
}

var parse = require('./parse').parse;

module.exports.write = write;
module.exports.construct = construct;
module.exports.constructor = function(pstr) {
  pstr = (arguments.length > 1) ? [].join.call(arguments, ',') : pstr;
  var pattern = parse(pstr);
  return function(vars) {
    return exports.construct(pattern, vars);
  };
};
