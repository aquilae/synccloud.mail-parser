var log = $log('synccloud:mail-notifications:config'),
    fs = require('fs'),
    path = require('path');

var promise = $q(function (resolve) {
    getConfigUrl().then(function (configUrl) {
        log.out('Requesting configuration [' + configUrl + ']');
        require('http').get(configUrl, function (res) {
            log.out('Receiving configuration');

            var chunks = [], length = 0;

            res.on('data', function (chunk) {
                chunks.push(chunk);
                length += chunk.length;
            });

            res.on('end', function () {
                log.out('Parsing configuration');

                var bytes, data;
                if (res.statusCode === 200) {
                    try {
                        bytes = Buffer.concat(chunks, length);
                        data = build(JSON.parse(bytes));
                        log.out('Configuration OK:', JSON.stringify(data, null, 4));
                    }
                    catch (err) {
                        log.trace('Error parsing configuration data:', err);
                        bytes.toString('utf8') && log.err('Configuration text:', bytes.toString('utf8'));
                        process.exit(1);
                        return;
                    }
                    resolve(data);
                }
                else {
                    try {
                        bytes = Buffer.concat(chunks, length);
                        data = bytes.toString('utf8');
                        log.trace('HTTP error (' + res.statusCode + ' ' + res.statusMessage + '):', '\n' + data);
                    }
                    catch (err){
                        log.trace('HTTP error (' + res.statusCode + ' ' + res.statusMessage + '):', err);
                    }
                    process.exit(1);
                }
            });

            res.on('error', function (err) {
                log.trace('HTTP error (' + res.statusCode + ' ' + res.statusMessage + '):', err);
            });
        });
    });
}).fail(function (err) {
    log.trace('Fatal error:', err);
    process.exit(1);
});

module.exports = function (callback) {
    return promise.then(callback);
};

function getConfigUrl() {
    return $q(function (resolve) {
        if (process.env.CONFIGURATION) {
            return resolve(process.env.CONFIGURATION);
        }
        fs.readFile(path.join(__dirname, '../config.json'), {encoding: 'utf8'}, function (err, data) {
            if (err) {
                log.trace('Could not get configuration URL:', err);
                process.exit(1);
            }
            else {
                var result;
                try {
                    result = JSON.parse(data).configuration;
                }
                catch (exc) {
                    log.trace('Could not get configuration URL:', exc);
                    process.exit(1);
                    return;
                }
                resolve(result);
            }
        });
    });
}

function build(data) {
    return check({
        redis: {
            port: data.redis && data.redis.port,
            host: data.redis && data.redis.host,
            database: data.redis && data.redis.database
        },
        redlock: {
            ttl: data.redlock && data.redlock.ttl,
            retryCount: data.redlock && data.redlock['retry-count'],
            retryDelay: data.redlock && data.redlock['retry-delay']
        },
        backend: {
            url: data.backend && data.backend.url,
            key: data.backend && data.backend.key
        },
        parser: {
            parseEventName: data.parser && data.parser['parse-event-name'],
            replyWatermarkText: data.parser && data.parser['reply-watermark-text']
        }
    }, {
        redis: {
            port: [optional(6379), integer()],
            host: optional('127.0.0.1'),
            database: [optional(0), integer()]
        },
        redlock: {
            ttl: [required(), integer()],
            retryCount: [required(), integer()],
            retryDelay: [required(), integer()]
        },
        backend: {
            url: required(),
            key: required()
        },
        parser: {
            parseEventName: required(),
            replyWatermarkText: required()
        }
    });
}

function check(config, meta, prefix) {
    var keys = Object.getOwnPropertyNames(meta);
    keys.forEach(function (key) {
        var traits = meta[key],
            record = config && config[key],
            path = (prefix ? prefix + '.' : '') + key,
            setValue = function (value) {
                config[key] = value;
                record = value;
            };
        if (typeof (traits) === 'function') {
            traits = [traits];
        }
        if (Array.isArray(traits)) {
            traits.forEach(function (trait) {
                trait(config, key, record, path, setValue);
            });
        }
        else {
            check(record, traits, path);
        }
    });
    return config;
}

function required() {
    return function required(config, key, record, path, setValue) {
        if (!record) {
            throw new Error('Missing configuration option `' + path + '`');
        }
    }
}

function optional(defaultValue) {
    return function optional(config, key, record, path, setValue) {
        if (!record) {
            setValue(typeof (defaultValue) === 'undefined' ? null : defaultValue);
        }
    }
}

function integer() {
    return function integer(config, key, record, path, setValue) {
        if (typeof (record) === 'number') {
            if (record.toFixed(1) !== (record.toFixed(0) + '.0')) {
                throw new Error('Option `' + path + '` should be an integer. Got ' + record);
            }
        }
        else {
            if (!(/[0-9]+/.test(record))) {
                throw new Error('Option `' + path + '` should be an integer. Got ' + record);
            }
            config[key] = +record;
        }
    }
}
