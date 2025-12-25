/**
 * Test script to verify Register Session response
 */

import net from 'net';

const HOST = '192.168.0.111';
const PORT = 44818;

console.log('=== Register Session Test ===');
console.log(`Connecting to ${HOST}:${PORT}...\n`);

const client = new net.Socket();

client.on('connect', () => {
  console.log('✓ TCP connection established\n');
  
  // Register Session request
  // Command: 0x0065
  // Length: 0x0004 (4 bytes data)
  // Session Handle: 0x00000000
  // Status: 0x00000000
  // Sender Context: 8 bytes (can be any value)
  // Options: 0x00000000
  // Data: 0x0001 0x0000 (Protocol version 1, Options 0)
  
  const request = Buffer.alloc(28);
  request.writeUInt16BE(0x0065, 0);  // Command: Register Session
  request.writeUInt16BE(0x0004, 2);  // Length: 4 bytes
  request.writeUInt32BE(0x00000000, 4); // Session Handle: 0
  request.writeUInt32BE(0x00000000, 8); // Status: 0
  Buffer.from('_pycomm_').copy(request, 12); // Sender Context
  request.writeUInt32BE(0x00000000, 20); // Options: 0
  request.writeUInt16BE(0x0001, 24); // Protocol version: 1
  request.writeUInt16BE(0x0000, 26); // Options flags: 0
  
  console.log('Sending Register Session request:');
  console.log(`  Hex: ${request.toString('hex')}`);
  console.log(`  Length: ${request.length} bytes\n`);
  
  client.write(request);
});

let responseBuffer = Buffer.alloc(0);

client.on('data', (data) => {
  console.log(`Received ${data.length} bytes`);
  console.log(`  Hex: ${data.toString('hex')}\n`);
  
  responseBuffer = Buffer.concat([responseBuffer, data]);
  
  if (responseBuffer.length >= 24) {
    const responseLength = 24 + responseBuffer.readUInt16BE(2);
    console.log(`Expected response length: ${responseLength} bytes`);
    console.log(`Current buffer length: ${responseBuffer.length} bytes\n`);
    
    if (responseBuffer.length >= responseLength) {
      const response = responseBuffer.slice(0, responseLength);
      responseBuffer = responseBuffer.slice(responseLength);
      
      console.log('=== Register Session Response ===');
      console.log(`  Full Response (hex): ${response.toString('hex')}`);
      console.log(`  Length: ${response.length} bytes\n`);
      
      // Parse response
      const command = response.readUInt16BE(0);
      const length = response.readUInt16BE(2);
      const sessionHandle = response.readUInt32BE(4);
      const status = response.readUInt32BE(8);
      const senderContext = response.slice(12, 20);
      const options = response.readUInt32BE(20);
      const data = response.slice(24);
      
      console.log('Parsed Response:');
      console.log(`  Command: 0x${command.toString(16).padStart(4, '0')} (should be 0x0065)`);
      console.log(`  Length: 0x${length.toString(16).padStart(4, '0')} (should be 0x0004)`);
      console.log(`  Session Handle: 0x${sessionHandle.toString(16).padStart(8, '0')}`);
      console.log(`  Status: 0x${status.toString(16).padStart(8, '0')} (should be 0x00000000)`);
      console.log(`  Sender Context: ${senderContext.toString('hex')}`);
      console.log(`  Options: 0x${options.toString(16).padStart(8, '0')}`);
      console.log(`  Data: ${data.toString('hex')} (should be 01000000)`);
      console.log(`  Data Length: ${data.length} bytes (should be 4)\n`);
      
      // Verify
      const expectedResponse = Buffer.from('0065000400000001000000005f7079636f6d6d5f0000000001000000', 'hex');
      const matches = response.equals(expectedResponse);
      
      console.log('=== Verification ===');
      console.log(`  Expected: ${expectedResponse.toString('hex')}`);
      console.log(`  Received: ${response.toString('hex')}`);
      console.log(`  Match: ${matches ? '✓ PASS' : '✗ FAIL'}\n`);
      
      if (matches) {
        console.log('✓ Register Session response is correct!');
      } else {
        console.log('✗ Register Session response format is incorrect!');
        console.log('\nDifferences:');
        if (length !== 0x0004) {
          console.log(`  - Length should be 0x0004, got 0x${length.toString(16).padStart(4, '0')}`);
        }
        if (data.length !== 4) {
          console.log(`  - Data length should be 4 bytes, got ${data.length} bytes`);
        }
        if (data.toString('hex') !== '01000000') {
          console.log(`  - Data should be 01000000, got ${data.toString('hex')}`);
        }
      }
      
      client.end();
    }
  }
});

client.on('error', (error) => {
  console.error(`Connection error: ${error.message}`);
});

client.on('close', () => {
  console.log('\nConnection closed');
  process.exit(0);
});

client.on('timeout', () => {
  console.error('\nConnection timeout');
  client.destroy();
  process.exit(1);
});

client.setTimeout(10000);
client.connect(PORT, HOST);

