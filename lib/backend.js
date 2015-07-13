module.exports = Backend;

var log = $log('synccloud:mail-parser:backend'),
    url = require('url'),
    needle = require('needle'),
    stringify = require('json-stringify-safe');

module.exports = Backend;

_.extendOwn(Backend, {
    create: function (config) {
        return new Backend({
            log: $log('synccloud:mail-listener#' + config.tag + ':backend'),
            url: config.backend.url,
            key: config.backend.key
        });
    }
});

_.extendOwn(Backend.prototype, {
    alterTask: function (model) {
        return this.request({
            method: 'POST',
            uri: 'api/email/reply?key=' + encodeURIComponent(this.key),
            data: model
        });
    },
    createTask: function (model) {
        return this.request({
            method: 'POST',
            uri: 'api/email/task?key=' + encodeURIComponent(this.key),
            data: model
        });
    },
    user: function (email) {
        return this.request({
            method: 'GET',
            uri: 'api/email/user',
            data: {key: this.key, email: email}
        });
    },
    execute: function (commands) {
        return $q(function (resolve, reject) {
            try {
                this.request({
                    method: 'POST',
                    uri: 'api/email/execute?key=' + this.key,
                    data: (function (hash) {
                        var keys = Object.getOwnPropertyNames(hash),
                            clone = {}, i = 0, ii = keys.length;
                        for (; i < ii; ++i) {
                            (hash[keys[i]]) && (clone[keys[i]] = hash[keys[i]]);
                        }
                        return clone;
                    })(commands)
                }).then(function (data) {
                    var errors = [],
                        results = {},
                        keys = Object.getOwnPropertyNames(commands);

                    for (var i = 0, ii = keys.length; i < ii; ++i) {
                        var key = keys[i], cmd = commands[key], value = data[key];
                        if (cmd) {
                            if (value && value.status === 'success') {
                                results[key] = value.data;
                            }
                            else {
                                errors.push(value && value.error);
                            }
                        }
                        else {
                            results[key] = cmd;
                        }
                    }

                    if (errors.length > 0) {
                        throw BackendError.aggregate(errors);
                    }
                    return results;
                }).then(resolve, reject);
            }
            catch (exc) {
                reject(exc);
            }
        }.bind(this));
    },
    request: function (options) {
        return $q(function (resolve, reject) {
            try {
                var method = options.method || 'GET',
                    addr = url.resolve(this.url, options.uri),
                    data = options.data || (void 0);

                log.out('%s %s', method, addr, '\n' + stringify(data, null, 4));

                needle.request(method, addr, data, {json: true}, function (err, resp, body) {
                    var result;
                    try {
                        if (err) {
                            log.trace('Needle request() error:', err);
                            printBody();
                            reject(err);
                            return;
                        }

                        if (!body) {
                            log.err('Response body could not be parsed');
                            printBody();
                            reject(new Error('Response body could not be parsed'));
                            return;
                        }

                        if (resp.statusCode !== 200 || body.status !== 'success') {
                            var error = body.error || {};
                            log.err('Backend error: [' + resp.statusCode + '] ' + error.code + ' ' + error.message);
                            error.traceback && log.err('Traceback:\n' + error.traceback);
                            printBody();
                            reject(new Error('Backend Error'));
                            return;
                        }

                        result = body.data;
                    }
                    catch (exc) {
                        reject(exc);
                        return;
                    }

                    resolve(result);

                    function printBody() {
                        var b = body || resp.raw;
                        if (b) {
                            if (Buffer.isBuffer(b)) {
                                log.err('Response body:', '\n' + b.toString('utf8'));
                            }
                            else {
                                log.err('Response body:', '\n' + stringify(b));
                            }
                        }
                        else {
                            log.err('No response body available');
                        }
                    }
                });
            }
            catch (exc) {
                reject(exc);
            }
        }.bind(this));
    },
    upload: function (attachment) {
        return $q(function (resolve, reject) {
            try {
                var method = 'POST',
                    url_ = url.resolve(this.url, 'api/email/upload?key=' + this.key),
                    form = {
                        attachment: {
                            buffer: attachment.content,
                            filename: attachment.fileName || 'attachment',
                            content_type: attachment.contentType || 'application/octet-stream'
                        }
                    },
                    options = {multipart: true};

                needle.request(method, url_, form, options, function (err, resp, body) {
                    var result;
                    try {
                        if (err) {
                            log.trace('Needle request() error:', err);
                            printBody();
                            reject(err);
                            return;
                        }

                        if (!body) {
                            log.err('Response body could not be parsed');
                            printBody();
                            reject(new Error('Response body could not be parsed'));
                            return;
                        }

                        if (resp.statusCode !== 200 || body.status !== 'success') {
                            var error = body.error || {};
                            log.err('Backend error: [' + resp.statusCode + '] ' + error.code + ' ' + error.message);
                            error.traceback && log.err('Traceback:\n' + error.traceback);
                            printBody();
                            reject(new Error('Backend Error'));
                            return;
                        }

                        result = body.data.attachments.attachment.id;
                    }
                    catch (exc) {
                        reject(exc);
                        return;
                    }

                    resolve(result);

                    function printBody() {
                        var b = body || resp.raw;
                        if (b) {
                            if (Buffer.isBuffer(b)) {
                                log.err('Response body:', '\n' + b.toString('utf8'));
                            }
                            else {
                                log.err('Response body:', '\n' + stringify(b));
                            }
                        }
                        else {
                            log.err('No response body available');
                        }
                    }
                }.bind(this));
            }
            catch (exc) {
                reject(exc);
            }
        }.bind(this));
    }
});

function Backend(options) {
    this.log = options.log;
    this.url = options.url;
    this.key = options.key;
}


_.extendOwn(BackendError, {
    parse: function (serverError, response) {
        return new BackendError({
            code: serverError && serverError.code,
            message: serverError && serverError.text,
            trace: serverError && serverError.trace,
            httpCode: response && response.statusCode,
            cause: serverError && (serverError.cause ? BackendError.parse(serverError.cause) : null),
            inner: serverError && (serverError.inner ? serverError.inner.map(BackendError.parse) : [])
        });
    },
    aggregate: function (serverErrors, httpCode) {
        return new BackendError({
            code: 'aggregate_error',
            name: 'Aggregate Error',
            message: 'Multiple errors have occured',
            httpCode: httpCode || 200,
            inner: (serverErrors || []).map(function (x) {
                return BackendError.parse(x, httpCode);
            })
        });
    }
});

_.extendOwn(BackendError.prototype, {
    caption: function () {
        var p1 = '(HTTP: ' + this.httpCode + ') ',
            p2 = this.code ? '[' + this.code + '] ' : '',
            p3 = this.name,
            p4 = this.message ? ': ' + this.message : '';
        return p1 + p2 + p3 + p4;
    },
    print: function () {
        var lines = [this.caption(), ''];
        if (this.trace) {
            lines.push('Server trace:');
            lines.push(this.trace);
            lines.push('');
        }
        if (this.stack) {
            lines.push('Stack:');
            lines.push(this.stack);
            lines.push('');
        }
        if (this.cause) {
            lines.push('Cause:');
            lines.push(this.cause.print ? this.cause.print() : (this.cause.stack || this.cause));
            lines.push('');
        }
        if (this.inner && this.inner.length > 0) {
            lines.push('Inner:');
            this.inner.forEach(function (inner) {
                lines.push(inner.print ? inner.print() : (inner.stack || inner));
                lines.push('');
            })
        }
        return lines.join('\n');
    }
});

function BackendError(options) {
    Error.call(this);
    Error.captureStackTrace(this, arguments.callee);

    options || (options = {});
    this.code = options.code || 'backend_error';
    this.name = options.name || 'Backend Error';
    this.message = options.message;
    this.httpCode = options.httpCode || 200;
    this.cause = options.cause;
    this.inner = options.inner || [];
}
