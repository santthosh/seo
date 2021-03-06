// load in the required modules
const url           = require('url');
const S             = require('string');
const request       = require('request');
const _             = require('underscore');

// stub functions that will check for testing data first, 
// before doing a actual request over the network
var doRequest = function(payload, options, fn) {

  // params to send back
  var data      = payload.getData();

  // check if we got testing data
  if(data.testingPresentError)
    return fn(new Error());

  // check if we got testing data
  if(data.testingStatusCode)
    return fn(null, {

      statusCode: 1 * data.testingStatusCode,
      request: {

        uri: url.parse(data.testingRequestUrl)

      }

    }, '');

  // check if we are not running 2 versions of the same page
  request(options, fn);

};

// expose the items
module.exports = exports = function(payload, fn) {

  // params to send back
  var data      = payload.getData();

  // parse the current url
  var uri       = url.parse(data.url);

  // decide which protocol is the alternate one
  var protocol  = uri.proto
  var port      = uri.port

  // check if this is https
  if(uri.protocol.toString().toLowerCase() == 'http:') {

    protocol = 'https:';
    if(!port || port == 80)
      port = 443;

  } else {

    protocol = 'http:'
    if(!port || port == 443)
      port = 80;

  }

  // the paths to use
  var target        = _.extend({}, uri, {

    port:       port,
    protocol:   protocol

  });

  // alt url to check ...
  var alt = url.format(target)

  // check if we are not running 2 versions of the same page
  doRequest(payload, {

      type:             'HEAD',
      method:           'HEAD',
      url:              alt,
      timeout:          5 * 1000,
      followRedirect:   true

    }, function(err, response, body) {

      // check that we did not get a error
      if(err) {

        // cleaned protocol
        var proto = S(protocol).trim().s.replace(/\:/gi, '').toLowerCase();

        // add them in
        payload.addRule({

          type:     'notice',
          key:      'duplicate.connect',
          message:  'Not able to connect to alternate protocol'

        }, {

          message:      'Unable to connect to $',
          identifiers:  [ alt ]

        })

      } else if((response || {}).statusCode >= 200 && 
          (response || {}).statusCode < 300) {

        // must check the redirect url
        if(response.request.uri.hostname != uri.hostname || 
            response.request.uri.path != uri.path || 
              response.request.uri.protocol != uri.protocol) {

          // add them in
          payload.addRule({

            type:     'error',
            key:      'duplicate',
            message:  'Both http:// & https:// versions of page are being served'

          }, {

            message:      '$ responded with a status code of $',
            identifiers:  [ alt, 1 * response.statusCode ]

          })

        }

      } else if((response || {}).statusCode >= 400 && 
                  (response || {}).statusCode <= 600) {

        // add them in
        payload.addRule({

          type:         'error',
          key:          'duplicate.error',
          message:      'Alternate version of page returns a error'

        }, {

          message:      '$ responded with a status code of $',
          identifiers:  [ alt, 1 * response.statusCode ]

        })

      }

      // done ... ?
      fn(null);

    });

};
