// A command learning plugin for IRC Node.

var fs = require('fs');
var path = require('path');
var irc = global.irc;

var config_path = (process.env.IRC_NODE_PATH || process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME'] + '/.ircnode');

var parsePhrase = function (phrase) {
  phrase = phrase.replace(/%nick/gi, irc.config.nick);
  phrase = phrase.replace(/%re/gi, '');
  return phrase;
};

var msgContainsPhrase = function (msg, phrase, strict) {
  phrase = phrase.replace(/%nick/gi, irc.config.nick);
  phrase = phrase.toLowerCase();
  if (phrase.indexOf('%re') !== -1) {
    while (phrase.indexOf('%re') !== -1) {
      var phrase1 = phrase.slice(0, phrase.indexOf('%re'));
      var phrasex = phrase.slice(phrase.indexOf('%re') + 3);
      var phrasere = phrasex.slice(0, phrasex.indexOf('%re'));
      var phrase2 = phrasex.slice(phrasex.indexOf('%re') + 3);
      try {
        var regexp = (phrasere.split('/').length > 1) ? (new RegExp(phrasere.split('/')[1], phrasere.split('/')[2])) : (new RegExp(phrasere, 'i'));
        phrase = phrase1 + phrase2;
        if (msg.indexOf(phrase1.trim()) === -1 || msg.indexOf(phrase2.trim()) === -1 || msg.search(regexp) === -1) {
          return false;
        }
        if (strict) {
          msg = msg.replace(phrase1.trim(), '').replace(phrase2.trim(), '').replace(regexp, '');
        }
    } catch (err) {
        console.log('WARNING: Unable to parse \'' + phrasere + '\' into a RegExp. Error: ' + err.message);
        return false;
      }
    }
    return strict ? msg.trim() === '' : true;
  } else {
    return strict ? msg === phrase : msg.indexOf(phrase) !== -1;
  }
};

if (!path.existsSync(config_path + '/know.json'))
  fs.writeFileSync(config_path + '/know.json', '{ "action": { }, "regular": { } }', 'utf8');
var know_dict = JSON.parse(fs.readFileSync(config_path + '/know.json', 'utf8'));
setInterval(function () {
  try {
    var new_dict = JSON.parse(fs.readFileSync(config_path + '/know.json', 'utf8'));
    know_dict = new_dict;
  } catch (err) {
    console.log('WARNING: Unable to update the "know" dictionary. Error: ' + err.message);
  }
}, 20000);

irc.emitter.on('PRIVMSG', function (data) {
  var msg = data.slice(data.indexOf(':') + 1).toLowerCase();
  var source = data.split(' ')[2];
  if (source === irc.config.nick)
    source = data.slice(0, data.indexOf('!'));

  if (data.slice(data.indexOf(':') + 1).substring(0, 7) === '\u0001ACTION' &&
      msg.substring(msg.length - 1, msg.length) === '\u0001') {
    msg = msg.substring(8, msg.length - 1);
    for (var valuea1 in know_dict.action)
      if (msgContainsPhrase(msg, valuea1, (know_dict.action[valuea1].strict === 'true')))
        irc.privmsg(source, know_dict.action[valuea1].response);
  } else if (msg.substring(0, irc.command_char.length + 6) !== irc.command_char + 'forget' &&
      msg.substring(0, irc.command_char.length + 5) !== irc.command_char + 'learn')
    for (var valuer1 in know_dict.regular)
      if (msgContainsPhrase(msg, valuer1, (know_dict.regular[valuer1].strict === 'true')))
        irc.privmsg(source, know_dict.regular[valuer1].response);
});

var learn_handler = function (act) {
  irc.check_level(act.nick, act.host, 'admin', function (is_admin) {
    if (is_admin) {
      var input = act.params.join(' ').split('"');
      if (input.length < 5)
        irc.privmsg(act.nick, 'USAGE: ' + irc.command_char + 'learn "LISTENER" "RESPONSE" [--flags]');
      else {
        var listener = input[1];
        var response = input[3];
        var flags = input[4].trim().split(' ');
        var dict_entry = { "response": response, "hidden": "false", "strict": "false" };
        for (var i in flags)
          switch (flags[i]) {
          case '--hidden':
            dict_entry.hidden = 'true';
            break;
          case '--strict':
            dict_entry.strict = 'true';
            break;
          default:
            break;
          }
        if (listener === '')
          irc.privmsg(act.nick, 'Unable to add an empty listener.');
        else if (response === '')
          irc.privmsg(act.nick, 'Unable to add an empty response.');
        else {
          if (listener.substring(0, 4) === '/me ') {
            know_dict.action[listener.substring(4, listener.length)] = dict_entry;
            irc.privmsg(act.nick, 'Added the "' + parsePhrase(listener) +  '" listener.');
            fs.writeFile(config_path + '/know.json', JSON.stringify(know_dict, null, 2), 'utf8');
          } else {
            know_dict.regular[listener] = dict_entry;
            irc.privmsg(act.nick, 'Added the "' + parsePhrase(listener) + '" listener.');
            fs.writeFile(config_path + '/know.json', JSON.stringify(know_dict, null, 2), 'utf8');
          }
        }
      }
    } else
      irc.privmsg(act.nick, 'Not authorized to modify responses.');
  });
};

var forget_handler = function (act) {
  irc.check_level(act.nick, act.host, 'admin', function (is_admin) {
    if (is_admin) {
      var listener = act.params.join(' ');
      if (listener === '')
        irc.privmsg(act.nick, 'USAGE: ' + irc.command_char + 'forget LISTENER');
      else {
        if (listener.substring(0, 4) === '/me ' && know_dict.action[listener.substring(4, listener.length)] !== undefined) {
          delete know_dict.action[listener.substring(4, listener.length)];
          irc.privmsg(act.nick, 'Deleted the "' + parsePhrase(listener) +  '" listener.');
          fs.writeFile(config_path + '/know.json', JSON.stringify(know_dict, null, 2), 'utf8');
        } else if (know_dict.regular[listener] !== undefined) {
          delete know_dict.regular[listener];
          irc.privmsg(act.nick, 'Deleted the "' + parsePhrase(listener) + '" listener.');
          fs.writeFile(config_path + '/know.json', JSON.stringify(know_dict, null, 2), 'utf8');
        } else
          irc.privmsg(act.nick, 'Could not find the "' + parsePhrase(listener) + '" listener.');
      }
    } else
      irc.privmsg(act.nick, 'Not authorized to modify responses.');
  });
};

var know_handler = function (act) {
  var output = [ 'Responses known to: ' ];
  for (var valuea2 in know_dict.action)
    if (know_dict.action[valuea2].hidden !== 'true')
      output[0] += '\'/me ' + parsePhrase(valuea2) + '\', ';
  for (var valuer2 in know_dict.regular)
    if (know_dict.regular[valuer2].hidden !== 'true')
      output[0] += '\'' + parsePhrase(valuer2) + '\', ';
  if (output[0] === 'Responses known to: ')
    irc.privmsg(act.nick, 'No known responses.');
  else {
    var loop = true;
    while (loop) {
      loop = false;
      for (var i in output) {
        if (output[i].length > 400) {
          if (output[parseInt(i, 10) + 1] === undefined)
            output[parseInt(i, 10) + 1] = '';
          while (output[i].length > 397) {
            var outArr = output[i].split(', ');
            output[parseInt(i, 10) + 1] = outArr.splice(outArr.length - 1, 1) + ', ' + output[parseInt(i, 10) + 1];
            output[i] = outArr.join(', ');
          }
          output[parseInt(i, 10) + 1] = '...' + output[parseInt(i, 10) + 1].slice(0, -4);
          output[i] += '...';
          loop = true;
        }
      }
    }
    irc.privmsg(act.nick, output[0]);
    var crntMsg = 0;
    var interid = setInterval(function () {
      crntMsg++;
      if (crntMsg < output.length)
        irc.privmsg(act.nick, output[crntMsg]);
      else
        clearInterval(interid);
    }, 3000);
  }
};

exports.name = 'learn';
exports.commands = {
  'learn': learn_handler,
  'forget': forget_handler,
  'know': know_handler
};
