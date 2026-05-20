import fs from 'fs';
import path from 'path';
import { Syntax } from '../types/expression.cjs';
import { UnwrapSyntax } from '../types/unwrap.cjs';
import { RecursiveDescentParser } from './parser.cjs';
import { normalizeToken } from '../types/token.cjs';

const llvm = require("llvm.js/llvm");
const exceptions = require('llvm.js/exceptions');

export class ModuleExpander {
  // Import Guard: Storing Absolute Paths of All Loaded Files
  private loadedFiles: Set<string> = new Set();
  private stdLibPath: string = path.join(__dirname, '../../include/stdlib');

  public expand(nodes: Syntax.Node<any>[], currentFilePath: string): Syntax.Node<any>[] {
    this.loadedFiles.add(path.resolve(currentFilePath));
    const expandedAST: Syntax.Node<any>[] = [];

    for (const node of nodes) {
      if (node.kind === Syntax.Kind.Instruction) {
        const instr = node as Syntax.RequiredNodeStructure<Syntax.Kind.Instruction>;
        const instrName = UnwrapSyntax.emit_name(instr).raw;

        if (instrName === "include" || instrName === "import") {
          // Getting the filename: @include "std/vector.asmx"
          const arg = instr.operands[0] as Syntax.Node<Syntax.Kind.Literal>;
          const importPathRaw = UnwrapSyntax.unwrap(arg.value ?? arg).raw.replace(/['"]/g, '');
          let targetPath = "";

          if (instrName === "include") {
            targetPath = path.resolve(this.stdLibPath, importPathRaw);
          } else {
            // @import resolves relative to the current file.
            targetPath = path.resolve(path.dirname(currentFilePath), importPathRaw);
          }

          // IMPORT GUARD
          // If the file has already been loaded, simply ignore the node (remove it from the AST).
          if (this.loadedFiles.has(targetPath)) {
            continue; 
          }

          if (!fs.existsSync(targetPath)) {
            new exceptions.ExpressionException(`Module not found: ${targetPath}`, UnwrapSyntax.unwrap(arg).token);
          }

          this.loadedFiles.add(targetPath);
          console.log(`[ModuleExpander] Loading module: ${targetPath}`);

          const sourceCode = fs.readFileSync(targetPath);

          let tokens = new llvm.Lexer().lexer(sourceCode.toString('utf8').split('\n'));
          tokens = tokens.filter(tree => !['WHITESPACE', 'COMMENT', 'COMMENT_BODY', 'SPACE'].includes(tree.type));

          tokens = tokens.map(token => normalizeToken(token));

          const parser = new RecursiveDescentParser(tokens);
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