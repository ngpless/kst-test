const net = require('net');
const server = net.createServer((clientSocket) => {
  const serverSocket = net.connect(3001, '127.0.0.1', () => {
    clientSocket.pipe(serverSocket);
    serverSocket.pipe(clientSocket);
  });
  serverSocket.on('error', () => clientSocket.destroy());
  clientSocket.on('error', () => serverSocket.destroy());
});
server.listen(3000, '0.0.0.0', () => {
  console.log('Proxy 3000 -> 3001 running');
});
