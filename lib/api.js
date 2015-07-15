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
    createTaskFromLetter: function (mail, meta) {
        $q(function (resolve, reject) {
            var pending = 1,
                markers = meta.markers,
                task = meta.task,
                model = {
                    name: task.name,
                    creator: task.creator,
                    executor: task.executor,
                    observers: task.observers,
                    description: task.description,
                    attachmentIds: task.attachments
                };

            if (markers.expiresAt) {
                ++pending;
                this.backend.user(model.creator.address)
                    .fail(function (err) {
                        log.trace('Cannot use marker `expiresAt` - unable to determine creator timezone:', err);
                        throw err;
                    }.bind(this))
                    .then(function (data) {
                        var date = moment.tz(markers.expiresAt, 'MM-DD-YY', data.user.timezone);
                        if (!date || !date.isValid()) {
                            log.err('Cannot use marker `expiresAt` - invalid date format ("' +
                                markers.expiresAt + '" TZ: ' + data.user.timezone + ')');
                            throw new Error();
                        }
                        model.expiresAt = date.add({days: 1}).format('\\[YYYY-MM-DD, HH:mm:ss.SSS\\]');
                    }.bind(this))
                    .then(advance, reject);
            }

            if (markers.executor) {
                model.executor = {address: markers.executor};
            }

            advance();

            function advance() {
                if (--pending === 0) {
                    resolve(model);
                }
            }
        }.bind(this)).then(function (model) {
            return this.backend.createTask(model);
        }.bind(this))
        .then(function (data) {
            log.out('Task created with ID=' + data.task.id);
            this.emit('task-created', data, meta, mail);
        }.bind(this))
        .fail(function (err) {
            log.trace('createTask() failed:', err);
            this.emit('error', err, meta, mail);
        }.bind(this));
    },

    alterTaskFromLetter: function (mail, meta) {
        $q(function (resolve, reject) {
            var pending = 1,
                markers = meta.markers,
                reply = meta.reply,
                model = {
                    token: reply.token,
                    sender: reply.sender,
                    recipient: reply.recipient,
                    observers: reply.observers,
                    text: reply.text,
                    html: reply.html,
                    attachmentIds: reply.attachments
                };

            if (markers.expiresAt) {
                ++pending;
                this.backend.user(model.sender.address)
                    .fail(function (err) {
                        log.trace('Cannot use marker `expiresAt` - unable to determine creator timezone:', err);
                        throw err;
                    }.bind(this))
                    .then(function (data) {
                        var date = moment.tz(markers.expiresAt, 'MM-DD-YY', data.user.timezone);
                        if (!date || !date.isValid()) {
                            log.err('Cannot use marker `expiresAt` - invalid date format ("' +
                                markers.expiresAt + '" TZ: ' + data.user.timezone + ')');
                            throw new Error();
                        }
                        model.expiresAt = date.add({days: 1}).format('\\[YYYY-MM-DD, HH:mm:ss.SSS\\]');
                    }.bind(this))
                    .then(advance, reject);
            }

            if (markers.executor) {
                model.executor = {address: markers.executor};
            }

            if (markers.state) {
                model.state = markers.state;
            }

            advance();

            function advance() {
                if (--pending === 0) {
                    resolve(model);
                }
            }
        }.bind(this))
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
            this.emit('task-altered', data, meta, mail);
        }.bind(this))
        .fail(function (err) {
            log.trace('alterTask() failed:', err);
            this.emit('error', err, meta, mail);
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
