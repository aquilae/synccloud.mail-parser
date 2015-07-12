var util = require('util'),
    events = require('events'),
    redis = require('redis');

module.exports = Redis;

util.inherits(Redis, events.EventEmitter);

function Redis(config) {
    this.readiness = 0;

    this.database = redis.createClient(config.redis.port, config.redis.host, config.redis);
    this.database.on('error', function (err) { this.emit('error', err); }.bind(this));
    this.database.on('end', function () { this.emit('end', this.database); }.bind(this));
    this.database.on('ready', function () {
        this.database.select(config.redis.database);
        (++this.readiness < 2) || this.emit('ready');
    }.bind(this));

    this.subscriber = redis.createClient(config.redis.port, config.redis.host, config.redis);
    this.subscriber.on('error', function (err) { this.emit('error', err); }.bind(this));
    this.subscriber.on('end', function () { this.emit('end', this.subscriber); }.bind(this));
    this.subscriber.on('ready', function () {
        this.subscriber.select(config.redis.database);
        (++this.readiness < 2) || this.emit('ready');
    }.bind(this));
}
