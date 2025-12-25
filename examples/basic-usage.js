/**
 * Basic usage example for Ethernet/IP Server
 */

import EthernetIPServer from '../src/index.js';

async function main() {
  console.log('Starting Ethernet/IP Server...');

  const server = new EthernetIPServer({
    tcpPort: 44818,
    udpPort: 2222,
    host: '0.0.0.0'
  });

  try {
    await server.start();
    // Server bilgileri start() içinde yazdırılıyor
    console.log('Press Ctrl+C to stop the server\n');
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down server...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\nShutting down server...');
    await server.stop();
    process.exit(0);
  });
}

main().catch(console.error);

