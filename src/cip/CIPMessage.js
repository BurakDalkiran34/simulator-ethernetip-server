/**
 * Common Industrial Protocol (CIP) Message Structure
 */

export class CIPMessage {
  static SERVICE = {
    GET_ATTRIBUTE_ALL: 0x01,
    SET_ATTRIBUTE_ALL: 0x02,
    GET_ATTRIBUTE_LIST: 0x03,
    SET_ATTRIBUTE_LIST: 0x04,
    RESET: 0x05,
    START: 0x06,
    STOP: 0x07,
    CREATE: 0x08,
    DELETE: 0x09,
    MULTIPLE_SERVICE_PACKET: 0x0A,
    APPLY_ATTRIBUTES: 0x0D,
    GET_ATTRIBUTE_SINGLE: 0x0E,
    SET_ATTRIBUTE_SINGLE: 0x10,
    FIND_NEXT: 0x11,
    RESTORE: 0x15,
    SAVE: 0x16,
    NO_OPERATION: 0x17,
    GET_MEMBER: 0x18,
    SET_MEMBER: 0x19,
    INSERT_MEMBER: 0x1A,
    REMOVE_MEMBER: 0x1B,
    GROUP_SYNC: 0x1C
  };

  static STATUS = {
    SUCCESS: 0x00,
    CONNECTION_FAILURE: 0x01,
    RESOURCE_UNAVAILABLE: 0x02,
    INVALID_PARAMETER_VALUE: 0x03,
    PATH_SEGMENT_ERROR: 0x04,
    PATH_DESTINATION_UNKNOWN: 0x05,
    PARTIAL_TRANSFER: 0x06,
    CONNECTION_LOST: 0x07,
    SERVICE_NOT_SUPPORTED: 0x08,
    INVALID_ATTRIBUTE_VALUE: 0x09,
    ATTRIBUTE_LIST_ERROR: 0x0A,
    ALREADY_IN_REQUESTED_MODE: 0x0B,
    OBJECT_STATE_CONFLICT: 0x0C,
    OBJECT_ALREADY_EXISTS: 0x0D,
    ATTRIBUTE_NOT_SETTABLE: 0x0E,
    PRIVILEGE_VIOLATION: 0x0F,
    DEVICE_STATE_CONFLICT: 0x10,
    REPLY_DATA_TOO_LARGE: 0x11,
    FRAGMENTATION_OF_PRIMITIVE: 0x12,
    NOT_ENOUGH_DATA: 0x13,
    ATTRIBUTE_NOT_SUPPORTED: 0x14,
    TOO_MUCH_DATA: 0x15,
    OBJECT_DOES_NOT_EXIST: 0x16,
    NO_FRAGMENTATION: 0x17,
    DATA_NOT_READY: 0x18,
    GENERAL_ERROR: 0x1E
  };

  constructor() {
    this.service = 0;
    this.path = Buffer.alloc(0);
    this.data = Buffer.alloc(0);
  }

  /**
   * Parse CIP message from buffer
   * @param {Buffer} buffer - CIP message buffer
   * @returns {CIPMessage}
   */
  static fromBuffer(buffer) {
    if (buffer.length < 2) {
      throw new Error('CIP message too short');
    }

    const message = new CIPMessage();
    message.service = buffer[0];
    
    // Parse path length (in 16-bit words)
    const pathLength = buffer[1];
    const pathStart = 2;
    const pathEnd = pathStart + (pathLength * 2);
    
    if (buffer.length < pathEnd) {
      throw new Error('Invalid path length');
    }

    message.path = buffer.slice(pathStart, pathEnd);
    message.data = buffer.slice(pathEnd);

    return message;
  }

  /**
   * Convert CIP request message to buffer
   * @returns {Buffer}
   */
  toBuffer() {
    // Check if this is a response (service has response bit set)
    if (this.service & 0x80) {
      return this.toResponseBuffer();
    }
    
    // Request format: Service + Path Length + Path + Data
    const pathLength = Math.ceil(this.path.length / 2);
    const totalLength = 2 + this.path.length + this.data.length;
    const buffer = Buffer.alloc(totalLength);

    buffer[0] = this.service;
    buffer[1] = pathLength;
    this.path.copy(buffer, 2);
    this.data.copy(buffer, 2 + this.path.length);

    return buffer;
  }

  /**
   * Convert CIP response message to buffer
   * CIP Response format:
   * - Service | 0x80 (1 byte)
   * - Reserved (1 byte) = 0x00
   * - General Status (1 byte)
   * - Size of Additional Status (1 byte) = 0
   * - Response Data (variable)
   * @returns {Buffer}
   */
  toResponseBuffer() {
    // Response format: Service + Reserved + Status + AdditionalStatusSize + Data
    const status = this.data.length > 0 ? this.data[0] : 0;
    const responseData = this.data.length > 1 ? this.data.slice(1) : Buffer.alloc(0);
    
    const totalLength = 4 + responseData.length; // 4 byte header + data
    const buffer = Buffer.alloc(totalLength);

    buffer[0] = this.service;           // Service with response bit
    buffer[1] = 0x00;                   // Reserved
    buffer[2] = status;                 // General Status
    buffer[3] = 0x00;                   // Size of Additional Status (0 words)
    
    if (responseData.length > 0) {
      responseData.copy(buffer, 4);
    }

    return buffer;
  }

  /**
   * Create a response message
   * @param {number} status - Status code
   * @param {Buffer} data - Response data
   * @returns {CIPMessage}
   */
  createResponse(status, data = Buffer.alloc(0)) {
    const response = new CIPMessage();
    response.service = this.service | 0x80; // Response bit set
    response.path = Buffer.alloc(0); // No path in response
    // Store status as first byte of data (will be extracted in toResponseBuffer)
    response.data = Buffer.concat([
      Buffer.from([status]),
      data
    ]);
    return response;
  }
}

