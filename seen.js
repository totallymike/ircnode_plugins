// A plugin for IRC Node for displaying the last statement or action seen from a specified user.

var irc = global.irc;

function msg_listener (act) {
  if (act.channel !== irc.config.nick) {
    if (exports.store[act.nick] === undefined)
      exports.store[act.nick] = {};
    exports.store[act.nick].time = new Date().toUTCString();
    exports.store[act.nick].msg = act.params.join(' ');
    exports.store[act.nick].channel = act.channel;
  }
}

function seen_listener (act) {
  if (act.channel === irc.config.nick) {
    irc.privmsg(act.source, 'As a security precaution, !seen has been deactivated for private messages. Please use the same command in a room in which the bot resides.');
    return;
  }

  var nick = act.params[0] ? act.params[0] : act.nick;
  if (exports.store[nick] === undefined) {
    irc.privmsg(act.source, 'Unknown nick: ' + nick);
    return;
  }
  var msg = exports.store[nick].msg;
  if (msg.substr(0, 8) === '\u0001ACTION ')
    msg = '***' + nick + msg.substr(7, -1);
  irc.privmsg(act.source, nick + ' last seen: ' + exports.store[nick].time + ' saying \'' + msg + '\' in ' + exports.store[nick].channel);
}

exports.name = 'seen';
exports.hooks = { 'PRIVMSG': msg_listener, 'seen': seen_listener };
exports.store = {};
