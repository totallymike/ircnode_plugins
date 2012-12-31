// A command learning plugin for IRC Node.

var irc = global.irc;

function parsePhrase (phrase) {
  var parsedPhrase = phrase;
  var storagePhrase = phrase;

  var replacements = {
    '%NICK%': irc.config.nick
  };
  for (var str in replacements) {
    parsedPhrase = parsedPhrase.replace(new RegExp(str, 'g'), replacements[str]);
    storagePhrase = storagePhrase.replace(new RegExp(replacements[str], 'g'), str);
  }

  var userInputPhrase = parsedPhrase;

  if (phrase.substr(0, 8) === '\u0001ACTION ' && phrase.substr(-1) === '\u0001') {
    parsedPhrase = '/me ' + parsedPhrase.slice(8, -1).trim();
  } else if (phrase.substr(0, 4) === '/me ') {
    storagePhrase = '\u0001ACTION ' + storagePhrase.substr(4) + '\u0001';
    userInputPhrase = '\u0001ACTION ' + userInputPhrase.substr(4) + '\u0001';
  }

  return { 'parsed': parsedPhrase, 'storage': storagePhrase, 'user': userInputPhrase };
}

function msgContainsPhrase (msg, phrase, loosely) {
  msg = msg.toLowerCase();
  while (msg.substr(-2) === ' \u0001')
    msg = msg.slice(0, -2) + '\u0001';
  phrase = parsePhrase(phrase).user.toLowerCase();
  // TODO Check for regexps?
  return loosely ? msg.indexOf(phrase) !== -1 : msg === phrase;
}

function response_listener (act) {
  var msg = act.params.join(' ');

  for (var p in exports.store)
    if (msgContainsPhrase(msg, p, exports.store[p].loosely))
      irc.privmsg(act.source, exports.store[p].response);
}

function learn_handler (act) {
  irc.check_level(act.nick, act.host, 'admin', function (is_admin) {
    if (!is_admin) {
      irc.privmsg(act.nick, 'Not authorized to modify responses.');
      return;
    }

    var entry = { 'response': '', 'hidden': false, 'loosely': false };
    var msg = act.params.join(' ');
    if (msg.substr(0, 3) === '-- ')
      msg = ' ' + msg;

    msg = msg.split(' -- ');
    var flags = [];
    if (msg.length > 1)
      flags = msg.splice(0, 1)[0].trim().split(' ');
    msg = msg.join(' -- ').trim().split(';');
    var listener = msg.splice(0, 1)[0];
    entry.response = msg.join(';');

    if (listener === '' || entry.response === '') {
      irc.privmsg(act.nick, 'USAGE: ' + irc.command_char + 'learn [[-h] [-l] --] $LISTENER;$RESPONSE');
      return;
    }

    for (var i in flags)
      switch (flags[i]) {
      case '-h':
        entry.hidden = true;
        break;
      case '-l':
        entry.loosely = true;
        break;
      }

    var listenerInfo = parsePhrase(listener);
    exports.store[listenerInfo.storage] = entry;

    if (listenerInfo.parsed === listenerInfo.storage)
      irc.privmsg(act.nick, 'Added a listener for \'' + listenerInfo.parsed + '\'.');
    else
      irc.privmsg(act.nick, 'Added a listener for \'' + listenerInfo.parsed + '\' (stored as \'' + listenerInfo.storage + '\').');
  });
}

function forget_handler (act) {
  irc.check_level(act.nick, act.host, 'admin', function (is_admin) {
    if (!is_admin) {
      irc.privmsg(act.nick, 'Not authorized to modify responses.');
      return;
    }

    var listener = act.params.join(' ').trim();
    if (listener === '') {
      irc.privmsg(act.nick, 'USAGE: ' + irc.command_char + 'forget $LISTENER');
      return;
    }

    var listenerInfo = parsePhrase(listener);

    if (exports.store[listenerInfo.storage] !== undefined) {
      delete exports.store[listenerInfo.storage];
      if (listenerInfo.parsed === listenerInfo.storage)
        irc.privmsg(act.nick, 'Deleted the listener for \'' + listenerInfo.parsed + '\'.');
      else
        irc.privmsg(act.nick, 'Deleted the listener for \'' + listenerInfo.parsed + '\' (was stored as \'' + listenerInfo.storage + '\').');
    } else {
      irc.privmsg(act.nick, 'Could not find the listener for \'' + listener + '\'.');
    }
  });
}

function know_handler (act) {
  var output = [ 'Responses known to: ' ];
  for (var p in exports.store)
    if (!exports.store[p].hidden)
      output[0] += '\'' + parsePhrase(p).parsed + '\', ';

  if (output[0] === 'Responses known to: ') {
    irc.privmsg(act.nick, 'No known responses.');
    return;
  }

  output = [ output[0].substr(0, output[0].length - 2) ];
  var loop = true;
  while (loop) {
    loop = false;
    for (var currentMsg in output) {
      if (output[currentMsg].length > 400) {
        var nextMsg = parseInt(currentMsg, 10) + 1;
        if (output[nextMsg] === undefined)
          output[nextMsg] = '';
        while (output[currentMsg].length > 396) {
          var outArr = output[currentMsg].split(', ');
          output[nextMsg] = outArr.splice(outArr.length - 1) + ', ' + output[nextMsg];
          output[currentMsg] = outArr.join(', ');
        }
        output[nextMsg] = '... ' + output[nextMsg].substr(0, output[nextMsg].length - 2);
        output[currentMsg] += ' ...';
        loop = true;
      }
    }
  }

  var outputArray = function (array) {
    irc.privmsg(act.nick, array.pop());
    if (array.length > 0)
      setTimeout(outputArray, 3000, array);
  };
  outputArray(output.reverse());
}

exports.name = 'learn';
exports.hooks = {
  'PRIVMSG': response_listener,
  'learn': learn_handler,
  'forget': forget_handler,
  'know': know_handler
};
exports.store = {};
