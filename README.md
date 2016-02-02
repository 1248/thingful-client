
# Thingful node.js Client

This package provides a client for the REST API provided by the IoT search engine, thingful.net.

The project was developed by 1248 and is released under the Apache 2.0 license.

## Thingful

This is a factory that allows creation of one, or many ThingfulClients to be
used for making queries to the Thingful API.

#### thingful.createClient()

Returns a new instance of ThingfulClient.

Example:

```
var thingful = require('thingful');

var client = thingful.createClient();
```

## ThingfulClient

The ThingfulClient is a container for making Thingful API calls, containing information about the current query, paging data and array of Things. The properties can be accessed directly through the object, or the `query()` shortcut method can be used to fill in the required queryString and bounds properties.

```
// Set some properties
client.currentQuery = 'QUERY STRING';
client.bounds = {
	minLat: 51.12,
    maxLat: 52.11,
    minLon: 0.12,
    maxLon: 0.15
};
client.limit = 100; // Number of results per page

// The things array will be an empty array as default, but as
// queries are run this will be populated
console.log(client.things);
```

#### ThingfulClient.execute()



#### ThingfulClient.query(queryString, bounds)

Shortcut method to add the required properties to the ThingfulClient object and then run `execute()` to populate the Things array and paging data.

```
client.query('temperature', {
    minLat: 51.12,
    maxLat: 52.11,
    minLon: 0.12,
    maxLon: 0.15
}).then(function(res) {
    // "res" is just returning the original client with the populated data
    console.log(res.things);
});
```

#### ThingfulClient.next()

## Thingful.Thing

A 

## Examples

#### A simple query

```
// Make the query
client.query('temperature', {
	minLat: 51,
	maxLat: 52,
	minLon: 0,
	maxLon: 1
}).then(function(res) {
	// Resulting things should now be in res.things
	console.log(res.things);
});
```

#### A query that makes use of next()

```
var things = [];

client.query('temperature', {
	minLat: 51,
	maxLat: 52,
	minLon: 0,
	maxLon: 1
}).then(function(res) {
	things.concat(res.things);
	return res.next();
}).then(function(res) {
	things.concat(res.things);
	// "things" should now contain all things from the first and second page
});
```