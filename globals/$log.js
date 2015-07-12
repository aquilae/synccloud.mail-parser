var debug = require('debug'),
    colors = require('colors'),
    stringify = require('json-stringify-safe');

module.exports = function (name) {
    var log = debug(name),
        err = function () {
            var argc = arguments.length,
                args = new Array(argc);

            for (var i = 0; i < argc; ++i) {
                args[i] = arguments[i];
            }

            var bak = log.log;
            try {
                log.log = console.warn.bind(console);
                log.apply(null, args);
            }
            finally {
                try { console.stdout.uncork(); } catch (_) { }
                try { console.stderr.uncork(); } catch (_) { }
                log.log = bak;
            }
        },
        out = function () {
            var argc = arguments.length,
                args = new Array(argc);

            for (var i = 0; i < argc; ++i) {
                args[i] = arguments[i];
            }

            var bak = log.log;
            try {
                log.log = console.log.bind(console);
                log.apply(null, args);
            }
            finally {
                try { console.stdout.uncork(); } catch (_) { }
                try { console.stderr.uncork(); } catch (_) { }
                log.log = bak;
            }
        };
    err.err = err;
    err.out = out;

    err.trace = function (title, error) {
        if (!error) {
            error = title;
            title = null;
        }

        title && err.err(colors.red(title));

        console.warn(error.print ? error.print() : (error.stack || error));
        try { console.stdout.uncork(); } catch (_) { }
        try { console.stderr.uncork(); } catch (_) { }
    };

    return err;
};
