(function () {
    "use strict";

    var Promise = require('bluebird/js/main/promise')();
    Promise.longStackTraces();

    Promise.prototype.fail = function (rejected) {
        return this.error(rejected);
    };

    var $q = function (callback) {
        return new Promise(callback);
    };

    for (var key in Promise) {
        //noinspection JSUnfilteredForInLoop
        $q[key] = Promise[key];
    }
    $q.prototype = Promise.prototype;

    $q.when = function (value) {
        return $q.resolve(value);
    };

    module.exports = $q;
})();
