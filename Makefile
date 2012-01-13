.PHONY: test

# Current node leaks a variable 'val' in Buffer.readInt16LE
GLOBALS_IGNORE=val

node_modules/mocha: node_modules/%:
	npm install $(@F)

test: node_modules/mocha
	./node_modules/.bin/mocha --globals $(GLOBALS_IGNORE) -u tdd
