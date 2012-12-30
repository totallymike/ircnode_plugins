// A plugin for displaying the version of IRC Node.

var irc = global.irc;

function version_handler (act) {
  irc.privmsg(act.source, 'IRC Node ' + irc.version);
};

exports.name = 'version';
exports.hooks = { 'version': version_handler };
