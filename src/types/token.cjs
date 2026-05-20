"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenOf = exports.ReserveIdentifierCoder = exports.ReserveIdentifier = exports.TokenStream = exports.StructToken = exports.Token = void 0;
exports.normalizeToken = normalizeToken;
const exceptions = require('llvm.js/exceptions');
var Token;
(function (Token) {
    Token[Token["INSTRUCTION"] = 0] = "INSTRUCTION";
    Token[Token["REGISTER"] = 1] = "REGISTER";
    Token[Token["COMMA"] = 2] = "COMMA";
    Token[Token["SEMICOLON"] = 3] = "SEMICOLON";
    Token[Token["COLON"] = 4] = "COLON";
    Token[Token["IDENTIFIER"] = 5] = "IDENTIFIER";
    Token[Token["NUMBER"] = 6] = "NUMBER";
    Token[Token["APOSTROPHE_STRING"] = 7] = "APOSTROPHE_STRING";
    Token[Token["STRING"] = 8] = "STRING";
    Token[Token["DOGE"] = 9] = "DOGE";
    Token[Token["DOT"] = 10] = "DOT";
    Token[Token["DOLLAR"] = 11] = "DOLLAR";
    Token[Token["BANG"] = 12] = "BANG";
    Token[Token["PIPE"] = 13] = "PIPE";
    Token[Token["AMPERSAND"] = 14] = "AMPERSAND";
    Token[Token["STAR"] = 15] = "STAR";
    Token[Token["OPEN_PAREN"] = 16] = "OPEN_PAREN";
    Token[Token["CLOSE_PAREN"] = 17] = "CLOSE_PAREN";
    Token[Token["OPEN_SQUARE_BRACKET"] = 18] = "OPEN_SQUARE_BRACKET";
    Token[Token["CLOSE_SQUARE_BRACKET"] = 19] = "CLOSE_SQUARE_BRACKET";
    Token[Token["OPEN_CURLY_BRACKET"] = 20] = "OPEN_CURLY_BRACKET";
    Token[Token["CLOSE_CURLY_BRACKET"] = 21] = "CLOSE_CURLY_BRACKET";
    Token[Token["PLUS"] = 22] = "PLUS";
    Token[Token["MINUS"] = 23] = "MINUS";
    Token[Token["INCREMENT"] = 24] = "INCREMENT";
    Token[Token["DECREMENT"] = 25] = "DECREMENT";
    Token[Token["TILDE"] = 26] = "TILDE";
    Token[Token["LESS"] = 27] = "LESS";
    Token[Token["GREATER"] = 28] = "GREATER";
    Token[Token["PERCENT"] = 29] = "PERCENT";
    Token[Token["CARET"] = 30] = "CARET";
    Token[Token["SLASH"] = 31] = "SLASH";
    Token[Token["EQUAL"] = 32] = "EQUAL";
    Token[Token["PLUS_EQUAL"] = 33] = "PLUS_EQUAL";
    Token[Token["MINUS_EQUAL"] = 34] = "MINUS_EQUAL";
    Token[Token["STAR_EQUAL"] = 35] = "STAR_EQUAL";
    Token[Token["SLASH_EQUAL"] = 36] = "SLASH_EQUAL";
    Token[Token["PERCENT_EQUAL"] = 37] = "PERCENT_EQUAL";
    Token[Token["EQUAL_EQUAL"] = 38] = "EQUAL_EQUAL";
    Token[Token["BANG_EQUAL"] = 39] = "BANG_EQUAL";
    Token[Token["LEFT_SHIFT"] = 40] = "LEFT_SHIFT";
    Token[Token["RIGHT_SHIFT"] = 41] = "RIGHT_SHIFT";
    Token[Token["LESS_EQUAL"] = 42] = "LESS_EQUAL";
    Token[Token["GREATER_EQUAL"] = 43] = "GREATER_EQUAL";
    Token[Token["OPERATOR_AND"] = 44] = "OPERATOR_AND";
    Token[Token["OPERATOR_OR"] = 45] = "OPERATOR_OR";
    Token[Token["ELLIPSIS"] = 46] = "ELLIPSIS";
    Token[Token["ARROW"] = 47] = "ARROW";
    Token[Token["PATTERN_CASE"] = 48] = "PATTERN_CASE";
    Token[Token["SCOPE"] = 49] = "SCOPE";
    Token[Token["EOF"] = 50] = "EOF";
})(Token || (exports.Token = Token = {}));
class TokenOf {
    static is(t, k) {
        return t.type == k;
    }
}
exports.TokenOf = TokenOf;
var ReserveIdentifier;
(function (ReserveIdentifier) {
    ReserveIdentifier["RID_STATIC"] = "static";
    ReserveIdentifier["RID_CONST"] = "const";
    ReserveIdentifier["RID_EXTERN"] = "extern";
    ReserveIdentifier["RID_TYPEDEF"] = "typedef";
    ReserveIdentifier["RID_SIZEOF"] = "sizeof";
    ReserveIdentifier["RID_INLINE"] = "inline";
    ReserveIdentifier["RID_VOLATILE"] = "volatile";
    ReserveIdentifier["RID_AUTO"] = "auto";
    ReserveIdentifier["RID_RESTRICT"] = "restrict";
    ReserveIdentifier["RID_NORETURN"] = "noreturn";
    ReserveIdentifier["RID_ATOMIC"] = "atomic";
    ReserveIdentifier["RID_COMPLEX"] = "complex";
    ReserveIdentifier["RID_THREAD"] = "thread_local";
    ReserveIdentifier["RID_SAT"] = "_Sat";
    ReserveIdentifier["RID_NULLPTR"] = "nullptr";
    ReserveIdentifier["RID_TRUE"] = "true";
    ReserveIdentifier["RID_FALSE"] = "false";
    ReserveIdentifier["RID_DEFAULT"] = "default";
    ReserveIdentifier["RID_FRIEND"] = "friend";
    ReserveIdentifier["RID_VIRTUAL"] = "virtual";
    ReserveIdentifier["RID_EXPLICIT"] = "explicit";
    ReserveIdentifier["RID_EXPORT"] = "export";
    ReserveIdentifier["RID_MUTABLE"] = "mutable";
    ReserveIdentifier["RID_STRUCT"] = "struct";
    ReserveIdentifier["RID_ENUM"] = "enum";
    ReserveIdentifier["RID_INSPECT"] = "inspect";
    ReserveIdentifier["RID_PUBLIC"] = "pub";
    ReserveIdentifier["RID_PRIVATE"] = "priv";
    ReserveIdentifier["RID_PROTECTED"] = "protected";
    ReserveIdentifier["RID_TEMPLATE"] = "template";
    ReserveIdentifier["RID_NAMESPACE"] = "namespace";
    ReserveIdentifier["RID_UNION"] = "union";
    ReserveIdentifier["RID_OPERATOR"] = "operator";
    ReserveIdentifier["RID_THIS"] = "this";
    ReserveIdentifier["RID_THROW"] = "except";
    ReserveIdentifier["RID_TRY"] = "try";
    ReserveIdentifier["RID_CATCH"] = "catch";
    ReserveIdentifier["RID_TYPENAME"] = "typename";
    ReserveIdentifier["RID_TYPEID"] = "typeid";
    ReserveIdentifier["RID_USING"] = "using";
    ReserveIdentifier["RID_WHILE"] = "while";
    ReserveIdentifier["RID_BREAK"] = "break";
    ReserveIdentifier["RID_CONTINUE"] = "continue";
    /* casts */
    ReserveIdentifier["RID_CONSTCAST"] = "const_cast";
    ReserveIdentifier["RID_DYNAMICCAST"] = "dynamic_cast";
    ReserveIdentifier["RID_REINTERPRETCAST"] = "reinterpret_cast";
    ReserveIdentifier["RID_STATICCAST"] = "static_cast";
    ReserveIdentifier["RID_BUILTIN_OPERATOR_NEW"] = "new";
    ReserveIdentifier["RID_BUILTIN_OPERATOR_DELETE"] = "delete";
    /* C++11 */
    ReserveIdentifier["RID_CONSTEXPR"] = "constexpr";
    ReserveIdentifier["RID_DECLTYPE"] = "decltype";
    ReserveIdentifier["RID_NOEXCEPT"] = "noexcept";
    /** Kernel and Shared object modifiers */
    ReserveIdentifier["RID___INIT"] = "__init";
    ReserveIdentifier["RID___EXIT"] = "__exit";
    ReserveIdentifier["RID_SHARE_SYMBOL"] = "__share__";
})(ReserveIdentifier || (exports.ReserveIdentifier = ReserveIdentifier = {}));
class ReserveIdentifierCoder {
    static reserveIdentifier(token) {
        return this.ridmap[token.lexem] ?? null;
    }
    static is(token, type) {
        const t = this.reserveIdentifier(token);
        return t !== null && t === type;
    }
}
exports.ReserveIdentifierCoder = ReserveIdentifierCoder;
ReserveIdentifierCoder.ridmap = Object.fromEntries(Object.entries(ReserveIdentifier).map(([_, v]) => [v, v]));
class StructToken {
    constructor(init) {
        Object.assign(this, init);
    }
    get value() {
        return this.lexem;
    }
}
exports.StructToken = StructToken;
function normalizeToken(rawToken) {
    const numericType = Token[rawToken.type];
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
    constructor(tokens) {
        this.pos = 0;
        this.tokens = tokens;
    }
    peek(offset = 0) {
        return (this.pos + offset) < this.tokens.length ? this.tokens[this.pos + offset] : null;
    }
    next() {
        if (this.pos >= this.tokens.length)
            return null;
        return this.tokens[this.pos++];
    }
    snapshot() {
        return this.pos;
    }
    restore(pos) {
        this.pos = pos;
    }
    swap(token, offset = 0) {
        if ((this.pos + offset) < this.tokens.length) {
            this.tokens[this.pos + offset] = token;
        }
    }
    is(type, offset = 0) {
        const t = this.peek(offset);
        return t ? t.type === type : false;
    }
    consume_if(type) {
        if (this.is(type))
            return this.next();
        return null;
    }
    expect(type) {
        const token = this.peek();
        if (!token || token.type !== type) {
            new exceptions.ExpressionException(`[except] Expected token type:${Token[type]} got ${Token[token?.type]}`, token);
        }
        return this.next();
    }
    try(type) {
        const token = this.peek();
        if (token && token.type === type) {
            return this.next();
        }
        return null;
    }
}
exports.TokenStream = TokenStream;
