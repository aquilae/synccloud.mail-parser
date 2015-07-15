module.exports = require('./init')(function (config, svc) {
    var util = require('util'),
        Parser = require('./parser'),
        parser = new Parser(config.parser.replyWatermarkText),
        api = svc.api;

    parser.on('error', function (err, mail) {
        log.trace('Error parsing mail ' + mail.id + ':', err);

        var template;
        switch (mail.kind) {
            case 'task':
                template = config.compose.templateNames.usermailTaskError;
                break;
            case 'reply':
                template = config.compose.templateNames.usermailReplyError;
                break;
        }

        template && svc.compose({
            template: template,
            id: mail.id + '.notification',
            model: mail.data
        });
    });

    parser.on('task', function (meta, mail) {
        api.createTaskFromLetter(mail, meta);
    });

    parser.on('reply', function (meta, mail) {
        api.alterTaskFromLetter(mail, meta);
    });

    return function (mail) {
        switch (mail.kind) {
            case 'task': {
                mail.data.repr = util.format(
                    '`%s` [%s] (%s -> %s) "%s"',
                    mail.data.uid, mail.kind,
                    mail.data.from.address,
                    mail.data.to[0].address);
                parser.parseTaskLetter(mail);
                break;
            }
            case 'reply': {
                mail.data.repr = util.format(
                    '`%s` [%s] (%s -> %s) "%s"',
                    mail.data.uid, mail.kind,
                    mail.data.from.address,
                    mail.data.to[0].address);
                parser.parseReplyLetter(mail, mail.options['token']);
                break;
            }
        }
    };

    function createParser() {
        return new Parser(config.parser.replyWatermarkText);
    }
});
