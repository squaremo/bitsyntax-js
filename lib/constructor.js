// -*- js-indent-level: 2 -*-

// Constructors given patterns

'use strict';

var ints = require('buffer-more-ints');

// Interpret the pattern, writing values into a buffer
function write(buf, offset, pattern, bindings) {
  for (var i=0, len = pattern.length; i < len; i++) {
    var segment = pattern[i];
    
    switch (segment.type) {
    case 'string':
      if(segment.value != undefined){
        offset += buf.write(segment.value, offset, 'utf8');
      }else{
        if (bindings[segment.name] == undefined) {
            throw new Error("Missing value for pattern variable:" + segment.name + "!");
        }
        var val = bindings[segment.name].toString();
        if (segment.left != undefined || segment.right != undefined) {
          var padChar = segment.space != undefined ? ' ' : '0';
          var padDirection = segment.right != undefined ? 'right' : 'left';
          val = paddString(val, padChar, segment.size, padDirection);
        }
        if (segment.hex) {
          val = (new Buffer(val)).toString('hex'); 
        } else if (segment.binary) {
          var resString = '';
          for(var c = 0; c < val.length; c++) {
            var chr = val.charCodeAt(c);
            resString += paddString(chr.toString(2), '0', 8, 'left');;
          }
          val = resString;
        } 
        offset += buf.write(val, offset, 'utf8');
        if (segment.z) {
            offset += buf.writeUInt8(0, offset);
        }
      }
      
      break;
    case 'binary':
      offset += writeBinary(segment, buf, offset, bindings);
      break;
    case 'integer':
      offset += writeInteger(segment, buf, offset, bindings);
      break;
    case 'float':
      offset += writeFloat(segment, buf, offset, bindings);
      break;
    case 'bcd':
      offset += writeBcd(segment, buf, offset, bindings);
      break;
    }
  }
  return offset;
}

function build(pattern, bindings) {
  var bufsize = size_of(pattern, bindings);
  var buf = new Buffer(bufsize);
  write(buf, 0, pattern, bindings);
  return buf;
}

// In bytes
function size_of_segment(segment, bindings) {
  // size refers to a variable
  if (typeof segment.size === 'string') {
    return (bindings[segment.size] * segment.unit) / 8;
  }
  if (segment.type === 'binary' && segment.size === null) {
    var val = bindings[segment.name];
    return val.length;
  }
  if (segment.type === 'string' || segment.type === 'binary') {
    if (segment.z) {
      var realSize = bindings[segment.name].length;
      if (realSize > segment.size) {
        throw new Error("Real segment size is greater then defined for type " + segment.type + "-z segment name " + segment.name);
        return;
      }
      return realSize + 1;
    }
    if (segment.type === 'string') {
      return segment.value != undefined ? Buffer.byteLength(segment.value, 'utf8') : (segment.size * segment.unit) / 8;
    }
  }
  
  return (segment.size * segment.unit) / 8;
}

// size of the to-be-constructed binary, in bytes
function size_of(segments, bindings) {
  var size = 0;
  for (var i=0, len = segments.length; i < len; i++) {
    size += size_of_segment(segments[i], bindings);
  }
  return size;
}

function writeBinary(segment, buf, offset, bindings) {
  var bin = bindings[segment.name];
  var size = size_of_segment(segment, bindings);
  bin.copy(buf, offset, 0, size);
  if (segment.z) {
    buf.writeUInt8(0, (offset+size-1));
  }
  return size;
}

// TODO in ff might use the noAssert argument to Buffer.write*() but
// need to check that it does the right thing wrt little-endian

function writeInteger(segment, buf, offset, bindings) {
  var value = (segment.name) ? bindings[segment.name] : segment.value;
  var size = size_of_segment(segment, bindings);
  return write_int(buf, value, offset, size, segment.bigendian);
}

function write_int(buf, value, offset, size, bigendian) {
  switch (size) {
  case 1:
    buf.writeUInt8(value, offset);
    break;
  case 2:
    (bigendian) ?
      buf.writeUInt16BE(value, offset) :
      buf.writeUInt16LE(value, offset);
    break;
  case 4:
    (bigendian) ?
      buf.writeUInt32BE(value, offset) :
      buf.writeUInt32LE(value, offset);
    break;
  case 8:
    (bigendian) ?
      ints.writeUInt64BE(buf, value, offset) :
      ints.writeUInt64LE(buf, value, offset);
    break;
  default:
    throw new Error("integer size * unit must be 8, 16, 32 or 64");
  }
  return size;
}

function writeFloat(segment, buf, offset, bindings) {
  var value = (segment.name) ? bindings[segment.name] : segment.value;
  var size = size_of_segment(segment, bindings);
  return write_float(buf, value, offset, size, segment.bigendian);
}

function write_float(buf, value, offset, size, bigendian) {
  if (size === 4) {
    (bigendian) ?
      buf.writeFloatBE(value, offset) :
      buf.writeFloatLE(value, offset);
  }
  else if (size === 8) {
    (bigendian) ?
      buf.writeDoubleBE(value, offset) :
      buf.writeDoubleLE(value, offset);
  }
  else {
    throw new Error("float size * unit must be 32 or 64");
  }
  return size;
}

function writeBcd(segment, buf, offset, bindings) {
  var value = (segment.name) ? bindings[segment.name] : segment.value;
  var size = size_of_segment(segment, bindings);
  if (value.toString().length > (size * 2)) {
    throw new Error("bcd integer size is greater the pattern segment size of segment name " + segment.name);
  }
  var resBuf = intToBcd(value, segment.size);
  resBuf.copy(buf, offset)
  return size;
}

function intToBcd(val, lngth) {
  var s = parseInt(val);
  var len = lngth;
  var bu = new Buffer(len);
  len--;
  while (len >= 0) {
    var b = (s % 10);
    bu[len] = b;
    s = (s - b) / 10;
    var c = (s % 10);
    bu[len] += (c << 4);
    s = (s - c) / 10;
    len--;
  }
  return bu;
}

function paddString(value, char, totalLength, direction) {
  value = value.toString();
  if (char.length == 0 || totalLength == 0 || typeof (totalLength) != "number" || value.length >= totalLength) {
    return value;
  }
  var paddingValue = '';
  for (var i = 0; i < (totalLength - value.length); i++) {
    paddingValue += char.toString();
  }
  
  return direction == "left" ? String(paddingValue + value) : String(value + paddingValue);
};

var parse = require('./parse').parse;

module.exports.write = write;
module.exports.build = build;
module.exports.write_int = write_int;
module.exports.write_float = write_float;
module.exports.paddString = paddString;

module.exports.builder = function(pstr) {
  pstr = (arguments.length > 1) ? [].join.call(arguments, ',') : pstr;
  var pattern = parse(pstr);
  return function(vars) {
    return build(pattern, vars);
  };
};
