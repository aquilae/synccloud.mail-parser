var log = $log('synccloud:mail-parser:api'),
    util = require('util'),
    events = require('events'),
    moment = require('moment-timezone');

module.exports = Api;

util.inherits(Api, events.EventEmitter);

_.extendOwn(Api, {
    create: function (backend, redis) {
        return new Api(backend, redis);
    }
});

_.extendOwn(Api.prototype, {
    createTaskFromLetter: function (letter) {
        var model = {
            name: letter.task.name,
            creator: letter.task.creator,
            executor: letter.task.executor,
            observers: letter.task.observers,
            description: letter.task.description,
            attachmentIds: letter.task.attachments
        };

        if (letter.markers.expiresAt) {
            model.expiresAt = this.backend.user(model.creator.address)
                .fail(function (err) {
                    log.trace('Cannot use marker `expiresAt` - unable to determine creator timezone:', err);
                    throw err;
                })
                .then(function (data) {
                    var date = moment.tz(letter.markers.expiresAt, 'MM-DD-YY', data.user.timezone);
                    if (!date || !date.isValid()) {
                        log.err('Cannot use marker `expiresAt` - invalid date format ("' +
                            letter.markers.expiresAt + '" TZ: ' + data.user.timezone + ')');
                        throw new Error();
                    }
                    return date.add({days: 1}).format('\\[YYYY-MM-DD, HH:mm:ss.SSS\\]');
                });
        }

        if (letter.markers.executor) {
            model.executor = {address: letter.markers.executor};
        }

        $q.props(model)
            .then(function (model) {
                return this.backend.createTask(model);
            }.bind(this))
            .then(function (data) {
                log.out('Task created with ID=' + data.task.id);
                this.emit('task-created', _.extendOwn(data, {letter: letter}));
            }.bind(this))
            .fail(function (err) {
                log.trace('createTask() failed:', err);

                this.redis.database.publish(
                    'synccloud.mail-composer:compose', JSON.stringify({
                        template: 'task-letter-error',
                        id: 'reply-letter-error[' + letter.uid + ']',
                        model: {
                            // inReplyTo: letter.messageId,
                            address: email(letter.to[0]),
                            client: email((letter.replyTo || [])[0] || letter.from[0])
                        }
                    }));

                this.emit('error', err, {letter: letter});
            }.bind(this));
    },

    alterTaskFromLetter: function (letter) {
        var model = {
            token: letter.reply.token,
            sender: letter.reply.sender,
            recipient: letter.reply.recipient,
            observers: letter.reply.observers,
            text: letter.reply.text,
            html: letter.reply.html,
            attachmentIds: letter.reply.attachments
        };

        if (letter.markers.expiresAt) {
            model.expiresAt = this.backend.user(model.sender.address)
                .fail(function (err) {
                    log.trace('Cannot use marker `expiresAt` - unable to determine creator timezone:', err);
                    throw err;
                })
                .then(function (data) {
                    var date = moment.tz(letter.markers.expiresAt, 'MM-DD-YY', data.user.timezone);
                    if (!date || !date.isValid()) {
                        log.err('Cannot use marker `expiresAt` - invalid date format ("' +
                            letter.markers.expiresAt + '" TZ: ' + data.user.timezone + ')');
                        throw new Error();
                    }
                    return date.utc().add({days: 1}).format('\\[YYYY-MM-DD, HH:mm:ss.SSS\\]');
                });
        }

        if (letter.markers.executor) {
            model.executor = {address: letter.markers.executor};
        }

        if (letter.markers.state) {
            model.state = letter.markers.state;
        }

        $q.props(model)
            .then(function (model) {
                return this.backend.alterTask(model);
            }.bind(this))
            .then(function (data) {
                if (data.comment) {
                    log.out('Comment created in task #' + data.task.id + ' with ID=' + data.comment.id);
                }
                else {
                    log.out('Altered task with ID=' + data.task.id);
                }
                this.emit('task-altered', _.extendOwn(data, {letter: letter}));
            }.bind(this))
            .fail(function (err) {
                log.trace('alterTask() failed:', err);

                this.redis.database.publish(
                    'synccloud.mail-composer:compose', JSON.stringify({
                        template: 'reply-error',
                        id: 'reply-error[' + letter.uid + ']',
                        model: {
                            // inReplyTo: letter.messageId,
                            address: email(letter.to[0]),
                            client: email(letter.replyTo[0] || letter.from[0]),
                            subject: letter.subject,
                            text: letter.text,
                            html: letter.html
                        }
                    }));

                this.emit('error', err, {letter: letter});
            }.bind(this));
    }
});

function Api(backend, redis) {
    this.backend = backend;
    this.redis = redis;
}

function email(address, name) {
    if (!address) {
        return null;
    }
    if (typeof (address) === 'object') {
        name = address.name;
        address = address.address;
    }
    return name ? '"' + name + '" <' + address + '>' : address;
}
