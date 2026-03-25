const exceptions = require('llvm.js/exceptions');

enum Token {
  INSTRUCTION,
  REGISTER,
  COMMA,
  SEMICOLON,
  COLON,
  IDENTIFIER,
  NUMBER,
  APOSTROPHE_STRING,
  STRING,
  DOGE,
  DOT,
  DOLLAR,
  BANG,// !
  PIPE, // |
  AMPERSAND, // &
  STAR, // *
  OPEN_PAREN, // (
  CLOSE_PAREN, // )
  OPEN_SQUARE_BRACKET, // [
  CLOSE_SQUARE_BRACKET, // ]
  OPEN_CURLY_BRACKET, // {
  CLOSE_CURLY_BRACKET, // }
  PLUS, // +
  MINUS, // -
  INCREMENT, // ++
  DECREMENT, // --
  TILDE, // ~
  LESS, // <
  GREATER, // >
  PERCENT, // %
  CARET, // ^
  SLASH, // /
  EQUAL,// =
  PLUS_EQUAL, // +=
  MINUS_EQUAL, // -=
  STAR_EQUAL, // *=
  SLASH_EQUAL, // /=
  PERCENT_EQUAL, // %=
  EQUAL_EQUAL, // ==
  BANG_EQUAL, // !=
  LEFT_SHIFT, // <<
  RIGHT_SHIFT, // >>
  LESS_EQUAL, // <=
  GREATER_EQUAL, // >=
  OPERATOR_AND, // &&
  OPERATOR_OR, // ||
  ELLIPSIS, // ...
  ARROW, // ->
  SCOPE,  // ::
  EOF,
}

enum ReserveIdentifier {
  RID_STATIC = "static",
  RID_CONST = "const",
  RID_EXTERN = "extern",
  RID_TYPEDEF = "typedef",
  RID_INLINE = "inline",
  RID_VOLATILE = "volatile",
  RID_AUTO = "auto",
  RID_RESTRICT = "restrict",
  RID_NORETURN = "noreturn",
  RID_ATOMIC = "atomic",
  RID_COMPLEX = "complex",
  RID_THREAD = "thread_local",
  RID_SAT = "_Sat",
  RID_NULLPTR = "nullptr",  // BUILTIN TYPE (LIT)
  RID_TRUE = "true",        // BUILTIN TYPE (LIT)
  RID_FALSE = "false",      // BUILTIN TYPE (LIT)
  RID_DEFAULT = "default",
  RID_FRIEND = "friend",
  RID_VIRTUAL = "virtual",
  RID_EXPLICIT = "explicit",
  RID_EXPORT = "export",
  RID_MUTABLE = "mutable",
  RID_STRUCT = "struct",
  RID_ENUM = "enum",
  RID_PUBLIC = "public",
  RID_PRIVATE = "private",
  RID_PROTECTED = "protected",
  RID_TEMPLATE = "template",
  RID_NAMESPACE = "namespace",
  RID_OPERATOR = "operator",
  RID_THIS = "this",
  RID_THROW = "except", // (C++ throw) except
  RID_TRY = "try",
  RID_CATCH = "catch",
  RID_TYPENAME = "typename",
  RID_TYPEID = "typeid",
  RID_USING = "using",
  /* casts */
  RID_CONSTCAST = "const_cast",
  RID_DYNAMICCAST = "dynamic_cast",
  RID_REINTERPRETCAST = "reinterpret_cast",
  RID_STATICCAST = "static_cast",
  RID_BUILTIN_OPERATOR_NEW = "new",
  RID_BUILTIN_OPERATOR_DELETE = "delete",
  /* C++11 */
  RID_CONSTEXPR = "constexpr",
  RID_DECLTYPE = "decltype",
  RID_NOEXCEPT = "noexcept",
  /** Kernel and Shared object modifiers */
  RID___INIT = "__init",
  RID___EXIT = "__exit",
  RID_SHARE_SYMBOL = "__share__"
}

class ReserveIdentifierCoder {
  private static readonly ridmap: Record<string, ReserveIdentifier> = 
    Object.fromEntries(Object.entries(ReserveIdentifier).map(([_, v]) => [v, v as ReserveIdentifier]));

  static reserveIdentifier(token: StructToken): ReserveIdentifier {
    return this.ridmap[token.lexem] ?? null;
  }

  static is(token: StructToken, type: ReserveIdentifier): boolean {
    const t = this.reserveIdentifier(token);
    return t !== null && t === type;
  }
}

class StructToken<T extends Token = Token> {
  type: T;
  lexem: string;
  current: number;
  line: number;
  code: string;

  constructor(init: Partial<StructToken<T>>) {
    Object.assign(this, init);
  }

  get value() : typeof this.lexem {
    return this.lexem;
  }
}

function normalizeToken(rawToken): StructToken {
  const numericType = Token[rawToken.type as keyof typeof Token];
  if (numericType === undefined) {
    throw new Error(`Unknown token type: ${rawToken.type}`);
  }
  return new StructToken({
    ...rawToken,
    lexem: numericType === Token.EOF ? " " : rawToken.lexem,
    code: numericType === Token.EOF ? " " : rawToken.code,
    type: numericType
  });
}

class TokenStream {
  private tokens: StructToken[];
  private pos = 0;

  constructor(tokens: StructToken[]) {
    this.tokens = tokens;
  }

  peek(offset = 0): StructToken | null {
    return (this.pos + offset) < this.tokens.length ? this.tokens[this.pos + offset] : null;
  }

  next(): StructToken | null {
    if (this.pos >= this.tokens.length) return null;
    return this.tokens[this.pos++];
  }

  snapshot(): typeof this.pos {
    return this.pos;
  }

  restore(pos: typeof this.pos) {
    this.pos = pos;
  }

  swap(token: StructToken, offset = 0) {
    if ((this.pos + offset) < this.tokens.length) {
      this.tokens[this.pos + offset] = token;
    }
  }

  is(type: Token, offset = 0): boolean {
    const t = this.peek(offset);
    return t ? t.type === type : false;
  }

  consume_if(type: Token): StructToken | null {
    if (this.is(type)) return this.next();
    return null;
  }

  expect(type: Token): StructToken {
    const token = this.peek();
    if (!token || token.type !== type) {
      new exceptions.ExpressionException(`[except] Expected token type:${Token[type]} got ${Token[token?.type]}`, token);
    }
    return this.next()!;
  }

  try(type: Token): StructToken | null {
    const token = this.peek();
    if (token && token.type === type) {
      return this.next()!;
    }
    return null;
  }
}

export {
  Token, StructToken, TokenStream, ReserveIdentifier, ReserveIdentifierCoder, normalizeToken
}