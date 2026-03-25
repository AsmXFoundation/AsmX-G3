"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecursiveDescentParser = void 0;
const print_cjs_1 = require("../backend/targets/x86_64/print.cjs");
const expression_cjs_1 = require("../types/expression.cjs");
const token_cjs_1 = require("../types/token.cjs");
const exceptions = require('llvm.js/exceptions');
var Precedence;
(function (Precedence) {
    Precedence[Precedence["LOWEST"] = 0] = "LOWEST";
    Precedence[Precedence["COMMA"] = 10] = "COMMA";
    Precedence[Precedence["ASSIGNMENT"] = 20] = "ASSIGNMENT";
    Precedence[Precedence["TERNARY"] = 20] = "TERNARY";
    Precedence[Precedence["LOGICAL_OR"] = 30] = "LOGICAL_OR";
    Precedence[Precedence["LOGICAL_AND"] = 40] = "LOGICAL_AND";
    Precedence[Precedence["BITWISE_OR"] = 50] = "BITWISE_OR";
    Precedence[Precedence["BITWISE_XOR"] = 60] = "BITWISE_XOR";
    Precedence[Precedence["BITWISE_AND"] = 70] = "BITWISE_AND";
    Precedence[Precedence["EQUALITY"] = 80] = "EQUALITY";
    Precedence[Precedence["RELATIONAL"] = 90] = "RELATIONAL";
    Precedence[Precedence["SPACESHIP"] = 100] = "SPACESHIP";
    Precedence[Precedence["SHIFT"] = 110] = "SHIFT";
    Precedence[Precedence["ADDITIVE"] = 120] = "ADDITIVE";
    Precedence[Precedence["MULTIPLICATIVE"] = 130] = "MULTIPLICATIVE";
    Precedence[Precedence["MEMBER_POINTER"] = 140] = "MEMBER_POINTER";
    Precedence[Precedence["PREFIX"] = 150] = "PREFIX";
    Precedence[Precedence["POSTFIX"] = 160] = "POSTFIX";
    Precedence[Precedence["SCOPE"] = 170] = "SCOPE";
})(Precedence || (Precedence = {}));
class RecursiveDescentParser {
    constructor(tokens) {
        // =================================================================
        // OPERATORS
        // =================================================================
        this.angleBracketIsOperator = [true];
        this.stream = new token_cjs_1.TokenStream(tokens);
    }
    // =================================================================
    // ENTRY POINT
    // =================================================================
    parse_translation_unit() {
        const nodes = [];
        print_cjs_1.PrintTree.verbose = true;
        while (this.stream.peek()?.type !== token_cjs_1.Token.EOF && this.stream.peek() !== null) {
            nodes.push(this.parse_statement());
        }
        return nodes;
    }
    // =================================================================
    // STATEMENTS & INSTRUCTIONS
    // =================================================================
    parse_statement() {
        const token = this.stream.peek();
        if (token.type == token_cjs_1.Token.DOGE) {
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
            if (next_token && next_token.type == token_cjs_1.Token.IDENTIFIER) {
                return this.parse_variable_declaration(modifiers, base_expr);
            }
            if (modifiers.length > 0) {
                new exceptions.ExpressionException("Expected variable name after modifiers and type", next_token);
            }
            // otherwise (Expression Statement)
            // just simple expression aka "mystruct.release = 3"
            let expr_node = base_expr;
            if (next_token && (this.is_direct_assignment_operator(next_token.type) ||
                this.is_compound_assignment_operator(next_token.type) ||
                next_token.type == token_cjs_1.Token.COLON)) {
                const operator = this.stream.next();
                // const right = this.parse_expression(Precedence.LOWEST);
                if (operator.type == token_cjs_1.Token.COLON) {
                    const right = this.parse_type_constructor();
                    expr_node = new expression_cjs_1.Syntax.RegistryMap[expression_cjs_1.Syntax.Kind.SectionFieldDecl]({
                        kind: expression_cjs_1.Syntax.Kind.SectionFieldDecl,
                        name: base_expr,
                        colonToken: operator,
                        value: right
                    });
                }
                else {
                    const right = this.parse_expression(Precedence.LOWEST);
                    expr_node = new expression_cjs_1.Syntax.RegistryMap[expression_cjs_1.Syntax.Kind.BinaryExpression]({
                        kind: expression_cjs_1.Syntax.Kind.BinaryExpression,
                        left: base_expr,
                        operator,
                        right
                    });
                }
            }
            this.stream.expect(token_cjs_1.Token.SEMICOLON);
            return expr_node;
        }
        const expr = this.parse_expression(0);
        this.stream.consume_if(token_cjs_1.Token.SEMICOLON);
        return expr;
    }
    parse_instruction() {
        this.stream.expect(token_cjs_1.Token.DOGE); // Consume @
        const name_token = this.stream.expect(token_cjs_1.Token.IDENTIFIER); // consume
        const nodeShape = new expression_cjs_1.Syntax.RegistryMap[expression_cjs_1.Syntax.Kind.Instruction]({
            name: new expression_cjs_1.Syntax.NodeShape({
                kind: expression_cjs_1.Syntax.Kind.Identifier,
                token: name_token,
            }),
            operands: []
        });
        // Lookahead next 2 tokens, avoid crap
        // is a for only @section name {...}
        garbage: {
            if (name_token.lexem != "section")
                break garbage;
            if (this.stream.is(token_cjs_1.Token.IDENTIFIER) && this.stream.is(token_cjs_1.Token.OPEN_CURLY_BRACKET, 1)) {
                const extra_name = this.stream.expect(token_cjs_1.Token.IDENTIFIER);
                nodeShape.operands.push(new expression_cjs_1.Syntax.NodeShape({
                    kind: expression_cjs_1.Syntax.Kind.Identifier,
                    token: extra_name
                }));
                const block = this.parse_block();
                nodeShape.operands.push(block);
                this.stream.consume_if(token_cjs_1.Token.SEMICOLON);
                return nodeShape;
            }
        }
        // otherwise is a just list operands delimited comma operator
        // is a @instruction operand (, operand)+
        {
            const operands = [];
            if (!this.stream.is(token_cjs_1.Token.SEMICOLON) && !this.stream.is(token_cjs_1.Token.EOF)) {
                do {
                    const expression = this.parse_expression(Precedence.ASSIGNMENT);
                    if (expression)
                        operands.push(expression);
                } while (this.stream.consume_if(token_cjs_1.Token.COMMA));
            }
            nodeShape.operands = operands;
        }
        // but, if not have semicolon token then we check what next instruction/statement at the next line 
        this.stream.consume_if(token_cjs_1.Token.SEMICOLON);
        // write release
        return nodeShape;
    }
    parse_variable_declaration(modifiers, typeNode) {
        const nameNode = this.parse_expression(Precedence.POSTFIX);
        let initializer = null;
        // check initializer ( = expr) or (= { })
        const peek = this.stream.peek();
        if (peek && this.is_direct_assignment_operator(peek.type)) {
            this.stream.next();
            initializer = this.parse_expression(Precedence.LOWEST);
        }
        // Uniform initialization (C++11): std::vector<int> vec {1, 2, 3};
        if (peek && peek.type == token_cjs_1.Token.OPEN_CURLY_BRACKET) {
            initializer = this.parse_prefix();
        }
        this.stream.expect(token_cjs_1.Token.SEMICOLON);
        const node = new expression_cjs_1.Syntax.RegistryMap[expression_cjs_1.Syntax.Kind.VariableDeclaration]({
            kind: expression_cjs_1.Syntax.Kind.VariableDeclaration,
            modifiers,
            typeNode,
            name: nameNode,
            initializer
        });
        return node;
    }
    parse_functional_declaration(modifiers) {
        const qualifier = this.stream.expect(token_cjs_1.Token.IDENTIFIER);
        const name = this.parse_expression(Precedence.POSTFIX);
        let parameters = [];
        let returnType = null;
        let body = null;
        let isDefaulted = false;
        let isDeleted = false;
        // parameters
        if (this.stream.is(token_cjs_1.Token.OPEN_PAREN)) {
            this.stream.next();
            if (!this.stream.is(token_cjs_1.Token.CLOSE_PAREN)) {
                do {
                    parameters.push(this.parse_parameter_declaration());
                } while (this.stream.consume_if(token_cjs_1.Token.COMMA));
            }
            this.stream.expect(token_cjs_1.Token.CLOSE_PAREN);
        }
        // return type
        if (this.stream.is(token_cjs_1.Token.ARROW)) {
            this.stream.next(); // consume ->
            returnType = this.parse_expression(Precedence.ASSIGNMENT, true);
        }
        // peek for decide it's body or assignment
        const peek = this.stream.peek();
        // body { }
        if (peek && peek.type == token_cjs_1.Token.OPEN_CURLY_BRACKET) {
            body = this.parse_block();
            this.stream.consume_if(token_cjs_1.Token.SEMICOLON);
        }
        // assignment
        else if (this.stream.consume_if(token_cjs_1.Token.EQUAL)) {
            this.stream.next(); // consume = 
            const keyword = this.stream.expect(token_cjs_1.Token.IDENTIFIER);
            if (keyword.lexem == "default") {
                isDefaulted = true;
            }
            else if (keyword.lexem == "delete") {
                isDeleted = true;
            }
            else {
                new exceptions.ExpressionException("Expected 'default' or 'delete' after '=' in function declaration", keyword);
            }
            this.stream.expect(token_cjs_1.Token.SEMICOLON);
        }
        else {
            new exceptions.ExpressionException("Expected function body '{ ... }' or '= default;'", peek);
        }
        const node = new expression_cjs_1.Syntax.RegistryMap[expression_cjs_1.Syntax.Kind.FunctionDeclaration]({
            kind: expression_cjs_1.Syntax.Kind.FunctionDeclaration,
            modifiers,
            qualifier,
            name: name,
            parameters,
            returnType,
            body,
            isDefaulted,
            isDeleted
        });
        return node;
    }
    parse_parameter_declaration() {
        const modifiers = [];
        while (this.is_modifier(this.stream.peek())) {
            modifiers.push(this.stream.next());
        }
        const typeNode = this.parse_expression(Precedence.ASSIGNMENT, false, true);
        let isVariadic = false;
        if (this.stream.consume_if(token_cjs_1.Token.ELLIPSIS)) {
            isVariadic = true;
        }
        let name = null;
        if (this.stream.is(token_cjs_1.Token.IDENTIFIER)) {
            name = this.parse_primary();
        }
        if (!isVariadic && this.stream.consume_if(token_cjs_1.Token.ELLIPSIS)) {
            isVariadic = true;
        }
        const node = new expression_cjs_1.Syntax.RegistryMap[expression_cjs_1.Syntax.Kind.ParameterDeclaration]({
            modifiers, typeNode, pointers: [], reference: null, isVariadic, name
        });
        return node;
    }
    // =================================================================
    // EXPRESSIONS (Pratt Parser / Precedence Climbing)
    // =================================================================
    // Here we resolve context (register vs imm vs memory, etc)
    parse_instruction_operand() {
        const token = this.stream.peek();
        if (token?.type == undefined)
            return this.parse_expression(0);
        if (token.type == token_cjs_1.Token.PERCENT) {
            this.stream.next(); // skip %
            const name = this.stream.expect(token_cjs_1.Token.IDENTIFIER);
            return new expression_cjs_1.Syntax.RegistryMap[expression_cjs_1.Syntax.Kind.UnaryExpression]({
                operator: token,
                operand: new expression_cjs_1.Syntax.NodeShape({
                    kind: expression_cjs_1.Syntax.Kind.Identifier,
                    token: name
                })
            });
        }
        // Immediate: $10 or $imm
        if (token.type == token_cjs_1.Token.DOLLAR) {
            this.stream.next(); // skip $
            const value = this.parse_primary();
            return new expression_cjs_1.Syntax.RegistryMap[expression_cjs_1.Syntax.Kind.UnaryExpression]({
                operator: token,
                operand: value
            });
        }
        // Addr / ref: &var
        if (token.type == token_cjs_1.Token.AMPERSAND) {
            this.stream.next(); // skip &
            const value = this.parse_expression(this.get_precedence(token_cjs_1.Token.AMPERSAND));
            return new expression_cjs_1.Syntax.RegistryMap[expression_cjs_1.Syntax.Kind.UnaryExpression]({
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
    parse_expression(minPrecedence = Precedence.LOWEST, stopAtBrace = false, isTypeContext = false) {
        let left = this.parse_prefix(isTypeContext);
        while (minPrecedence < this.get_next_precedence(stopAtBrace, isTypeContext)) {
            const token = this.stream.peek();
            if (!token)
                break;
            if (this.stream.is(token_cjs_1.Token.OPEN_PAREN)) {
                left = this.parse_function_call(left);
                continue;
            }
            if (this.stream.is(token_cjs_1.Token.DOT) || this.stream.is(token_cjs_1.Token.SCOPE) || this.stream.is(token_cjs_1.Token.ARROW)) {
                const operator = this.stream.next();
                // const right = this.parse_primary();
                const right = this.parse_expression(Precedence.POSTFIX, stopAtBrace, isTypeContext);
                left = new expression_cjs_1.Syntax.RegistryMap[expression_cjs_1.Syntax.Kind.Identifier]({
                    kind: expression_cjs_1.Syntax.Kind.Identifier,
                    operator,
                    selector: left,
                    forward: right
                });
                continue;
            }
            if (isTypeContext && (token.type === token_cjs_1.Token.STAR || token.type === token_cjs_1.Token.AMPERSAND || token.type === token_cjs_1.Token.OPERATOR_AND || this.is_modifier(token))) {
                this.stream.next();
                left = new expression_cjs_1.Syntax.RegistryMap[expression_cjs_1.Syntax.Kind.UnaryExpression]({
                    kind: expression_cjs_1.Syntax.Kind.UnaryExpression,
                    operator: token,
                    operand: left,
                    isPostfix: true
                });
                continue;
            }
            // Handle postfix (a++, a--)
            if (token.type == token_cjs_1.Token.INCREMENT || token.type == token_cjs_1.Token.DECREMENT) {
                this.stream.next(); // eat the postfix
                left = new expression_cjs_1.Syntax.RegistryMap[expression_cjs_1.Syntax.Kind.UnaryExpression]({
                    kind: expression_cjs_1.Syntax.Kind.UnaryExpression,
                    operator: token,
                    operand: left,
                    isPostfix: true
                });
            }
            if (this.is_binary_operator(token.type)) {
                const operator = this.stream.next();
                const nextPrecedence = this.is_right_associative(operator.type)
                    ? this.get_precedence(operator.type)
                    : this.get_precedence(operator.type) + 1;
                const right = this.parse_expression(nextPrecedence, stopAtBrace, isTypeContext);
                left = new expression_cjs_1.Syntax.RegistryMap[expression_cjs_1.Syntax.Kind.BinaryExpression]({ left, operator, right });
                continue;
            }
            if (token.type == token_cjs_1.Token.COMMA) {
                const right = this.parse_comma_separator();
                right.elements.unshift(left);
                left = right;
                continue;
            }
            if (token.type == token_cjs_1.Token.OPEN_CURLY_BRACKET) {
                left = this.resolve_initializer(left);
                continue;
            }
            // If it's not handled as infix/postfix, exit
            break;
        }
        return left;
    }
    parse_comma_separator() {
        this.stream.expect(token_cjs_1.Token.COMMA);
        const seq = [];
        do {
            let expr = this.parse_expression(Precedence.ASSIGNMENT);
            seq.push(expr);
        } while (this.stream.consume_if(token_cjs_1.Token.COMMA));
        let node = new expression_cjs_1.Syntax.RegistryMap[expression_cjs_1.Syntax.Kind.List]({
            kind: expression_cjs_1.Syntax.Kind.List,
            elements: seq
        });
        return node;
    }
    parse_block() {
        const open = this.stream.expect(token_cjs_1.Token.OPEN_CURLY_BRACKET);
        const statements = [];
        while (!this.stream.is(token_cjs_1.Token.CLOSE_CURLY_BRACKET) && !this.stream.is(token_cjs_1.Token.EOF)) {
            const startPosition = this.stream.snapshot();
            try {
                statements.push(this.parse_statement());
            }
            catch (error) {
                // console.error("Statement parsing failed, trying to recover...", error);
                this.stream.next();
                continue;
            }
            if (this.stream.snapshot() == startPosition) {
                const stuckToken = this.stream.peek();
                new exceptions.ExpressionException(`Infinite Loop Detected! Parser got stuck on token: ${stuckToken?.lexem} (${token_cjs_1.Token[stuckToken?.type]})`, stuckToken);
            }
        }
        const close = this.stream.expect(token_cjs_1.Token.CLOSE_CURLY_BRACKET);
        return new expression_cjs_1.Syntax.RegistryMap[expression_cjs_1.Syntax.Kind.Block]({ open, close, statements });
    }
    parse_prefix(isTypeContext = false) {
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
        if (this.stream.consume_if(token_cjs_1.Token.OPEN_SQUARE_BRACKET)) {
            new exceptions.WarningExpressionException("[parse_block] Arrays/Lambdas not implemented yet in this snippet", token);
            new exceptions.ExpressionException(`[parse_block] Unexpected token: ${token?.lexem} at line ${token?.line}`, token);
        }
        // if (this.is_prefix_operator(token.type)) {
        if (this.is_prefix_operator(token.type) || (isTypeContext && this.is_modifier(token))) {
            const op = this.stream.next();
            const prec = this.is_modifier(token) ? Precedence.SCOPE : Precedence.PREFIX;
            // const operand = this.parse_expression(Precedence.PREFIX);
            const operand = this.parse_expression(prec, false, isTypeContext);
            return new expression_cjs_1.Syntax.RegistryMap[expression_cjs_1.Syntax.Kind.UnaryExpression]({
                operator: op,
                operand,
                isPostfix: false
            });
        }
        return this.parse_primary();
    }
    resolve_tuple() {
        const openParen = this.stream.consume_if(token_cjs_1.Token.OPEN_PAREN);
        if (!openParen)
            return null;
        const elements = [];
        if (!this.stream.is(token_cjs_1.Token.CLOSE_PAREN)) {
            do {
                elements.push(this.parse_expression(Precedence.ASSIGNMENT));
            } while (this.stream.consume_if(token_cjs_1.Token.COMMA));
        }
        const close = this.stream.expect(token_cjs_1.Token.CLOSE_PAREN);
        let node = new expression_cjs_1.Syntax.RegistryMap[expression_cjs_1.Syntax.Kind.List]({
            kind: expression_cjs_1.Syntax.Kind.List,
            type: expression_cjs_1.Syntax.Type.Tuple,
            open: openParen, close, elements
        });
        return node;
    }
    resolve_initializer(left) {
        const open = this.stream.peek();
        if (!this.stream.consume_if(token_cjs_1.Token.OPEN_CURLY_BRACKET))
            return null;
        const elements = [];
        if (!this.stream.is(token_cjs_1.Token.CLOSE_CURLY_BRACKET)) {
            do {
                elements.push(this.parse_expression(Precedence.ASSIGNMENT));
            } while (this.stream.consume_if(token_cjs_1.Token.COMMA));
        }
        const close = this.stream.expect(token_cjs_1.Token.CLOSE_CURLY_BRACKET);
        const node = new expression_cjs_1.Syntax.RegistryMap[expression_cjs_1.Syntax.Kind.List]({
            kind: expression_cjs_1.Syntax.Kind.List,
            type: expression_cjs_1.Syntax.Type.Initializer,
            open, close, elements,
        });
        if (left)
            node.name = left;
        return node;
    }
    parse_cast_expression() {
        const peek = this.stream.peek();
        if (!peek || peek.type !== token_cjs_1.Token.IDENTIFIER)
            return null;
        if (!this.is_cast_keyword(peek))
            return null;
        const cast = this.stream.next();
        this.stream.expect(token_cjs_1.Token.LESS);
        const typeid = this.withAngleBrackets(() => {
            return this.parse_expression(Precedence.LOWEST, false, true);
        });
        this.expect_greater();
        this.stream.expect(token_cjs_1.Token.OPEN_PAREN);
        const operand = this.parse_expression(Precedence.LOWEST);
        this.stream.expect(token_cjs_1.Token.CLOSE_PAREN);
        const node = new expression_cjs_1.Syntax.RegistryMap[expression_cjs_1.Syntax.Kind.ImplicitCastExpression]({
            castType: cast,
            typeid,
            convert: operand
        });
        return node;
    }
    parse_primary() {
        const token = this.stream.peek();
        if (token?.type == token_cjs_1.Token.NUMBER) {
            this.stream.next();
            return new expression_cjs_1.Syntax.RegistryMap[expression_cjs_1.Syntax.Kind.Literal]({
                type: expression_cjs_1.Syntax.Type.NumberLieral,
                value: token
            });
        }
        if (token?.type == token_cjs_1.Token.STRING) {
            this.stream.next();
            return new expression_cjs_1.Syntax.RegistryMap[expression_cjs_1.Syntax.Kind.Literal]({
                type: expression_cjs_1.Syntax.Type.StringLiteral,
                value: token
            });
        }
        if (token.type == token_cjs_1.Token.PERCENT || token.type == token_cjs_1.Token.DOLLAR || token.type == token_cjs_1.Token.AMPERSAND) {
            return this.parse_instruction_operand();
        }
        const castexpr = this.parse_cast_expression();
        if (castexpr)
            return castexpr;
        if (token.type == token_cjs_1.Token.IDENTIFIER) {
            const idToken = this.stream.next();
            if (token_cjs_1.ReserveIdentifierCoder.is(idToken, token_cjs_1.ReserveIdentifier.RID_TRUE) || token_cjs_1.ReserveIdentifierCoder.is(idToken, token_cjs_1.ReserveIdentifier.RID_FALSE)) {
                return new expression_cjs_1.Syntax.RegistryMap[expression_cjs_1.Syntax.Kind.Literal]({
                    type: expression_cjs_1.Syntax.Type.BooleanLiteral,
                    value: token
                });
            }
            if (token_cjs_1.ReserveIdentifierCoder.is(idToken, token_cjs_1.ReserveIdentifier.RID_NULLPTR)) {
                return new expression_cjs_1.Syntax.RegistryMap[expression_cjs_1.Syntax.Kind.Literal]({
                    kind: expression_cjs_1.Syntax.Kind.Literal,
                    type: expression_cjs_1.Syntax.Type.NullptrLiteral,
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
            const idNode = new expression_cjs_1.Syntax.RegistryMap[expression_cjs_1.Syntax.Kind.Identifier]({
                selector: new expression_cjs_1.Syntax.NodeShape({
                    kind: expression_cjs_1.Syntax.Kind.Identifier,
                    token: idToken,
                })
                // selector: idToken
            });
            return idNode;
        }
        new exceptions.ExpressionException(`[parse_primary] Unexpected token: ${token?.lexem} at line ${token?.line}`, token);
    }
    parse_function_call(calleeNode) {
        this.stream.expect(token_cjs_1.Token.OPEN_PAREN);
        let args = this.parse_sequence(token_cjs_1.Token.CLOSE_PAREN);
        let node = new expression_cjs_1.Syntax.RegistryMap[expression_cjs_1.Syntax.Kind.Call]({
            kind: expression_cjs_1.Syntax.Kind.Call,
            caller: calleeNode,
            parameters: args
        });
        return node;
    }
    parse_sequence(close) {
        const seq = [];
        // Check if not empty: ( ...
        if (!this.stream.is(close)) {
            do {
                seq.push(this.parse_expression(Precedence.ASSIGNMENT));
            } while (this.stream.consume_if(token_cjs_1.Token.COMMA));
        }
        this.stream.expect(close);
        return seq;
    }
    get isGreaterThanOperator() {
        return this.angleBracketIsOperator[this.angleBracketIsOperator.length - 1];
    }
    expect_greater() {
        const token = this.stream.peek();
        if (token && token.type === token_cjs_1.Token.GREATER) {
            return this.stream.next(); // The usual case: just '>'
        }
        // C++11 HACK: If it's '>>', we eat the first part of the '>',
        // and leave the second part in the stream as a new '>' token
        if (token && token.type === token_cjs_1.Token.RIGHT_SHIFT) {
            // Replace the current token in the stream from '>>' to '>'
            this.stream.swap(new token_cjs_1.StructToken({
                ...token,
                type: token_cjs_1.Token.GREATER,
                lexem: ">"
            }));
            // Return a fake token '>' for the current call
            return new token_cjs_1.StructToken({
                ...token,
                type: token_cjs_1.Token.GREATER,
                lexem: ">"
            });
        }
        // If it's '>=', you can split it into '>' and '=' (rarely needed for templates, but it happens)
        if (token && token.type === token_cjs_1.Token.GREATER_EQUAL) {
            this.stream.swap(new token_cjs_1.StructToken({
                ...token,
                type: token_cjs_1.Token.EQUAL,
                lexem: "="
            }));
            return new token_cjs_1.StructToken({ ...token, type: token_cjs_1.Token.GREATER, lexem: ">" });
        }
        new exceptions.ExpressionException(`[except] Expected token type:GREATER got ${token_cjs_1.Token[token?.type]}`, token);
    }
    // Helper for < ... >. Push to stack and call callback with it.
    withAngleBrackets(callback) {
        this.angleBracketIsOperator.push(false); // disallow '>' be operator
        try {
            return callback();
        }
        finally {
            this.angleBracketIsOperator.pop(); // return to normal
        }
    }
    // =================================================================
    // HELPERS
    // =================================================================
    is_modifier(token) {
        if (!token)
            return false;
        return [
            token_cjs_1.ReserveIdentifierCoder.is(token, token_cjs_1.ReserveIdentifier.RID_CONST),
            token_cjs_1.ReserveIdentifierCoder.is(token, token_cjs_1.ReserveIdentifier.RID_VOLATILE),
            token_cjs_1.ReserveIdentifierCoder.is(token, token_cjs_1.ReserveIdentifier.RID_STATIC),
            token_cjs_1.ReserveIdentifierCoder.is(token, token_cjs_1.ReserveIdentifier.RID_CONSTEXPR),
            token_cjs_1.ReserveIdentifierCoder.is(token, token_cjs_1.ReserveIdentifier.RID___INIT),
            token_cjs_1.ReserveIdentifierCoder.is(token, token_cjs_1.ReserveIdentifier.RID___EXIT),
            token_cjs_1.ReserveIdentifierCoder.is(token, token_cjs_1.ReserveIdentifier.RID_SHARE_SYMBOL),
        ].includes(true);
    }
    is_decl_qualifier(token) {
        if (!token)
            return false;
        return [
            token.lexem == "fn",
            token.lexem == "constructor",
            token.lexem == "destructor",
        ].includes(true);
    }
    get_next_precedence(stopAtBrace = false, isTypeContext = false) {
        const token = this.stream.peek();
        if (!token)
            return Precedence.LOWEST;
        if (stopAtBrace && token.type == token_cjs_1.Token.OPEN_CURLY_BRACKET)
            return Precedence.LOWEST;
        if (isTypeContext) {
            if ([token_cjs_1.Token.STAR, token_cjs_1.Token.AMPERSAND, token_cjs_1.Token.OPERATOR_AND].includes(token.type) || this.is_modifier(token)) {
                return Precedence.POSTFIX;
            }
            if (token.type === token_cjs_1.Token.ELLIPSIS) {
                return Precedence.LOWEST;
            }
        }
        if (token.type == token_cjs_1.Token.INCREMENT || token.type == token_cjs_1.Token.DECREMENT)
            return Precedence.POSTFIX;
        if (token.type == token_cjs_1.Token.OPEN_PAREN)
            return Precedence.POSTFIX; // Call
        if (token.type == token_cjs_1.Token.OPEN_SQUARE_BRACKET)
            return Precedence.POSTFIX;
        if (token.type == token_cjs_1.Token.OPEN_CURLY_BRACKET)
            return Precedence.POSTFIX;
        return this.get_precedence(token.type);
    }
    get_precedence(type) {
        if (this.is_direct_assignment_operator(type) || this.is_compound_assignment_operator(type)) {
            return Precedence.ASSIGNMENT;
        }
        switch (type) {
            case token_cjs_1.Token.COLON: return Precedence.ASSIGNMENT;
            case token_cjs_1.Token.COMMA: return Precedence.COMMA;
            // is_direct_assignment_operator && is_compound_assignment_operator
            case token_cjs_1.Token.OPERATOR_OR: return Precedence.LOGICAL_OR;
            case token_cjs_1.Token.OPERATOR_AND: return Precedence.LOGICAL_AND;
            case token_cjs_1.Token.PIPE: return Precedence.BITWISE_OR; // |
            case token_cjs_1.Token.CARET: return Precedence.BITWISE_XOR; // ^
            case token_cjs_1.Token.AMPERSAND: return Precedence.BITWISE_AND; // &
            case token_cjs_1.Token.EQUAL_EQUAL:
            case token_cjs_1.Token.BANG_EQUAL: return Precedence.EQUALITY;
            case token_cjs_1.Token.LESS:
            case token_cjs_1.Token.LESS_EQUAL:
            case token_cjs_1.Token.GREATER_EQUAL: return Precedence.RELATIONAL;
            case token_cjs_1.Token.GREATER:
                return this.isGreaterThanOperator ? Precedence.RELATIONAL : Precedence.LOWEST;
            // SPACESHIP
            case token_cjs_1.Token.LEFT_SHIFT: return Precedence.SHIFT;
            case token_cjs_1.Token.RIGHT_SHIFT:
                return this.isGreaterThanOperator ? Precedence.SHIFT : Precedence.LOWEST;
            case token_cjs_1.Token.PLUS:
            case token_cjs_1.Token.MINUS: return Precedence.ADDITIVE;
            case token_cjs_1.Token.STAR:
            case token_cjs_1.Token.SLASH:
            case token_cjs_1.Token.PERCENT: return Precedence.MULTIPLICATIVE;
            // MEMBER_POINTER
            // PREFIX
            case token_cjs_1.Token.DOT:
            case token_cjs_1.Token.ARROW: return Precedence.POSTFIX;
            case token_cjs_1.Token.SCOPE: return Precedence.SCOPE;
            default: return Precedence.LOWEST;
        }
    }
    is_prefix_operator(type) {
        return [
            token_cjs_1.Token.INCREMENT, token_cjs_1.Token.DECREMENT,
            token_cjs_1.Token.PLUS, token_cjs_1.Token.MINUS,
            token_cjs_1.Token.BANG, token_cjs_1.Token.TILDE,
            token_cjs_1.Token.STAR, token_cjs_1.Token.AMPERSAND,
        ].includes(type);
    }
    is_binary_operator(type) {
        const part = [
            token_cjs_1.Token.COLON, // for @section
            token_cjs_1.Token.STAR, token_cjs_1.Token.SLASH, token_cjs_1.Token.PERCENT,
            token_cjs_1.Token.PLUS, token_cjs_1.Token.MINUS,
            token_cjs_1.Token.LEFT_SHIFT, token_cjs_1.Token.RIGHT_SHIFT,
            token_cjs_1.Token.LESS, token_cjs_1.Token.LESS_EQUAL, token_cjs_1.Token.GREATER, token_cjs_1.Token.GREATER_EQUAL,
            token_cjs_1.Token.EQUAL_EQUAL, token_cjs_1.Token.BANG_EQUAL,
            token_cjs_1.Token.AMPERSAND, token_cjs_1.Token.CARET, token_cjs_1.Token.PIPE,
            token_cjs_1.Token.OPERATOR_AND, token_cjs_1.Token.OPERATOR_OR,
        ].includes(type);
        return [
            part,
            this.is_direct_assignment_operator(type),
            this.is_compound_assignment_operator(type)
        ].includes(true);
    }
    is_direct_assignment_operator(type) {
        return type == token_cjs_1.Token.EQUAL;
    }
    is_compound_assignment_operator(type) {
        return [
            token_cjs_1.Token.PLUS_EQUAL, token_cjs_1.Token.MINUS_EQUAL,
            token_cjs_1.Token.STAR_EQUAL, token_cjs_1.Token.SLASH_EQUAL, token_cjs_1.Token.PERCENT_EQUAL,
        ].includes(type);
    }
    is_right_associative(type) {
        if (this.is_direct_assignment_operator(type) || this.is_compound_assignment_operator(type)) {
            return true;
        }
        return false;
    }
    is_cast_keyword(token) {
        return [
            token_cjs_1.ReserveIdentifierCoder.is(token, token_cjs_1.ReserveIdentifier.RID_STATICCAST),
            token_cjs_1.ReserveIdentifierCoder.is(token, token_cjs_1.ReserveIdentifier.RID_CONSTCAST),
            token_cjs_1.ReserveIdentifierCoder.is(token, token_cjs_1.ReserveIdentifier.RID_DYNAMICCAST),
            token_cjs_1.ReserveIdentifierCoder.is(token, token_cjs_1.ReserveIdentifier.RID_REINTERPRETCAST)
        ].some(Boolean);
    }
}
exports.RecursiveDescentParser = RecursiveDescentParser;
