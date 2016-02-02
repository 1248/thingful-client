'use strict';
/*eslint-env node, mocha */
/*eslint no-unused-expressions: 0*/

// Require the thingfulClient
var thingful = require('../../lib/thingful.js');

// Require test libs
var chai = require('chai'),
    chaiAsPromised = require('chai-as-promised');

// Values to test on
var client = thingful.createClient(),
    bounds = {
        minLat: 51.15,
        maxLat: 51.30,
        minLon: 0.1,
        maxLon: 0.3
    };

// Chai Setup
chai.use(chaiAsPromised);
chai.should();

describe('ThingfulClient', () => {
    // Set a longer timeout than default for the HTTP response
    this.timeout(30000);

    it('should be able to run a basic query', () => {
        // Run a simple query
        return client.query('temperature', bounds).then(res => {
            // Check the bounds got saved
            res.should.have.property('bounds');
            res.bounds.should.have.property('minLat').and.equal(51.15);
            res.bounds.should.have.property('maxLat').and.equal(51.30);
            res.bounds.should.have.property('minLon').and.equal(0.1);
            res.bounds.should.have.property('maxLon').and.equal(0.3);

            // Ensure the current query and self page was saved
            res.should.have.property('currentQuery');
            res.currentQuery.should.equal('temperature');
            res.should.have.property('currentPage').and.not.be.null;

            // Check the Things array
            res.should.have.property('things');
            res.things.should.be.an.array;
        });
    });

    it('should be able to manually set client properties and then run execute', () => {
        var blankClient = thingful.createClient();
        blankClient.currentQuery = 'temperature';
        blankClient.bounds = bounds;

        return blankClient.execute().then(res => {
            // Ensure the current query and self page was saved
            res.should.have.property('currentQuery');
            res.currentQuery.should.equal('temperature');
            res.should.have.property('currentPage').and.not.be.null;

            // Check the Things array
            res.should.have.property('things');
            res.things.should.be.an.array;
        });
    });

    it('should reject the query if no query string is specified', () => {
        return client.query().should.be.rejected;
    });

    it('should reject the query if no bounds are specified', () => {
        return client.query('temperature').should.be.rejected;
    });

    it('should reject the query if bad boundaries are specified', () => {
        return client.query('temperature', {
            minLat: 1,
            maxLat: 2
            // No Longitude bounds specified
        }).should.be.rejected;
    });

    it('should reject execute() calls on a empty ThingfulClient', () => {
        var newClient = thingful.createClient();
        return newClient.execute().should.be.rejected;
    });

    it('should resolve to an empty array if no things are on the page', () => {
        return client.query('NO_RESULTS_TEST123123', bounds)
            .then(res => {
                // Check the Things array
                res.should.have.property('things');
                res.things.should.be.an.array;
                res.things.should.have.length(0);
            });
    });

    it('should have a null nextPage if there are no more pages', () => {
        return client.query('NO_RESULTS_TEST123123', bounds)
            .then(res => {
                // Check the nextPage property
                res.should.have.property('nextPage').and.equal(null);
            });
    });

    it('should be able to run next() after a successful query\'s result', () => {
        var firstThing,
            firstPageUrl,
            secondPageUrl;

        // Set the limit to 1 so we definitely have some paging
        client.limit = 1;

        return client.query('temperature', bounds).then(res => {
            res.should.have.property('things').and.be.an.array;

            // Save a reference to the first thing so we can ensure the page changes
            firstThing = res.things[0];

            // Remember the page URLs to test against
            firstPageUrl = res.currentPage;
            secondPageUrl = res.nextPage;

            return res.next();
        }).then(res => {
            res.should.have.property('things').and.be.an.array;

            // We want the first thing of this Things array to not match
            res.things[0].should.not.deep.equal(firstThing);

            // Check the pages match the expected values
            res.currentPage.should.not.equal(firstPageUrl);
            res.currentPage.should.equal(secondPageUrl);
        }).catch(err => {
            throw err;
        });
    });

    it('should be able to have multiple clients running simulatiously', () => {
        var firstQuery = 'temperature',
            secondQuery = 'pollution',
            firstClient = thingful.createClient(),
            secondClient = thingful.createClient();

        return firstClient.query(firstQuery, bounds).then(res => {
            res.should.have.property('currentQuery');
            res.currentQuery.should.equal(firstQuery);
        }).then(() => {
            return secondClient.query(secondQuery, bounds);
        }).then(res => {
            res.should.have.property('currentQuery');
            res.currentQuery.should.equal(secondQuery);

            // Now check both original client variables contain the correct info
            firstClient.currentQuery.should.equal(firstQuery);
            secondClient.currentQuery.should.equal(secondQuery);
        });
    });

    it('should be able to find an amount of matching things across pages', () => {
        client = thingful.createClient();

        return client.nextPageUntilAmount({
            amount: 3,
            query: 'humidity',
            bounds: bounds,
            unit: '%'
        }).then(res => {
            res.things.length.should.be.at.least(3);
        }).catch(err => {
            throw err;
        });
    });
});
