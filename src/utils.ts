export class Utils {
    /**
     * Convert bytes to string.
     * @param b buffer to convert
     */
    static bytes2String(b: Buffer): string {
      return b.toString("hex");
    }
  
    /**
     * Convert string to bytes.
     * @param hex string to convert
     */
    static hex2Bytes(hex: string) {
      if (!hex) {
        return Buffer.allocUnsafe(0);
      }
  
      return Buffer.from(hex, "hex");
    }
  
    /**
     * Generate a random color in HEX format.
     * Source: https://stackoverflow.com/a/1152508
     */
    static getRandomColor() {
      return (
        "#" + (0x1000000 + Math.random() * 0xffffff).toString(16).substr(1, 6)
      );
    }
  }
  