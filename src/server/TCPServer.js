/**
 * TCP Server for Ethernet/IP Explicit Messaging
 * Port 44818
 */

import net from 'net';
import { EncapsulationPacket } from '../encapsulation/EncapsulationPacket.js';
import { CIPMessage } from '../cip/CIPMessage.js';
import { CIPPath } from '../cip/CIPPath.js';
import { SessionManager } from './SessionManager.js';
import { TagManager } from '../tags/TagManager.js';
import debug from 'debug';

const log = debug('ethernetip:tcp');

export class TCPServer {
  constructor(options = {}) {
    this.port = options.port || 44818;
    this.host = options.host || '0.0.0.0';
    this.server = null;
    this.sessionManager = options.sessionManager || new SessionManager();
    this.tagManager = options.tagManager || new TagManager();
    this.messageHandlers = new Map();
    this.clientEndianness = new Map(); // Track endianness per socket
    
    // Device configuration
    this.deviceSlotNumber = options.deviceSlotNumber || 0;
    this.vendorId = options.vendorId || 0x0000;
    this.deviceType = options.deviceType || 0x0000;
    this.productCode = options.productCode || 0x00000000;
    this.productName = options.productName || 'EtherNet/IP Simulator';
    
    // Register default handlers
    this.registerDefaultHandlers();
  }

  /**
   * Register default command handlers
   */
  registerDefaultHandlers() {
    this.onCommand(EncapsulationPacket.COMMAND.REGISTER_SESSION, this.handleRegisterSession.bind(this));
    this.onCommand(EncapsulationPacket.COMMAND.UNREGISTER_SESSION, this.handleUnregisterSession.bind(this));
    this.onCommand(EncapsulationPacket.COMMAND.SEND_RR_DATA, this.handleSendRRData.bind(this));
    this.onCommand(EncapsulationPacket.COMMAND.LIST_SERVICES, this.handleListServices.bind(this));
    this.onCommand(EncapsulationPacket.COMMAND.LIST_IDENTITY, this.handleListIdentity.bind(this));
  }

  /**
   * Get command name for logging
   * @param {number} command - Command code
   * @returns {string}
   */
  getCommandName(command) {
    const names = {
      [EncapsulationPacket.COMMAND.NOP]: 'NOP',
      [EncapsulationPacket.COMMAND.LIST_SERVICES]: 'List Services',
      [EncapsulationPacket.COMMAND.LIST_IDENTITY]: 'List Identity',
      [EncapsulationPacket.COMMAND.LIST_INTERFACES]: 'List Interfaces',
      [EncapsulationPacket.COMMAND.REGISTER_SESSION]: 'Register Session',
      [EncapsulationPacket.COMMAND.UNREGISTER_SESSION]: 'Unregister Session',
      [EncapsulationPacket.COMMAND.SEND_RR_DATA]: 'Send RR Data',
      [EncapsulationPacket.COMMAND.SEND_UNIT_DATA]: 'Send Unit Data',
      [EncapsulationPacket.COMMAND.INDICATE_STATUS]: 'Indicate Status',
      [EncapsulationPacket.COMMAND.CANCEL]: 'Cancel'
    };
    return names[command] || 'Unknown';
  }

  /**
   * Register a command handler
   * @param {number} command - Command code
   * @param {Function} handler - Handler function
   */
  onCommand(command, handler) {
    this.messageHandlers.set(command, handler);
  }

  /**
   * Handle register session
   */
  async handleRegisterSession(socket, packet, isLittleEndian = false) {
    const clientInfo = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`[${new Date().toISOString()}] REQUEST: Register Session from ${clientInfo}`);
    console.log(`  Command: 0x${packet.command.toString(16).padStart(4, '0')}`);
    console.log(`  Session Handle: ${packet.sessionHandle}`);
    console.log(`  Data: ${packet.data.toString('hex')}`);
    log('Register session request');
    
    // Protocol version check (should be 1)
    // Data field may also be in little-endian format
    if (packet.data.length >= 2) {
      let protocolVersion = packet.data.readUInt16BE(0);
      let optionsFlags = packet.data.length >= 4 ? packet.data.readUInt16BE(2) : 0;
      
      // If little-endian client, try reading as little-endian
      if (isLittleEndian) {
        protocolVersion = packet.data.readUInt16LE(0);
        optionsFlags = packet.data.length >= 4 ? packet.data.readUInt16LE(2) : 0;
      }
      
      console.log(`  Protocol Version (BE): ${packet.data.readUInt16BE(0)}`);
      console.log(`  Protocol Version (LE): ${packet.data.readUInt16LE(0)}`);
      console.log(`  Using Protocol Version: ${protocolVersion} (${isLittleEndian ? 'LE' : 'BE'})`);
      
      if (protocolVersion !== 1) {
        const response = packet.createResponse(
          EncapsulationPacket.STATUS.UNSUPPORTED_PROTOCOL,
          Buffer.alloc(0)
        );
        // Send response in client's endianness
        const responseBuffer = isLittleEndian 
          ? EncapsulationPacket.toBufferLE(response, Buffer.alloc(0))
          : response.toBuffer();
        console.log(`[${new Date().toISOString()}] RESPONSE: Register Session (FAILED - Unsupported Protocol)`);
        console.log(`  Status: 0x${response.status.toString(16).padStart(8, '0')}`);
        console.log(`  Response Data: ${responseBuffer.toString('hex')}`);
        socket.write(responseBuffer);
        return;
      }
    }

    const sessionHandle = this.sessionManager.createSession();
    log(`Session registered: ${sessionHandle}`);

    // Register Session response data: Protocol version (2 bytes) + Options flags (2 bytes) = 4 bytes total
    // Protocol version: 0x0001 (EtherNet/IP version 1)
    // Options flags: 0x0000 (no options)
    // Note: Data field should match client's endianness
    const responseData = Buffer.alloc(4);
    if (isLittleEndian) {
      responseData.writeUInt16LE(0x0001, 0); // Protocol version (little-endian)
      responseData.writeUInt16LE(0x0000, 2); // Options flags (little-endian)
    } else {
      responseData.writeUInt16BE(0x0001, 0); // Protocol version (big-endian)
      responseData.writeUInt16BE(0x0000, 2); // Options flags (big-endian)
    }
    
    const response = packet.createResponse(
      EncapsulationPacket.STATUS.SUCCESS,
      responseData
    );
    response.sessionHandle = sessionHandle;
    
    const responseBuffer = response.toBuffer();
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] RESPONSE: Register Session (SUCCESS)`);
    console.log(`  Status: 0x${response.status.toString(16).padStart(8, '0')}`);
    console.log(`  Session Handle: ${sessionHandle}`);
    console.log(`  Response Length: ${responseBuffer.length} bytes`);
    console.log(`  Response Data Length: ${responseData.length} bytes (should be 4)`);
    console.log(`  Response Data: ${responseData.toString('hex')} (Protocol: 0x0001, Options: 0x0000)`);
    console.log(`  Full Response (hex): ${responseBuffer.toString('hex')}`);
    
    // Verify response format
    const expectedResponse = Buffer.from('0065000400000001000000005f7079636f6d6d5f0000000001000000', 'hex');
    console.log(`  Expected Response (hex): ${expectedResponse.toString('hex')}`);
    console.log(`  Response matches expected: ${responseBuffer.equals(expectedResponse) ? 'YES' : 'NO'}`);
    
    // Convert response to client's endianness
    // Note: Some clients (like ethernet-ip npm package) send little-endian requests
    // and also expect little-endian responses, even though Ethernet/IP standard uses big-endian
    let responseToSend = responseBuffer;
    if (isLittleEndian) {
      responseToSend = EncapsulationPacket.toBufferLE(response, responseData);
    }
    
    // Write response and verify
    try {
      const written = socket.write(responseToSend);
      console.log(`  Bytes written to socket: ${written}`);
      console.log(`  Socket writable: ${socket.writable}`);
      console.log(`  Socket destroyed: ${socket.destroyed}`);
      console.log(`  Response endianness: ${isLittleEndian ? 'LITTLE-ENDIAN' : 'BIG-ENDIAN'}`);
      console.log(`  Response sent (hex): ${responseToSend.toString('hex')}`);
      
      // Add error handler if not already present
      if (!socket._hasErrorHandler) {
        socket.on('error', (err) => {
          console.log(`[${timestamp}] Socket error while sending Register Session response: ${err.message}`);
        });
        socket._hasErrorHandler = true;
      }
      
      // Verify data was sent
      socket.once('drain', () => {
        console.log(`[${timestamp}] Socket drain event - data sent`);
      });
      
    } catch (error) {
      console.log(`[${timestamp}] ERROR writing Register Session response: ${error.message}`);
      log(`Error writing response: ${error.message}`);
    }
  }

  /**
   * Handle unregister session
   */
  async handleUnregisterSession(socket, packet, isLittleEndian = false) {
    const clientInfo = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`[${new Date().toISOString()}] REQUEST: Unregister Session from ${clientInfo}`);
    console.log(`  Session Handle: ${packet.sessionHandle}`);
    log(`Unregister session: ${packet.sessionHandle}`);
    
    if (this.sessionManager.hasSession(packet.sessionHandle)) {
      this.sessionManager.removeSession(packet.sessionHandle);
      const response = packet.createResponse(
        EncapsulationPacket.STATUS.SUCCESS,
        Buffer.alloc(0)
      );
      // Send response in client's endianness
      const responseBuffer = isLittleEndian 
        ? EncapsulationPacket.toBufferLE(response, Buffer.alloc(0))
        : response.toBuffer();
      console.log(`[${new Date().toISOString()}] RESPONSE: Unregister Session (SUCCESS)`);
      console.log(`  Status: 0x${response.status.toString(16).padStart(8, '0')}`);
      console.log(`  Response Data: ${responseBuffer.toString('hex')}`);
      socket.write(responseBuffer);
    } else {
      const response = packet.createResponse(
        EncapsulationPacket.STATUS.INVALID_SESSION_HANDLE,
        Buffer.alloc(0)
      );
      // Send response in client's endianness
      const responseBuffer = isLittleEndian 
        ? EncapsulationPacket.toBufferLE(response, Buffer.alloc(0))
        : response.toBuffer();
      console.log(`[${new Date().toISOString()}] RESPONSE: Unregister Session (FAILED - Invalid Session)`);
      console.log(`  Status: 0x${response.status.toString(16).padStart(8, '0')}`);
      console.log(`  Response Data: ${responseBuffer.toString('hex')}`);
      socket.write(responseBuffer);
    }
  }

  /**
   * Handle Send RR Data (Request/Response Data)
   */
  async handleSendRRData(socket, packet, isLittleEndian = false) {
    const clientInfo = `${socket.remoteAddress}:${socket.remotePort}`;
    const timestamp = new Date().toISOString();
    
    console.log(`[${timestamp}] REQUEST: Send RR Data from ${clientInfo}`);
    console.log(`  Command: 0x${packet.command.toString(16).padStart(4, '0')}`);
    console.log(`  Session Handle: ${packet.sessionHandle}`);
    console.log(`  Data Length: ${packet.data.length} bytes`);
    console.log(`  Data (hex): ${packet.data.toString('hex')}`);
    
    if (!this.sessionManager.hasSession(packet.sessionHandle)) {
      const response = packet.createResponse(
        EncapsulationPacket.STATUS.INVALID_SESSION_HANDLE,
        Buffer.alloc(0)
      );
      // Send response in client's endianness
      const responseBuffer = isLittleEndian 
        ? EncapsulationPacket.toBufferLE(response, Buffer.alloc(0))
        : response.toBuffer();
      console.log(`[${timestamp}] RESPONSE: Send RR Data (FAILED - Invalid Session Handle)`);
      console.log(`  Status: 0x${response.status.toString(16).padStart(8, '0')}`);
      socket.write(responseBuffer);
      return;
    }

    this.sessionManager.updateActivity(packet.sessionHandle);

    // Parse CIP message from data
    // Send RR Data format (CPF - Common Packet Format):
    // - Interface Handle (4 bytes, UDINT)
    // - Timeout (2 bytes, UINT)
    // - Item Count (2 bytes)
    // - Item 1: Null Address (Type: 0x0000, Length: 0)
    // - Item 2: Unconnected Data (Type: 0x00B2, Length: n, Data: CIP message)
    try {
      let interfaceHandle = 0;
      let timeout = 0;
      let itemCount = 0;
      let cipMessageBuffer = Buffer.alloc(0);
      
      if (packet.data.length >= 16) {
        if (isLittleEndian) {
          interfaceHandle = packet.data.readUInt32LE(0);
          timeout = packet.data.readUInt16LE(4);
          itemCount = packet.data.readUInt16LE(6);
          
          // Parse CPF items
          let offset = 8;
          for (let i = 0; i < itemCount && offset < packet.data.length; i++) {
            const itemType = packet.data.readUInt16LE(offset);
            const itemLength = packet.data.readUInt16LE(offset + 2);
            offset += 4;
            
            console.log(`  CPF Item ${i + 1}: Type=0x${itemType.toString(16).padStart(4, '0')}, Length=${itemLength}`);
            
            // Item type 0x00B2 = Unconnected Data Item (contains CIP message)
            if (itemType === 0x00B2) {
              cipMessageBuffer = packet.data.slice(offset, offset + itemLength);
            }
            offset += itemLength;
          }
        } else {
          interfaceHandle = packet.data.readUInt32BE(0);
          timeout = packet.data.readUInt16BE(4);
          itemCount = packet.data.readUInt16BE(6);
          
          // Parse CPF items
          let offset = 8;
          for (let i = 0; i < itemCount && offset < packet.data.length; i++) {
            const itemType = packet.data.readUInt16BE(offset);
            const itemLength = packet.data.readUInt16BE(offset + 2);
            offset += 4;
            
            console.log(`  CPF Item ${i + 1}: Type=0x${itemType.toString(16).padStart(4, '0')}, Length=${itemLength}`);
            
            // Item type 0x00B2 = Unconnected Data Item (contains CIP message)
            if (itemType === 0x00B2) {
              cipMessageBuffer = packet.data.slice(offset, offset + itemLength);
            }
            offset += itemLength;
          }
        }
        
        console.log(`  Interface Handle: ${interfaceHandle} (0x${interfaceHandle.toString(16).padStart(8, '0')})`);
        console.log(`  Timeout: ${timeout} ms`);
        console.log(`  Item Count: ${itemCount}`);
      }
      
      console.log(`  CIP Message Buffer (${cipMessageBuffer.length} bytes): ${cipMessageBuffer.toString('hex')}`);
      
      const cipMessage = CIPMessage.fromBuffer(cipMessageBuffer);
      const service = cipMessage.service & 0x7F;
      console.log(`  CIP Service: 0x${service.toString(16).padStart(2, '0')} (${service === 0x0E ? 'Get Attribute Single' : service === 0x4C ? 'Read Tag' : 'Unknown'})`);
      console.log(`  CIP Path: ${cipMessage.path.toString('hex')}`);
      console.log(`  CIP Path Length: ${cipMessage.path.length} bytes`);
      if (cipMessage.data.length > 0) {
        console.log(`  CIP Data: ${cipMessage.data.toString('hex')}`);
      }
      
      log(`CIP Service: 0x${service.toString(16)}`);
      
      // Handle CIP message
      const cipResponse = await this.handleCIPMessage(cipMessage);
      
      // Create encapsulation response with CPF format
      // Response format:
      // - Interface Handle (4 bytes)
      // - Timeout (2 bytes)
      // - Item Count (2 bytes) = 2
      // - Item 1: Null Address (Type: 0x0000, Length: 0) = 4 bytes
      // - Item 2: Unconnected Data (Type: 0x00B2, Length: n, Data: CIP response)
      const cipResponseBuffer = cipResponse.toBuffer();
      const cpfHeaderSize = 4 + 2 + 2 + 4 + 4; // Interface Handle + Timeout + Item Count + Item 1 + Item 2 header
      const responseData = Buffer.alloc(cpfHeaderSize + cipResponseBuffer.length);
      
      if (isLittleEndian) {
        responseData.writeUInt32LE(interfaceHandle, 0);  // Interface Handle (4 bytes)
        responseData.writeUInt16LE(timeout, 4);          // Timeout (2 bytes)
        responseData.writeUInt16LE(2, 6);                // Item Count = 2
        
        // Item 1: Null Address
        responseData.writeUInt16LE(0x0000, 8);           // Type: Null Address
        responseData.writeUInt16LE(0, 10);               // Length: 0
        
        // Item 2: Unconnected Data
        responseData.writeUInt16LE(0x00B2, 12);          // Type: Unconnected Data
        responseData.writeUInt16LE(cipResponseBuffer.length, 14); // Length
      } else {
        responseData.writeUInt32BE(interfaceHandle, 0);
        responseData.writeUInt16BE(timeout, 4);
        responseData.writeUInt16BE(2, 6);
        
        responseData.writeUInt16BE(0x0000, 8);
        responseData.writeUInt16BE(0, 10);
        
        responseData.writeUInt16BE(0x00B2, 12);
        responseData.writeUInt16BE(cipResponseBuffer.length, 14);
      }
      
      // Copy CIP response data
      cipResponseBuffer.copy(responseData, 16);
      
      const response = packet.createResponse(
        EncapsulationPacket.STATUS.SUCCESS,
        responseData
      );
      
      const responseStatus = cipResponse.data.length > 0 ? cipResponse.data[0] : 0;
      // Send response in client's endianness
      const responseBuffer = isLittleEndian 
        ? EncapsulationPacket.toBufferLE(response, responseData)
        : response.toBuffer();
      console.log(`[${timestamp}] RESPONSE: Send RR Data (SUCCESS)`);
      console.log(`  Encapsulation Status: 0x${response.status.toString(16).padStart(8, '0')}`);
      console.log(`  CIP Response Status: 0x${responseStatus.toString(16).padStart(2, '0')}`);
      console.log(`  Response Data Length: ${cipResponse.toBuffer().length} bytes`);
      console.log(`  Response Data (hex): ${cipResponse.toBuffer().toString('hex')}`);
      console.log(`  Response endianness: ${isLittleEndian ? 'LITTLE-ENDIAN' : 'BIG-ENDIAN'}`);
      
      socket.write(responseBuffer);
    } catch (error) {
      log(`Error handling CIP message: ${error.message}`);
      console.log(`[${timestamp}] RESPONSE: Send RR Data (ERROR: ${error.message})`);
      const response = packet.createResponse(
        EncapsulationPacket.STATUS.INVALID_LENGTH,
        Buffer.alloc(0)
      );
      // Send response in client's endianness
      const responseBuffer = isLittleEndian 
        ? EncapsulationPacket.toBufferLE(response, Buffer.alloc(0))
        : response.toBuffer();
      console.log(`  Status: 0x${response.status.toString(16).padStart(8, '0')}`);
      socket.write(responseBuffer);
    }
  }

  /**
   * Handle CIP message
   * @param {CIPMessage} message - CIP message
   * @returns {Promise<CIPMessage>}
   */
  async handleCIPMessage(message) {
    const service = message.service & 0x7F; // Remove response bit
    
    console.log(`  [CIP] Handling service: 0x${service.toString(16).padStart(2, '0')}`);
    
    // Handle Multiple Service Packet (0x0A)
    if (service === CIPMessage.SERVICE.MULTIPLE_SERVICE_PACKET) {
      return this.handleMultipleServicePacket(message);
    }
    
    // Handle Unconnected Send (0x52) - Connection Manager service
    if (service === 0x52) {
      return this.handleUnconnectedSend(message);
    }
    
    // Handle Read Tag service (0x4C)
    if (service === 0x4C) {
      return this.handleReadTag(message);
    }
    
    // Handle Get Attribute Single (0x0E) - can be used for tag reading
    if (service === CIPMessage.SERVICE.GET_ATTRIBUTE_SINGLE) {
      return this.handleGetAttributeSingle(message);
    }
    
    // Handle Get Attribute All (0x01)
    if (service === CIPMessage.SERVICE.GET_ATTRIBUTE_ALL) {
      return this.handleGetAttributeAll(message);
    }

    // Default handler - returns not supported
    console.log(`  [CIP] Service 0x${service.toString(16)} not supported`);
    const response = message.createResponse(
      CIPMessage.STATUS.SERVICE_NOT_SUPPORTED,
      Buffer.alloc(0)
    );
    return response;
  }

  /**
   * Handle Unconnected Send service (0x52)
   * This is used by Connection Manager to forward CIP messages
   * @param {CIPMessage} message - CIP message
   * @returns {Promise<CIPMessage>}
   */
  async handleUnconnectedSend(message) {
    console.log(`  [CIP] Handling Unconnected Send (0x52)`);
    
    // Unconnected Send data format:
    // - Priority/Time_tick (1 byte)
    // - Timeout_ticks (1 byte)
    // - Message Request Size (2 bytes, LE)
    // - Embedded CIP Message (variable)
    // - Pad byte (if message size is odd)
    // - Route Path Size (1 byte, in 16-bit words)
    // - Reserved (1 byte)
    // - Route Path (variable)
    
    if (message.data.length < 4) {
      console.log(`  [CIP] Unconnected Send data too short: ${message.data.length} bytes`);
      return message.createResponse(CIPMessage.STATUS.NOT_ENOUGH_DATA, Buffer.alloc(0));
    }
    
    const priorityTimeTick = message.data[0];
    const timeoutTicks = message.data[1];
    const messageSize = message.data.readUInt16LE(2);
    
    console.log(`  [CIP] Priority/Time_tick: ${priorityTimeTick}`);
    console.log(`  [CIP] Timeout_ticks: ${timeoutTicks}`);
    console.log(`  [CIP] Embedded Message Size: ${messageSize} bytes`);
    
    if (message.data.length < 4 + messageSize) {
      console.log(`  [CIP] Not enough data for embedded message`);
      return message.createResponse(CIPMessage.STATUS.NOT_ENOUGH_DATA, Buffer.alloc(0));
    }
    
    // Extract embedded CIP message
    const embeddedMessageBuffer = message.data.slice(4, 4 + messageSize);
    console.log(`  [CIP] Embedded Message (hex): ${embeddedMessageBuffer.toString('hex')}`);
    
    try {
      // Parse and handle embedded CIP message
      const embeddedMessage = CIPMessage.fromBuffer(embeddedMessageBuffer);
      console.log(`  [CIP] Embedded Service: 0x${(embeddedMessage.service & 0x7F).toString(16).padStart(2, '0')}`);
      console.log(`  [CIP] Embedded Path: ${embeddedMessage.path.toString('hex')}`);
      
      // Process the embedded message
      const embeddedResponse = await this.handleCIPMessage(embeddedMessage);
      
      // For Unconnected Send, return the embedded response directly
      // The embedded response already has the correct service, status, and data
      const embeddedResponseBuffer = embeddedResponse.toBuffer();
      console.log(`  [CIP] Embedded Response (hex): ${embeddedResponseBuffer.toString('hex')}`);
      
      // Return the embedded response as-is (not wrapped in Unconnected Send)
      // The embedded response already contains the proper CIP response format
      return embeddedResponse;
    } catch (error) {
      console.log(`  [CIP] Error processing embedded message: ${error.message}`);
      return message.createResponse(CIPMessage.STATUS.GENERAL_ERROR, Buffer.alloc(0));
    }
  }

  /**
   * Handle Get Attribute All service (0x01)
   * @param {CIPMessage} message - CIP message
   * @returns {Promise<CIPMessage>}
   */
  async handleGetAttributeAll(message) {
    console.log(`  [CIP] Handling Get Attribute All (0x01)`);
    
    // Parse path to get class and instance
    const pathInfo = CIPPath.parse(message.path);
    console.log(`  [CIP] Path: Class=0x${(pathInfo.classId || 0).toString(16)}, Instance=${pathInfo.instanceId || 0}`);
    
    // Identity Object (Class 0x01)
    if (pathInfo.classId === 0x01) {
      return this.handleIdentityGetAttributeAll(message);
    }
    
    // Default - not supported
    return message.createResponse(CIPMessage.STATUS.SERVICE_NOT_SUPPORTED, Buffer.alloc(0));
  }

  /**
   * Handle Identity Object Get Attribute All
   * @param {CIPMessage} message - CIP message
   * @returns {Promise<CIPMessage>}
   */
  async handleIdentityGetAttributeAll(message) {
    console.log(`  [CIP] Returning Identity Object attributes`);
    
    // Identity Object attributes (Class 0x01, Instance 1)
    // Attribute 1: Vendor ID (UINT)
    // Attribute 2: Device Type (UINT)
    // Attribute 3: Product Code (UINT)
    // Attribute 4: Revision (USINT.USINT)
    // Attribute 5: Status (WORD)
    // Attribute 6: Serial Number (UDINT)
    // Attribute 7: Product Name (SHORT_STRING)
    
    const productNameBytes = Buffer.from(this.productName, 'utf8');
    const productNameLength = Math.min(productNameBytes.length, 32);
    
    // Calculate total size
    const dataSize = 2 + 2 + 2 + 2 + 2 + 4 + 1 + productNameLength; // 15 + name
    const responseData = Buffer.alloc(dataSize);
    
    let offset = 0;
    
    // Vendor ID (2 bytes)
    responseData.writeUInt16LE(this.vendorId, offset);
    offset += 2;
    
    // Device Type (2 bytes)
    responseData.writeUInt16LE(this.deviceType, offset);
    offset += 2;
    
    // Product Code (2 bytes)
    responseData.writeUInt16LE(this.productCode & 0xFFFF, offset);
    offset += 2;
    
    // Revision (2 bytes: major.minor)
    responseData.writeUInt8(1, offset);     // Major
    responseData.writeUInt8(0, offset + 1); // Minor
    offset += 2;
    
    // Status (2 bytes)
    responseData.writeUInt16LE(0x0000, offset); // Status: 0 = OK
    offset += 2;
    
    // Serial Number (4 bytes)
    responseData.writeUInt32LE(0x12345678, offset);
    offset += 4;
    
    // Product Name (SHORT_STRING: length byte + string)
    responseData.writeUInt8(productNameLength, offset);
    offset += 1;
    productNameBytes.copy(responseData, offset, 0, productNameLength);
    
    console.log(`  [CIP] Identity response: ${responseData.toString('hex')}`);
    
    return message.createResponse(CIPMessage.STATUS.SUCCESS, responseData);
  }

  /**
   * Handle Multiple Service Packet (0x0A)
   * This allows multiple CIP services to be sent in a single request
   * @param {CIPMessage} message - CIP message
   * @returns {Promise<CIPMessage>}
   */
  async handleMultipleServicePacket(message) {
    console.log(`  [CIP] Handling Multiple Service Packet (0x0A)`);
    console.log(`  [CIP] Data length: ${message.data.length} bytes`);
    console.log(`  [CIP] Data (hex): ${message.data.toString('hex')}`);
    
    // Multiple Service Packet request format:
    // - Number of Services (2 bytes, UINT)
    // - Service Offsets (2 bytes each)
    // - Service Requests (variable)
    
    if (message.data.length < 2) {
      console.log(`  [CIP] Multiple Service Packet data too short`);
      return message.createResponse(CIPMessage.STATUS.NOT_ENOUGH_DATA, Buffer.alloc(0));
    }
    
    const serviceCount = message.data.readUInt16LE(0);
    console.log(`  [CIP] Service count: ${serviceCount}`);
    
    if (message.data.length < 2 + (serviceCount * 2)) {
      console.log(`  [CIP] Not enough data for service offsets`);
      return message.createResponse(CIPMessage.STATUS.NOT_ENOUGH_DATA, Buffer.alloc(0));
    }
    
    // Read service offsets
    const offsets = [];
    for (let i = 0; i < serviceCount; i++) {
      offsets.push(message.data.readUInt16LE(2 + (i * 2)));
    }
    console.log(`  [CIP] Service offsets: ${offsets.join(', ')}`);
    
    // Process each service request
    const responses = [];
    for (let i = 0; i < serviceCount; i++) {
      const startOffset = offsets[i];
      const endOffset = (i < serviceCount - 1) ? offsets[i + 1] : message.data.length;
      
      // Extract service request
      const serviceData = message.data.slice(startOffset, endOffset);
      console.log(`  [CIP] Service ${i + 1} (offset ${startOffset}-${endOffset}): ${serviceData.toString('hex')}`);
      
      if (serviceData.length < 2) {
        console.log(`  [CIP] Service ${i + 1} data too short`);
        // Create error response for this service
        const errorResponse = new CIPMessage();
        errorResponse.service = 0x80; // Generic error response
        errorResponse.path = Buffer.alloc(0);
        errorResponse.data = Buffer.from([CIPMessage.STATUS.NOT_ENOUGH_DATA]);
        responses.push(errorResponse);
        continue;
      }
      
      try {
        // Parse embedded service request
        const embeddedMessage = CIPMessage.fromBuffer(serviceData);
        console.log(`  [CIP] Service ${i + 1}: service=0x${(embeddedMessage.service & 0x7F).toString(16)}, path=${embeddedMessage.path.toString('hex')}`);
        
        // Process the embedded service
        const embeddedResponse = await this.handleCIPMessage(embeddedMessage);
        responses.push(embeddedResponse);
      } catch (error) {
        console.log(`  [CIP] Error processing service ${i + 1}: ${error.message}`);
        const errorResponse = new CIPMessage();
        errorResponse.service = serviceData[0] | 0x80;
        errorResponse.path = Buffer.alloc(0);
        errorResponse.data = Buffer.from([CIPMessage.STATUS.GENERAL_ERROR]);
        responses.push(errorResponse);
      }
    }
    
    // Build Multiple Service Packet response
    // Response format:
    // - Number of Services (2 bytes)
    // - Service Response Offsets (2 bytes each)
    // - Service Responses (variable)
    
    // Calculate response offsets
    const responseBuffers = responses.map(r => r.toBuffer());
    const headerSize = 2 + (serviceCount * 2); // Count + offsets
    let currentOffset = headerSize;
    const responseOffsets = [];
    
    for (const buf of responseBuffers) {
      responseOffsets.push(currentOffset);
      currentOffset += buf.length;
    }
    
    // Build response data
    const responseData = Buffer.alloc(currentOffset);
    responseData.writeUInt16LE(serviceCount, 0);
    
    for (let i = 0; i < serviceCount; i++) {
      responseData.writeUInt16LE(responseOffsets[i], 2 + (i * 2));
    }
    
    let writeOffset = headerSize;
    for (const buf of responseBuffers) {
      buf.copy(responseData, writeOffset);
      writeOffset += buf.length;
    }
    
    console.log(`  [CIP] Multiple Service Packet response: ${responseData.toString('hex')}`);
    
    return message.createResponse(CIPMessage.STATUS.SUCCESS, responseData);
  }

  /**
   * Handle Read Tag service (0x4C)
   * @param {CIPMessage} message - CIP message
   * @returns {Promise<CIPMessage>}
   */
  async handleReadTag(message) {
    console.log(`  [CIP] Handling Read Tag (0x4C)`);
    console.log(`  [CIP] Path (hex): ${message.path.toString('hex')}`);
    console.log(`  [CIP] Data (hex): ${message.data.toString('hex')}`);
    
    try {
      let tagData = null;
      
      // Try to extract tag name from symbolic path
      const tagName = CIPPath.extractTagName(message.path);
      console.log(`  [CIP] Extracted tag name: ${tagName}`);
      
      if (tagName) {
        // First try to read by name
        tagData = this.tagManager.readTag(tagName);
        
        // If not found by name, try to find by address
        if (!tagData) {
          console.log(`  [CIP] Tag not found by name, trying address: ${tagName}`);
          const tagByAddress = this.tagManager.findTagByAddress(tagName);
          if (tagByAddress) {
            tagData = this.tagManager.readTag(tagByAddress.name);
          }
        }
        
        if (tagData) {
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] TAG OKUMA: ${tagData.name} (${tagData.address}) = ${tagData.value}`);
          log(`Read tag by name/address: ${tagName} = ${tagData.value}`);
        }
      } else {
        // Try to parse as address (Tag_1, Tag_2, etc.)
        // Path might be in different formats, try multiple approaches
        const pathStr = message.path.toString('ascii', 2); // Skip path length bytes
        const match = pathStr.match(/Tag[_\s]?(\d+)/i);
        
        if (match) {
          const tagIndex = parseInt(match[1]) - 1;
          const allTags = this.tagManager.getAllTags();
          if (tagIndex >= 0 && tagIndex < allTags.length) {
            const tag = allTags[tagIndex];
            tagData = this.tagManager.readTag(tag.name);
            const timestamp = new Date().toISOString();
            console.log(`[${timestamp}] TAG OKUMA: ${tagData.name} (${tagData.address}) = ${tagData.value}`);
            log(`Read tag by address: ${tag.address} (${tag.name}) = ${tagData.value}`);
          }
        } else {
          // Try to find by address directly
          const addressMatch = pathStr.match(/(\d+)/);
          if (addressMatch) {
            const tagIndex = parseInt(addressMatch[1]) - 1;
            const allTags = this.tagManager.getAllTags();
            if (tagIndex >= 0 && tagIndex < allTags.length) {
              const tag = allTags[tagIndex];
              tagData = this.tagManager.readTag(tag.name);
              const timestamp = new Date().toISOString();
              console.log(`[${timestamp}] TAG OKUMA: ${tagData.name} (${tagData.address}) = ${tagData.value}`);
              log(`Read tag by index: Tag_${tagIndex + 1} (${tag.name}) = ${tagData.value}`);
            }
          }
        }
      }
      
      if (!tagData) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] TAG OKUMA HATASI: Tag bulunamadı. Path: ${message.path.toString('hex')}`);
        log(`Tag not found. Path: ${message.path.toString('hex')}`);
        return message.createResponse(
          CIPMessage.STATUS.PATH_DESTINATION_UNKNOWN,
          Buffer.alloc(0)
        );
      }
      
      // Return value with type info
      // Read Tag response format: Type (2 bytes) + Data (variable)
      // DINT = 0x00C4
      const valueBuffer = this.tagManager.valueToBuffer(tagData.value);
      const responseData = Buffer.alloc(2 + valueBuffer.length);
      responseData.writeUInt16LE(0x00C4, 0); // Type: DINT
      valueBuffer.copy(responseData, 2);
      
      console.log(`  [CIP] Read Tag response: Type=DINT, Value=${tagData.value}, Data=${responseData.toString('hex')}`);
      
      return message.createResponse(
        CIPMessage.STATUS.SUCCESS,
        responseData
      );
    } catch (error) {
      log(`Error reading tag: ${error.message}`);
      return message.createResponse(
        CIPMessage.STATUS.GENERAL_ERROR,
        Buffer.alloc(0)
      );
    }
  }

  /**
   * Handle Get Attribute Single service (0x0E)
   * @param {CIPMessage} message - CIP message
   * @returns {Promise<CIPMessage>}
   */
  async handleGetAttributeSingle(message) {
    try {
      // Parse CIP path to get class, instance, and attribute
      const pathSegments = CIPPath.parsePath(message.path);
      
      if (pathSegments.length === 0) {
        log('Get Attribute Single: Empty path');
        return message.createResponse(
          CIPMessage.STATUS.PATH_SEGMENT_ERROR,
          Buffer.alloc(0)
        );
      }

      // Extract class, instance, and attribute from path
      let classId = null;
      let instanceId = null;
      let attributeId = null;

      for (const segment of pathSegments) {
        if (segment.type === 'logical') {
          if (segment.format === CIPPath.LOGICAL_FORMAT.CLASS_ID) {
            classId = segment.value;
          } else if (segment.format === CIPPath.LOGICAL_FORMAT.INSTANCE_ID) {
            instanceId = segment.value;
          } else if (segment.format === CIPPath.LOGICAL_FORMAT.ATTRIBUTE_ID) {
            attributeId = segment.value;
          }
        }
      }

      // If attribute ID is in data section (some clients send it there)
      if (attributeId === null && message.data.length >= 2) {
        attributeId = message.data.readUInt16LE(0);
      }

      // Debug logging
      log(`Get Attribute Single: Class=${classId}, Instance=${instanceId}, Attribute=${attributeId}, Path=${message.path.toString('hex')}, Data=${message.data.toString('hex')}`);
      
      if (classId === null) {
        log('Get Attribute Single: Class ID not found in path');
        return message.createResponse(
          CIPMessage.STATUS.PATH_SEGMENT_ERROR,
          Buffer.alloc(0)
        );
      }

      // Handle Identity Object (Class 0x01)
      if (classId === 0x01) {
        return this.handleIdentityObject(instanceId, attributeId, message);
      }

      // Handle Message Router Object (Class 0x02)
      if (classId === 0x02) {
        return this.handleMessageRouterObject(instanceId, attributeId, message);
      }

      // Handle Connection Manager Object (Class 0x06)
      if (classId === 0x06) {
        return this.handleConnectionManagerObject(instanceId, attributeId, message);
      }

      // Try tag reading via symbolic path
      const tagName = CIPPath.extractTagName(message.path);
      if (tagName) {
        const tagData = this.tagManager.readTag(tagName);
        if (tagData) {
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] TAG OKUMA (Get Attribute): ${tagData.name} (${tagData.address}) = ${tagData.value}`);
          log(`Read tag via Get Attribute: ${tagName} = ${tagData.value}`);
          const valueBuffer = this.tagManager.valueToBuffer(tagData.value);
          return message.createResponse(
            CIPMessage.STATUS.SUCCESS,
            valueBuffer
          );
        }
      }
      
      log(`Get Attribute Single: Object not found - Class=${classId}, Instance=${instanceId}, Attribute=${attributeId}`);
      return message.createResponse(
        CIPMessage.STATUS.OBJECT_DOES_NOT_EXIST,
        Buffer.alloc(0)
      );
    } catch (error) {
      log(`Get Attribute Single error: ${error.message}`);
      return message.createResponse(
        CIPMessage.STATUS.GENERAL_ERROR,
        Buffer.alloc(0)
      );
    }
  }

  /**
   * Handle Identity Object (Class 0x01) attribute requests
   * @param {number} instanceId - Instance ID
   * @param {number} attributeId - Attribute ID
   * @param {CIPMessage} message - Original message
   * @returns {CIPMessage}
   */
  handleIdentityObject(instanceId, attributeId, message) {
    console.log(`  -> Identity Object: Instance=${instanceId}, Attribute=${attributeId}`);
    
    // Identity Object typically uses instance 1
    if (instanceId !== 1 && instanceId !== 0) {
      console.log(`  <- Identity Object: OBJECT_DOES_NOT_EXIST`);
      return message.createResponse(
        CIPMessage.STATUS.OBJECT_DOES_NOT_EXIST,
        Buffer.alloc(0)
      );
    }

    // Attribute 1: Vendor ID (UINT)
    if (attributeId === 1) {
      const data = Buffer.alloc(2);
      data.writeUInt16LE(this.vendorId, 0);
      console.log(`  <- Identity Object Attribute 1 (Vendor ID): 0x${this.vendorId.toString(16).padStart(4, '0')}`);
      return message.createResponse(CIPMessage.STATUS.SUCCESS, data);
    }

    // Attribute 2: Device Type (UINT)
    if (attributeId === 2) {
      const data = Buffer.alloc(2);
      data.writeUInt16LE(this.deviceType, 0);
      console.log(`  <- Identity Object Attribute 2 (Device Type): 0x${this.deviceType.toString(16).padStart(4, '0')}`);
      return message.createResponse(CIPMessage.STATUS.SUCCESS, data);
    }

    // Attribute 3: Product Code (UINT)
    if (attributeId === 3) {
      const data = Buffer.alloc(2);
      data.writeUInt16LE(this.productCode & 0xFFFF, 0);
      console.log(`  <- Identity Object Attribute 3 (Product Code): 0x${(this.productCode & 0xFFFF).toString(16).padStart(4, '0')}`);
      return message.createResponse(CIPMessage.STATUS.SUCCESS, data);
    }

    // Attribute 4: Revision (STRUCT: Major, Minor)
    if (attributeId === 4) {
      const data = Buffer.alloc(2);
      data.writeUInt8(0x01, 0); // Major revision
      data.writeUInt8(0x00, 1); // Minor revision
      console.log(`  <- Identity Object Attribute 4 (Revision): 1.0`);
      return message.createResponse(CIPMessage.STATUS.SUCCESS, data);
    }

    // Attribute 5: Status (WORD)
    if (attributeId === 5) {
      const data = Buffer.alloc(2);
      data.writeUInt16LE(0x0001, 0); // Status: configured
      console.log(`  <- Identity Object Attribute 5 (Status): 0x0001 (configured)`);
      return message.createResponse(CIPMessage.STATUS.SUCCESS, data);
    }

    // Attribute 6: Serial Number (UDINT)
    if (attributeId === 6) {
      const data = Buffer.alloc(4);
      data.writeUInt32LE(0x00000000, 0);
      console.log(`  <- Identity Object Attribute 6 (Serial Number): 0x00000000`);
      return message.createResponse(CIPMessage.STATUS.SUCCESS, data);
    }

    // Attribute 7: Product Name (SHORT_STRING)
    if (attributeId === 7) {
      const nameBytes = Buffer.from(this.productName, 'ascii');
      const data = Buffer.alloc(1 + nameBytes.length);
      data[0] = nameBytes.length; // Length byte
      nameBytes.copy(data, 1);
      console.log(`  <- Identity Object Attribute 7 (Product Name): ${this.productName}`);
      return message.createResponse(CIPMessage.STATUS.SUCCESS, data);
    }

    console.log(`  <- Identity Object: ATTRIBUTE_NOT_SUPPORTED (Attribute ${attributeId})`);
    log(`Identity Object: Unsupported attribute ${attributeId}`);
    return message.createResponse(
      CIPMessage.STATUS.ATTRIBUTE_NOT_SUPPORTED,
      Buffer.alloc(0)
    );
  }

  /**
   * Handle Message Router Object (Class 0x02) attribute requests
   * @param {number} instanceId - Instance ID
   * @param {number} attributeId - Attribute ID
   * @param {CIPMessage} message - Original message
   * @returns {CIPMessage}
   */
  handleMessageRouterObject(instanceId, attributeId, message) {
    console.log(`  -> Message Router Object: Instance=${instanceId}, Attribute=${attributeId}`);
    
    // Message Router Object typically uses instance 1
    if (instanceId !== 1 && instanceId !== 0) {
      console.log(`  <- Message Router Object: OBJECT_DOES_NOT_EXIST`);
      return message.createResponse(
        CIPMessage.STATUS.OBJECT_DOES_NOT_EXIST,
        Buffer.alloc(0)
      );
    }

    // Attribute 1: Number of Objects (UINT)
    if (attributeId === 1) {
      const data = Buffer.alloc(2);
      data.writeUInt16LE(3, 0); // Identity, Message Router, Connection Manager
      console.log(`  <- Message Router Object Attribute 1 (Number of Objects): 3`);
      return message.createResponse(CIPMessage.STATUS.SUCCESS, data);
    }

    // Attribute 2: Number of Class Instances (UINT)
    if (attributeId === 2) {
      const data = Buffer.alloc(2);
      data.writeUInt16LE(0, 0);
      console.log(`  <- Message Router Object Attribute 2 (Number of Class Instances): 0`);
      return message.createResponse(CIPMessage.STATUS.SUCCESS, data);
    }

    // Attribute 3: Number of Instances (UINT)
    if (attributeId === 3) {
      const data = Buffer.alloc(2);
      data.writeUInt16LE(0, 0);
      console.log(`  <- Message Router Object Attribute 3 (Number of Instances): 0`);
      return message.createResponse(CIPMessage.STATUS.SUCCESS, data);
    }

    console.log(`  <- Message Router Object: ATTRIBUTE_NOT_SUPPORTED (Attribute ${attributeId})`);
    log(`Message Router Object: Unsupported attribute ${attributeId}`);
    return message.createResponse(
      CIPMessage.STATUS.ATTRIBUTE_NOT_SUPPORTED,
      Buffer.alloc(0)
    );
  }

  /**
   * Handle Connection Manager Object (Class 0x06) attribute requests
   * @param {number} instanceId - Instance ID
   * @param {number} attributeId - Attribute ID
   * @param {CIPMessage} message - Original message
   * @returns {CIPMessage}
   */
  handleConnectionManagerObject(instanceId, attributeId, message) {
    console.log(`  -> Connection Manager Object: Instance=${instanceId}, Attribute=${attributeId}`);
    
    // Connection Manager Object typically uses instance 1
    if (instanceId !== 1 && instanceId !== 0) {
      console.log(`  <- Connection Manager Object: OBJECT_DOES_NOT_EXIST`);
      return message.createResponse(
        CIPMessage.STATUS.OBJECT_DOES_NOT_EXIST,
        Buffer.alloc(0)
      );
    }

    // Attribute 1: Maximum Connections (UINT)
    if (attributeId === 1) {
      const data = Buffer.alloc(2);
      data.writeUInt16LE(128, 0); // Max connections
      console.log(`  <- Connection Manager Object Attribute 1 (Maximum Connections): 128`);
      return message.createResponse(CIPMessage.STATUS.SUCCESS, data);
    }

    // Attribute 2: Active Connections (UINT)
    if (attributeId === 2) {
      const activeSessions = this.sessionManager.getAllSessions().length;
      const data = Buffer.alloc(2);
      data.writeUInt16LE(activeSessions, 0);
      console.log(`  <- Connection Manager Object Attribute 2 (Active Connections): ${activeSessions}`);
      return message.createResponse(CIPMessage.STATUS.SUCCESS, data);
    }

    console.log(`  <- Connection Manager Object: ATTRIBUTE_NOT_SUPPORTED (Attribute ${attributeId})`);
    log(`Connection Manager Object: Unsupported attribute ${attributeId}`);
    return message.createResponse(
      CIPMessage.STATUS.ATTRIBUTE_NOT_SUPPORTED,
      Buffer.alloc(0)
    );
  }

  /**
   * Handle list services
   */
  async handleListServices(socket, packet, isLittleEndian = false) {
    const clientInfo = `${socket.remoteAddress}:${socket.remotePort}`;
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] REQUEST: List Services from ${clientInfo}`);
    log('List services request');
    
    // Service list: only Encapsulation service
    const serviceData = Buffer.alloc(16);
    serviceData.writeUInt16BE(0x0001, 0); // Service type: Encapsulation
    serviceData.writeUInt16BE(0x0001, 2); // Version
    serviceData.writeUInt16BE(0x0001, 4); // Flags
    serviceData.writeUInt16BE(0x0000, 6); // Name length
    // Service name would go here if length > 0
    
    const response = packet.createResponse(
      EncapsulationPacket.STATUS.SUCCESS,
      serviceData
    );
    
    // Send response in client's endianness
    const responseBuffer = isLittleEndian 
      ? EncapsulationPacket.toBufferLE(response, serviceData)
      : response.toBuffer();
    console.log(`[${timestamp}] RESPONSE: List Services (SUCCESS)`);
    console.log(`  Status: 0x${response.status.toString(16).padStart(8, '0')}`);
    console.log(`  Response Data: ${serviceData.toString('hex')}`);
    console.log(`  Response endianness: ${isLittleEndian ? 'LITTLE-ENDIAN' : 'BIG-ENDIAN'}`);
    
    socket.write(responseBuffer);
  }

  /**
   * Handle list identity
   */
  async handleListIdentity(socket, packet, isLittleEndian = false) {
    const clientInfo = `${socket.remoteAddress}:${socket.remotePort}`;
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] REQUEST: List Identity from ${clientInfo}`);
    log('List identity request');
    
    // Get server's actual IP address
    const serverAddress = socket.localAddress || '0.0.0.0';
    const ipParts = serverAddress.split('.').map(Number);
    const ipAddress = (ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3];
    
    // Identity information according to EtherNet/IP spec
    // Format: 16 bytes header + variable length product name
    const productNameBytes = Buffer.from(this.productName, 'ascii');
    const nameLength = Math.min(productNameBytes.length, 32); // Max 32 bytes for product name
    const identityData = Buffer.alloc(16 + 2 + nameLength + 1); // Header + length + name + null terminator
    
    // 16-byte header
    identityData.writeUInt16BE(0x0000, 0); // Socket address family (IPv4)
    identityData.writeUInt16BE(0x0000, 2); // Port (0 = not applicable)
    identityData.writeUInt32BE(ipAddress, 4); // IP address
    identityData.writeUInt16BE(0x0000, 8); // Reserved
    identityData.writeUInt16BE(0x0000, 10); // Reserved
    identityData.writeUInt16BE(this.vendorId, 12); // Vendor ID
    identityData.writeUInt16BE(this.deviceType, 14); // Device type
    
    // Product code (4 bytes)
    identityData.writeUInt32BE(this.productCode, 16);
    
    // Revision (2 bytes)
    identityData.writeUInt8(0x01, 20); // Revision (major)
    identityData.writeUInt8(0x00, 21); // Revision (minor)
    
    // Status (2 bytes)
    identityData.writeUInt16BE(0x0001, 22); // Status: configured
    
    // Serial number (4 bytes)
    identityData.writeUInt32BE(0x00000000, 24);
    
    // Product name length (2 bytes)
    identityData.writeUInt16BE(nameLength, 28);
    
    // Product name (variable length)
    productNameBytes.copy(identityData, 30, 0, nameLength);
    identityData[30 + nameLength] = 0; // Null terminator
    
    log(`List Identity response: Slot=${this.deviceSlotNumber}, Vendor=0x${this.vendorId.toString(16)}, Type=0x${this.deviceType.toString(16)}, IP=${serverAddress}`);
    
    const response = packet.createResponse(
      EncapsulationPacket.STATUS.SUCCESS,
      identityData
    );
    
    console.log(`[${timestamp}] RESPONSE: List Identity (SUCCESS)`);
    console.log(`  Status: 0x${response.status.toString(16).padStart(8, '0')}`);
    console.log(`  IP Address: ${serverAddress}`);
    console.log(`  Vendor ID: 0x${this.vendorId.toString(16).padStart(4, '0')}`);
    console.log(`  Device Type: 0x${this.deviceType.toString(16).padStart(4, '0')}`);
    console.log(`  Product Code: 0x${this.productCode.toString(16).padStart(8, '0')}`);
    console.log(`  Product Name: ${this.productName}`);
    console.log(`  Response Data Length: ${identityData.length} bytes`);
    console.log(`  Response Data (hex): ${identityData.toString('hex')}`);
    
    // Send response in client's endianness
    const responseBuffer = isLittleEndian 
      ? EncapsulationPacket.toBufferLE(response, identityData)
      : response.toBuffer();
    console.log(`  Response endianness: ${isLittleEndian ? 'LITTLE-ENDIAN' : 'BIG-ENDIAN'}`);
    
    socket.write(responseBuffer);
  }

  /**
   * Handle client connection
   */
  handleConnection(socket) {
    const clientInfo = `${socket.remoteAddress}:${socket.remotePort}`;
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ===== NEW CLIENT CONNECTION =====`);
    console.log(`  Client: ${clientInfo}`);
    console.log(`  Local Address: ${socket.localAddress}:${socket.localPort}`);
    console.log(`  Remote Address: ${socket.remoteAddress}:${socket.remotePort}`);
    console.log(`  Socket Ready State: ${socket.readyState}`);
    log(`Client connected: ${clientInfo}`);

    // Add connection event handlers
    socket.on('error', (error) => {
      console.log(`[${new Date().toISOString()}] Socket error from ${clientInfo}: ${error.message}`);
      log(`Socket error: ${error.message}`);
    });

    socket.on('close', (hadError) => {
      console.log(`[${new Date().toISOString()}] ===== CLIENT DISCONNECTED =====`);
      console.log(`  Client: ${clientInfo}`);
      console.log(`  Had Error: ${hadError}`);
      // Clean up endianness mapping
      this.clientEndianness.delete(socket);
      log(`Client disconnected: ${clientInfo}`);
    });

    socket.on('end', () => {
      console.log(`[${new Date().toISOString()}] Client ended connection: ${clientInfo}`);
      log(`Client ended connection: ${clientInfo}`);
    });

    let buffer = Buffer.alloc(0);
    let firstDataReceived = false;

    socket.on('data', async (data) => {
      const dataTimestamp = new Date().toISOString();
      
      if (!firstDataReceived) {
        firstDataReceived = true;
        console.log(`[${dataTimestamp}] ===== FIRST DATA RECEIVED from ${clientInfo} =====`);
        console.log(`  Data length: ${data.length} bytes`);
        console.log(`  Data (hex): ${data.toString('hex')}`);
        console.log(`========================================`);
      }
      
      buffer = Buffer.concat([buffer, data]);

      // Process complete packets
      while (buffer.length >= 24) {
        // Check if packet is little-endian by checking command field
        // Standard Ethernet/IP uses big-endian, but some clients send little-endian
        const commandBE = buffer.readUInt16BE(0);
        const commandLE = buffer.readUInt16LE(0);
        const lengthBE = buffer.readUInt16BE(2);
        const lengthLE = buffer.readUInt16LE(2);
        
        // Detect endianness: if command in LE makes sense (known commands) and BE doesn't, use LE
        const knownCommands = [
          0x0065, // Register Session
          0x0066, // Unregister Session
          0x006F, // Send RR Data
          0x0004, // List Services
          0x0063  // List Identity
        ];
        
        const isLittleEndian = knownCommands.includes(commandLE) && !knownCommands.includes(commandBE);
        
        let command = isLittleEndian ? commandLE : commandBE;
        let dataLength = isLittleEndian ? lengthLE : lengthBE;
        let packetLength = 24 + dataLength;
        
        console.log(`[${new Date().toISOString()}] Buffer status: ${buffer.length} bytes`);
        console.log(`  Command (BE): 0x${commandBE.toString(16).padStart(4, '0')}`);
        console.log(`  Command (LE): 0x${commandLE.toString(16).padStart(4, '0')}`);
        console.log(`  Length (BE): 0x${lengthBE.toString(16).padStart(4, '0')} = ${lengthBE}`);
        console.log(`  Length (LE): 0x${lengthLE.toString(16).padStart(4, '0')} = ${lengthLE}`);
        console.log(`  Detected endianness: ${isLittleEndian ? 'LITTLE-ENDIAN' : 'BIG-ENDIAN'}`);
        console.log(`  Using Command: 0x${command.toString(16).padStart(4, '0')}`);
        console.log(`  Using Data Length: ${dataLength} bytes`);
        console.log(`  Expected packet length: ${packetLength} bytes (24 header + ${dataLength} data)`);
        
        // Validate packet length
        if (packetLength < 24) {
          console.log(`[${new Date().toISOString()}] ERROR: Invalid packet length: ${packetLength} (too short)`);
          console.log(`  Buffer (first 24 bytes): ${buffer.slice(0, 24).toString('hex')}`);
          buffer = Buffer.alloc(0); // Clear buffer on error
          break;
        }
        
        if (packetLength > 65535) {
          console.log(`[${new Date().toISOString()}] ERROR: Invalid packet length: ${packetLength} (too long)`);
          console.log(`  Buffer (first 24 bytes): ${buffer.slice(0, 24).toString('hex')}`);
          buffer = Buffer.alloc(0); // Clear buffer on error
          break;
        }
        
        if (buffer.length < packetLength) {
          // Wait for more data
          console.log(`  Waiting for more data... (need ${packetLength - buffer.length} more bytes)`);
          break;
        }

        try {
          // Extract packet from buffer
          const packetBuffer = buffer.slice(0, packetLength);
          console.log(`[${new Date().toISOString()}] Extracting packet: ${packetLength} bytes from buffer`);
          console.log(`  Packet buffer (hex): ${packetBuffer.toString('hex')}`);
          
          // Store endianness for this socket
          this.clientEndianness.set(socket, isLittleEndian);
          
          // Parse packet with detected endianness
          const packet = isLittleEndian 
            ? EncapsulationPacket.fromBufferLE(packetBuffer)
            : EncapsulationPacket.fromBuffer(packetBuffer);
          const timestamp = new Date().toISOString();
          const clientInfo = `${socket.remoteAddress}:${socket.remotePort}`;
          
          console.log(`[${timestamp}] ===== INCOMING PACKET from ${clientInfo} =====`);
          console.log(`  Command: 0x${packet.command.toString(16).padStart(4, '0')} (${this.getCommandName(packet.command)})`);
          console.log(`  Length: ${packet.length} bytes`);
          console.log(`  Session Handle: ${packet.sessionHandle}`);
          console.log(`  Status: 0x${packet.status.toString(16).padStart(8, '0')}`);
          console.log(`  Data Length: ${packet.data.length} bytes`);
          if (packet.data.length > 0) {
            console.log(`  Data (hex): ${packet.data.toString('hex')}`);
          }
          console.log(`========================================`);
          
          log(`Received command: 0x${packet.command.toString(16).padStart(4, '0')}`);

          const handler = this.messageHandlers.get(packet.command);
          if (handler) {
            await handler(socket, packet, isLittleEndian);
          } else {
            log(`Unknown command: 0x${packet.command.toString(16)}`);
            console.log(`[${timestamp}] RESPONSE: Unknown Command (0x${packet.command.toString(16).padStart(4, '0')})`);
            const response = packet.createResponse(
              EncapsulationPacket.STATUS.INVALID_COMMAND,
              Buffer.alloc(0)
            );
            // Send response in client's endianness
            const responseBuffer = isLittleEndian 
              ? EncapsulationPacket.toBufferLE(response, Buffer.alloc(0))
              : response.toBuffer();
            console.log(`  Status: 0x${response.status.toString(16).padStart(8, '0')}`);
            socket.write(responseBuffer);
          }
          
          // Remove processed packet from buffer
          buffer = buffer.slice(packetLength);
          console.log(`[${new Date().toISOString()}] Packet processed, remaining buffer: ${buffer.length} bytes`);
        } catch (error) {
          log(`Error processing packet: ${error.message}`);
          console.log(`[${new Date().toISOString()}] ERROR processing packet: ${error.message}`);
          console.log(`  Error stack: ${error.stack}`);
          // On error, clear buffer to prevent infinite loop
          buffer = Buffer.alloc(0);
        }
      }
    });

    socket.on('error', (error) => {
      log(`Socket error: ${error.message}`);
    });

    socket.on('close', () => {
      log(`Client disconnected: ${clientInfo}`);
    });
  }

  /**
   * Start the TCP server
   * @returns {Promise}
   */
  async start() {
    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => {
        this.handleConnection(socket);
      });

      this.server.on('error', (error) => {
        log(`Server error: ${error.message}`);
        reject(error);
      });

      this.server.listen(this.port, this.host, () => {
        log(`TCP Server listening on ${this.host}:${this.port}`);
        resolve();
      });
    });
  }

  /**
   * Stop the TCP server
   * @returns {Promise}
   */
  async stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          log('TCP Server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

