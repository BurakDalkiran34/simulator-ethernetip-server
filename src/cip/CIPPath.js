/**
 * CIP Path parsing and building utilities
 */

export class CIPPath {
  static SEGMENT_TYPE = {
    LOGICAL: 0x20,
    NETWORK: 0x00,
    SYMBOLIC: 0x91,
    DATA: 0x80
  };

  // Logical segment types (bits 4-2 of segment byte)
  // 0x20 = Class ID (8-bit), 0x21 = Class ID (16-bit)
  // 0x24 = Instance ID (8-bit), 0x25 = Instance ID (16-bit)
  // 0x28 = Member ID (8-bit), 0x29 = Member ID (16-bit)
  // 0x2C = Connection Point (8-bit), 0x2D = Connection Point (16-bit)
  // 0x30 = Attribute ID (8-bit), 0x31 = Attribute ID (16-bit)
  static LOGICAL_FORMAT = {
    CLASS_ID: 0x00,          // (0x20 >> 2) & 0x07 = 0
    INSTANCE_ID: 0x01,       // (0x24 >> 2) & 0x07 = 1
    MEMBER_ID: 0x02,         // (0x28 >> 2) & 0x07 = 2
    CONNECTION_POINT: 0x03,  // (0x2C >> 2) & 0x07 = 3
    ATTRIBUTE_ID: 0x04       // (0x30 >> 2) & 0x07 = 4
  };

  /**
   * Build a logical path
   * @param {number} classId - Class ID
   * @param {number} instanceId - Instance ID
   * @param {number} attributeId - Attribute ID (optional)
   * @returns {Buffer}
   */
  static buildLogicalPath(classId, instanceId, attributeId = null) {
    const segments = [];
    
    // Class ID segment (0x20 for 8-bit)
    segments.push(Buffer.from([0x20, classId]));

    // Instance ID segment (0x24 for 8-bit)
    segments.push(Buffer.from([0x24, instanceId]));

    // Attribute ID segment (0x30 for 8-bit)
    if (attributeId !== null) {
      segments.push(Buffer.from([0x30, attributeId]));
    }

    return Buffer.concat(segments);
  }

  /**
   * Parse a CIP path and extract class, instance, attribute IDs
   * @param {Buffer} pathBuffer - Path buffer
   * @returns {Object} Object with classId, instanceId, attributeId
   */
  static parse(pathBuffer) {
    const segments = this.parsePath(pathBuffer);
    const result = {
      classId: null,
      instanceId: null,
      attributeId: null,
      segments: segments
    };
    
    for (const segment of segments) {
      if (segment.type === 'logical') {
        switch (segment.format) {
          case CIPPath.LOGICAL_FORMAT.CLASS_ID:
            result.classId = segment.value;
            break;
          case CIPPath.LOGICAL_FORMAT.INSTANCE_ID:
            result.instanceId = segment.value;
            break;
          case CIPPath.LOGICAL_FORMAT.ATTRIBUTE_ID:
            result.attributeId = segment.value;
            break;
        }
      } else if (segment.type === 'symbolic') {
        result.tagName = segment.value;
      }
    }
    
    return result;
  }

  /**
   * Parse a CIP path into segments
   * @param {Buffer} pathBuffer - Path buffer
   * @returns {Object[]} Parsed path segments
   */
  static parsePath(pathBuffer) {
    const segments = [];
    let offset = 0;

    while (offset < pathBuffer.length) {
      const segmentType = pathBuffer[offset];
      // Extract logical type from bits 4-2
      const segmentFormat = (segmentType >> 2) & 0x07;
      // Segment class is in bits 7-5
      const segmentClass = segmentType & 0xE0;

      if (segmentClass === CIPPath.SEGMENT_TYPE.LOGICAL) {
        if (offset + 1 >= pathBuffer.length) {
          break;
        }
        // Check if 16-bit addressing (bit 0 = 1 means 16-bit)
        const is16Bit = (segmentType & 0x01) !== 0;
        let value;
        if (is16Bit) {
          if (offset + 3 > pathBuffer.length) {
            break;
          }
          // 16-bit value: pad byte + 2 bytes (little-endian)
          value = pathBuffer.readUInt16LE(offset + 2);
          offset += 4;
        } else {
          // 8-bit value
          value = pathBuffer[offset + 1];
          offset += 2;
        }
        segments.push({
          type: 'logical',
          format: segmentFormat,
          value: value
        });
      } else if (segmentType === 0x91) {
        // ANSI Extended Symbolic segment
        if (offset + 1 >= pathBuffer.length) {
          break;
        }
        const length = pathBuffer[offset + 1];
        if (offset + 2 + length > pathBuffer.length) {
          break;
        }
        const symbol = pathBuffer.slice(offset + 2, offset + 2 + length).toString('ascii');
        segments.push({
          type: 'symbolic',
          value: symbol
        });
        // Pad to word boundary if odd length
        const totalLen = 2 + length + (length % 2);
        offset += totalLen;
      } else {
        // Unknown segment type, skip
        console.log(`[CIPPath] Unknown segment type: 0x${segmentType.toString(16)} at offset ${offset}`);
        offset++;
      }
    }

    return segments;
  }

  /**
   * Extract tag name from symbolic path
   * @param {Buffer} pathBuffer - Path buffer
   * @returns {string|null}
   */
  static extractTagName(pathBuffer) {
    const segments = this.parsePath(pathBuffer);
    for (const segment of segments) {
      if (segment.type === 'symbolic') {
        return segment.value;
      }
    }
    return null;
  }

  /**
   * Build symbolic path for tag
   * @param {string} tagName - Tag name
   * @returns {Buffer}
   */
  static buildSymbolicPath(tagName) {
    const nameBuffer = Buffer.from(tagName, 'ascii');
    const path = Buffer.alloc(2 + nameBuffer.length);
    path[0] = CIPPath.SEGMENT_TYPE.SYMBOLIC;
    path[1] = nameBuffer.length;
    nameBuffer.copy(path, 2);
    return path;
  }
}

