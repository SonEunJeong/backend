const WebSocket = require('ws');

class WebSocketServer {
  constructor(port) {
    this.wss = new WebSocket.Server({ port });

    this.wss.on('connection', (ws, req) => {
        // 클라이언트 IP 주소 저장
        ws.ip = req.socket.remoteAddress;
    });

    this.broadcastData = this.broadcastData.bind(this);
    console.info(` . . . 소켓통신 설정 : ${port}에서 broadcast 바인딩..`);
  }

  broadcastData(data) {    
    this.wss.clients.forEach((client) => {
         console.log(` - Client(${client.ip}) : ${client.readyState} `)
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(data));
           console.log(` - client.send : ${JSON.stringify(data)} `)
        }
    });
  }

  startBroadcasting(interval) {
    setInterval(this.broadcastData, interval);
  }
}

module.exports = WebSocketServer;
