export class ValidationUtils {
  static validatePackageName(name: string): boolean {
    const regex = /^[a-z0-9][a-z0-9.-]*$/;
    return regex.test(name) && name.length >= 2 && name.length <= 50;
  }

  static validateVersion(version: string): boolean {
    const regex = /^\d+\.\d+\.\d+$/; // (major.minor.patch)
    return regex.test(version);
  }
}