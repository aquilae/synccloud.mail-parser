module.exports = function composeFactory(config, redis) {
    var log = $log('synccloud:mail-parser:compose');

    return function compose(data) {
        return $q(function (resolve, reject) {
            redis.database.set(dataKey(data.id), JSON.stringify(data), function (err) {
                if (err) {
                    log.trace('Failed to queue message `' + data.id + '` for composition:', err);
                    reject(err);
                }
                else {
                    redis.database.expire(dataKey(data.id), config.compose.timeout, function () {
                        redis.database.publish(composeEvent(), data.id);
                        resolve();
                    });
                }
            });
        }).fail(function (err) {
            log.trace('Failed to enqueue message ' + data.id + ' for composition:', err);
        });
    };

    function dataKey(id) {
        return config.compose.dataKey.replace('${id}', id);
    }

    function composeEvent() {
        return config.compose.composeEvent;
    }
};
