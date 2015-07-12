require('../globals');

require('./init')(function (config, svc) {
    var log = $log('synccloud:mail-parser'),
        parse = require('./parse'),
        redis = svc.redis,
        redlock = svc.redlock,
        api = svc.api;

    log.out('Starting up');

    api.on('error', function (err) {
    });

    redis.on('end', function () {
        log.err('Disconnected from Redis');
        process.exit(2);
    });

    redis.on('error', function (err) {
        log.trace('Redis error:', err);
        process.exit(3);
    });

    redis.on('ready', function () {
        log.out('Redis connection ready');

        redis.subscriber.on('message', function (channel, message) {
            try {
                var mail = JSON.parse(message);
                log.out('Requested to parse message %s', mail.data.uid);
                log.out(JSON.stringify(mail, null, 4));
                parse.then(function (parse) { parse(mail); });
            }
            catch (exc) {
                log.trace('Failed to parse incoming request:', exc);
            }
        });

        redis.subscriber.subscribe(config.parser.parseEventName);
    });
});
