const request = require('request');
const crypto = require('crypto');
const xml2js = require('xml2js');

/**
 * @api private
 */
const xmlOptions = {  // options passed to xml2js parser
  explicitCharkey: false, // undocumented
  trim: false,            // trim the leading/trailing whitespace from text nodes
  normalize: false,       // trim interior whitespace inside text nodes
  explicitRoot: false,    // return the root node in the resulting object?
  emptyTag: null,         // the default value for empty nodes
  explicitArray: true,    // always put child nodes in an array
  ignoreAttrs: false,     // ignore attributes, only create text nodes
  mergeAttrs: false,      // merge attributes and child elements
  validator: null         // a callable validator
};

const REQ_ALGORITHM = 'AWS4-HMAC-SHA256';
const REQ_VERSION = 'aws4_request';

module.exports.get = function get(options = {}) {
  // Default method is GET
  const method = 'GET';

  // Unless path is already provided, generate it from dir and filename.
  const path = options.path || generateBucketKey(options.filename, options.dir);
  // Create an authorization prerequest.
  const auth = generatePreRequest(options, {method, path});

  // Construct the request options.
  const reqOptions = {
    uri: auth.uri,
    method,
    headers: auth.headers,
    //resolveWithFullResponse: true
    encoding: null,
    rejectUnauthorized: false
  };

  /*
  const req = request(reqOptions);

  // Responses, including errors, received from AWS S3 are in XML format.
  return req.catch((res) => {
    return parseXMLResponse(res.error).then((parsedErr) => {
      const err = new TypeError(parsedErr.Message || parsedErr.message || 'Request failed');
      return Promise.reject(Object.assign(err, parsedErr));
    });
  });
  */
  return _request(reqOptions);
};

function generatePreRequest(...args) {

  // Build the options object.
  // Start with an empty base object, used as first merge destination by `reduce`
  const options = [{}].concat(
    // Filter the arguments, allowing only non-null objects.
    args.filter((arg) => (typeof arg === 'object' && arg !== null))
  ).reduce((dst, src) => Object.assign(dst, src));  // Do Object.assign on each argument, using previous as destination.

  // Retrieve parameters from options.
  const {
    accessKey,
    secretKey,
    bucket,
    region,
    service = 's3',
    method = 'GET',
    path = '/',
    headers = {},
    query = {},
    date = new Date(),
    body = 'UNSIGNED-PAYLOAD',
    meta,
    bodyHash
  } = options;

  const host = `${bucket}.s3.amazonaws.com`;
  // Ensure the canonical URI starts with a backslash.
  const canonicalURI = (path.indexOf('/') === 0 ? path : `/${path}`);
  // Build the request URI
  const uri = `https://${host}${canonicalURI}`;
  // Generate the request date
  const currentDate = getCurrentDate(date);
  // Generate the ISO date.
  const currentISODate = getISODate(currentDate);
  // Generate the short ISO date.
  const shortISODate = currentISODate.substr(0, 8);
  // Generate the payload hash
  const payloadHash = (bodyHash || hash(body, 'hex'));
  
  // Prepare headers for signing.
  const reqHeaders = Object.assign({
    date: currentDate.toUTCString(),
    host,
    'x-amz-date': currentISODate,
    'x-amz-content-sha256': payloadHash
  }, headers, generateMetaHeaders(meta));

  // Generate the scope for the signature.
  const scope = [shortISODate, region, service, REQ_VERSION].join('/');
  const credential = `${accessKey}/${scope}`;
  // Store a list of the headers names, in lower case and sorted alphabetically.
  const headerNames = Object.keys(reqHeaders).map((header) => header.toLowerCase().trim()).sort();
  // Store the list of signed headers as a semicolon delimited string.
  const signedHeaders = headerNames.join(';');
  // Generate the canonical headers array and merge it, using the new-line separator.
  const canonicalHeaders = generateCanonicalHeaders(reqHeaders).join('\n');
  // Generate the canonical query
  const canonicalQuery = generateCanonicalQueryString(query);
  // Generate the canonical request array
  const arrCanonicalRequest = [
    method,
    canonicalURI,
    canonicalQuery,
    canonicalHeaders + '\n',
    signedHeaders,
    payloadHash
  ];
  // Generate the canonical request hash.
  const canonicalRequest = hash(arrCanonicalRequest.join('\n'), 'hex');

  // Generate StringToSign
  const stringToSign = [
    REQ_ALGORITHM,
    currentISODate,
    scope,
    canonicalRequest
  ].join('\n');

  // Generate the signature.
  const signature = generateSignature({secret: secretKey, date: shortISODate, region, service, payload: stringToSign});

  // Generate the Authorization header.
  const Authorization = [
    `${REQ_ALGORITHM} Credential=${credential}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`
  ].join(',');

  // Return an object that provides the uri, headers, method, signature and date for the authorized request.
  return {
    uri,
    headers: Object.assign({Authorization}, reqHeaders),
    method,
    signature,
    date: currentDate
  };
}

function generateSignature({secret, date, region, service, payload, version = REQ_VERSION}) {
  const part1 = hmac(`AWS4${secret}`, date);
  const part2 = hmac(part1, region);
  const part3 = hmac(part2, service);
  const part4 = hmac(part3, version);
  
  return hmac(part4, payload, 'hex');
}

function generateCanonicalHeaders(headers) {
  return Object.keys(headers)
    .sort(stringSort)
    .map((key) => formatCanonicalHeader(key, headers[key]));
}

function stringSort(a, b) {
  return (a.toLowerCase() < b.toLowerCase() ? -1 : 1);
}

function formatCanonicalHeader(key, value) {
  return key.toLowerCase() + ':' + String(value).trim();
}

function generateCanonicalQueryString(params) {
  return Object.keys(params).sort().map(function(key) {
    return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
  }).join('&');
}

function generateMetaHeaders(meta = {}) {
  if (typeof meta === 'object' && meta !== null) {
    // Prefix all `meta` properties with `x-amz-meta-`
    return Object.keys(meta).reduce((p, k) => { p['x-amz-meta-' + k] = meta[k]; return p; }, {});
  }

  return undefined;
}

function getCurrentDate(date) {
  if (date && !(date instanceof Date)) {
    return new Date(date);
  }

  return new Date();
}

function getISODate(date) {
  if (!date) {
    date = new Date();
  } else if (!(date instanceof Date)) {
    date = new Date(date);
  }

  return date.toISOString().replace(/[:\-]|\.\d{3}/g, '');
}

function generateBucketKey(filename, dir = '') {
  dir = dir.trim();

  if (dir.indexOf('/') === 0) {
    dir = dir.substr(1);
  }

  if (dir.substr(-1, 1) === '/') {
    dir = dir.substr(0, dir.length - 1);
  }

  return dir + '/' + filename;
}

function hmac(key, string, encoding) {
  return crypto.createHmac('sha256', key)
    .update(string, 'utf8')
    .digest(encoding);
}
function hash(string, encoding) {
  return crypto.createHash('sha256')
    .update(string, 'utf8')
    .digest(encoding);
}

function parseXMLResponse(xml, options = xmlOptions) {
  var parser = new xml2js.Parser(options);

  return new Promise((resolve, reject) => {
    parser.parseString(xml, function(err, response) {
      if (!err) {

        // Convert single-item arrays into single value.
        const rf = Object.keys(response).reduce((p, k) => {
          const v = response[k];

          if (Array.isArray(v)) {
            if (v.length > 0) {
              if (v.length === 1) {
                p[k] = v[0];
              } else {
                p[k] = v;
              }
            }
          } else {
            p[k] = v;
          }

          return p;
        }, {});

        resolve(rf);
      } else {
        reject(xml);
      }
    });
  });
}

function _request(options = {}) {
  // Default SUCCESS status
  const statusCode = options.statusCode;

  let req;
  const promise = new Promise((resolve, reject) => {
    req = request(options, (error, res, body) => {
      if (!error) {
        if (res.statusCode === statusCode || (!statusCode && Math.floor(res.statusCode/100) === 2)) {
          resolve(res);
        } else {
          const err = new TypeError(res.statusCode + ' - ' + res.statusMessage);
          Object.defineProperties(err, {
            body: {value: body, enumerable: false, configurable: true, writable: true},
            res: {value: res, enumerable: false, configurable: true, writable: true}
          });
          reject(err);
        }
      } else {
        reject(error);
      }
    });
  });

  const p = promise.catch((err) => {
    return parseXMLResponse(err.body).then((parsedErr) => {
      const err = new TypeError(parsedErr.Message || parsedErr.message || 'Request failed');
      return Promise.reject(Object.assign(err, parsedErr));
    });
  });

  req.then = (...args) => p.then(...args);
  req.catch = (...args) => p.catch(...args);

  return req;
}
