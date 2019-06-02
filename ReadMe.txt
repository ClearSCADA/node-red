ClearSCADA Node-Red Node
========================
Steve Beadle.

Note - Interfaces with ClearSCADA on localhost port 80. The points to be modified are Internal. Need Guest/Everyone access to Control the points.

11/4/18 Now handles strings (primitively). If data is a string then it sends as a string parameter via SOAP
11/4/18 Now returns HTTP status code as the result
12/4/18 Analogue, Digital and String point types all handled. New Point Type configuration property on ClearSCADA Node. Default to Analogue.
24/4/18 Adds server configuration object, enables port, host and https configuration. Adds credentials but these are not used.
25/4/18 Fix case statement for analogue values
20/6/18 Add login, read data and read query functionality
26/9/18 Error check around receiving malformed xml - ignore silently
31/5/19 Fix chunk error truncating larger queries

TODO
-
