"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModuleExpander = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const expression_cjs_1 = require("../types/expression.cjs");
const unwrap_cjs_1 = require("../types/unwrap.cjs");
const parser_cjs_1 = require("./parser.cjs");
const token_cjs_1 = require("../types/token.cjs");
const llvm = require("llvm.js/llvm");
const exceptions = require('llvm.js/exceptions');
class ModuleExpander {
    constructor() {
        // Import Guard: Storing Absolute Paths of All Loaded Files
        this.loadedFiles = new Set();
        this.stdLibPath = path_1.default.join(__dirname, '../../include/stdlib');
    }
    expand(nodes, currentFilePath) {
        this.loadedFiles.add(path_1.default.resolve(currentFilePath));
        const expandedAST = [];
        for (const node of nodes) {
            if (node.kind === expression_cjs_1.Syntax.Kind.Instruction) {
                const instr = node;
                const instrName = unwrap_cjs_1.UnwrapSyntax.emit_name(instr).raw;
                if (instrName === "include" || instrName === "import") {
                    // Getting the filename: @include "std/vector.asmx"
                    const arg = instr.operands[0];
                    const importPathRaw = unwrap_cjs_1.UnwrapSyntax.unwrap(arg.value ?? arg).raw.replace(/['"]/g, '');
                    let targetPath = "";
                    if (instrName === "include") {
                        targetPath = path_1.default.resolve(this.stdLibPath, importPathRaw);
                    }
                    else {
                        // @import resolves relative to the current file.
                        targetPath = path_1.default.resolve(path_1.default.dirname(currentFilePath), importPathRaw);
                    }
                    // IMPORT GUARD
                    // If the file has already been loaded, simply ignore the node (remove it from the AST).
                    if (this.loadedFiles.has(targetPath)) {
                        continue;
                    }
                    if (!fs_1.default.existsSync(targetPath)) {
                        new exceptions.ExpressionException(`Module not found: ${targetPath}`, unwrap_cjs_1.UnwrapSyntax.unwrap(arg).token);
                    }
                    this.loadedFiles.add(targetPath);
                    console.log(`[ModuleExpander] Loading module: ${targetPath}`);
                    const sourceCode = fs_1.default.readFileSync(targetPath);
                    let tokens = new llvm.Lexer().lexer(sourceCode.toString('utf8').split('\n'));
                    tokens = tokens.filter(tree => !['WHITESPACE', 'COMMENT', 'COMMENT_BODY', 'SPACE'].includes(tree.type));
                    tokens = tokens.map(token => (0, token_cjs_1.normalizeToken)(token));
                    const parser = new parser_cjs_1.RecursiveDescentParser(tokens);
                    const subAST = parser.parse_translation_unit();
                    // RECURSION: Unfolding imports within the imported file!
                    const subExpandedAST = this.expand(subAST, targetPath);
                    // Insert the module nodes RIGHT HERE.
                    expandedAST.push(...subExpandedAST);
                    continue; // We remove the @include node itself.
                }
            }
            // Simply leave ordinary nodes as they are.
            expandedAST.push(node);
        }
        return expandedAST;
    }
}
exports.ModuleExpander = ModuleExpander;
