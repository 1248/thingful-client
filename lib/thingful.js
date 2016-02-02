'use strict';
/*eslint-env node */

// Requires
var request = require('request');

// Declare the modules
var Thingful = {},
    ThingfulClient = {};

/**
 * The client will wrap the Thingful API to allow easy use of it with basic
 * searches and pagination
 *
 * @return {[type]} [description]
 */
ThingfulClient = function() {
    // Create a blank client object which will be filled as queries are run, or
    // if the properties are directly modified
    var client = {
        things: [],
        limit: 10
    };

    /**
     * Sends a request to the Thingful API based on the values that are currently
     * stored in the ThingfulClient object
     *
     * @param  {Boolean} executeCurrentPage Whether to run the query based on the current value of currentPage
     * @return {Promise} Resolves with the result from the Thingful API
     */
    client.execute = function(executeCurrentPage) {
        // Define the base URL
        var url;

        // Should default to false
        executeCurrentPage = executeCurrentPage || false;

        // If we are executing the current page, the URL is simply the one
        // provided under the "currentPage" property
        if (executeCurrentPage === true && client.currentPage !== null) {
            url = client.currentPage;
        }

        return new Promise(function(resolve, reject) {
            // Check if we need to construct the URL up
            if (!executeCurrentPage || url === undefined) {
                url = 'https://api.thingful.net/things?';

                // Ensure we have a query
                if (client.currentQuery === undefined) {
                    return reject('No query was defined');
                }

                // Ensure the bounds are part of the client
                if ((client.bounds === undefined) ||
                    (client.bounds.minLat === undefined) ||
                    (client.bounds.maxLat === undefined) ||
                    (client.bounds.minLon === undefined) ||
                    (client.bounds.maxLon === undefined)) {
                        return reject('Invalid geobounds parameter');
                }

                // Construct the query string
                url += 'geobound-minlong=' + client.bounds.minLon +
                    '&geobound-maxlong=' + client.bounds.maxLon +
                    '&geobound-minlat=' + client.bounds.minLat +
                    '&geobound-maxlat=' + client.bounds.maxLat +
                    '&limit=' + client.limit +
                    '&q=' + client.currentQuery;
            }

            // Make the request using the generated url
            request({
                url: url,
                json: true,
                timeout: 30000
            }, function(err, res, body) {
                // Check if we have errors, or non-200 (OK) response
                if (err) {
                    return reject(err);
                } else if (res.statusCode !== 200) {
                    return reject('Bad HTTP Response (' + res.statusCode + ')');
                }

                // Save the pagination data to the client
                client.currentPage = body.links.self;
                client.nextPage = body.links.next || null;

                // Map each of the raw JSON things to our nice Thing object
                client.things = body.data.map(function(rawData) {
                    return new Thingful.Thing(rawData);
                });

                // Finally, resolve the client
                resolve(client);
            });
        });
    };

    /**
     * A shortcut for populating the properties necessary for a Thingful API
     * query, the queryString and bounds. This method will also run an "execute"
     * once the client has been populated
     *
     * @param  {String} queryString The full text search query to be run by Thingful
     * @param  {Object} bounds The object to define the search geobounds (minLon, maxLon, minLat, maxLat)
     * @return {Promise} Resolves to the populated ThingfulClient
     */
    client.query = function(queryString, bounds) {
        return new Promise(function(resolve, reject) {
            // Ensure we have a queryString
            if (queryString === undefined || typeof queryString !== 'string') {
                return reject('No query was defined');
            }

            // Ensure the bounds make sense
            if ((bounds === undefined) ||
                (bounds.minLat === undefined) ||
                (bounds.maxLat === undefined) ||
                (bounds.minLon === undefined) ||
                (bounds.maxLon === undefined)) {
                    return reject('Invalid geobounds parameter');
            }

            // Add the parameters to the client object
            client.currentQuery = queryString;
            client.bounds = bounds;

            // Execute the current query on the client
            client.execute().then(function(result) {
                // Resolve the result
                return resolve(result);
            }).catch(function(err) {
                return reject(err);
            });
        });
    };

    /**
     * Must be run on a ThingfulClient with a populated query. If the API returns
     * no next page, an empty array will be resolved.
     *
     * @return {Promise} Resolves to a ThingfulClient with a populated "things" array
     */
    client.next = function() {
        // Set the current page to be the value stored in nextPage
        client.currentPage = client.nextPage;

        // Now we execute the query again
        return client.execute(true);
    };

    client.nextPageUntilAmount = function(args) {
        var filteredArray;

        // Restore the fullThingsArray from args
        if (args.fullThingsArray === undefined) {
            args.fullThingsArray = [];
        }

        // Ensure we have basic arguments
        if ((args === undefined) ||
            (args.amount === undefined)) {
            return Promise.reject('No arguments were given');
        }

        // Check we have a query somewhere
        if ((args.query === undefined) &&
            (client.currentQuery === undefined)) {
            return Promise.reject('No search query was defined');
        }

        // Check if we have the bounds
        if ((args.bounds === undefined) &&
            (client.bounds === undefined)) {
            return Promise.reject('No search bounds were defined');
        }

        // Save the parameters to the client
        client.currentQuery = args.query;
        client.bounds = args.bounds;
        client.limit = 1;

        return client.next().then(function(res) {
            // Filter the Things to return only the ones that
            // match our criteria
            filteredArray = res.things.filter(function(thing) {
                var foundUnit = false,
                    dataObj;

                // Check all data objects
                for (dataObj in thing.data) {
                    if (thing.data.hasOwnProperty(dataObj)) {
                        // Check the unit
                        if (true || (args.unit !== undefined) &&
                            (args.unit === thing.data[dataObj].unit)) {
                                foundUnit = true;
                        }
                    }
                }

                return foundUnit;
            });

            // Add the filtered Things to the fullThingsArray
            args.fullThingsArray = args.fullThingsArray.concat(filteredArray);

            // Check if we have the correct amount of Things in our array, or if
            // there are no more pages to iterate through
            if ((args.fullThingsArray.length >= args.amount) ||
                (client.nextPage === null)) {
                    // Add the things to the client and resolve it
                    client.things = args.fullThingsArray;
                    return Promise.resolve(client);
            }

            // Run the method again until we have the correct number of Things
            return client.nextPageUntilAmount(args);
        }).catch(function(err) {
            return Promise.reject(err);
        });
    };

    return client;
};

/**
 * Main entry point for the node module, includes a factory to create a new
 * ThingfulClient and the constructor for a "Thing" object
 *
 * @return {Thingful}
 */
Thingful = (function() {
    var thingful = {};

    /**
     * Create a new instance of a ThingfulClient, used for making queries
     * against the Thingful API
     *
     * @return {ThingfulClient} A new instance of ThingfulClient
     */
    thingful.createClient = function() {
        return new ThingfulClient();
    };

    /**
     * Takes the rawData from the Thingful API as returned from /things and
     * formats it into a JavaScript object with easily accessible properties
     * in a flatter Object structure
     *
     * @param  {Object} rawData The raw data that is received from the Thingful API for a Thing
     * @return {Object} The data will be formatted into a more Javascript-friendly format
     */
    thingful.Thing = function(rawData) {
        // Flatten the data
        var attributes = rawData.attributes,
            parsedData = {
                id: rawData.id,
                title: attributes.title,
                description: attributes.description,
                datasource: attributes.datasource,
                createdAt: attributes.created_at,
                updatedAt: attributes.updated_at,
                indexedAt: attributes.indexed_at,
                longitude: attributes.longitude,
                latitude: attributes.latitude,
                distance: attributes.distance,
                data: {}
            };

        // Loop through data preview to construct the Thing's data
        // @TODO need to make sure this works after API gets updated
        attributes.channels.forEach(function(dataPreview) {
            // Construct the data object
            parsedData.data[dataPreview.id] = {
                value: dataPreview.value || null,
                unit: dataPreview.unit || null,
                recordedAt: dataPreview.recorded_at
            };
        });

        // @TODO the relationships may need reformatting
        parsedData.relationships = rawData.relationships;

        return parsedData;
    };

    return thingful;
}());

// Export Thingful for use as a node module
module.exports = Thingful;
