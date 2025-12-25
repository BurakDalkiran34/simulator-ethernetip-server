/**
 * Tag Manager - Manages 100 random tags with changing values
 */

export class TagManager {
  constructor() {
    this.tags = new Map();
    this.initializeTags();
  }

  /**
   * Initialize 100 tags with random names and initial values
   */
  initializeTags() {
    const tagNames = this.generateTagNames(100);
    
    tagNames.forEach((name, index) => {
      this.tags.set(name, {
        name: name,
        address: `Tag_${index + 1}`,
        value: this.generateRandomValue(),
        dataType: 'DINT', // 32-bit signed integer
        lastRead: Date.now()
      });
    });
  }

  /**
   * Generate unique tag names
   * @param {number} count - Number of tags to generate
   * @returns {Array<string>}
   */
  generateTagNames(count) {
    const names = [];
    const prefixes = ['Sensor', 'Motor', 'Valve', 'Temp', 'Pressure', 'Flow', 'Level', 'Speed', 'Position', 'Status'];
    const suffixes = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
    
    for (let i = 0; i < count; i++) {
      const prefix = prefixes[i % prefixes.length];
      const suffix = suffixes[Math.floor(i / prefixes.length)];
      const number = Math.floor(i / 10) + 1;
      names.push(`${prefix}${number}${suffix}`);
    }
    
    return names;
  }

  /**
   * Generate a random value (DINT: -2147483648 to 2147483647)
   * @returns {number}
   */
  generateRandomValue() {
    return Math.floor(Math.random() * 2000000) - 1000000; // -1M to +1M range
  }

  /**
   * Get tag by name
   * @param {string} tagName - Tag name
   * @returns {Object|null}
   */
  getTag(tagName) {
    return this.tags.get(tagName) || null;
  }

  /**
   * Read tag value (generates new random value on each read)
   * @param {string} tagName - Tag name
   * @returns {Object|null}
   */
  readTag(tagName) {
    const tag = this.tags.get(tagName);
    if (!tag) {
      return null;
    }

    // Generate new random value on each read
    tag.value = this.generateRandomValue();
    tag.lastRead = Date.now();

    return {
      name: tag.name,
      address: tag.address,
      value: tag.value,
      dataType: tag.dataType
    };
  }

  /**
   * Get all tags
   * @returns {Array}
   */
  getAllTags() {
    return Array.from(this.tags.values());
  }

  /**
   * Get tag list (names and addresses)
   * @returns {Array<{name: string, address: string}>}
   */
  getTagList() {
    return Array.from(this.tags.values()).map(tag => ({
      name: tag.name,
      address: tag.address
    }));
  }

  /**
   * Find tag by address
   * @param {string} address - Tag address
   * @returns {Object|null}
   */
  findTagByAddress(address) {
    for (const tag of this.tags.values()) {
      if (tag.address === address) {
        return tag;
      }
    }
    return null;
  }

  /**
   * Convert value to buffer (DINT = 4 bytes, signed, little-endian)
   * @param {number} value - Value to convert
   * @returns {Buffer}
   */
  valueToBuffer(value) {
    const buffer = Buffer.alloc(4);
    buffer.writeInt32LE(value, 0);  // Little-endian for Ethernet/IP
    return buffer;
  }
}

