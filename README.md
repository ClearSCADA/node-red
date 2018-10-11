node-red-ClearSCADA
===================

A <a href="http://nodered.org" target="_new">Node-RED</a> node to send/receive telemetry data with <a href="http://www.schneider-electric.com/en/product-range-presentation/61264-clearscada/" target="_new">ClearSCADA</a>.

Install
-------

Run the following command in your Node-RED user directory - typically `~/.node-red`

    npm install node-red-contrib-ClearSCADA


Usage
-----

### ClearSCADA output node

Uses ClearSCADA web API to send an analogue, digital or string value in `msg.payload` to an Internal Point of that type in ClearSCADA.
* Optionally uses `msg.topic` to set the point`s full name, if not already set in the properties.
* Optionally uses `msg.time` to set the process time of the point, and if absent the ClearSCADA server will use its receipt time.

### ClearSCADA get object node

Gets summary data about an object. For example, when using a point name, the data includes Current Value, Time, Quality etc.

### ClearSCADA read query node

Execute any SQL query and return the results to node-red.
