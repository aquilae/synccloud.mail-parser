module.exports = require('./init')(function (config, svc) {
    var util = require('util'),
        Parser = require('./parser'),
        parser = new Parser(config.parser.replyWatermarkText),
        api = svc.api;

    parser.on('error', function (err) {
        log.trace('Error parsing letter:', err);
    });

    parser.on('task', function (letter) {
        api.createTaskFromLetter(letter);
    });

    parser.on('reply', function (letter) {
        api.alterTaskFromLetter(letter);
    });

    return function (mail) {
        switch (mail.kind) {
            case 'task': {
                mail.data.repr = util.format(
                    '`%s` [%s] (%s -> %s) "%s"',
                    mail.data.uid, mail.kind,
                    mail.data.from.address,
                    mail.data.to[0].address);
                parser.parseTaskLetter(mail.data);
                break;
            }
            case 'reply': {
                mail.data.repr = util.format(
                    '`%s` [%s] (%s -> %s) "%s"',
                    mail.data.uid, mail.kind,
                    mail.data.from.address,
                    mail.data.to[0].address);
                parser.parseReplyLetter(mail.data, mail.options['token']);
                break;
            }
        }
    };

    function createParser() {
        return new Parser(config.parser.replyWatermarkText);
    }
});
