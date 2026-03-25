export namespace Interpreter {
  export class string_view {
    static interpretEscapeSequences(rawString) {
      if ((rawString.startsWith('"') && rawString.endsWith('"')) || (rawString.startsWith("'") && rawString.endsWith("'"))) {
        rawString = rawString.slice(1, -1);
      }

      const simpleEscapeMap = { 'n': '\n', 't': '\t', 'r': '\r', '\\': '\\', '"': '"', "'": "'" };
      const regex = /\\(?:([ntr\\"'])|x([0-9a-fA-F]{2})|u([0-9a-fA-F]{4})|U([0-9a-fA-F]{8})|([0-7]{1,3}))/g;

      return rawString.replace(regex, (match, simple, hex, unicode, unicode_ext, octal) => {
        if (simple) {
          return simpleEscapeMap[simple];
        }

        if (octal) {
          return String.fromCharCode(parseInt(octal, 8));
        }

        const code = hex || unicode || unicode_ext;
        if (code) {
          const charCode = parseInt(code, 16);
          return String.fromCodePoint(charCode);
        }

        return match;
      });
    }
  }
}