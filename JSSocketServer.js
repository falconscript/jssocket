"use strict";

var net = require('net'),
    process = require('process'),
    util = require('util');

/**
 * JSSocketServer
 *
 * Server to manage socket connections and receive messages for clients
 */

class JSSocketServer {
  constructor (port) {
    this.port = parseInt(port) || console.log("[!] Invalid port: ", port) && process.exit(1);
    this.host = '0.0.0.0';
    this.queuedMessages = {};
    this.callbacks = {};
    this.delimiter = "\n";
    this.clientSockets = {};

    this.servSocket = net.createServer();
    this.servSocket.on('listening', () => {
      console.log("[+] JSServ Listening on", this.port);
      // .address() must have 'listening' event occur before being used
      this.servSocketAddress = this.servSocket.address().address + ':' + this.servSocket.address().port;
    });
    this.servSocket.on('close', () => { console.log("[+] JSServ for port", this.port, "closed."); });
    this.servSocket.on('error', this.onSocketError.bind(this));
    this.servSocket.on('connection', this.onNewConnection.bind(this));

    this.startListening();
  }

  startListening () {
    this.servSocket.listen({
      host: this.host,
      port: this.port,
      exclusive: true
    } /*, 511 max backlog num*/);
  }

  stopListening () {
    this.servSocket.close();
  }

  onNewConnection (socket) {
    var socketAddress = socket.address().address + ':' + socket.address().port;

     var partial = ''; // each socket gets a 'partial' variable in this closure.
     socket.on('data', (data) => {
       partial += data.toString();

       var msgArr = partial.split(this.delimiter);
       // set to either the last part of the message or '' if ended on a complete message
       partial = msgArr.pop();

       // send completed messages to onSocketMessage
       while (msgArr.length) {
         var msg = msgArr.shift(); // get first
         //sails.log.debug("[D] REC'd MSG: ", msg);
         this.onSocketMessage(socket, msg);
       }
     });
     socket.on('error', (e) => {
       console.log("[?] JSServ - Err on socket from", socketAddress, "e->", e);
     });
     socket.on('close', (had_error) => { // close event always happens right after 'error' event
       console.log("[?] JSServ - Socket closed from", socketAddress, "had_error->", had_error);
       if (!this.clientSockets[socketAddress]) {
         console.log("[!] WARNING!! CLIENTSOCKET from", socketAddress, "was NOT in JSServ.clientSockets!!");
       } else {
         delete this.clientSockets[socketAddress];
       }
     });
     socket.on('timeout', () => {
       console.log("[?] JSServ - Socket TIMEOUT from", socketAddress, "- Closing now.");
       socket.close();
     });
     this.clientSockets[socketAddress] = socket;
  }

  onSocketMessage (socket, rawMessage) {
    try {
      var message = JSON.parse(rawMessage);
    } catch (e) {
      var socketAddress = socket.address().address + ':' + socket.address().port;
      return console.log("[!] Received erroneous message from", socketAddress, " raw:", rawMessage);
    }
    // get callback based on type
    var cb = this.callbacks[message.type];
    if (!cb) {
      console.log("[-] WARN - No callback for this type yet. Race con? Msg:", message);
      message.clientSocket = socket;
      this.queuedMessages[message.type] =
        this.queuedMessages[message.type] || [];
      this.queuedMessages[message.type].push(message);
    } else {
      return cb(socket, message);
    }
  }

  onSocketError (e) {
    if (e.code == 'EADDRINUSE') {
      console.log('[!] JSSocketServer ERR - Address in use:', this.host + ':' + this.port, ' QUITTING.');
      process.exit(1);
    } else {
      console.log('[!] JSSocketServer ERROR occurred:', this.servSocketAddress, e);
      process.exit(1);
    }
  }

  sendDataToAllClients (dataLine) {
    for (let socketAddress in this.clientSockets) {
      // EXTREMELY weird bug where we cannot really... USE a socket used as a hash key!!
     this.clientSockets[socketAddress].write(dataLine);
    }
  }

  getNumberConnectedClients () {
    return Object.keys(this.clientSockets).length;
  }

  addCallbackForType (type, callback) {
    this.callbacks[type] = callback;
    // if there are already messages for this type, execute them away now
    if (this.queuedMessages[type]) {
      this.queuedMessages[type].forEach((msg, index) => {
        return this.onSocketMessage(msg.clientSocket, msg);
      });
      delete this.queuedMessages[type];
    }
  }
};


module.exports = JSSocketServer;
