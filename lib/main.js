require('../globals');

require('./init')(function (config, svc) {
    var log = $log('synccloud:mail-parser'),
        parse = require('./parse'),
        redis = svc.redis,
        api = svc.api,
        compose = svc.compose;

    log.out('Starting up');

    api.on('error', function (err, meta, mail) {
        var template;
        switch (mail.kind) {
            case 'task':
                template = config.compose.templateNames.usermailTaskError;
                break;
            case 'reply':
                template = config.compose.templateNames.usermailReplyError;
                break;
        }

        template && compose({
            template: template,
            id: mail.id + '.notification',
            model: _.extendOwn(mail.data, {lines: meta.lines})
        });
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
                log.out('Requested to parse message %s', mail.id);
                log.out(JSON.stringify(mail, null, 4));
                parse.then(function (parse) { parse(mail); });
            }
            catch (exc) {
                log.trace('Failed to parse incoming request:', exc);
                log.err(message);
            }
        });

        redis.subscriber.subscribe(config.parser.parseEventName);
    });
});
