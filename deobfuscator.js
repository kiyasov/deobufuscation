var esprima = require('esprima');
var estraverse = require('estraverse');
var escodegen = require('escodegen');

function shouldSwitchScope(node) {
  return node.type.match(/^Function(Express|Declarat)ion$/);
}

function main(fileName) {
  var code = require('fs').readFileSync(fileName).toString();
  var ast = esprima.parse(code);
  var strings = {};
  var scopeDepth = 0; // initial: global

  // pass 1: extract all strings
  estraverse.traverse(ast, {
    enter: function(node) {
	  if (shouldSwitchScope(node)) {
	    scopeDepth++;
	  }
	  
      if (scopeDepth == 0 &&
		node.type === esprima.Syntax.VariableDeclarator &&
        node.init &&
        node.init.type === esprima.Syntax.ArrayExpression &&
		node.init.elements.every(function(e) {return e.type === esprima.Syntax.Literal})) {
        strings[node.id.name] = node.init.elements.map(function(e) {
          return e.value;
        });
        this.skip();
      }
    },
	leave: function(node) {
      if (shouldSwitchScope(node)) {
		scopeDepth--;
	  }
	}
  });

  // pass 2: restore code
  ast = estraverse.replace(ast, {
    enter: function(node) {
    },
	leave: function(node) {
	  // restore strings
	  if (node.type === esprima.Syntax.MemberExpression &&
        node.computed &&
        strings.hasOwnProperty(node.object.name) &&
        node.property.type === esprima.Syntax.Literal
      ) {
        var val = strings[node.object.name][node.property.value];
        return {
          type: esprima.Syntax.Literal,
          value: val,
          raw: val
        }
      }
	  
	  if (node.type === esprima.Syntax.MemberExpression &&
        node.property.type === esprima.Syntax.Literal &&
        typeof node.property.value === 'string'
      ) {
        return {
          type: esprima.Syntax.MemberExpression,
          computed: false,
          object: node.object,
          property: {
            type: esprima.Syntax.Identifier,
            name: node.property.value
          }
        }
      }
	}
  });

  console.log(escodegen.generate(ast));
}

main(process.argv[2]);