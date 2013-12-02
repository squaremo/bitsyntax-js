.PHONY: test all

GRAMMAR=lib/grammar.pegjs

all: lib/parser.js

lib/parser.js:
	./node_modules/pegjs/bin/pegjs $(GRAMMAR) $@

test: lib/parser.js
	./node_modules/.bin/mocha --check-leaks -R list -u tdd test/*.js
