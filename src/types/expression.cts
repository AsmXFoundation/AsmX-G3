import { StructToken, Token } from "./token.cjs";

namespace Syntax {
  export enum Kind {
    Instruction,      // @mov, @call
    Identifier,       // name, std::variant with even hard paths
    Literal,
    List,             // arguments list, type list, just multiple someone
    Generics,         // <T>, <class T>, <typename T>, etc
    Application,      // fn, constructor, destructor
    Call,

    UnaryExpression,  // &x, *ptr, -5, $10, %rax
    BinaryExpression, // a + b, a % b

    ImplicitCastExpression,

    VariableDeclaration,
    FunctionDeclaration,
    ParameterDeclaration,
    SectionFieldDecl,

    Closure,            // [capture] <generics> (args) -> ret { body }
    Block,              // { stmt; stmt; }
  }

  export enum Type {
    /** @type {Kind.Literal} */
    StringLiteral,
    NumberLieral,
    ArrayLiteral,
    BooleanLiteral,
    NullptrLiteral,
    NullLiteral,
    /** @type {Kind.Application} */
    Fn,
    Ctor,
    Dtor,
    /** @type {Kind.List} */
    Tuple,
    Initializer,
    /** @type {Kind.ImplicitCastExpression} */
    StaticCast,
    ConstCast,
    DynamicCast,
    ReinterpretCast,
  }

  export abstract class NodeBase<K extends Kind> {
    abstract readonly kind: K | null;     // Literal
    abstract readonly type?: Type | null; // StringLiteral, NumberLiteral
    constructor(init = {}) {
      Object.assign(this, init);
    }
  }

  export class NodeShape<K extends Kind> extends NodeBase<K> {
    readonly kind: K | null;      // Literal
    readonly type?: Type | null;  // StringLiteral, NumberLiteral
    readonly token: StructToken;
    constructor(init:  Pick<NodeShape<K>, 'kind' | 'type' | 'token'>) {
      super(init);
      Object.assign(this, init);
    }
  }

  export type NodeMap = {
    [K in keyof typeof Registry]: InstanceType<(typeof Registry)[K]>;
  };

  export type Node<K extends Kind> = NodeMap[K];
  export type NodeStructure = { [K in Kind]: Node<K> }[Kind];
  export type RequiredNodeStructure<K extends Kind> = NodeMap[K];
  export type Program = NodeStructure[];

  function Factory<K extends Kind>(kind: K) {
    return class extends NodeBase<K> {
      readonly kind = kind;
      readonly type?: Type | null = null;

      constructor(init: any = {}) {
        super(init);
        Object.assign(this, init);
      }
    } as unknown as new (init?: any) => NodeBase<K> & { kind: K, type?: Type | null };
  }

  type Constructor<T = {}> = new (...args: any[]) => T;

  function WithSignature<T extends Constructor>(Base: T) {
    return class extends Base {
      generics?: NodeShape<Kind.Generics>;
      parameters?: NodeShape<Kind.List>;
      returnType?: NodeStructure;
      body: NodeShape<Kind.List>;
    };
  }

  function WithParenthesis<T extends { new (...args: any[]): {} }>(target: T) {
    return class extends target {
      open: StructToken;
      close: StructToken;
    };
  }

  function WithBothPrefix<T extends { new (...args: any[]): {} }>(target: T) {
    return class extends target {
      prefix?: StructToken; // -40
      suffix?: StructToken; // 40?
    };
  }

  export const Registry = {
    [Kind.ImplicitCastExpression]: class extends Factory(Kind.ImplicitCastExpression) {
      castType: StructToken;
      typeid: Node<any>;
      convert: Node<any>;
    },

    [Kind.UnaryExpression]: class extends Factory(Kind.UnaryExpression) {
      operator: StructToken;
      operand: Node<any>;
      isPostfix?: boolean;
    },

    [Kind.BinaryExpression]: class extends Factory(Kind.BinaryExpression) {
      left: Node<any>;
      operator: StructToken;
      right: Node<any>;
    },

    [Kind.Instruction]: class extends Factory(Kind.Instruction) {
      name: NodeShape<Kind.Identifier>;
      operands: (NodeShape<any> | InstanceType<(typeof Registry[Kind])>)[];
    },

    [Kind.List]: class extends WithParenthesis(Factory(Kind.List)) {
      name?: NodeShape<any>;
      elements: NodeShape<any>[];
    },

    [Kind.Generics]: class extends WithParenthesis(Factory(Kind.Generics)) {
      elements: NodeShape<any>[];
    },

    /**
     * @example
     * ```ts
     * // Expr: engine.createShape
     * const NodeShape = new Syntax.Registry[Syntax.Kind.Identifier]({
     *  operator: Token("."),
     *  selector: NodeShape("engine"),
     *  forward: NodeShape("createShape")
     * });
     * ```
     */
    [Kind.Identifier]: class extends WithBothPrefix(Factory(Kind.Identifier)) {
      operator?: StructToken;
      selector: Node<any>;
      // selector: StructToken;
      forward?: Node<any>;
    },

    [Kind.Literal]: class extends WithBothPrefix(Factory(Kind.Literal)) {
      value: StructToken;
    },

    [Kind.Application]: class extends WithSignature(Factory(Kind.Application)) {
      attributes?: NodeShape<Kind.List>;
      name: NodeShape<Kind.Identifier>;
    },

    [Kind.Closure]: class extends WithSignature(Factory(Kind.Closure)) {
      capture: NodeShape<Kind.List>;
    },

    [Kind.Call]: class extends Factory(Kind.Call) {
      caller: Node<any>;
      parameters: Node<any>[];
    },

    [Kind.Block]: class extends WithParenthesis(Factory(Kind.Block)) {
      statements: NodeShape<any>[];
    },

    [Kind.VariableDeclaration]: class extends Factory(Kind.VariableDeclaration) {
      modifiers: StructToken[]; // static const
      typeNode: Node<any>;
      name: Node<Kind.Identifier>;
      initializer: Node<any> | null;
    },

    [Kind.FunctionDeclaration]: class extends Factory(Kind.FunctionDeclaration) {
      modifiers: StructToken[]; // static const
      qualifier: StructToken;
      name: Node<Kind.Identifier>;
      parameters: Node<Kind.ParameterDeclaration>[];
      returnType: Node<any> | null;
      body: Node<any> | null;
      isDefaulted: boolean; // for = default;
      isDeleted: boolean; // for = delete;
    },

    [Kind.ParameterDeclaration]: class extends Factory(Kind.ParameterDeclaration) {
      modifiers: StructToken[];
      typeNode: Node<any>;
      pointers: StructToken[];
      reference: StructToken | null;
      isVariadic: boolean;
      name: Node<Kind.Identifier>;
    },

    [Kind.SectionFieldDecl]: class extends Factory(Kind.SectionFieldDecl) {
      name: Node<any>;
      colonToken: StructToken | null;
      value: Node<any>;
    },
  } as const;

  export type NodeConstructor<K extends Kind> = new (init?: Partial<Node<K>>) => Node<K>;

  export const RegistryMap: {
    [K in Kind]: NodeConstructor<K>;
  } = Registry as any;
}

export {
  Syntax
}