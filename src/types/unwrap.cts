import { Syntax } from "./expression.cjs";
import { StructToken } from "./token.cjs";

type EmitResult = {
  token: StructToken,
  raw: string
}

namespace UnwrapSyntax {
  export function get_start_token<T extends Syntax.Kind>(tree: StructToken | Syntax.NodeShape<T> | InstanceType<(typeof Syntax.Registry)[T]>): StructToken {
    if (tree instanceof Syntax.NodeShape) {
      return tree.token;
    }

    if (tree instanceof StructToken) {
      return tree;
    }

    const tree_t: Syntax.Node<T> = tree as any;
    switch (tree_t.kind) {
      case Syntax.Kind.UnaryExpression:
        return tree_t.operator;
      case Syntax.Kind.BinaryExpression:
        return get_start_token(tree_t.left);
      case Syntax.Kind.Instruction:
        return get_start_token(tree_t.name);
      case Syntax.Kind.List:
        if (tree_t.name) return get_start_token(tree_t.name);
        if (tree_t.open) return tree_t.open;
        if (tree_t.elements && tree_t.elements.length > 0) return get_start_token(tree_t.elements[0]);
        return null;
      case Syntax.Kind.Generics:
        if (tree_t.open) return tree_t.open;
        if (tree_t.elements && tree_t.elements.length > 0) return get_start_token(tree_t.elements[0]);
        return null;
      case Syntax.Kind.Identifier:
        if (tree_t.prefix) return tree_t.prefix;
        return get_start_token(tree_t.selector);
      case Syntax.Kind.Literal:
        if (tree_t.prefix) return tree_t.prefix;
        // return get_start_token(tree_t.value);
        return tree_t.value;
      case Syntax.Kind.Call:
        return get_start_token(tree_t.caller);
      case Syntax.Kind.SectionFieldDecl:
        return get_start_token(tree_t.name);
      case Syntax.Kind.ImplicitCastExpression:
        return get_start_token(tree_t.castType);
      case Syntax.Kind.VariableDeclaration: {
        if (tree_t.modifiers[0]) return tree_t.modifiers[0];
        if (tree_t.typeNode) return get_start_token(tree_t.typeNode);
        return null;
      }
      case Syntax.Kind.FunctionDeclaration: {
        if (tree_t.modifiers[0]) return tree_t.modifiers[0];
        if (tree_t.qualifier) return tree_t.qualifier;
        if (tree_t.name) return get_start_token(tree_t.name);
        return null;
      }
      case Syntax.Kind.ParameterDeclaration: {
        if (tree_t.modifiers[0]) return tree_t.modifiers[0];
        if (tree_t.pointers) return tree_t.pointers[0];
        if (tree_t.reference) return tree_t.reference;
        if (tree_t.typeNode) return get_start_token(tree_t.typeNode);
        if (tree_t.name) return get_start_token(tree_t.name);
        return null;
      }
      case Syntax.Kind.Block:
        return get_start_token(tree_t.statements[0]);
      default:
        break;
    }
  }

  export function emit_name<N extends {name: unknown}>(node: N): EmitResult {
    return this.unwrap(node.name);
  }

  export function unwrap(node): EmitResult {
    const token = UnwrapSyntax.get_start_token(node);
    return { token, raw: token.lexem };
  }
}

export {
  UnwrapSyntax
}