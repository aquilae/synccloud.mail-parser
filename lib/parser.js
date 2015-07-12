var log = $log('synccloud:mail-parser:parser'),
    util = require('util'),
    events = require('events');

module.exports = MailParser;

util.inherits(MailParser, events.EventEmitter);

_.extendOwn(MailParser, {
    create: function (config) {
        return new MailParser(
            config.taskAddress,
            config.replyAddress,
            config.replyWatermarkText
        );
    }
});

_.extendOwn(MailParser.prototype, {
    parseTaskLetter: function (letter) {
        var parsed = extractMarkers(textToLines(
                letter.text || htmlToText(letter.html) || ''), 'task'),
            markers = parsed.markers,
            lines = parsed.lines,
            task = {
                name: letter.subject || '',
                creator: letter.from,
                executor: letter.to[1],
                observers: letter.cc || [],
                description: {
                    text: lines.join('\n').trim()
                },
                attachments: letter.attachments
            };

        this.emit('task', _.extendOwn(letter, {markers: markers, task: task}));
    },

    parseReplyLetter: function (letter, token) {
        var parsed = extractMarkers(cropLines(textToLines(
                    letter.text || htmlToText(letter.html) || ''),
                        this.replyWatermarkText), 'reply'),
            uid = letter.uid,
            markers = parsed.markers,
            lines = parsed.lines,
            reply = {
                token: token,
                sender: letter.from[0],
                recipient: letter.to[1],
                observers: (letter.cc || []),
                text: lines.join('\n').trim(),
                html: null,
                attachments: letter.attachments
            };

        this.emit('reply', _.extendOwn(letter, {markers: markers, reply: reply}));
    }
});

function MailParser(replyWatermarkText) {
    this.replyWatermarkText = replyWatermarkText;
}


function escapeRegExp(str) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}


// parsing functions

function extractMarkers(lines, options) {
    var markers = {};
    options || (options = []);

    if (options === 'task') {
        options = ['expiresAt', 'assign'];
    }
    else if (options === 'reply') {
        options = ['expiresAt', 'assign', 'state'];
    }

    lines = lines.filter(function (line) {
        var upper = line.toUpperCase();
        if (options.indexOf('expiresAt') >= 0) {
            if (upper.indexOf('#DEADLINEMM-DD-YY') === 0) {
                markers.expiresAt = line.substr('#DEADLINEMM-DD-YY'.length).trim();
                return false;
            }
        }
        if (options.indexOf('assign') >= 0) {
            if (upper.indexOf('#ASSIGN') === 0) {
                markers.executor = line.substr('#ASSIGN'.length).trim();
                return false;
            }
        }
        if (options.indexOf('state') >= 0) {
            if (upper.indexOf('#REOPEN') === 0) {
                markers.state = 'opened';
                return false;
            }
            if (upper.indexOf('#WORK') === 0) {
                markers.state = 'inWork';
                return false;
            }
            if (upper.indexOf('#DONE') === 0) {
                markers.state = 'completed';
                return false;
            }
            if (upper.indexOf('#ARCHIVE') === 0) {
                markers.state = 'closed';
                return false;
            }
            if (upper.indexOf('#ARCHIVED') === 0) {
                markers.state = 'closed';
                return false;
            }
        }
        return true;
    });
    return {lines: lines, markers: markers};
}

function cropLines(lines, replyWatermarkText) {
    var result = [], line, i, ii;
    for (i = 0, ii = lines.length; i < ii; ++i) {
        line = lines[i];
        if (line.indexOf(replyWatermarkText) >= 0) {
            return result;
        }
        result.push(line);
    }
    return result;
}

function textToLines(text) {
    return text.split(/(\r\n|[\n\v\f\r\x85\u2028\u2029])/);
}

function htmlToText(html) {
    if (html.indexOf('<body') < 0) {
        html = '<p>' + html + '</p>';
    }

    var inlineTags = [
        'span', 'font', 'i', 'b', 'big',
        'em', 'strong', 'small', 'a',
        'tt', 'abbr', 'acronym', 'cite',
        'code', 'dfn', 'kbd', 'samp', 'var',
        'bdo', 'img', 'q', 'sub', 'sup',
        'button', 'label', 'textarea'
    ];

    var $ = require('cheerio').load(html);
    return recurse($($('*')[0])).join('\n');

    function recurse(container) {
        var lines = [];
        container.contents().each(function (idx, ele) {
            var $ele = $(ele);
            if (ele.type !== 'text') {
                if ($ele.is('p')) {
                    lines.push('');
                }
                else if (lines.length > 0) {
                    for (var i = 0, ii = inlineTags.length; i < ii; ++i) {
                        if ($ele.is(inlineTags[i])) {
                            return lines[lines.length - 1] += ' ' + ($ele.text() ? $ele.text().trim() : '');
                        }
                    }
                }
                recurse($(ele)).forEach(function (line) {
                    lines.push(line ? line.trim() : '');
                });
            }
            else {
                lines.push($ele.text() ? $ele.text().trim() : '');
            }
        });
        return lines;
    }
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
