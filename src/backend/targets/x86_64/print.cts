import { Syntax } from "../../../types/expression.cjs";
import { StructToken, Token } from "../../../types/token.cjs";

import Color from "../../../utils/color.js";

type NodeType = { node: Syntax.NodeBase<any>, role: string };

class PrintTree {
  static verbose: boolean = false;
  static C = {
    kind: Color.FG_CYAN + Color.BRIGHT,
    line: Color.FG_GRAY,
    identifier: Color.FG_YELLOW,
    literal: Color.FG_MAGENTA,
    operator: Color.FG_RED,
    number: Color.FG_BLUE,
    reset: Color.RESET,
    dim: Color.DIM,
  };

  static isNode(obj: any): obj is Syntax.NodeBase<any> {
    return obj && typeof obj === 'object' && 'kind' in obj &&
      typeof obj.kind === 'number' && obj.kind in Syntax.Kind;
  }

  static print_node(data: StructToken | Syntax.NodeBase<any> | Array<any>): void {
    const TranslationUnitDecl = `${this.C.kind}TranslationUnitDecl${this.C.reset}`;
    if (Array.isArray(data)) {
      console.log(TranslationUnitDecl);
      for (let i = 0; i < data.length; i++) {
        const node = data[i];
        const last = i === data.length - 1;
        if (this.isNode(node)) {
          this.#print_tree(node, "", last);
        } else {
          console.log(`${this.#getPrefix(1, last)} <unknown non-node>`);
        }
      }
    } else if (this.isNode(data)) {
      console.log(TranslationUnitDecl);
      this.#print_tree(data, "", true);
    } else if (data instanceof StructToken) {
      const typeName = Token[data.type] || `Token#${data.type}`;
      console.log(`Token: ${typeName} '${data.lexem}' at line ${data.line}`);
    } else {
      console.log("Unknown node type");
    }
  }

  static #print_tree(node, prefix: string, isLast: boolean, role?: string): void {
    const roleStr = (this.verbose && role) ? `${role} ` : '';
    const description = roleStr + this.#describeNode(node);
    console.log(prefix + (isLast ? '`-' : '|-') + description);

    const children = this.#collectChildren(node);
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const last = i === children.length - 1;
      const newPrefix = prefix + (isLast ? '  ' : '| ');
      // @ts-ignore
      this.#print_tree(child.node, newPrefix, last, child.role);
    }
  }

  static #getPrefix(depth: number, isLast: boolean): string {
    if (depth === 0) return '';
    let result = '';
    for (let i = 0; i < depth - 1; i++) {
      // result += '| ';
      result += " │ ";
    }
    // result += isLast ? '`-' : '|-';
    result += isLast ? ' `-' : ' ├─ ';
    return result;
  }

  static #getTokenFromNode(node: any): StructToken | undefined {
    if (!node) return undefined;
    if (node.token instanceof StructToken) return node.token;
    if (node.value && this.isNode(node.value)) return this.#getTokenFromNode(node.value);
    if (node.selector && this.isNode(node.selector)) return this.#getTokenFromNode(node.selector);
    if (node.operand && this.isNode(node.operand)) return this.#getTokenFromNode(node.operand);
    return undefined;
  }

  static #describeNode(node: Syntax.NodeBase<any>): string {
    const kindName = Syntax.Kind[node.kind] || `Kind#${node.kind}`;
    let desc = this.C.kind + kindName + this.C.reset;

    const token = this.#getTokenFromNode(node);
    if (token && token.line !== undefined) {
      desc += ` ${this.C.line}<line:${token.line} col:${token.current}>${this.C.reset}`;
    }

    switch (node.kind) {
      case Syntax.Kind.Identifier: {
        const name = this.#getIdentifierName(node);
        if (name) {
          desc += ` ${this.C.identifier}'${name}'${this.C.reset}`;
        } else {
          const directToken = this.#getTokenFromNode(node);
          if (directToken && directToken.lexem) {
            desc += ` ${this.C.identifier}'${directToken.lexem}' (direct)${this.C.reset}`;
          } else {
            const parts = this.#countIdentifierParts(node);
            desc += ` ${this.C.dim}(${parts}-part, no token)${this.C.reset}`;
          }
        }
        break;
      }

      case Syntax.Kind.Literal: {
        if (node.type !== undefined && node.type !== null) {
          const typeName = Syntax.Type[node.type] || `Type#${node.type}`;
          desc += ` ${this.C.dim}${typeName}${this.C.reset}`;
        }
        const valueNode = (node as any).value;
        if (valueNode && this.isNode(valueNode)) {
          const valToken = this.#getTokenFromNode(valueNode);
          if (valToken && valToken.lexem !== undefined) {
            desc += ` ${this.C.literal}${JSON.stringify(valToken.lexem)}${this.C.reset}`;
          } else {
            desc += ` ${this.C.dim}(nested literal)${this.C.reset}`;
          }
        } else {
          const litToken = this.#getTokenFromNode(node);
          if (litToken && litToken.lexem !== undefined) {
            desc += ` ${this.C.literal}${JSON.stringify(litToken.lexem)}${this.C.reset}`;
          } else {
            desc += ` ${this.C.dim}(no value)${this.C.reset}`;
          }
        }
        break;
      }

      case Syntax.Kind.Instruction: {
        const instrNode = node as Syntax.Node<Syntax.Kind.Instruction>;
        if (instrNode.name && this.isNode(instrNode.name)) {
          desc += ` ${this.#getNodeBrief(instrNode.name)}`;
        }
        if (instrNode.operands?.length) {
          desc += ` ${this.C.dim}(${instrNode.operands.length} operands)${this.C.reset}`;
        }
        break;
      }

      case Syntax.Kind.Application: {
        const appNode = node as Syntax.Node<Syntax.Kind.Application>;
        if (appNode.name && this.isNode(appNode.name)) {
          desc += ` ${this.#getNodeBrief(appNode.name)}`;
        }
        if (appNode.generics) desc += ` ${this.C.dim}<...>${this.C.reset}`;
        if (appNode.parameters) desc += ` ${this.C.dim}(...)${this.C.reset}`;
        if (appNode.returnType) desc += ` ${this.C.dim}-> ...${this.C.reset}`;
        break;
      }

      case Syntax.Kind.Closure: {
        const closureNode = node as Syntax.Node<Syntax.Kind.Closure>;
        if (closureNode.capture) desc += ` ${this.C.dim}[capture]${this.C.reset}`;
        if (closureNode.generics) desc += ` ${this.C.dim}<...>${this.C.reset}`;
        if (closureNode.parameters) desc += ` ${this.C.dim}(...)${this.C.reset}`;
        if (closureNode.returnType) desc += ` ${this.C.dim}-> ...${this.C.reset}`
        break;
      }

      case Syntax.Kind.Call: {
        const callNode = node as Syntax.Node<Syntax.Kind.Call>;
        if (callNode.caller && this.isNode(callNode.caller)) {
          desc += ` ${this.#getNodeBrief(callNode.caller)}`;
        }
        if (callNode.parameters?.length) {
          desc += ` ${this.C.dim}(${callNode.parameters.length} args)${this.C.reset}`;
        }
        break;
      }

      case Syntax.Kind.BinaryExpression: {
        const binNode = node as Syntax.Node<Syntax.Kind.BinaryExpression>;
        if (binNode.operator && binNode.operator.lexem) {
          desc += ` ${this.C.operator}'${binNode.operator.lexem}'${this.C.reset}`;
        }
        break;
      }

      case Syntax.Kind.UnaryExpression: {
        const unaryNode = node as Syntax.Node<Syntax.Kind.UnaryExpression>;
        if (unaryNode.operator && unaryNode.operator.lexem) {
          const position = unaryNode.isPostfix ? 'postfix' : 'prefix';
          const pos_str = ` ${this.C.dim}${position}${this.C.reset}`;
          desc += ` ${pos_str} ${this.C.operator}'${unaryNode.operator.lexem}'${this.C.reset}`;
        }
        break;
      }

      case Syntax.Kind.Block: {
        const blockNode = node as Syntax.Node<Syntax.Kind.Block>;
        if (blockNode.statements?.length) {
          desc += ` ${this.C.dim}(${blockNode.statements.length} stmts)${this.C.reset}`;
        }
        break;
      }

      case Syntax.Kind.Generics:
      case Syntax.Kind.List: {
        const items = (node as any).elements;
        if (Array.isArray(items)) {
          desc += ` ${this.C.dim}(${items.length} items)${this.C.reset}`;
        }
        break;
      }

      case Syntax.Kind.VariableDeclaration: {
        const varNode = node as Syntax.Node<Syntax.Kind.VariableDeclaration>;
        if (varNode.initializer) {
          desc += ` ${this.C.dim}cinit${this.C.reset}`;
        }
        break;
      }
    }

    if ('type' in node && node.type !== undefined && node.type !== null) {
      const typeName = Syntax.Type[node.type] || `Type#${node.type}`;
      desc += ` ${this.C.dim}[${typeName}]${this.C.reset}`
    }

    return desc;
  }

  static #getNodeBrief(node: Syntax.Node<any>): string {
    switch (node.kind) {
      case Syntax.Kind.Identifier: {
        const name = this.#getIdentifierName(node);
        return name ? `${this.C.identifier}'${name}'${this.C.reset}` : `${this.C.dim}ident${this.C.reset}`;
      }
      case Syntax.Kind.Literal: {
        const token = this.#getTokenFromNode(node);
        if (token && token.lexem !== undefined) {
          return `${this.C.literal}${String(token.lexem)}${this.C.reset}`;
        }
        return `${this.C.dim}literal${this.C.reset}`;
      }
      default:
        return `${this.C.kind}${Syntax.Kind[node.kind] || 'node'}${this.C.reset}`;
    }
  }

  static #getIdentifierName(node: Syntax.Node<any>): string {
    if (node.kind !== Syntax.Kind.Identifier) return '';

    if (!('selector' in node) && node.token) {
      return node.token.lexem || '';
    }

    let name = '';

    if ((node as any).selector && this.isNode((node as any).selector)) {
      name += this.#getIdentifierName((node as any).selector);
    }

    if ((node as any).operator && (node as any).operator.lexem) {
      if (name) name += (node as any).operator.lexem;
    }

    if ((node as any).forward && this.isNode((node as any).forward)) {
      name += this.#getIdentifierName((node as any).forward);
    }

    if (!name && node.token && node.token.lexem) {
      name = node.token.lexem;
    }

    return name;
  }

  static #countIdentifierParts(node: Syntax.NodeBase<any>): number {
    if (node.kind !== Syntax.Kind.Identifier) return 0;
    let count = 0;

    if ((node as any).selector && this.isNode((node as any).selector)) {
      count += this.#countIdentifierParts((node as any).selector);
    } else {
      count = 1;
    }

    if ((node as any).forward && this.isNode((node as any).forward)) {
      count += this.#countIdentifierParts((node as any).forward);
    }

    return count;
  }

  static #addChild(children: NodeType[], role: string, value: any) {
    if (this.isNode(value)) {
      children.push({ node: value, role });
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (this.isNode(item)) {
          children.push({ node: item, role });
        }
      }
    }
  }

  static #collectChildren(node: Syntax.NodeBase<any>): { node: Syntax.NodeBase<any>, role: string }[] {
    const children: { node: Syntax.NodeBase<any>, role: string }[] = [];

    switch (node.kind) {
      case Syntax.Kind.UnaryExpression:
        this.#addChild(children, "operand", (node as any).operand);
        break;

      case Syntax.Kind.BinaryExpression:
        this.#addChild(children, "left", (node as any).left);
        this.#addChild(children, "right", (node as any).right);
        break;

      case Syntax.Kind.Instruction:
        this.#addChild(children, "name", (node as any).name);
        if ((node as any).operands) {
          for (const op of (node as any).operands) {
            this.#addChild(children, "operand", op);
          }
        }
        break;

      case Syntax.Kind.List:
        if (node.type == Syntax.Type.Initializer) {
          this.#addChild(children, "name", (node as any).name);
        }
        const items = (node as any).elements;
        if (Array.isArray(items)) {
          for (const item of items) {
            this.#addChild(children, "element", item);
          }
        }
        break;

      case Syntax.Kind.Generics:
        const genericItems = (node as any).elements;
        if (Array.isArray(genericItems)) {
          for (const item of genericItems) {
            this.#addChild(children, "generic", item);
          }
        }
        break;

      case Syntax.Kind.Identifier:
        break;

      case Syntax.Kind.Literal:
        break;

      case Syntax.Kind.Application:
        this.#addChild(children, "name", (node as any).name);
        this.#addChild(children, "generics", (node as any).generics);
        this.#addChild(children, "parameters", (node as any).parameters);
        this.#addChild(children, "returnType", (node as any).returnType);
        this.#addChild(children, "body", (node as any).body);
        if ((node as any).attributes) this.#addChild(children, "attributes", (node as any).attributes);
        break;

      case Syntax.Kind.Closure:
        this.#addChild(children, "capture", (node as any).capture);
        this.#addChild(children, "generics", (node as any).generics);
        this.#addChild(children, "parameters", (node as any).parameters);
        this.#addChild(children, "returnType", (node as any).returnType);
        this.#addChild(children, "body", (node as any).body);
        break;

      case Syntax.Kind.Call:
        this.#addChild(children, "caller", (node as any).caller);
        if ((node as any).parameters) {
          for (const param of (node as any).parameters) {
            this.#addChild(children, "argument", param);
          }
        }
        break;

      case Syntax.Kind.Block:
        if ((node as any).statements) {
          for (const stmt of (node as any).statements) {
            this.#addChild(children, "statement", stmt);
          }
        }
        break;

      case Syntax.Kind.SectionFieldDecl: {
        const fieldDecl = node as InstanceType<typeof Syntax.RegistryMap[Syntax.Kind.SectionFieldDecl]>;
        this.#addChild(children, "name", fieldDecl.name);
        this.#addChild(children, "colonToken", fieldDecl.colonToken); // может быть токеном, но addChild обработает
        this.#addChild(children, "value", fieldDecl.value);
        break;
      }

      case Syntax.Kind.VariableDeclaration: {
        const varNode = node as any;
        if (varNode.modifiers?.length) {
          for (const modToken of varNode.modifiers) {
            const modNode = new Syntax.RegistryMap[Syntax.Kind.Identifier]({
              kind: Syntax.Kind.Identifier,
              selector: new Syntax.NodeShape({ kind: Syntax.Kind.Identifier, token: modToken })
            });
            this.#addChild(children, "modifiers", modNode);
          }
        }
        this.#addChild(children, "type", varNode.typeNode);
        this.#addChild(children, "name", varNode.name);
        this.#addChild(children, "initializer", varNode.initializer);
        break;
      }

      case Syntax.Kind.FunctionDeclaration: {
        const funcNode = node as InstanceType<typeof Syntax.RegistryMap[Syntax.Kind.FunctionDeclaration]>;
        if (funcNode.modifiers?.length) {
          for (const modToken of funcNode.modifiers) {
            const modNode = new Syntax.RegistryMap[Syntax.Kind.Identifier]({
              kind: Syntax.Kind.Identifier,
              selector: new Syntax.NodeShape({ kind: Syntax.Kind.Identifier, token: modToken })
            });
            this.#addChild(children, "modifiers", modNode);
          }
        }
        this.#addChild(children, "qualifier", funcNode.qualifier);
        this.#addChild(children, "name", funcNode.name);
        if (funcNode.parameters) {
          for (const param of funcNode.parameters) {
            this.#addChild(children, "parameters", param);
          }
        }
        this.#addChild(children, "returnType", funcNode.returnType);
        this.#addChild(children, "body", funcNode.body);
        break;
      }

      case Syntax.Kind.ParameterDeclaration: {
        const paramNode = node as any;
        if (paramNode.modifiers?.length) {
          for (const modToken of paramNode.modifiers) {
            const modNode = new Syntax.RegistryMap[Syntax.Kind.Identifier]({
              kind: Syntax.Kind.Identifier,
              selector: new Syntax.NodeShape({ kind: Syntax.Kind.Identifier, token: modToken })
            });
            this.#addChild(children, "modifiers", modNode);
          }
        }
        this.#addChild(children, "type", paramNode.typeNode);
        if (paramNode.pointers?.length) {
          for (const ptrToken of paramNode.pointers) {
            const ptrNode = new Syntax.RegistryMap[Syntax.Kind.Identifier]({
              kind: Syntax.Kind.Identifier,
              selector: new Syntax.NodeShape({ kind: Syntax.Kind.Identifier, token: ptrToken })
            });
            this.#addChild(children, "pointers", ptrNode);
          }
        }
        if (paramNode.reference) {
          const refNode = new Syntax.RegistryMap[Syntax.Kind.Identifier]({
            kind: Syntax.Kind.Identifier,
            selector: new Syntax.NodeShape({ kind: Syntax.Kind.Identifier, token: paramNode.reference })
          });
          this.#addChild(children, "reference", refNode);
        }
        if (paramNode.isVariadic) {
          const variadicToken = new StructToken({
            type: Token.ELLIPSIS,
            lexem: '...',
            line: paramNode.typeNode?.token?.line || 0
          });
          const variadicNode = new Syntax.RegistryMap[Syntax.Kind.Identifier]({
            kind: Syntax.Kind.Identifier,
            selector: new Syntax.NodeShape({ kind: Syntax.Kind.Identifier, token: variadicToken })
          });
          this.#addChild(children, "isVariadic", variadicNode);
        }
        this.#addChild(children, "name", paramNode.name);
        break;
      }

      default:
        // Fallback
        for (const key in node) {
          if (Object.prototype.hasOwnProperty.call(node, key)) {
            const val = (node as any)[key];
            this.#addChild(children, key, val);
          }
        }
        break;
    }

    return children;
  }
}

export { PrintTree };