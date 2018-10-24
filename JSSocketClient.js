"use strict";

const net = require('net'),
    process = require('process');

 /**
  * JSSocketClient
  *
  * Client code to start and maintain socket connection to a host service
  * Manages delimiter and message sending (tcp fragmentation)
  */
 class JSSocketClient {

  constructor () {
    // instantiate and setup socket listeners.
    this.socketConnected = false;
    this.delimiter = "\n";
    this.delimiterLength = this.delimiter.length;
    this.continueReconnecting = false; // set to true to maintain connection attempts
    this.queuedMessages = [];

    this.sock = new net.Socket();
    this.sock.setNoDelay(true);
    this.sock.setKeepAlive(true); // will it destroy things?
    this.sock.on('close', this.onSocketDisconnect.bind(this));
    this.sock.on('connect', () => { this.onSocketConnected(/*callback*/); });
    //this.sock.setTimeout(5000, this.onSocketTimeout.bind(this)); // forget it I guess, calls before connect!!
    this.sock.on('error', this.onSocketError.bind(this));

    let partial = '';
    this.sock.on('data', (data) => {

     partial += data.toString();

     let msgArr = partial.split(this.delimiter);
     // set to either the last part of the message or '' if ended on a complete message
     partial = msgArr.pop();

     // send completed messages to onSocketMessage
     while (msgArr.length) {
       let msg = msgArr.shift(); // get first
       //console.log("[D] REC'd MSG: ", msg);
       this.onSocketMessage(msg);
     }
    });
  }

  setHostAndPort (targetHost, targetPort) {
    this.targetHost = targetHost;
    this.targetPort = parseInt(targetPort);
  }

  connectSocket (callback) {
    // Only reattempt connect if NOT connected AND no reconnect attempt is scheduled
    if (!this.socketConnected && !this.nextReconnectTime) {
     // the function will execute on connect. not a big deal though
     console.log("[+]", this.constructor.name, "- Attempting connect to", this.targetHost + ":" + this.targetPort);
     this.sock.connect(this.targetPort, this.targetHost);
    }
    if (typeof(callback) == "function") return callback();
  }

  disconnectSocket () {
    this.sock.destroy();
  }

  // Does NOT include delimiter (newline by default). Include before sending!
  sendDataLine (dataLine, callbackUponSending, encoding="utf8") {
    if (this.socketConnected) {
     // Returns true if the entire data was flushed successfully to the kernel buffer.
     // Returns false if all or part of the data was queued in user memory.
     // 'drain' will be emitted when the buffer is again free.
     this.sock.write(dataLine, encoding, callbackUponSending); // function calls onComplete of write
    } else {
     console.log("[D]", this.constructor.name, " - SOCK DC'd when sendDataLine called! QUEUEING.");
     this.queuedMessages.push(dataLine);
     // DON'T TRY TO RECONNECT. The connection will automatically be managed.
    }
  }

  onSocketConnected (callback) {
    this.socketConnected = true;

    this.sendQueuedMessages();

    // queued messages sent.
    if (typeof(callback) == "function") return callback(true);
  }

  sendQueuedMessages () {
    // connect check is to avoid an infinite fail/repush loop with sendDataLine
    while (this.queuedMessages.length != 0 && this.socketConnected) {
      this.sendDataLine(this.queuedMessages.shift()); // get from front
    }
  }

  onSocketTimeout () {
   console.log("[-]", this.constructor.name, " - this.sock TIMEOUT REACHED! YOU WANNA KILL?");
   // XXX This might occur during normal activity. I'm not sure when best to use this
   // if (this.running) setTimeout(this.connectSocket.bind(this), 1000);
   // this.sock.destroy(); // Not sure we want to destroy though... Worried it'll kill handlers
  }

  onSocketError (err_info) {
    // NOT doing anything because onSocketDisconnect is always called right after 'error' emitted.
    //console.log("[-]", this.constructor.name, " - SOCKET ERROR:", err_info);
  }

  onSocketDisconnect (had_error) {
    if (had_error) console.log("[-]", this.constructor.name, " - Socket closed with error... Reconnecting...");
    this.socketConnected = false;

    // keep trying until connected...
    this.nextReconnectTime = setTimeout(() => { // retryConnect function
     if (!this.socketConnected && this.continueReconnecting) {
       this.nextReconnectTime = null;
       this.connectSocket();
     } else {
       clearTimeout(this.nextReconnectTime);
       this.nextReconnectTime = null;
     }
    }, 5000);
  }

  onSocketMessage (msg) {
    console.log("[!] Failed to Override onSocketMessage! Redefine this method in inheriting class!");
    process.exit(1);
  }
 };


module.exports = JSSocketClient;
