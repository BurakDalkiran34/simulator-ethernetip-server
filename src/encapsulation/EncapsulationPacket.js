/**
 * Ethernet/IP Encapsulation Packet Structure
 * Based on EtherNet/IP Specification
 */

export class EncapsulationPacket {
  static COMMAND = {
    NOP: 0x0000,
    LIST_SERVICES: 0x0004,
    LIST_IDENTITY: 0x0063,
    LIST_INTERFACES: 0x0064,
    REGISTER_SESSION: 0x0065,
    UNREGISTER_SESSION: 0x0066,
    SEND_RR_DATA: 0x006F,
    SEND_UNIT_DATA: 0x0070,
    INDICATE_STATUS: 0x0072,
    CANCEL: 0x0073
  };

  static STATUS = {
    SUCCESS: 0x0000,
    INVALID_COMMAND: 0x0001,
    INSUFFICIENT_MEMORY: 0x0002,
    INVALID_SESSION_HANDLE: 0x0065,
    INVALID_LENGTH: 0x0069,
    UNSUPPORTED_PROTOCOL: 0x006A
  };

  constructor() {
    this.command = 0;
    this.length = 0;
    this.sessionHandle = 0;
    this.status = 0;
    this.senderContext = Buffer.alloc(8);
    this.options = 0;
    this.data = Buffer.alloc(0);
  }

  /**
   * Parse a buffer into an EncapsulationPacket (big-endian)
   * @param {Buffer} buffer - Raw packet buffer
   * @returns {EncapsulationPacket}
   */
  static fromBuffer(buffer) {
    if (buffer.length < 24) {
      throw new Error('Packet too short');
    }

    const packet = new EncapsulationPacket();
    packet.command = buffer.readUInt16BE(0);
    packet.length = buffer.readUInt16BE(2);
    packet.sessionHandle = buffer.readUInt32BE(4);
    packet.status = buffer.readUInt32BE(8);
    buffer.copy(packet.senderContext, 0, 12, 20);
    packet.options = buffer.readUInt32BE(20);
    
    if (buffer.length > 24) {
      packet.data = buffer.slice(24);
    }

    return packet;
  }

  /**
   * Parse a buffer into an EncapsulationPacket (little-endian)
   * @param {Buffer} buffer - Raw packet buffer
   * @returns {EncapsulationPacket}
   */
  static fromBufferLE(buffer) {
    if (buffer.length < 24) {
      throw new Error('Packet too short');
    }

    const packet = new EncapsulationPacket();
    packet.command = buffer.readUInt16LE(0);
    packet.length = buffer.readUInt16LE(2);
    packet.sessionHandle = buffer.readUInt32LE(4);
    packet.status = buffer.readUInt32LE(8);
    buffer.copy(packet.senderContext, 0, 12, 20);
    packet.options = buffer.readUInt32LE(20);
    
    if (buffer.length > 24) {
      packet.data = buffer.slice(24);
    }

    return packet;
  }

  /**
   * Convert packet to buffer (big-endian)
   * @returns {Buffer}
   */
  toBuffer() {
    const headerLength = 24;
    const totalLength = headerLength + this.data.length;
    const buffer = Buffer.alloc(totalLength);

    buffer.writeUInt16BE(this.command, 0);
    buffer.writeUInt16BE(this.data.length, 2); // Length field is data length only
    buffer.writeUInt32BE(this.sessionHandle, 4);
    buffer.writeUInt32BE(this.status, 8);
    this.senderContext.copy(buffer, 12);
    buffer.writeUInt32BE(this.options, 20);
    
    if (this.data.length > 0) {
      this.data.copy(buffer, 24);
    }

    return buffer;
  }

  /**
   * Convert packet to buffer (little-endian)
   * @param {EncapsulationPacket} packet - Packet to convert
   * @param {Buffer} data - Response data
   * @returns {Buffer}
   */
  static toBufferLE(packet, data = null) {
    const responseData = data || packet.data;
    const headerLength = 24;
    const totalLength = headerLength + responseData.length;
    const buffer = Buffer.alloc(totalLength);

    buffer.writeUInt16LE(packet.command, 0);
    buffer.writeUInt16LE(responseData.length, 2); // Length field is data length only
    buffer.writeUInt32LE(packet.sessionHandle, 4);
    buffer.writeUInt32LE(packet.status, 8);
    packet.senderContext.copy(buffer, 12);
    buffer.writeUInt32LE(packet.options, 20);
    
    if (responseData.length > 0) {
      responseData.copy(buffer, 24);
    }

    return buffer;
  }

  /**
   * Create a response packet
   * @param {number} status - Status code
   * @param {Buffer} data - Response data
   * @returns {EncapsulationPacket}
   */
  createResponse(status, data = Buffer.alloc(0)) {
    const response = new EncapsulationPacket();
    response.command = this.command;
    response.length = data.length;
    response.sessionHandle = this.sessionHandle;
    response.status = status;
    this.senderContext.copy(response.senderContext);
    response.options = 0;
    response.data = data;
    return response;
  }
}

