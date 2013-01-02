// A plugin to respond to CTCP requests for IRC Node.

var irc = global.irc;

function ctcp_listener (act) {
  var msg = act.params.join(' ');
  if (msg.substr(0, 1) !== '\u0001' || msg.substr(-1) !== '\u0001')
    return;
  msg = msg.substr(1, msg.length - 2).trim();

  var response = undefined;
  if (msg === 'VERSION')
    response = 'VERSION IRC Node ' + irc.version;
  else if (msg.substr(0, 4) === 'PING')
    response = msg;
  else if (msg === 'TIME')
    response = 'TIME :' + new Date().toUTCString();

  if (response !== undefined)
    irc.act({ action: 'NOTICE', params: [ act.nick ], longParam: '\u0001' + response + '\u0001' }, function () {});
}

exports.name = 'ctcp';
exports.hooks = { 'PRIVMSG': ctcp_listener };
