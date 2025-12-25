/**
 * UDP Server for Ethernet/IP Implicit Messaging
 * Port 2222
 */

import dgram from 'dgram';
import debug from 'debug';

const log = debug('ethernetip:udp');

export class UDPServer {
  constructor(options = {}) {
    this.port = options.port || 2222;
    this.host = options.host || '0.0.0.0';
    this.socket = null;
  }

  /**
   * Handle incoming UDP message
   */
  handleMessage(msg, rinfo) {
    log(`UDP message from ${rinfo.address}:${rinfo.port}, length: ${msg.length}`);
    
    // UDP messages for implicit messaging are typically
    // connection-based and contain I/O data
    // This is a basic implementation
    
    // Echo back or process I/O data
    // In a real implementation, you would parse the connection ID
    // and route the data appropriately
  }

  /**
   * Start the UDP server
   * @returns {Promise}
   */
  async start() {
    return new Promise((resolve, reject) => {
      this.socket = dgram.createSocket('udp4');

      this.socket.on('message', (msg, rinfo) => {
        this.handleMessage(msg, rinfo);
      });

      this.socket.on('error', (error) => {
        log(`UDP Server error: ${error.message}`);
        reject(error);
      });

      this.socket.on('listening', () => {
        const address = this.socket.address();
        log(`UDP Server listening on ${address.address}:${address.port}`);
        resolve();
      });

      this.socket.bind(this.port, this.host);
    });
  }

  /**
   * Stop the UDP server
   * @returns {Promise}
   */
  async stop() {
    return new Promise((resolve) => {
      if (this.socket) {
        this.socket.close(() => {
          log('UDP Server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

