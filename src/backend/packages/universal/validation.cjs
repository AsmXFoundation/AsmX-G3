"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationUtils = void 0;
class ValidationUtils {
    static validatePackageName(name) {
        const regex = /^[a-z0-9][a-z0-9.-]*$/;
        return regex.test(name) && name.length >= 2 && name.length <= 50;
    }
    static validateVersion(version) {
        const regex = /^\d+\.\d+\.\d+$/; // (major.minor.patch)
        return regex.test(version);
    }
}
exports.ValidationUtils = ValidationUtils;
