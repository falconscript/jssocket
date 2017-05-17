# jssocket

> ES6 JS classes for socket client and server message passing

## Installation

```sh
npm install jssocket --save
```

## Usage

This is an example of how to write a chat with this socket module.  
One core idea is the "type" key is used for determining what callback runs for what message  
Another core feature is that messages are queued if attempted to be sent when disconnected.  
Those messages will be sent upon connecting/reconnecting.

```js
// Server

// Instantiate server socket listening on port 8000
var jssocket = require('jssocket');
var sockServ = new jssocket.jssocketserver(8000);
var delimiter = "\n";

// Attach handlers for receiving messages
sockServ.addCallbackForType("CHAT_MESSAGE_CLIENT_SENT", (clientSock, msgObj) => {

  // Send a message back to this client that we got the message successfully
  var acknowledgementmessage = {
    type: "CHAT_ACKNOWLEDGEMENT", // The "type" key is used for if statement below
    chatMessageStatus: "accepted",
    isUserBanned: false,
    messageData: msgObj.messageData, // from client
  };
  clientSock.write(JSON.stringify(acknowledgementmessage) + delimiter, function onCompletedWriting () { });

  // Relay this sent message to all clients! They will update their UIs presumably
  var messageToSendToAllClients = {
    type: "NEW_CHAT_MESSAGE", // The "type" key is used for if statement below
    sender: "some_username_probably_indexed_by_clientSock",
    messageData: msgObj.messageData
  };
  sockServ.sendDataToAllClients(JSON.stringify(messageToSendToAllClients) + delimiter);
});
```

```js
// Client

// Instantiate client socket to connect to 'yourdomain.com:8000'
var jssocket = new jssocket.jssocketclient();
jssocket.setHostAndPort('yourdomain.com', 8000);

// Upon a disconnection or failed connect attempt, it will retry every
// second as long as jssocket.continueReconnecting is true
jssocket.continueReconnecting = true;

// Specify a callback to be run when this client receives a message
// Overriding the existing function onSocketMessage. Inheritance would also work
jssocket.onSocketMessage = function (rawMessage) {
  try {
    var message = JSON.parse(rawMessage);
  } catch (e) {
    return console.log("[!] Received erroneous message from", socket.address(), " raw:", rawMessage);
  }

  console.log("[D] Received a message! ", rawMessage, " in json->", message);

  // find the type and respond appropriately
  if (message.type == "NEW_CHAT_MESSAGE") {
    console.log("[+] New chat message:", message.messageData, "from user:", message.sender);
  } else if (message.type == "CHAT_ACKNOWLEDGEMENT") {
    console.log("[D] Received acknowledgement form server about sent chat message");
  } else {
    console.log("[!] WARNING - Unknown message type received! rawMessage:", rawMessage);
  }
};


// Start trying to connect
jssocket.connectSocket();


// An application would send a chat message with:
jssocket.sendDataLine(JSON.stringify({
  type: "CHAT_MESSAGE_CLIENT_SENT",
  messageData: "Hey are we still on for pizza tomorrow?"
}) + delimiter);
```

## Credits
http://c-cfalcon.rhcloud.com
