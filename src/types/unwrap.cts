import { SemanticAnalyzer } from "../parsing/semantic_analyzer.cjs";
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
      case Syntax.Kind.SubscriptExpression:
        return get_start_token(tree_t.base);
      case Syntax.Kind.IfStatement:
        return get_start_token(tree_t.condition);
      case Syntax.Kind.WhileStatement:
        return get_start_token(tree_t.condition);
      case Syntax.Kind.JumpStatement:
        return get_start_token(tree_t.label);
      case Syntax.Kind.LabelStatement:
        return get_start_token(tree_t.name);
      case Syntax.Kind.ReturnStatement:
        return get_start_token(tree_t.expression);
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
      case Syntax.Kind.StructDeclaration:
        return get_start_token(tree_t.name);
      case Syntax.Kind.NamespaceDeclaration:
        return get_start_token(tree_t.name);
      case Syntax.Kind.EnumerationDeclaration:
        return get_start_token(tree_t.name);
      case Syntax.Kind.UnionDeclaration:
        return get_start_token(tree_t.name);
      case Syntax.Kind.InspectStatement:
        return get_start_token(tree_t.target);
      case Syntax.Kind.InspectCase:
        return get_start_token(tree_t.pattern);
      case Syntax.Kind.ThisLiteral:
        return get_start_token(tree_t.token);
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

  export namespace Operator {
    export enum Kind {
      BANG = "!",
      PLUS = "+",
      MINUS = "-",
      STAR = "*",
      SLASH = "/",
      PERCENT = "%",
      INCREMENT = "++",
      DECREMENT = "--",
      OR = "||",
      NOT = "!",
      LT = "<",
      LE = "<=",
      GT = ">",
      GE = ">=",
      EQ = "==",
      NE = "!=",
      OPERATOR_AND = "&&",
      OPERATOR_OR = "||",
      ASSIGN = "=",
      DOT = ".",
      SCOPE_RESOLUTION = "::",
      COMMA = ",",
      ASSIGN_PLUS = "+=",
      ASSIGN_MINUS = "-=",
      ASSIGN_STAR = "*=",
      ASSIGN_SLASH = "/=",
      ASSIGN_PERCENT = "%=",
    }

    export function is(target: StructToken | Syntax.NodeBase<any>, op: Kind): boolean {
      if (target instanceof StructToken) {
        return target.lexem === op;
      } else if (target instanceof Syntax.NodeBase && target.kind == Syntax.Kind.Identifier) {
        type TID = Syntax.RequiredNodeStructure<Syntax.Kind.Identifier>;
        const id: TID = target as TID;
        return id.operator?.lexem === op;
      }
      return false;
    }
  } // end of namespace Operator

  export function emit_name<N extends { name: unknown }>(node: N): EmitResult {
    return this.unwrap(node.name);
  }

  export function emit_identifier(analyzer: { namespacePath: string[] }, node: InstanceType<(typeof Syntax.Registry)[Syntax.Kind.Identifier]>): string {
    // 1. Unwrap generic wrappers (if it is a vector<T>, extract the vector itself)
    if (!node.operator && node.selector && node.selector.kind === Syntax.Kind.Identifier) {
      return emit_identifier(analyzer, node.selector as any);
    }

    let fn_name_raw = "";

    // 2. Recursively merge the left and right parts.
    if (node.operator && node.operator.lexem === "::") {
      const left = node.selector.kind === Syntax.Kind.Identifier 
        ? emit_identifier({ namespacePath: [] }, node.selector as any) 
        : UnwrapSyntax.unwrap(node.selector).raw;

      const right = node.forward!.kind === Syntax.Kind.Identifier 
        ? emit_identifier({ namespacePath: [] }, node.forward as any) 
        : UnwrapSyntax.unwrap(node.forward).raw;

      const partL = left === "this" ? "$anon" : left;
      fn_name_raw = partL + "__" + right;
    } else {
      // 3. Regular identifier
      fn_name_raw = UnwrapSyntax.unwrap(node).raw;
      if (fn_name_raw === "this") fn_name_raw = "$anon";
    }

    // 4. READ-TIME MANGLING: Apply ONLY to anonymous namespaces (this::)
    if (analyzer.namespacePath && analyzer.namespacePath.length > 0 && fn_name_raw.startsWith("$anon__")) {
      const ns_prefix = analyzer.namespacePath.join("__");
      fn_name_raw = ns_prefix + "__" + fn_name_raw;
    }

    return fn_name_raw;
  }

  export function unwrap(node): EmitResult {
    const token = UnwrapSyntax.get_start_token(node);
    return { token, raw: token.lexem };
  }
}

export {
  UnwrapSyntax
}