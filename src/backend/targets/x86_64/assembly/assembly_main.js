"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.impl_assembly_fn_main = exports.impl_assembly_fn_pass_args_via_abi = exports.impl_assembly_fn_call = exports.impl_assembly_fn_base = exports.ApplicationBinaryInterface = void 0;
var ApplicationBinaryInterface;
(function (ApplicationBinaryInterface) {
    ApplicationBinaryInterface[ApplicationBinaryInterface["ABI_SYSV"] = 0] = "ABI_SYSV";
    ApplicationBinaryInterface[ApplicationBinaryInterface["ABI_ASMX"] = 1] = "ABI_ASMX";
})(ApplicationBinaryInterface || (exports.ApplicationBinaryInterface = ApplicationBinaryInterface = {}));
// any fn
class impl_assembly_fn_base {
    constructor() {
        this.fn_body = Buffer.alloc(0);
        this.fn_locals = [];
        this.fn_locals_size = 0;
    }
    gen_prologue() {
        return Buffer.from([
            0x55, // push %rbp
            0x48, 0x89, 0xe5 // mov %rsp, %rbp
        ]);
    }
    gen_epilogue() {
        return Buffer.from([
            0x5d, // pop %rbp
            0xc3 // ret
        ]);
    }
    gen_allocate_local_variables() {
        let buf = Buffer.alloc(0);
        const locals_size = this.fn_locals.map(l => l.size).reduce((a, b) => a + b, 0);
        if (locals_size == 0) {
            return buf;
        }
        // 32-bit: 4 294 967 295
        if (locals_size <= Math.pow(2, 32) - 1) {
            const raw_instruction = Buffer.from([0x48, 0x81, 0xec]); // subq $size, %rsp
            const size_buf = Buffer.alloc(4);
            size_buf.writeInt32LE(locals_size, 0);
            buf = Buffer.concat([buf, raw_instruction, size_buf]);
        }
        else {
            const raw_mov_instruction = Buffer.from([0x48, 0xb8]); // movabsq $size, %rax
            const raw_sub_instruction = Buffer.from([0x48, 0x29, 0xc4]); // subq %rax, %rsp
            const size_buf = Buffer.alloc(8);
            size_buf.writeBigUInt64LE(BigInt(locals_size), 0);
            buf = Buffer.concat([buf, raw_mov_instruction, size_buf, raw_sub_instruction]);
        }
        return buf;
    }
    gen_free_local_variables() {
        let buf = Buffer.alloc(0);
        const locals_size = this.fn_locals.map(l => l.size).reduce((a, b) => a + b, 0);
        if (locals_size == 0) {
            return buf;
        }
        if (locals_size <= Math.pow(2, 32) - 1) {
            const raw_instruction = Buffer.from([0x48, 0x81, 0xc4]); // addq $size, %rsp
            const size_buf = Buffer.alloc(4);
            size_buf.writeInt32LE(locals_size, 0);
            buf = Buffer.concat([buf, raw_instruction, size_buf]);
        }
        else {
            const raw_mov_instruction = Buffer.from([0x48, 0xb8]); // movabsq $size, %rax
            const raw_add_instruction = Buffer.from([0x48, 0x01, 0xc4]); // addq %rax, %rsp
            const size_buf = Buffer.alloc(8);
            size_buf.writeBigUInt64LE(BigInt(locals_size), 0);
            buf = Buffer.concat([buf, raw_mov_instruction, size_buf, raw_add_instruction]);
        }
        return buf;
    }
    create_allocate_local_variable(name, type, size) {
        this.fn_locals.push({ name, type, size });
        this.fn_locals_size += size;
    }
    gen_body(body) {
        this.fn_body = body;
    }
}
exports.impl_assembly_fn_base = impl_assembly_fn_base;
class impl_assembly_fn_call extends impl_assembly_fn_base {
}
exports.impl_assembly_fn_call = impl_assembly_fn_call;
class impl_assembly_fn_pass_args_via_abi extends impl_assembly_fn_base {
}
exports.impl_assembly_fn_pass_args_via_abi = impl_assembly_fn_pass_args_via_abi;
// rettype main(T retqaddr, U argc, T1 argv, T2 envp, T3 auxv, T4 undefined_stackpalce)
class impl_assembly_fn_main extends impl_assembly_fn_base {
    gen_exit_syscall() {
        // Generates a standard sys_exit(0) sequence.
        return Buffer.from([
            0x48, 0xc7, 0xc0, 0x3c, 0x00, 0x00, 0x00, // mov rax, 60 (sys_exit)
            0x48, 0xc7, 0xc7, 0x00, 0x00, 0x00, 0x00, // mov rdi, 0 (exit code)
            0x0f, 0x05 // syscall
        ]);
    }
    impl() {
        // if fn_body  is empty
        if (this.fn_body.length === 0) {
            this.fn_body = this.gen_exit_syscall();
        }
        else {
            this.fn_body = Buffer.concat([
                this.fn_body,
                this.gen_exit_syscall()
            ]);
        }
        const buffer = Buffer.concat([
            this.gen_prologue(),
            this.gen_allocate_local_variables(),
            this.fn_body,
            this.gen_free_local_variables(),
            this.gen_epilogue()
        ]);
        return buffer;
    }
}
exports.impl_assembly_fn_main = impl_assembly_fn_main;
