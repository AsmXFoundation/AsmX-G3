const TypeOfAtomicExpression = require("../types/expression.type");

class BuilderExpression {
  // builder import
  static buildImportInstruction(ast) {
    const node = { module: ast[0] };

    if (ast.length > 1) {
      node.alias = ast[2];
    }

    return node;
  }

  static buildExportInstruction(ast) {
    const node = { module: ast[0] };
    return node;
  }

  static buildFunctionalInstruction(nodes, attributes = []) {
    if (nodes.length == 1) {
      return { name: attributes[attributes.length - 1], body: nodes[0], attributes: attributes.slice(0, -1) };
    }

    const node = { name: nodes[0], body: nodes[1], attributes };
    return node;
  }

  static buildCallInstruction(ast) {
    return ast[0];
  }

  static buildReturnInstruction(ast) {
    return ast[0];
  }

  static buildVariableExpression(nodes) {
    let node = nodes[0];

    if (node.type == TypeOfAtomicExpression.ASSIGNMENT) {
      return node.body;
    } else if (node.type == TypeOfAtomicExpression.PROPERTY) {
      node = node.body;
      return { name: node.property, value: node.value };
    }

    return {};
  }

  static buildMathInstruction(nodes) {
    let node = nodes[0];

    if (node && node.type == TypeOfAtomicExpression.ARGUMENTS) {
      return node.body;
    } else {
      return { values: nodes };
    }
  }

  static buildBranchBlockInstruction(nodes, attributes = []) {
    return { name: attributes[attributes.length - 1], body: nodes[0], attributes: attributes.slice(0, -1) };
  }

  static getAttributes(ast) {
    const attributes = [];

    if (ast.length > 1) {
      let localIndex = 0;
      const peek = (i) => ast[i];

      while (localIndex < ast.length) {
        if (peek(localIndex).type == TypeOfAtomicExpression.CALL || peek(localIndex).type == TypeOfAtomicExpression.OBJECT) {
          break;
        } else {
          attributes.push(peek(localIndex));
          ast.shift();
        }
      }
    }

    return attributes;
  }

  static zcc_build_include_instruction(ast) {
    const ast_node = ast[0];
    const node = {};
    
    if (ast_node.type == TypeOfAtomicExpression.CALL) {
      node.path = ast_node.body.arguments[0].body;
      node.alias = ast_node.body.caller.body.identifer;
    } else if (ast_node.type == TypeOfAtomicExpression.MEMBER) {
      node.alias = null;
      node.path = ast_node.body;
    } else if (ast_node.type == TypeOfAtomicExpression.IDENTIFER) {
      node.alias = null;
      node.path = ast_node.body;
    }

    return node;
  }

  static zcc_build_section_instruction(ast) {
    ast = ast[0];
    const node = {};
    node.type = ast.body.inizializer.body.identifer.lexem;
    node.values = ast.body.values;
    return node;
  }

  static zcc_build_syscall_instruction(ast) {
    const node = {};
    
    if (ast.length == 0) {
      node.values = [];
    } else {
      const unwrap = ast[0].body.body[0];
      if (unwrap.type == TypeOfAtomicExpression.ARGUMENTS) {
        node.values = unwrap.body.values;
      } else {
        node.values = [unwrap];
      }
    }

    return node;
  }

  static zcc_build_fn_instruction(ast, attributes) {
    const node = {};

    if (ast.length == 1) {
      node.attributes = attributes.slice(0, -1);
      node.name = attributes[attributes.length - 1];
      node.arguments = null;

      if (ast[0].type == TypeOfAtomicExpression.OBJECT) {
        node.body = ast[0].body.body;
      }
    } else {
      node.attributes = attributes;
      node.name = ast[0].body.caller;
      node.arguments = ast[0].body.arguments;

      if (ast[1].type == TypeOfAtomicExpression.OBJECT) {
        node.body = ast[1].body.body;
      }
    }
    
    return node;
  }

  static zcc_build_generic_instruction(ast) {
    if (ast[0].type == TypeOfAtomicExpression.ARGUMENTS) {
      return ast[0].body.values;
    }
    return ast;
  }
}

module.exports = BuilderExpression;