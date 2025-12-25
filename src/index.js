/**
 * Ethernet/IP Server - Main Entry Point
 */

import { TCPServer } from './server/TCPServer.js';
import { UDPServer } from './server/UDPServer.js';
import { SessionManager } from './server/SessionManager.js';
import { TagManager } from './tags/TagManager.js';
import os from 'os';
import debug from 'debug';

const log = debug('ethernetip:main');
debug.enabled('ethernetip:*');

class EthernetIPServer {
  constructor(options = {}) {
    this.sessionManager = new SessionManager();
    this.tagManager = new TagManager();
    
    // Device configuration
    this.deviceSlotNumber = options.deviceSlotNumber || 0; // Default slot 0 for standalone device
    this.vendorId = options.vendorId || 0x0000;
    this.deviceType = options.deviceType || 0x0000;
    this.productCode = options.productCode || 0x00000000;
    this.productName = options.productName || 'EtherNet/IP Simulator';
    
    this.tcpServer = new TCPServer({
      port: options.tcpPort || 44818,
      host: options.host || '0.0.0.0',
      sessionManager: this.sessionManager,
      tagManager: this.tagManager,
      deviceSlotNumber: this.deviceSlotNumber,
      vendorId: this.vendorId,
      deviceType: this.deviceType,
      productCode: this.productCode,
      productName: this.productName
    });

    this.udpServer = new UDPServer({
      port: options.udpPort || 2222,
      host: options.host || '0.0.0.0'
    });

    this.running = false;
  }

  /**
   * Get tag list
   * @returns {Array}
   */
  getTagList() {
    return this.tagManager.getTagList();
  }

  /**
   * Start both TCP and UDP servers
   */
  async start() {
    if (this.running) {
      log('Server already running');
      return;
    }

    try {
      await Promise.all([
        this.tcpServer.start(),
        this.udpServer.start()
      ]);
      
      this.running = true;
      
      // Get server addresses
      const tcpAddress = this.tcpServer.server?.address();
      const udpAddress = this.udpServer.socket?.address();
      const tcpPort = tcpAddress?.port || this.tcpServer.port;
      const udpPort = udpAddress?.port || this.udpServer.port;
      
      // Get network interfaces for display
      const networkInterfaces = os.networkInterfaces();
      const ipAddresses = [];
      
      // Collect all IPv4 addresses (excluding loopback)
      for (const [name, addresses] of Object.entries(networkInterfaces)) {
        if (addresses) {
          for (const addr of addresses) {
            // Check for IPv4 (both 'IPv4' and '4' formats)
            const isIPv4 = addr.family === 'IPv4' || addr.family === 4;
            if (isIPv4 && !addr.internal) {
              ipAddresses.push({
                interface: name,
                address: addr.address
              });
            }
          }
        }
      }
      
      // Print server information
      console.log('\n========================================');
      console.log('  Ethernet/IP Server Başlatıldı');
      console.log('========================================');
      console.log(`TCP Server (Explicit Messaging):`);
      console.log(`  Port: ${tcpPort}`);
      console.log(`UDP Server (Implicit Messaging):`);
      console.log(`  Port: ${udpPort}`);
      console.log(`\nBağlanılabilir IP Adresleri:`);
      
      // Show external IP addresses
      if (ipAddresses.length > 0) {
        ipAddresses.forEach(({ interface: iface, address }) => {
          console.log(`  • ${address} (${iface})`);
          console.log(`    TCP: tcp://${address}:${tcpPort}`);
          console.log(`    UDP: udp://${address}:${udpPort}`);
        });
      }
      
      // Always show localhost
      console.log(`  • localhost (127.0.0.1)`);
      console.log(`    TCP: tcp://127.0.0.1:${tcpPort}`);
      console.log(`    UDP: udp://127.0.0.1:${udpPort}`);
      
      // Print tag information
      const allTags = this.tagManager.getAllTags();
      console.log(`\nCihaz Bilgileri:`);
      console.log(`  Slot Number: ${this.deviceSlotNumber}`);
      console.log(`  Vendor ID: 0x${this.vendorId.toString(16).padStart(4, '0')}`);
      console.log(`  Device Type: 0x${this.deviceType.toString(16).padStart(4, '0')}`);
      console.log(`  Product Code: 0x${this.productCode.toString(16).padStart(8, '0')}`);
      console.log(`  Product Name: ${this.productName}`);
      console.log(`\nToplam Tag Sayısı: ${allTags.length}`);
      console.log(`\nTag Listesi:`);
      
      // Create table header
      const separator = '='.repeat(85);
      const headerSeparator = '-'.repeat(85);
      console.log(separator);
      console.log(`| ${'#'.padEnd(3)} | ${'Tag Adı'.padEnd(14)} | ${'Adres'.padEnd(8)} | ${'Veri Tipi'.padEnd(9)} | ${'Başlangıç Değeri'.padStart(16)} |`);
      console.log(headerSeparator);
      
      // Print tags in groups of 10
      const chunkSize = 10;
      for (let i = 0; i < allTags.length; i += chunkSize) {
        const chunk = allTags.slice(i, i + chunkSize);
        chunk.forEach((tag, idx) => {
          const tagNum = i + idx + 1;
          const numStr = tagNum.toString().padEnd(3);
          const nameStr = tag.name.padEnd(14);
          const addrStr = tag.address.padEnd(8);
          const typeStr = tag.dataType.padEnd(9);
          const valueStr = tag.value.toString().padStart(16);
          console.log(`| ${numStr} | ${nameStr} | ${addrStr} | ${typeStr} | ${valueStr} |`);
        });
        
        // Add separator between chunks (except for last chunk)
        if (i + chunkSize < allTags.length) {
          console.log(headerSeparator);
        }
      }
      
      console.log(separator);
      console.log('\nNot: Her tag okunduğunda değeri rastgele olarak güncellenir (-1,000,000 ile +1,000,000 arası)');
      console.log('========================================\n');
      
      log('Ethernet/IP Server started successfully');
      
      // Setup cleanup interval for inactive sessions
      setInterval(() => {
        this.sessionManager.cleanupInactive();
      }, 60000); // Cleanup every minute
      
    } catch (error) {
      console.error(`Server başlatılamadı: ${error.message}`);
      log(`Failed to start server: ${error.message}`);
      throw error;
    }
  }

  /**
   * Stop both servers
   */
  async stop() {
    if (!this.running) {
      return;
    }

    try {
      await Promise.all([
        this.tcpServer.stop(),
        this.udpServer.stop()
      ]);
      
      this.running = false;
      log('Ethernet/IP Server stopped');
    } catch (error) {
      log(`Error stopping server: ${error.message}`);
      throw error;
    }
  }

  /**
   * Register a CIP message handler
   * @param {number} service - CIP service code
   * @param {Function} handler - Handler function
   */
  onCIPService(service, handler) {
    // This would need to be implemented in TCPServer
    // to allow custom CIP service handlers
  }
}

// Start server if run directly
// Simple check: if this file is executed directly (not imported)
const isMainModule = process.argv[1] && (
  process.argv[1].replace(/\\/g, '/').endsWith('index.js') || 
  process.argv[1].replace(/\\/g, '/').endsWith('src/index.js')
);

if (isMainModule) {
  const server = new EthernetIPServer({
    tcpPort: process.env.TCP_PORT || 44818,
    udpPort: process.env.UDP_PORT || 2222,
    host: process.env.HOST || '0.0.0.0',
    deviceSlotNumber: parseInt(process.env.DEVICE_SLOT_NUMBER || '0', 10),
    vendorId: parseInt(process.env.VENDOR_ID || '0', 16),
    deviceType: parseInt(process.env.DEVICE_TYPE || '0', 16),
    productCode: parseInt(process.env.PRODUCT_CODE || '0', 16),
    productName: process.env.PRODUCT_NAME || 'EtherNet/IP Simulator'
  });

  server.start().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\nShutting down...');
    await server.stop();
    process.exit(0);
  });
}

export default EthernetIPServer;

