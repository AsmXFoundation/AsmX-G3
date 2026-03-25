import { PrintTree } from "../backend/targets/x86_64/print.cjs";
import { Syntax } from "../types/expression.cjs";
import { ReserveIdentifier, ReserveIdentifierCoder, StructToken, Token, TokenStream } from "../types/token.cjs";

const exceptions = require('llvm.js/exceptions');

enum Precedence {
  LOWEST = 0,
  COMMA = 10,           // ,
  ASSIGNMENT = 20,      // = += -=
  TERNARY = 20,         // ? :
  LOGICAL_OR = 30,      // ||
  LOGICAL_AND = 40,     // &&
  BITWISE_OR = 50,      // |
  BITWISE_XOR = 60,     // ^
  BITWISE_AND = 70,     // &
  EQUALITY = 80,        // == !=
  RELATIONAL = 90,      // < > <= >=
  SPACESHIP = 100,      // <=>
  SHIFT = 110,          // << >>
  ADDITIVE = 120,       // + -
  MULTIPLICATIVE = 130, // * / %
  MEMBER_POINTER = 140, // .* ->*
  PREFIX = 150,         // -x, ++x, !x, &x, *x (deref) (cast) sizeof 
  POSTFIX = 160,        // x++, x--, x[], x(), x.y
  SCOPE = 170,          // ::
}

class RecursiveDescentParser {
  private stream: TokenStream;

  constructor(tokens: StructToken[]) {
    this.stream = new TokenStream(tokens);
  }

  // =================================================================
  // ENTRY POINT
  // =================================================================
  
  public parse_translation_unit(): Syntax.Program {
    const nodes: Syntax.Program = [];
    PrintTree.verbose = true;
    while (this.stream.peek()?.type !== Token.EOF && this.stream.peek() !== null) {
      nodes.push(this.parse_statement());
    }
    return nodes;
  }

  // =================================================================
  // STATEMENTS & INSTRUCTIONS
  // =================================================================

  private parse_statement(): Syntax.NodeStructure | any {
    const token = this.stream.peek();

    if (token.type == Token.DOGE) {
      return this.parse_instruction();
    }

    {
      const modifiers = [];
      while (this.is_modifier(this.stream.peek())) {
        modifiers.push(this.stream.next());
      }

      if (this.is_decl_qualifier(this.stream.peek())) {
        return this.parse_functional_declaration(modifiers);
      }

      // parsing to =
      // const base_expr = this.parse_expression(Precedence.ASSIGNMENT);
      const base_expr = this.parse_expression(Precedence.ASSIGNMENT, false, true);

      // lookahead
      const next_token = this.stream.peek();

      // exmaple: [const] [int] [B] = &A;
      //          [std::vector<int>] [vec] = {1, 2, 3};
      if (next_token && next_token.type == Token.IDENTIFIER) {
        return this.parse_variable_declaration(modifiers, base_expr);
      }

      if (modifiers.length > 0) {
        new exceptions.ExpressionException("Expected variable name after modifiers and type", next_token);
      }

      // otherwise (Expression Statement)
      // just simple expression aka "mystruct.release = 3"
      let expr_node = base_expr;
      if ( next_token && (this.is_direct_assignment_operator(next_token.type) ||
                          this.is_compound_assignment_operator(next_token.type) ||
                          next_token.type == Token.COLON)) {
        const operator = this.stream.next()!;
        // const right = this.parse_expression(Precedence.LOWEST);
        
        if (operator.type == Token.COLON) {
          const right = this.parse_type_constructor();

          expr_node = new Syntax.RegistryMap[Syntax.Kind.SectionFieldDecl]({
            kind: Syntax.Kind.SectionFieldDecl,
            name: base_expr,
            colonToken: operator,
            value: right
          });
        } else {
          const right = this.parse_expression(Precedence.LOWEST);
          expr_node = new Syntax.RegistryMap[Syntax.Kind.BinaryExpression]({
            kind: Syntax.Kind.BinaryExpression,
            left: base_expr,
            operator,
            right
          });
        }
      }

      this.stream.expect(Token.SEMICOLON);
      return expr_node;
    }

    const expr = this.parse_expression(0);
    this.stream.consume_if(Token.SEMICOLON);
    return expr;
  }

  parse_instruction(): Syntax.Node<Syntax.Kind.Instruction> {
    this.stream.expect(Token.DOGE); // Consume @
    const name_token = this.stream.expect(Token.IDENTIFIER); // consume

    const nodeShape = new Syntax.RegistryMap[Syntax.Kind.Instruction]({
      name: new Syntax.NodeShape<Syntax.Kind.Identifier>({
        kind: Syntax.Kind.Identifier,
        token: name_token,
      }),
      operands: []
    });

    // Lookahead next 2 tokens, avoid crap
    // is a for only @section name {...}
    garbage: {
      if (name_token.lexem != "section") break garbage;
      if (this.stream.is(Token.IDENTIFIER) && this.stream.is(Token.OPEN_CURLY_BRACKET, 1)) {
        const extra_name = this.stream.expect(Token.IDENTIFIER);
  
        nodeShape.operands.push(new Syntax.NodeShape<Syntax.Kind.Identifier>({
          kind: Syntax.Kind.Identifier,
          token: extra_name
        }));

        const block = this.parse_block();
        nodeShape.operands.push(block);
        this.stream.consume_if(Token.SEMICOLON);
        return nodeShape;
      }
    }

    // otherwise is a just list operands delimited comma operator
    // is a @instruction operand (, operand)+
    {
      const operands = [];

      if (!this.stream.is(Token.SEMICOLON) && !this.stream.is(Token.EOF)) {
        do {
          const expression = this.parse_expression(Precedence.ASSIGNMENT);
          if (expression) operands.push(expression);
        } while (this.stream.consume_if(Token.COMMA));
      }

      nodeShape.operands = operands;
    }

    // but, if not have semicolon token then we check what next instruction/statement at the next line 
    this.stream.consume_if(Token.SEMICOLON);
    // write release

    return nodeShape;
  }

  parse_variable_declaration(modifiers, typeNode) {
    const nameNode = this.parse_expression(Precedence.POSTFIX);

    let initializer = null;
    // check initializer ( = expr) or (= { })
    const peek = this.stream.peek();
    if(peek && this.is_direct_assignment_operator(peek.type)) {
      this.stream.next();
      initializer = this.parse_expression(Precedence.LOWEST);
    }

    // Uniform initialization (C++11): std::vector<int> vec {1, 2, 3};
    if (peek && peek.type == Token.OPEN_CURLY_BRACKET) {
      initializer = this.parse_prefix();
    }

    this.stream.expect(Token.SEMICOLON);

    const node = new Syntax.RegistryMap[Syntax.Kind.VariableDeclaration]({
      kind: Syntax.Kind.VariableDeclaration,
      modifiers,
      typeNode,
      name: nameNode as InstanceType<typeof Syntax.Registry[Syntax.Kind.Identifier]>,
      initializer
    });

    return node;
  }

  parse_functional_declaration(modifiers) {
    const qualifier = this.stream.expect(Token.IDENTIFIER);
    const name = this.parse_expression(Precedence.POSTFIX);

    let parameters = [];
    let returnType = null;
    let body = null;
    let isDefaulted = false;
    let isDeleted = false;

    // parameters
    if (this.stream.is(Token.OPEN_PAREN)) {
      this.stream.next();
      if (!this.stream.is(Token.CLOSE_PAREN)) {
        do {
          parameters.push(this.parse_parameter_declaration());
        } while (this.stream.consume_if(Token.COMMA));
      }
      this.stream.expect(Token.CLOSE_PAREN);
    }

    // return type
    if (this.stream.is(Token.ARROW)) {
      this.stream.next(); // consume ->
      returnType = this.parse_expression(Precedence.ASSIGNMENT, true);
    }

    // peek for decide it's body or assignment
    const peek = this.stream.peek();

    // body { }
    if (peek && peek.type == Token.OPEN_CURLY_BRACKET) {
      body = this.parse_block();
      this.stream.consume_if(Token.SEMICOLON);
    }

    // assignment
    else if (this.stream.consume_if(Token.EQUAL)) {
      this.stream.next(); // consume = 
      const keyword = this.stream.expect(Token.IDENTIFIER);

      if (keyword.lexem == "default") {
        isDefaulted = true;
      } else if (keyword.lexem == "delete") {
        isDeleted = true;
      } else {
        new exceptions.ExpressionException("Expected 'default' or 'delete' after '=' in function declaration", keyword);
      }

      this.stream.expect(Token.SEMICOLON);
    } else {
      new exceptions.ExpressionException("Expected function body '{ ... }' or '= default;'", peek);
    }

    const node = new Syntax.RegistryMap[Syntax.Kind.FunctionDeclaration]({
      kind: Syntax.Kind.FunctionDeclaration,
      modifiers,
      qualifier,
      name: name as any,
      parameters,
      returnType,
      body,
      isDefaulted,
      isDeleted
    });

    return node;
  }

  parse_parameter_declaration(): InstanceType<typeof Syntax.Registry[Syntax.Kind.ParameterDeclaration]> {
    const modifiers = [];
    while (this.is_modifier(this.stream.peek())) {
      modifiers.push(this.stream.next());
    }

    const typeNode = this.parse_expression(Precedence.ASSIGNMENT, false, true);

    let isVariadic = false;
    if (this.stream.consume_if(Token.ELLIPSIS)) {
      isVariadic = true;
    }

    let name = null;
    if (this.stream.is(Token.IDENTIFIER)) {
      name = this.parse_primary();
    }

    if (!isVariadic && this.stream.consume_if(Token.ELLIPSIS)) {
      isVariadic = true;
    }

    const node = new Syntax.RegistryMap[Syntax.Kind.ParameterDeclaration]({
      modifiers, typeNode, pointers: [], reference: null, isVariadic, name
    });

    return node;
  }

  // =================================================================
  // EXPRESSIONS (Pratt Parser / Precedence Climbing)
  // =================================================================

  // Here we resolve context (register vs imm vs memory, etc)
  parse_instruction_operand(){
    const token = this.stream.peek();

    if (token?.type == undefined)
      return this.parse_expression(0);

    if (token.type == Token.PERCENT) {
      this.stream.next(); // skip %
      const name = this.stream.expect(Token.IDENTIFIER);
      return new Syntax.RegistryMap[Syntax.Kind.UnaryExpression]({
        operator: token,
        operand: new Syntax.NodeShape<Syntax.Kind.Identifier>({
          kind: Syntax.Kind.Identifier,
          token: name
        })
      });
    }

    // Immediate: $10 or $imm
    if (token.type == Token.DOLLAR) {
      this.stream.next(); // skip $
      const value = this.parse_primary();
      return new Syntax.RegistryMap[Syntax.Kind.UnaryExpression]({
        operator: token,
        operand: value
      });
    }

    // Addr / ref: &var
    if (token.type == Token.AMPERSAND) {
      this.stream.next(); // skip &
      const value = this.parse_expression(this.get_precedence(Token.AMPERSAND));
      return new Syntax.RegistryMap[Syntax.Kind.UnaryExpression]({
        operator: token,
        operand: value
      });
    }

    // Normal expression (memory, variable, complex calculation)
    return this.parse_expression(0);
  }

  parse_type_constructor() {
    return this.parse_expression(Precedence.ASSIGNMENT, false, true);
  }

  /**
   * Parses expressions based on precedence.
   * Solves the problem where & or * can be both unary and binary.
   */
  parse_expression(
    minPrecedence: number = Precedence.LOWEST, stopAtBrace: boolean = false, isTypeContext: boolean = false
  ): InstanceType<typeof Syntax.Registry[Syntax.Kind]> {
    let left = this.parse_prefix(isTypeContext);

    while(minPrecedence < this.get_next_precedence(stopAtBrace, isTypeContext)) {
      const token = this.stream.peek();
      if (!token) break;

      if (this.stream.is(Token.OPEN_PAREN)) {
        left = this.parse_function_call(left);
        continue;
      }

      if (this.stream.is(Token.DOT) || this.stream.is(Token.SCOPE) || this.stream.is(Token.ARROW)) {
        const operator = this.stream.next();
        // const right = this.parse_primary();
        const right = this.parse_expression(Precedence.POSTFIX, stopAtBrace, isTypeContext);
        left = new Syntax.RegistryMap[Syntax.Kind.Identifier]({
          kind: Syntax.Kind.Identifier,
          operator,
          selector: left,
          forward: right
        });
        continue;
      }

      if (isTypeContext && (token.type === Token.STAR || token.type === Token.AMPERSAND || token.type === Token.OPERATOR_AND || this.is_modifier(token))) {
        this.stream.next();
        left = new Syntax.RegistryMap[Syntax.Kind.UnaryExpression]({
          kind: Syntax.Kind.UnaryExpression,
          operator: token,
          operand: left,
          isPostfix: true
        });
        continue;
      }

      // Handle postfix (a++, a--)
      if (token.type == Token.INCREMENT || token.type == Token.DECREMENT) {
        this.stream.next(); // eat the postfix
        left = new Syntax.RegistryMap[Syntax.Kind.UnaryExpression]({
          kind: Syntax.Kind.UnaryExpression,
          operator: token,
          operand: left,
          isPostfix: true
        });
      }

      if (this.is_binary_operator(token.type)) {
        const operator = this.stream.next()!;

        const nextPrecedence = this.is_right_associative(operator.type) 
            ? this.get_precedence(operator.type) 
            : this.get_precedence(operator.type) + 1;

        const right = this.parse_expression(nextPrecedence, stopAtBrace, isTypeContext);

        left = new Syntax.RegistryMap[Syntax.Kind.BinaryExpression]({left, operator, right});
        continue;
      }

      if (token.type == Token.COMMA) {
        const right = this.parse_comma_separator();
        right.elements.unshift(left as any);
        left = right;
        continue;
      }

      if (token.type == Token.OPEN_CURLY_BRACKET) {
        left = this.resolve_initializer(left);
        continue;
      }

      // If it's not handled as infix/postfix, exit
      break;
    }

    return left;
  }

  private parse_comma_separator() {
    this.stream.expect(Token.COMMA);
    const seq = [];

    do {
      let expr = this.parse_expression(Precedence.ASSIGNMENT);
      seq.push(expr);
    } while (this.stream.consume_if(Token.COMMA));

    let node = new Syntax.RegistryMap[Syntax.Kind.List]({
      kind: Syntax.Kind.List,
      elements: seq
    });

    return node;
  }

  private parse_block(): Syntax.Node<Syntax.Kind.Block> {
    const open = this.stream.expect(Token.OPEN_CURLY_BRACKET);
    const statements = [];

    while (!this.stream.is(Token.CLOSE_CURLY_BRACKET) && !this.stream.is(Token.EOF)) {
      const startPosition = this.stream.snapshot();

      try {
        statements.push(this.parse_statement());
      } catch (error) {
        // console.error("Statement parsing failed, trying to recover...", error);
        this.stream.next();
        continue;
      }

      if (this.stream.snapshot() == startPosition) {
        const stuckToken = this.stream.peek();
        new exceptions.ExpressionException(`Infinite Loop Detected! Parser got stuck on token: ${stuckToken?.lexem} (${Token[stuckToken?.type]})`, stuckToken);
      }
    }

    const close = this.stream.expect(Token.CLOSE_CURLY_BRACKET);
    return new Syntax.RegistryMap[Syntax.Kind.Block]({open, close, statements});
  }

  private parse_prefix(isTypeContext: boolean = false): InstanceType<typeof Syntax.RegistryMap[Syntax.Kind]> {
    const token = this.stream.peek();
    if (!token) {
      new exceptions.ExpressionException("Unexpected EOF", token);
    }

    {
      let solution;
      solution = this.resolve_tuple();
      if (solution)
        return solution;
      solution = this.resolve_initializer(null);
      if (solution)
        return solution;
    }

    if (this.stream.consume_if(Token.OPEN_SQUARE_BRACKET)) {
      new exceptions.WarningExpressionException("[parse_block] Arrays/Lambdas not implemented yet in this snippet", token);
      new exceptions.ExpressionException(`[parse_block] Unexpected token: ${token?.lexem} at line ${token?.line}`, token);
    }

    // if (this.is_prefix_operator(token.type)) {
    if (this.is_prefix_operator(token.type) || (isTypeContext && this.is_modifier(token))) {
      const op = this.stream.next()!;
      const prec = this.is_modifier(token) ? Precedence.SCOPE : Precedence.PREFIX;
      // const operand = this.parse_expression(Precedence.PREFIX);
      const operand = this.parse_expression(prec, false, isTypeContext);
      return new Syntax.RegistryMap[Syntax.Kind.UnaryExpression]({
        operator: op,
        operand,
        isPostfix: false
      });
    }

    return this.parse_primary();
  }

  resolve_tuple() {
    const openParen = this.stream.consume_if(Token.OPEN_PAREN);
    if (!openParen)
      return null;

    const elements = [];

    if (!this.stream.is(Token.CLOSE_PAREN)) {
      do {
        elements.push(this.parse_expression(Precedence.ASSIGNMENT));
      } while (this.stream.consume_if(Token.COMMA));
    }

    const close = this.stream.expect(Token.CLOSE_PAREN);
    let node = new Syntax.RegistryMap[Syntax.Kind.List]({
      kind: Syntax.Kind.List,
      type: Syntax.Type.Tuple,
      open: openParen, close, elements
    });

    return node;
  }

  resolve_initializer(left: Syntax.Node<any> | null) {
    const open = this.stream.peek();
    if (!this.stream.consume_if(Token.OPEN_CURLY_BRACKET))
      return null;

    const elements = [];
    if (!this.stream.is(Token.CLOSE_CURLY_BRACKET)) {
      do {
        elements.push(this.parse_expression(Precedence.ASSIGNMENT));
      } while (this.stream.consume_if(Token.COMMA));
    }

    const close = this.stream.expect(Token.CLOSE_CURLY_BRACKET);
    const node = new Syntax.RegistryMap[Syntax.Kind.List]({
      kind: Syntax.Kind.List,
      type: Syntax.Type.Initializer,
      open, close, elements,
    });

    if (left)
      node.name = left;

    return node;
  }

  parse_cast_expression() {
    const peek = this.stream.peek();
    if (!peek || peek.type !== Token.IDENTIFIER)
      return null;
    if (!this.is_cast_keyword(peek))
      return null;

    const cast = this.stream.next()!;
    this.stream.expect(Token.LESS);

    const typeid = this.withAngleBrackets(() => {
      return this.parse_expression(Precedence.LOWEST, false, true);
    });
    this.expect_greater();

    this.stream.expect(Token.OPEN_PAREN);
    const operand = this.parse_expression(Precedence.LOWEST);
    this.stream.expect(Token.CLOSE_PAREN);

    const node = new Syntax.RegistryMap[Syntax.Kind.ImplicitCastExpression]({
      castType: cast,
      typeid,
      convert: operand
    });

    return node;
  }

  parse_primary(): InstanceType<typeof Syntax.RegistryMap[Syntax.Kind]> {
    const token = this.stream.peek();

    if (token?.type == Token.NUMBER) {
      this.stream.next()!;
      return new Syntax.RegistryMap[Syntax.Kind.Literal]({
        type: Syntax.Type.NumberLieral,
        value: token
      });
    }

    if (token?.type == Token.STRING) {
      this.stream.next()!;
      return new Syntax.RegistryMap[Syntax.Kind.Literal]({
        type: Syntax.Type.StringLiteral,
        value: token
      });
    }

    if (token.type == Token.PERCENT || token.type == Token.DOLLAR || token.type == Token.AMPERSAND) {
      return this.parse_instruction_operand();
    }

    const castexpr = this.parse_cast_expression();
      if (castexpr)
        return castexpr;

    if (token.type == Token.IDENTIFIER) {
      const idToken = this.stream.next()!;

      if (ReserveIdentifierCoder.is(idToken, ReserveIdentifier.RID_TRUE) || ReserveIdentifierCoder.is(idToken, ReserveIdentifier.RID_FALSE)) {
        return new Syntax.RegistryMap[Syntax.Kind.Literal]({
          type: Syntax.Type.BooleanLiteral,
          value: token
        });
      }

      if (ReserveIdentifierCoder.is(idToken, ReserveIdentifier.RID_NULLPTR)) {
        return new Syntax.RegistryMap[Syntax.Kind.Literal]({
          kind: Syntax.Kind.Literal,
          type: Syntax.Type.NullptrLiteral,
          value: token
        });
      }

      // if (ReserveIdentifierCoder.is(idToken, ReserveIdentifier.RID_NULL)) {
      //   return new Syntax.RegistryMap[Syntax.Kind.Literal]({
      //     kind: Syntax.Kind.Literal,
      //     type: Syntax.Type.NullLiteral,
      //     value: token
      //   });
      // }

      const idNode = new Syntax.RegistryMap[Syntax.Kind.Identifier]({
        selector: new Syntax.NodeShape<Syntax.Kind.Identifier>({
          kind: Syntax.Kind.Identifier,
          token: idToken,
        })
        // selector: idToken
      });

      return idNode;
    }

    new exceptions.ExpressionException(`[parse_primary] Unexpected token: ${token?.lexem} at line ${token?.line}`, token);
  }

  parse_function_call(calleeNode) {
    this.stream.expect(Token.OPEN_PAREN);
    let args= this.parse_sequence(Token.CLOSE_PAREN);

    let node = new Syntax.RegistryMap[Syntax.Kind.Call]({
      kind: Syntax.Kind.Call,
      caller: calleeNode,
      parameters: args
    });

    return node;
  }

  private parse_sequence(close: Token) {
    const seq = [];

    // Check if not empty: ( ...
    if (!this.stream.is(close)) {
      do {
        seq.push(this.parse_expression(Precedence.ASSIGNMENT));
      } while (this.stream.consume_if(Token.COMMA));
    }

    this.stream.expect(close);
    return seq;
  }

  // =================================================================
  // OPERATORS
  // =================================================================
  private angleBracketIsOperator: boolean[] = [true];

  private get isGreaterThanOperator(): boolean {
    return this.angleBracketIsOperator[this.angleBracketIsOperator.length - 1];
  }

  expect_greater(): StructToken {
    const token = this.stream.peek();

    if (token && token.type === Token.GREATER) {
      return this.stream.next()!; // The usual case: just '>'
    }

    // C++11 HACK: If it's '>>', we eat the first part of the '>',
    // and leave the second part in the stream as a new '>' token
    if (token && token.type === Token.RIGHT_SHIFT) {
      // Replace the current token in the stream from '>>' to '>'
      this.stream.swap(new StructToken({
        ...token,
        type: Token.GREATER,
        lexem: ">"
      }));

      // Return a fake token '>' for the current call
      return new StructToken({
        ...token,
        type: Token.GREATER,
        lexem: ">"
      });
    }

    // If it's '>=', you can split it into '>' and '=' (rarely needed for templates, but it happens)
    if (token && token.type === Token.GREATER_EQUAL) {
      this.stream.swap(new StructToken({
        ...token,
        type: Token.EQUAL,
        lexem: "="
      }));
      return new StructToken({ ...token, type: Token.GREATER, lexem: ">" });
    }

    new exceptions.ExpressionException(`[except] Expected token type:GREATER got ${Token[token?.type]}`, token);
  }

  // Helper for < ... >. Push to stack and call callback with it.
  private withAngleBrackets<T>(callback: () => T): T {
    this.angleBracketIsOperator.push(false); // disallow '>' be operator
    try {
      return callback();
    } finally {
      this.angleBracketIsOperator.pop(); // return to normal
    }
  }

  // =================================================================
  // HELPERS
  // =================================================================

  private is_modifier(token: StructToken | undefined): boolean {
    if (!token) return false;
    return [
      ReserveIdentifierCoder.is(token, ReserveIdentifier.RID_CONST),
      ReserveIdentifierCoder.is(token, ReserveIdentifier.RID_VOLATILE),
      ReserveIdentifierCoder.is(token, ReserveIdentifier.RID_STATIC),
      ReserveIdentifierCoder.is(token, ReserveIdentifier.RID_CONSTEXPR),

      ReserveIdentifierCoder.is(token, ReserveIdentifier.RID___INIT),
      ReserveIdentifierCoder.is(token, ReserveIdentifier.RID___EXIT),
      ReserveIdentifierCoder.is(token, ReserveIdentifier.RID_SHARE_SYMBOL),
    ].includes(true);
  }

  private is_decl_qualifier(token: StructToken | undefined): boolean {
    if (!token) return false;
    return [
      token.lexem == "fn",
      token.lexem == "constructor",
      token.lexem == "destructor",
    ].includes(true);
  }

  private get_next_precedence(stopAtBrace: boolean = false, isTypeContext: boolean = false): Precedence {
    const token = this.stream.peek();
    if (!token) return Precedence.LOWEST;

    if (stopAtBrace && token.type == Token.OPEN_CURLY_BRACKET) return Precedence.LOWEST;

    if (isTypeContext) {
      if ([Token.STAR, Token.AMPERSAND, Token.OPERATOR_AND].includes(token.type) || this.is_modifier(token)) {
        return Precedence.POSTFIX;
      }
      if (token.type === Token.ELLIPSIS) {
        return Precedence.LOWEST;
      }
    }

    if (token.type == Token.INCREMENT || token.type == Token.DECREMENT) return Precedence.POSTFIX;
    if (token.type == Token.OPEN_PAREN) return Precedence.POSTFIX; // Call
    if (token.type == Token.OPEN_SQUARE_BRACKET) return Precedence.POSTFIX;
    if (token.type == Token.OPEN_CURLY_BRACKET) return Precedence.POSTFIX;

    return this.get_precedence(token.type);
  }

  private get_precedence(type: Token | undefined): Precedence {
    if (this.is_direct_assignment_operator(type) || this.is_compound_assignment_operator(type)) {
      return Precedence.ASSIGNMENT;
    }

    switch (type) {
      case Token.COLON: return Precedence.ASSIGNMENT;
      case Token.COMMA: return Precedence.COMMA;
      // is_direct_assignment_operator && is_compound_assignment_operator
      case Token.OPERATOR_OR: return Precedence.LOGICAL_OR;
      case Token.OPERATOR_AND: return Precedence.LOGICAL_AND;
      case Token.PIPE: return Precedence.BITWISE_OR; // |
      case Token.CARET: return Precedence.BITWISE_XOR; // ^
      case Token.AMPERSAND: return Precedence.BITWISE_AND; // &

      case Token.EQUAL_EQUAL:
      case Token.BANG_EQUAL: return Precedence.EQUALITY;

      case Token.LESS:
      case Token.LESS_EQUAL:
      case Token.GREATER_EQUAL: return Precedence.RELATIONAL;
  
      case Token.GREATER:
        return this.isGreaterThanOperator ? Precedence.RELATIONAL : Precedence.LOWEST;

      // SPACESHIP

      case Token.LEFT_SHIFT: return Precedence.SHIFT;
      case Token.RIGHT_SHIFT:
        return this.isGreaterThanOperator ? Precedence.SHIFT : Precedence.LOWEST;

      case Token.PLUS:
      case Token.MINUS: return Precedence.ADDITIVE;

      case Token.STAR:
      case Token.SLASH:
      case Token.PERCENT: return Precedence.MULTIPLICATIVE;

      // MEMBER_POINTER
      // PREFIX

      case Token.DOT:
      case Token.ARROW: return Precedence.POSTFIX;
      case Token.SCOPE: return Precedence.SCOPE;

      default: return Precedence.LOWEST;
    }
  }

  private is_prefix_operator(type: Token): boolean {
    return [
      Token.INCREMENT, Token.DECREMENT,
      Token.PLUS, Token.MINUS,
      Token.BANG, Token.TILDE,
      Token.STAR, Token.AMPERSAND,
    ].includes(type);
  }

  is_binary_operator(type: Token): boolean {
    const part = [
      Token.COLON, // for @section
      Token.STAR, Token.SLASH, Token.PERCENT,
      Token.PLUS, Token.MINUS,
      Token.LEFT_SHIFT, Token.RIGHT_SHIFT,
      Token.LESS, Token.LESS_EQUAL, Token.GREATER, Token.GREATER_EQUAL,
      Token.EQUAL_EQUAL, Token.BANG_EQUAL,
      Token.AMPERSAND, Token.CARET, Token.PIPE,
      Token.OPERATOR_AND, Token.OPERATOR_OR,
    ].includes(type!);

    return [
      part,
      this.is_direct_assignment_operator(type),
      this.is_compound_assignment_operator(type)
    ].includes(true)
  }

  is_direct_assignment_operator(type: Token): boolean {
    return type == Token.EQUAL;
  }

  is_compound_assignment_operator(type: Token): boolean {
    return [
      Token.PLUS_EQUAL, Token.MINUS_EQUAL,
      Token.STAR_EQUAL, Token.SLASH_EQUAL, Token.PERCENT_EQUAL,
    ].includes(type!);
  }

  private is_right_associative(type: Token): boolean {
    if (this.is_direct_assignment_operator(type) || this.is_compound_assignment_operator(type)) {
      return true;
    }
    return false;
  }

  is_cast_keyword(token: StructToken): boolean {
    return [
      ReserveIdentifierCoder.is(token, ReserveIdentifier.RID_STATICCAST),
      ReserveIdentifierCoder.is(token, ReserveIdentifier.RID_CONSTCAST),
      ReserveIdentifierCoder.is(token, ReserveIdentifier.RID_DYNAMICCAST),
      ReserveIdentifierCoder.is(token, ReserveIdentifier.RID_REINTERPRETCAST)
    ].some(Boolean)
  }
}

export {
  RecursiveDescentParser
}