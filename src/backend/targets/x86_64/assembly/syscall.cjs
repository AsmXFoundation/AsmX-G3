"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.impl_assembly_fn_syscall = void 0;
class impl_assembly_fn_syscall {
    static put_arg(arg) { }
    static impl() {
        let buffer = Buffer.alloc(0);
        buffer = Buffer.concat([
            ...this.args,
            Buffer.from([0x0f, 0x05]) // syscall
        ]);
        return buffer;
    }
}
exports.impl_assembly_fn_syscall = impl_assembly_fn_syscall;
impl_assembly_fn_syscall.args = [];
