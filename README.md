# Byte-wise matching for Node.JS

Gives a compact syntax for parsing binary data, derived from [Erlang's
bit syntax](http://www.erlang.org/doc/programming_examples/bit_syntax.html#id64858).

    > var pattern = bitsyntax.parse('len:8/integer, string:len/binary');
    > var bound = bitsyntax.match(pattern, new Buffer([4, 0x41,0x42,0x43,0x44]));
    > bound.string
    <Buffer 41 42 43 44>

In the above, the first 8 bits of the input are treated as an unsigned
integer (by default, see the "signedness" specifier below) and
assigned to the variable `len`; then the next `len` bytes are treated
as a binary (i.e., a byte buffer) and assigned to the variable
`string`. The return value of `match` is an object mapping variable
names to matched values, or the boolean `false` meaning the match did
not succeed.

A typical use of this is parsing byte streams from sockets. For example,
size-prefixed frames:

    > var framePattern = bitsyntax.parse('len:32/integer, frame:len/binary, rest/binary');
    > socket.on('data', function process(data) {
        var m;
        if (m = bitsyntax.match(framePattern, data)) {
          this.emit('frame', m.frame);
          process(m.rest);
        }
        else {
          // stash the data somewhere and try matching again when more
          // comes in
        }
      });

## Patterns

Patterns are given as strings, with a comma-separated series of
segments. Each segment matches a particular kind of value, which
currently may be an integer or a binary (buffer). At the moment these
must be aligned on byte boundaries (Erlang's bit syntax doesn't have
this constraint in general).

Each segment has at least a literal value or variable name, a may have
a size. It may also have additional specifiers giving the type, the
endianness or signedness of an integer segment, and the unit in which
the size is given as a number of bits. These specifiers appear after a
forward-slash and are separated with hyphens. Here's an example of a
segment with specifiers:

    'foo:4/integer-little-unit:8-signed'

This will match thirty-two bits (size 4 * unit 8) and parse them as a
little-endian, signed integer. The full complement of specifiers is
explained in the following.

### Variable or value

The first part of a segment gives a variable name or a literal
value. If a variable name is given, the value matched by the segment
will be bound to that variable name for the rest of the pattern. If a
literal value is given, the matched value must equal that value.

The special variable name `_` discards the value matched; i.e., it
simply skips over the appropriate number of bits in the input.

### Size and unit

The size of a segment is given following the value or variable,
separated with a colon:

    foo:32

The unit is given in the list of specifiers as `'unit' and
an integer from 0..256, separated by a colon:

    foo:4/integer-unit:8

The size is the number of units in the value; the unit is given as a
number of bits. Unit can be of use, for example, when you want to
match integers of a number of bytes rather than a number of bits.

For integers and floats, the default unit is 1 bit; to keep things
aligned on byte boundaries, `unit * size` must currently be a multiple
of 8. For binaries the default unit is 8, and the unit must be a
multiple of 8.

If the size is omitted and the type is integer, the size defaults to
8. If the size is omitted and the type is binary, the segment will
match all remaining bytes in the input; such a segment may only be
used at the end of a pattern.

The size may also be given as an integer variable matched prior in the
pattern, as in the example given at the top.

### Type

One of `integer`, `binary`, (and coming soon) `float`. If not given, the
default is `integer`.

An integer is a big- or little-endian, signed or unsigned
integer. Integers up to 32 bits are supported. Signed integers are
two's complement format. In JavaScript, only integers between -(2^53)
and 2^53 can be represented, and bitwise operators are only defined on
32-bit signed integers.

A binary is simply a byte buffer; usually this will result in a slice
of the input buffer being returned, so beware mutation.

A float is a 32- or 64-bit IEEE754 floating-point value (this is
the standard JavaScript uses, as do Java and Erlang).

### Endianness

Integers may be big- or little-endian; this refers to which 'end' of
the bytes making up the integer are most significant. In network
protocols integers are usually big-endian, meaning the first
(left-most) byte is the most significant, but this is not always the
case.

A specifier of `big` means the integer will be parsed as big-endian,
and `little` means the integer will be parsed as little-endian. The
default is big-endian.

### Signedness

Integer segments may include a specifier of `signed` or `unsigned`. An
unsigned integer is parsed as two's complement format. The default is
unsigned.
