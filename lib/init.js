var promise = require('./config')(function (config) {
    return config;
}).then(function (config) {
    var svc = {};
    svc.redis = new (require('./redis'))(config);
    svc.redlock = new (require('redlock'))(config.redlock, svc.redis.database);
    svc.backend = require('./backend').create(config);
    svc.api = new (require('./api'))(svc.backend, svc.redis);
    svc.compose = require('./compose')(config, svc.redis);
    return [config, svc];
});

module.exports = function (callback) {
    return promise.spread(function (config, svc) {
        return callback(config, svc);
    });
};
