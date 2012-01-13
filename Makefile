.PHONY: test

# Current node leaks a variable 'val' in Buffer.readInt16LE
GLOBALS_IGNORE=val

node_modules/mocha: node_modules/%:
	-mkdir -p node_modules
	npm install $(@F)

test: node_modules/mocha
	./node_modules/.bin/mocha -R list --globals $(GLOBALS_IGNORE) -u tdd
