"use strict";
// --- Enums and Types ---
Object.defineProperty(exports, "__esModule", { value: true });
exports.InstructionNameTags = exports.OperandEncoding = exports.OperandSize = exports.OperandType = void 0;
// Represents the type of an operand
var OperandType;
(function (OperandType) {
    OperandType[OperandType["Reg"] = 0] = "Reg";
    OperandType[OperandType["Mem"] = 1] = "Mem";
    OperandType[OperandType["Imm"] = 2] = "Imm";
    OperandType[OperandType["Rel"] = 3] = "Rel";
    OperandType[OperandType["Sreg"] = 4] = "Sreg";
    OperandType[OperandType["None"] = 5] = "None";
})(OperandType || (exports.OperandType = OperandType = {}));
// Represents the size of an operand or operation
var OperandSize;
(function (OperandSize) {
    OperandSize[OperandSize["Byte"] = 1] = "Byte";
    OperandSize[OperandSize["Word"] = 2] = "Word";
    OperandSize[OperandSize["Dword"] = 4] = "Dword";
    OperandSize[OperandSize["Qword"] = 8] = "Qword";
})(OperandSize || (exports.OperandSize = OperandSize = {}));
// --- Instruction Definition ---
// Describes how an operand is encoded
var OperandEncoding;
(function (OperandEncoding) {
    OperandEncoding[OperandEncoding["ModRM_Reg"] = 0] = "ModRM_Reg";
    OperandEncoding[OperandEncoding["ModRM_RM"] = 1] = "ModRM_RM";
    OperandEncoding[OperandEncoding["OpcodeReg"] = 2] = "OpcodeReg";
    OperandEncoding[OperandEncoding["Immediate"] = 3] = "Immediate";
    OperandEncoding[OperandEncoding["Implicit"] = 4] = "Implicit";
    // Add more as needed (e.g., VEX encoding)
})(OperandEncoding || (exports.OperandEncoding = OperandEncoding = {}));
