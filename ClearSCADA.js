/*

node-red-contrib-ClearSCADA
Send point data into ClearSCADA using its web service port.
Data is sent into analogue, digital and string Internal Points.
Supports value and time stamp.
Does not support: Time points, User credentials.
For experimental use only, do not use on production SCADA systems.

The MIT License (MIT)

Copyright (c) 2017 Schneider Electric

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

Steve Beadle, stephen.beadle@schneider-electric.com
*/

// ClearSCADA Node-RED node file

module.exports = function(RED) {
    "use strict";
    // require any external libraries we may need....
	// NEEDS: npm install xml2js
    var xmlparser = require("xml2js").parseString;

	function ClearSCADAServerNode(n) {
        RED.nodes.createNode(this,n);
		
		// Configuration Options
        this.hostname = n.hostname;
        this.port = n.port;
		this.usehttps = n.usehttps;
		console.log( "ClearSCADA hostname: " + this.hostname);
		console.log( "ClearSCADA port    : " + this.port.toString() );
		console.log( "ClearSCADA user    : " + this.credentials.user );
		
		// Config node state
        this.brokerurl = "";
        this.connected = false;
		this.connecttime = 0;
		this.userid = "";
		this.secureuserid = "";

		// Remember credentials
        if (this.credentials) {
            this.username = this.credentials.user;
            this.password = this.credentials.password;
		}

        // Define functions called by ClearSCADA in and out nodes
        var node = this;

		// Called here to get login credentials, then the individual callbacks done
		//node.server.login( this, function( node, msg) { 
		this.login = function( ClearSCADAnode, msg, done ) {
			
			// If > 4 min since last request or login, then redo login
			if ( node.connecttime < Date.now() - (4*60*1000) ) {
				node.connected = false;
			}
			
			if ( ! node.connected) {
				console.log( "Login call.");
				login2ClearSCADA( node, ClearSCADAnode, msg, done);
			} else {
				// If already logged in then just carry on
				console.log( "Already logged in.");
				done( ClearSCADAnode, msg);
			}
		};
	}
    
	RED.nodes.registerType("ClearSCADA-server",ClearSCADAServerNode,{
		credentials: {
			user: {type:"text"},
			password: {type:"password"}
		}
	});

	function login2ClearSCADA( node, ClearSCADAnode, msg, done) {
		var http;
		var datamessage = "user=" + node.username + "&password=" + node.password + "&redir=%2F";

		if (node.usehttps) {
			http = require('https');
		} else {
			http = require('http');
		}
		var http_options = {
		  hostname: node.hostname,
		  port: node.port,
		  path: '/logon',
		  method: 'POST',
		  headers: {
			"Content-Type": "text/xml",
			"SCX-Client-Version": "6.77.5914",
			"Content-Length": datamessage.length
		  }
		}
		//console.log( http_options.path);
		
		var req = http.request(http_options, (res) => {
			// logging:
			// console.log( node.hostname);
			// console.log( node.port);
			// console.log(`Value STATUS: ${res.statusCode}`);
			// msg.payload = res.statusCode;
			//if (res.statusCode == 200) {
			//	node.status({fill:"green", shape:"dot", text:"Success"});
			//}
			//else {
			//	node.status({fill:"red", shape:"ring", text:"Bad response"});
			//}
			// console.log(`HEADERS: ${JSON.stringify(res.headers)}`);

			// console.log(`STATUS: ${res.statusCode}`);
			if (res.statusCode != 200) {
				node.connected = false;
			}		
			//console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
			var cookies = res.headers["set-cookie"];
			//console.log(cookies);
			res.setEncoding('utf8');
		  
			res.on('data', (chunk) => {
				//console.log("Login data received");
				//console.log(`BODY: ${chunk}`);
				if (chunk.indexOf("Logon successful") >= 0) {
					node.connected = true;
					console.log("Logon successful");
					node.connecttime = Date.now();
				} else {
					console.log("Logon unsuccessful");
					node.connected = false;
				}
			});

			res.on('end', () => {
				//console.log("Was logon successful?");
				//cookies = res.getHeader('Cookie');
				//console.log(`HEADERS: ${cookies}`);
				// If logged on OK then:
				// node.connected = true;
				// console.log(cookies);
				if (typeof cookies != 'undefined') {
					node.userid = getcookie("CLEARSCADAUSERID", cookies);
					node.secureuserid = getcookie("CLEARSCADASECUREUSERID", cookies);
					console.log( node.userid);
					console.log('Login complete. Calling data node.');
					//Cascade to call data retrieve
					done( ClearSCADAnode, msg);
				} else {
					console.log('Login error, cookies undefined');
					msg.payload = 999;
					node.connected = false;
					ClearSCADAnode.status({fill:"red", shape:"ring", text:"Bad response"});
					ClearSCADAnode.send( msg);
				}
			})
		});

		req.on('error', (e) => {
		  //node.warn(`problem with request: ${e.message}`);
		  //msg.payload = 404;
		  //node.send(msg);
		  //this.status({fill:"red", shape:"ring", text:"Error"});
		  console.log("Error in login");
			// node.connected = false;
		});

		// write data to login body
		// console.log('Login write: ' + datamessage);
		req.write( datamessage);
		req.end();
		//console.log('Login end write.');	
	}
	
	function getcookie( name, cookielist) {
		var i;
		for ( i = 0; i < cookielist.length; i++) {
			//console.log( cookielist[i]);
			var cookieitems = cookielist[i].split("=");
			if (cookieitems[0] == name && cookieitems.length >= 2) {
				var cookiedata = cookieitems[1].split(";");
				//console.log( cookiedata);
				if (cookiedata[0].length > 10) {
					return (cookiedata[0].substring(1, cookiedata[0].length-1) );
				}
			}
		}
		return (null);
	}
	
    // The main node definition - most things happen in here
    function UpdatePointNode(n) {
        // Create a RED node
        RED.nodes.createNode(this,n);

        // Store local copies of the node configuration (as defined in the .html)
		this.server = RED.nodes.getNode(n.server);	
		
        this.topic = n.topic;
		this.pointtype = n.pointtype;
		
		// Copy server info and work out defaults
		this.hostname =  this.server.hostname?this.server.hostname:'localhost';
		this.port = this.server.port?this.server.port:'80';
		this.usehttps = this.server.usehttps;

        // copy "this" object in case we need it in context of callbacks of other functions.
        var node = this;

        // Do whatever you need to do in here - declare callbacks etc.
        // Note: it will only send this message once at start-up...
        var msg = {};
        msg.topic = this.topic;
        msg.payload = "Started ClearSCADA output node."

        // send out the message to the rest of the workspace.
        // ... this message will get sent at start-up so you may not see it in a debug node.
        this.send(msg);

        // respond to inputs....
        this.on('input', function (msg) {
			msg.topic = msg.topic ? msg.topic : this.topic; // Message topic overrides point name in topic configuration if blank
			console.log("ClearSCADA point: " + msg.topic + " Value: " + msg.payload);
			
			if ((msg.pointtype != 0) && (msg.pointtype != 1) && (msg.pointtype != 2 )) {
				msg.pointtype = this.pointtype;
			}
			// console.log("ClearSCADA type:  " + msg.pointtype);
			// console.log ("Username: " + this.server.username);

			var callback = function( node, msg) { 
					//console.log(msg);
					console.log("Calling to send value.");
					if (! isNaN(msg.time)) {
						console.log("ClearSCADA time: " + msg.time);
						sendClearSCADATimeThenValue( node, msg);				
					}
					else {
						sendClearSCADAValue( node, msg);
					}
				};
			
			// Ready to send out data, but must connect and log in first
			// So make the server object do this and call back when OK
			// This will omit login if already logged in.
			node.server.login( node, msg, callback );

        });

        this.on("close", function() {
            // Called when the node is shut down - eg on redeploy.
            // Allows ports to be closed, connections dropped etc.
            // eg: node.client.disconnect();
        });
    }

    // Register the node by name. This must be called before overriding any of the
    // Node functions.
    RED.nodes.registerType("ToClearSCADA", UpdatePointNode);

	function sendClearSCADATimeThenValue( node, msg) {
		// first call ClearSCADA and update time value
		// SOAP constants
		var sxmlver = "<?xml version=\"1.0\"?>\n";
		var ssoapen = "<soap:Envelope xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\">\n";
		var sinvoke = "<Invoke xmlns=\"http://serck-controls.com/webservices/SCX6/\" ";
		sinvoke += "xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" ";
		sinvoke += "xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\">\n";
		var sendtag = "</Invoke>\n</soap:Body>\n</soap:Envelope>\n";
		var saction = "\"http://serck-controls.com/webservices/SCX6/Invoke\"";

		var xmlToSend = sxmlver;
		xmlToSend += ssoapen;
		xmlToSend += "<soap:Body>\n";
		xmlToSend += sinvoke;
		xmlToSend += "<ObjectName>" + msg.topic + "</ObjectName>\n";
		xmlToSend += "<DispId>1129337671</DispId>\n";
		xmlToSend += "<Context>put</Context>\n";
		xmlToSend += "<Arg xsi:type=\"xsd:dateTime\">" + sOAPTime(msg.time) + "</Arg>\n";
		xmlToSend += sendtag;

		var http;
		if (node.usehttps) {
			http = require('https');
		} else {
			http = require('http');
		}
		var http_options = {
		  hostname: node.hostname,
		  port: node.port,
		  path: '/webservices/scx',
		  method: 'POST',
		  headers: {
			"Accept-Encoding": "deflate",
			"Content-Type": "text/xml",
			"SOAPAction": saction,
			"SCX-Client-Version": "6.77.5914",
			"User-Agent": "ViewXCtrl",
			"Cookie": "CLEARSCADAUSERID={" + node.server.userid + "}; " + 
					"CLEARSCADASECUREUSERID={" + node.server.secureuserid + "}",
			"Content-Length": xmlToSend.length
		  }
		}
		//console.log( http_options.headers );
		var req = http.request(http_options, (res) => {
			// logging:
			// console.log( node.hostname);
			// console.log( node.port);
			// console.log(`Time STATUS: ${res.statusCode}`);
			// Cannot overwrite payload here, it destroys data value: msg.payload = res.statusCode;
			// console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
			if (res.statusCode == 200) {
				node.status({fill:"green", shape:"dot", text:"Success"});
			}
			else {
				node.status({fill:"red", shape:"ring", text:"Bad response"});
				msg.payload = res.statusCode;
				node.server.connected = false;
			}
			res.setEncoding('utf8');
		  
			res.on('data', (chunk) => {
				// console.log(`BODY: ${chunk}`);
			});

			res.on('end', () => {
				console.log('Time Response complete.');
				// Now send value
				sendClearSCADAValue( node, msg);
			})
		});

		req.on('error', (e) => {
		  node.warn(`problem with Time request: ${e.message}`);
		  msg.payload = 404;
		  node.send(msg);
		  node.status({fill:"red", shape:"ring", text:"Unsuccessful"});
		});
		// console.log('Time Request write.');
		req.write(xmlToSend);
		req.end();
		// console.log('Time Request end.');
	}

	// call ClearSCADA service to update point value
	function sendClearSCADAValue( node, msg) {
		// SOAP constants
		var sxmlver = "<?xml version=\"1.0\"?>\n";
		var ssoapen = "<soap:Envelope xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\">\n";
		var sinvoke = "<Invoke xmlns=\"http://serck-controls.com/webservices/SCX6/\" ";
		sinvoke += "xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" ";
		sinvoke += "xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\">\n";
		var sendtag = "</Invoke>\n</soap:Body>\n</soap:Envelope>\n";
		var saction = "\"http://serck-controls.com/webservices/SCX6/Invoke\"";

		var xmlToSend = sxmlver;
		xmlToSend += ssoapen;
		xmlToSend += "<soap:Body>\n";
		xmlToSend += sinvoke;
		xmlToSend += "<ObjectName>" + msg.topic + "</ObjectName>\n";

		switch (msg.pointtype.toString()) {
			case "0": // Analogue
				xmlToSend += "<DispId>1398803523</DispId>\n";
				xmlToSend += "<Context>method</Context>\n";
				xmlToSend += "<Arg xsi:type=\"xsd:double\">" + msg.payload.toString() + "</Arg>\n";
			break;
			case "1": // Digital
				xmlToSend += "<DispId>1129336836</DispId>\n";
				xmlToSend += "<Context>put</Context>\n";
				xmlToSend += "<Arg xsi:type=\"xsd:short\">" + msg.payload.toString() + "</Arg>\n";
			break;
			case "2": // String
				xmlToSend += "<DispId>1398803523</DispId>\n";
				xmlToSend += "<Context>method</Context>\n";
				xmlToSend += "<Arg xsi:type=\"xsd:string\">" + msg.payload.toString() + "</Arg>\n";
			break;
			default:
				console.log("No point type: " + msg.pointtype);
		}
		xmlToSend += sendtag;
		
		var http;
		if (node.usehttps) {
			http = require('https');
		} else {
			http = require('http');
		}
		var http_options = {
		  hostname: node.hostname,
		  port: node.port,
		  path: '/webservices/scx',
		  method: 'POST',
		  headers: {
			"Accept-Encoding": "deflate",
			"Content-Type": "text/xml",
			"SOAPAction": saction,
			"SCX-Client-Version": "6.77.5914",
			"User-Agent": "ViewXCtrl",
			"Cookie": "CLEARSCADAUSERID={" + node.server.userid + "}; " + 
					"CLEARSCADASECUREUSERID={" + node.server.secureuserid + "}",
			"Content-Length": xmlToSend.length
		  }
		}
		// console.log(xmlToSend);
		var req = http.request(http_options, (res) => {
			// logging:
			// console.log( node.hostname);
			// console.log( node.port);
			// console.log(`Value STATUS: ${res.statusCode}`);
			msg.payload = res.statusCode;
			if (res.statusCode == 200) {
				node.status({fill:"green", shape:"dot", text:"Success"});
				node.server.connecttime = Date.now();
			}
			else {
				node.status({fill:"red", shape:"ring", text:"Bad response"});
				node.server.connected = false;
			}
			//console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
			res.setEncoding('utf8');
		  
			res.on('data', (chunk) => {
				// console.log(`BODY: ${chunk}`);
			});

			res.on('end', () => {
				console.log('Value Response complete.');
				node.send(msg);
			})
		});

		req.on('error', (e) => {
		  node.warn(`problem with request: ${e.message}`);
		  msg.payload = 404;
		  node.send(msg);
		  node.status({fill:"red", shape:"ring", text:"Error"});
		});

		// write data to request body
		// console.log('Value Request write.');
		req.write(xmlToSend);
		req.end();
		// console.log('Value Request end.');
	}

	//From timestamp to soap time string
	function sOAPTime(ts) { 
		var t = new Date(ts);
		var r;
		var s;
		r = t.getUTCFullYear();
		s = (t.getUTCMonth() + 1);
		if (s.toString().length == 1) { s = "0" + s; }
		r += "-" + s;
		s = t.getUTCDate();
		if (s.toString().length == 1) { s = "0" + s; }
		r += "-" + s;
		s = t.getUTCHours();
		if (s.toString().length == 1) { s = "0" + s; }
		r += "T" + s;
		s = t.getUTCMinutes();
		if (s.toString().length == 1) { s = "0" + s; }
		r += ":" + s;
		s = t.getUTCSeconds();
		if (s.toString().length == 1) { s = "0" + s; }
		r += ":" + s;
		s = t.getUTCMilliseconds();
		if (s.toString().length < 3) { s = "0" + s; }
		if (s.toString().length < 3) { s = "0" + s; }
		r += "." + s + "0000Z";
		//				"2009-11-26T14:58:12.0000000Z"
		return r;
	}

    // The main node definition - most things happen in here
    function GetObjectNode(n) {
        // Create a RED node
        RED.nodes.createNode(this,n);

        // Store local copies of the node configuration (as defined in the .html)
		this.server = RED.nodes.getNode(n.server);	
		
        this.topic = n.topic;
		
		// Copy server info and work out defaults
		this.hostname =  this.server.hostname?this.server.hostname:'localhost';
		this.port = this.server.port?this.server.port:'80';
		this.usehttps = this.server.usehttps;
		
        // copy "this" object in case we need it in context of callbacks of other functions.
        var node = this;

        // Do whatever you need to do in here - declare callbacks etc.
        // Note: it will only send this message once at start-up...
        var msg = {};
        msg.topic = this.topic;
        msg.payload = "Started ClearSCADA input node."

        // send out the message to the rest of the workspace.
        // ... this message will get sent at start-up so you may not see it in a debug node.
        this.send(msg);

        // respond to inputs....
        this.on('input', function (msg) {
			msg.topic = msg.topic ? msg.topic : this.topic; // Message topic overrides point name in topic configuration if blank
			console.log("Get ClearSCADA object: " + msg.topic);
			// console.log ("Username: " + this.server.username);

			var callback = function( node, msg) { 
					//console.log(msg);
					console.log("Calling to get object.");
					getClearSCADAValue( node, msg);
				};
			
			// Ready to send out data, but must connect and log in first
			// So make the server object do this and call back when OK
			// This will omit login if already logged in.
			node.server.login( node, msg, callback );

		});

        this.on("close", function() {
            // Called when the node is shut down - eg on redeploy.
            // Allows ports to be closed, connections dropped etc.
            // eg: node.client.disconnect();
        });
    }

    // Register the node by name. This must be called before overriding any of the
    // Node functions.
    RED.nodes.registerType("FromClearSCADA", GetObjectNode);
	
	
	function getClearSCADAValue( node, msg) {
		
		var http;
		if (node.usehttps) {
			http = require('https');
		} else {
			http = require('http');
		}
		var http_options = {
		  hostname: node.hostname,
		  port: node.port,
		  path: '/db/' + encodeURI(msg.topic) + '?View',
		  method: 'GET',
		  headers: {
			//"Accept-Encoding": "deflate",
			"Content-Type": "text/xml",
			"SCX-Client-Version": "6.77.5914",
			"User-Agent": "ViewXCtrl",
			"Cookie": "CLEARSCADAUSERID={" + node.server.userid + "}; " + 
					"CLEARSCADASECUREUSERID={" + node.server.secureuserid + "}",
			"Content-Length": 0
		  }
		}
		// console.log( http_options.path);
		var req = http.request(http_options, (res) => {
			// logging:
			// console.log( node.hostname);
			// console.log( node.port);
			// console.log(`Value STATUS: ${res.statusCode}`);
			// msg.payload = res.statusCode;
			if (res.statusCode == 200) {
				node.status({fill:"green", shape:"dot", text:"Success"});
				node.server.connecttime = Date.now();
			}
			else {
				node.status({fill:"red", shape:"ring", text:"Bad response"});
				node.server.connected = false;
			}
			// console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
			res.setEncoding('utf8');
			var allchunks = ""

			res.on('data', (chunk) => {
				// console.log(`BODY: ${chunk}`);
				// var chunk = chunk.toString().replace("\ufeff", "");
				allchunks = allchunks + chunk;
			});

			res.on('end', () => {
				console.log('Get Value Response complete.');
				xmlparser(allchunks, function (err, result) {
					if (err != null) {
						msg.payload = err;
					} else {
					
						var l = result.Page.ViewInfo[0].Attributes[0].Attribute.length;
						var attributes = {};
						for (var i = 0; i < l; i++) {
							// console.log(result.Page.ViewInfo[0].Attributes[0].Attribute[i].$.name);
							// console.log(result.Page.ViewInfo[0].Attributes[0].Attribute[i]._);
							var n = result.Page.ViewInfo[0].Attributes[0].Attribute[i].$.name;
							if (n != "")
							{
								attributes[ n] = 
											result.Page.ViewInfo[0].Attributes[0].Attribute[i]._;
							}
						}
						// Result is an array of attributes indexed by attribute name, all strings
						// e.g. msg.payload["Current Value"] = 3.14
						msg.payload = attributes;
						// console.log( msg.payload);
					}
				});
				node.send(msg);
			})
		});

		req.on('error', (e) => {
		  node.warn(`problem with request: ${e.message}`);
		  msg.payload = 404;
		  node.send(msg);
		  node.status({fill:"red", shape:"ring", text:"Error"});
		});

		// write data to request body
		//console.log('Value Request write.');
		req.write("");
		req.end();
		//console.log('Value Request end.');	
	}


    // The main node definition - most things happen in here
    function GetQueryNode(n) {
        // Create a RED node
        RED.nodes.createNode(this,n);

        // Store local copies of the node configuration (as defined in the .html)
		this.server = RED.nodes.getNode(n.server);	
		
        this.topic = n.topic;
		
		// Copy server info and work out defaults
		this.hostname =  this.server.hostname?this.server.hostname:'localhost';
		this.port = this.server.port?this.server.port:'80';
		this.usehttps = this.server.usehttps;
		
        // copy "this" object in case we need it in context of callbacks of other functions.
        var node = this;

        // Do whatever you need to do in here - declare callbacks etc.
        // Note: it will only send this message once at start-up...
        var msg = {};
        msg.topic = this.topic;
        msg.payload = "Started ClearSCADA query node."

        // send out the message to the rest of the workspace.
        // ... this message will get sent at start-up so you may not see it in a debug node.
        this.send(msg);

        // respond to inputs....
        this.on('input', function (msg) {
			msg.topic = msg.topic ? msg.topic : this.topic; // Message topic overrides point name in topic configuration if blank
			console.log("ClearSCADA query: " + msg.topic);
			// console.log ("Username: " + this.server.username);
			
			var callback = function( node, msg) { 
					//console.log(msg);
					console.log("Calling to get query.");
					getClearSCADAQuery( node, msg);
				};
			
			// Ready to send out data, but must connect and log in first
			// So make the server object do this and call back when OK
			// This will omit login if already logged in.
			node.server.login( node, msg, callback );
        });

        this.on("close", function() {
            // Called when the node is shut down - eg on redeploy.
            // Allows ports to be closed, connections dropped etc.
            // eg: node.client.disconnect();
        });
    }

    // Register the node by name. This must be called before overriding any of the
    // Node functions.
    RED.nodes.registerType("QryClearSCADA", GetQueryNode);
	
	
	function getClearSCADAQuery( node, msg) {
		
		var http;
		if (node.usehttps) {
			http = require('https');
		} else {
			http = require('http');
		}
		var http_options = {
		  hostname: node.hostname,
		  port: node.port,
		  path: '/list/qry?' + encodeURI(msg.topic),
		  method: 'GET',
		  headers: {
			//"Accept-Encoding": "deflate",
			"Content-Type": "text/xml",
			"SCX-Client-Version": "6.77.5914",
			"User-Agent": "ViewXCtrl",
			"Cookie": "CLEARSCADAUSERID={" + node.server.userid + "}; " + 
					"CLEARSCADASECUREUSERID={" + node.server.secureuserid + "}",
			"Content-Length": 0
		  }
		}
		//console.log( http_options.path);
		var req = http.request(http_options, (res) => {
			// logging:
			// console.log( node.hostname);
			// console.log( node.port);
			// console.log(`Value STATUS: ${res.statusCode}`);
			// msg.payload = res.statusCode;
			if (res.statusCode == 200) {
				node.status({fill:"green", shape:"dot", text:"Success"});
				node.server.connecttime = Date.now();
			}
			else {
				node.status({fill:"red", shape:"ring", text:"Bad response"});
				node.server.connected = false;
			}
			// console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
			res.setEncoding('utf8');
		    var allchunks = ""
			res.on('data', (chunk) => {
				// console.log(`BODY: ${chunk}`);
				allchunks = allchunks + chunk;
			});

			res.on('end', () => {
				console.log('Query Response complete.');
				try {
					xmlparser(allchunks, function (err, result) {
						if (err != null) {
							msg.payload = err;
							// console.log(`******************************************************************`);
						} else {
							//Could be an invalid query
							try {
								//console.log( result.Page.List[0].Columns[0].Column);
								var data = { };
								data.columns = result.Page.List[0].Columns[0].Column;
								
								// Test if no records returned
								//console.log( typeof(result.Page.List[0].Rows[0]) );
								//console.log( '/' + result.Page.List[0].Rows[0] + '/');
								if ( result.Page.List[0].Rows[0] == "") {
									data.rowcount = 0;
								} else {

									var l = result.Page.List[0].Rows[0].Row.length;
									data.rowcount = l;
									
									if (l > 0) // Safety check.
									{
										//console.log( result.Page.List[0].Rows[0].Row);
										var rows = { };
										for (var i = 0; i < l; i++) {
											//console.log(result.Page.List[0].Rows[0].Row[i].Value);
											rows[ i] = result.Page.List[0].Rows[0].Row[i].Value;
										}
										data.rows = rows;
									}
								}
								msg.payload = data;
							}
							catch( err) {
								msg.payload = "Error: " + chunk;
							}
						}
					});
				} catch (err) {
					// Likely a shutting down server - ignore.
				}
				node.send(msg);
			})
		});

		req.on('error', (e) => {
		  node.warn(`problem with request: ${e.message}`);
		  msg.payload = 404;
		  node.send(msg);
		  node.status({fill:"red", shape:"ring", text:"Error"});
		});

		// write data to request body
		//console.log('Query Request write.');
		req.write("");
		req.end();
		//console.log('Query Request end.');	
	}
}
