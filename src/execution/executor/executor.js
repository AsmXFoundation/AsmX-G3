const Expression = require("../../ast/expression.js");
const TypeOfInstructionExpression = require("../../types/instruction.type.js");
const TypeOfToken = require("../../types/token.type.js");
const TypeOfAtomicExpression = require("../../types/expression.type.js");
const SyntaxScannerExpression = require("../../parsing/scanner-syntax.js");
const Runtime = require("../runtime.js");
const RuntimeException = require("../exception/runtime.exception.js");

const FunctionalMember = require("../members/functional-member.js");
const ModuleMember = require("../members/module-member.js");
const StackMember = require("../members/stack-member.js");
const SystemMember = require("../members/system-member.js");
const MathematicalMember = require("../members/mathematical-member.js");
const MovementMember = require("../members/movement-member.js");
const Branchmember = require("../members/branch-member.js");
const JumpMember = require("../members/jump-member.js");
const ConditionInstructionMember = require("../members/condition-instruction-member.js");
const MMXInstructionMember = require("../members/mmx-member.js");
const SSEInstructionMember = require("../members/sse-member.js");
const CPUInstructionMember = require("../members/cpu-member.js");

class IntermediateRepresentationCompiler {
  constructor(ast) {
    for (const expression of ast) {
      if (expression.type == TypeOfToken.EOF) break;

      if (expression.type == TypeOfInstructionExpression.INSTRUCTION) {
        if (Runtime.TYPE_OF_ENVIROMENT == Runtime.TYPE_OF_ENVIROMENTS.GLOBAL) {
          const allowedTypeOfInstructions = [
            TypeOfInstructionExpression.MODULE,
            TypeOfInstructionExpression.VARIABLE,
            TypeOfInstructionExpression.DECLARATION,
            TypeOfInstructionExpression.OBJECT_ORIENTED_PROGRAMMING,
            TypeOfInstructionExpression.DATA_STRUCTURE,
            TypeOfInstructionExpression.BRANCH_BLOCK
          ];

          if (!TypeOfInstructionExpression.existNameOfInstruction(expression.subtype, ...allowedTypeOfInstructions)) {
            if (expression.subtype == TypeOfInstructionExpression.SECTION) {
              continue;
            }
            
            SyntaxScannerExpression.exceptDefaultTracewayException(expression.body.id, `The instruction ${expression.body.id.lexem} is not allowed in the global environment`);
          }
        }

        switch (expression.subtype) {
          case TypeOfInstructionExpression.CPU_INSTRUCTION:
            CPUInstructionMember.generalImplementation(expression);
            break;
          case TypeOfInstructionExpression.MODULE:
            ModuleMember.generalImplementation(expression);
            break;
          case TypeOfInstructionExpression.DECLARATION:
            FunctionalMember.generalImplementation(expression);
            break;
          case TypeOfInstructionExpression.STACK:
            StackMember.generalImplementation(expression);
            break;
          case TypeOfInstructionExpression.SYSTEM:
            SystemMember.generalImplementation(expression);
            break;
          case TypeOfInstructionExpression.MATHEMATICAL:
            MathematicalMember.generalImplementation(expression);
            break;
          case TypeOfInstructionExpression.MOVEMENT:
            MovementMember.generalImplementation(expression);
            break;
          case TypeOfInstructionExpression.JUMP:
            JumpMember.generalImplementation(expression);
            break;
          case TypeOfInstructionExpression.BRANCH_BLOCK:
          case TypeOfInstructionExpression.BRANCH_INSTRUCTION:
            Branchmember.generalImplementation(expression);
            break;
          case TypeOfInstructionExpression.CONDITION_INSTRUCTION:
            ConditionInstructionMember.generalImplementation(expression);
            break;
          case TypeOfInstructionExpression.MMX_INSTRUCTION:
            MMXInstructionMember.generalImplementation(expression);
          case TypeOfInstructionExpression.SSE_INSTRUCTION:
            SSEInstructionMember.generalImplementation(expression);
            break;
        }

      } else {
        if (expression.type == TypeOfAtomicExpression.LITERAL) {
          const token = expression.body[Reflect.ownKeys(expression.body)[0]];
          new excveptions.ExpressionException('The expression must start with an instruction', token);
        } else {
          let pass = expression;

          if (expression instanceof Expression) {
            if (expression.type == TypeOfAtomicExpression.PARENTHESIS) {
              pass = expression.body.parentheses[0];
            } else if (expression.type == TypeOfAtomicExpression.IDENTIFER) {
              pass = expression.body.identifer;
            } else {
              pass = expression.id;
            }
          }

          if (pass) {
            SyntaxScannerExpression.exceptDefaultTracewayException(pass, 'The expression must start with an instruction');
          } else {
            SyntaxScannerExpression.exceptDefaultTracewayException(
              { type: TypeOfToken.EOF, lexem: '', current: 0, line: 1, code: ' ' },
              'The expression must start with an instruction'
            );
          }
        }
      }
    }

    if (
      Runtime.IMPORT_ENVIROMENT_MODE == Runtime.TYPE_OF_ENVIROMENTS.MAIN
      && Runtime.TYPE_OF_ENVIROMENT == Runtime.TYPE_OF_ENVIROMENTS.GLOBAL
    ) {
      if (!Runtime.HAS_MAIN_FUNCTION) {
        RuntimeException.exceptMessage('The main function is not defined');
      }
    }
  }
}

module.exports = IntermediateRepresentationCompiler;