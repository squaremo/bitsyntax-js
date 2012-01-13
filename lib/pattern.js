// Constructing patterns

function contained(value, array) {
  return (array.indexOf(value) > -1);
}

function variable(name, size, specifiers) {
  var segment = {name: name};
  segment.type = type_in(specifiers);
  specs(segment, segment.type, specifiers);
  segment.size = size_of(segment, segment.type, size, segment.unit);
  return segment;
}

module.exports.variable = variable;
module.exports.rest = function() {
  return variable('_', true, ['binary']);
}

function value(val, size, specifiers) {
  var segment = {value: val};
  segment.type = type_in(specifiers);
  // TODO check type v value ..
  specs(segment, segment.type, specifiers);
  segment.size = size_of(segment, segment.type, size, segment.unit);
  return segment;
}

module.exports.value = value;

var TYPES = ['integer', 'binary', 'float', 'utf8'];
function type_in(specifiers) {
  for (var i in specifiers) {
    if (contained(specifiers[i], TYPES)) return specifier[i];
  }
  return 'integer';
}

function specs(segment, type, specifiers) {
  if (type == 'integer' || type == 'float') {
    segment.bigendian = endian_in(specifiers);
  }
  if (type == 'integer') {
    segment.signed = signed_in(specifiers);
  }
  segment.unit = unit_in(specifiers, segment.type);
  return segment;
}

function endian_in(specifiers) {
  // default is big, but I have chosen true = bigendian
  return !contained('little', specifiers);
}

function signed_in(specifiers) {
  // this time I got it right; default is unsigned
  return contained('signed', specifiers);
}

function unit_in(specifiers, type) {
  for (var i in specifiers) {
    var s = specifiers[i];
    if (s.substr(0, 5) == 'unit:') {
      var unit = parseInt(s.substr(5));
      // TODO check sane for type
      return unit;
    }
  }
  // OK defaults then
  switch (type) {
  case 'binary':
    return 8;
  case 'integer':
  case 'float':
    return 1;
  }
}

function size_of(segment, type, size, unit) {
  if (size) {
    return size;
  }
  else {
    switch (type) {
    case 'integer':
      return 8;
    case 'float':
      return 64;
    case 'binary':
      return true;
    }
  }
}
