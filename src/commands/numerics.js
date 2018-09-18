'use strict';

module.exports = {
    '001': 'RPL_WELCOME',
    '002': 'RPL_YOURHOST',
    '003': 'RPL_CREATED',
    '004': 'RPL_MYINFO',
    '005': 'RPL_ISUPPORT',
    '006': 'RPL_MAPMORE',
    '007': 'RPL_MAPEND',
    '008': 'RPL_SNOMASK',
    '015': 'RPL_MAP',
    '017': 'RPL_MAPEND',
    '200': 'RPL_TRACELINK',
    '201': 'RPL_TRACECONNECTING',
    '202': 'RPL_TRACEHANDSHAKE',
    '203': 'RPL_TRACEUNKNOWN',
    '204': 'RPL_TRACEOPERATOR',
    '205': 'RPL_TRACEUSER',
    '206': 'RPL_TRACESERVER',
    '207': 'RPL_TRACESERVICE',
    '208': 'RPL_TRACENEWTYPE',
    '209': 'RPL_TRACECLASS',
    '210': 'RPL_TRACERECONNECT',
    '211': 'RPL_STATSLINKINFO',
    '212': 'RPL_STATSCOMMANDS',
    '213': 'RPL_STATSCLINE',
    '214': 'RPL_STATSNLINE',
    '215': 'RPL_STATSILINE',
    '216': 'RPL_STATSKLINE',
    '217': 'RPL_STATSPLINE',
    '218': 'RPL_STATSYLINE',
    '219': 'RPL_ENDOFSTATS',
    '220': 'RPL_STATSBLINE',
    '221': 'RPL_UMODEIS',
    '222': 'RPL_SQLINE_NICK',
    '223': 'RPL_STATS_E',
    '224': 'RPL_STATS_D',
    '229': 'RPL_SPAMFILTER',
    '231': 'RPL_SERVICEINFO',
    '232': 'RPL_ENDOFSERVICES',
    '233': 'RPL_SERVICE',
    '234': 'RPL_SERVLIST',
    '235': 'RPL_SERVLISTEND',
    '241': 'RPL_STATSLLINE',
    '242': 'RPL_STATSUPTIME',
    '243': 'RPL_STATSOLINE',
    '244': 'RPL_STATSHLINE',
    '245': 'RPL_STATSSLINE',
    '246': 'RPL_STATSGLINE',
    '247': 'RPL_STATSXLINE',
    '248': 'RPL_STATSULINE',
    '249': 'RPL_STATSDEBUG',
    '250': 'RPL_STATSCONN',
    '251': 'RPL_LUSERCLIENT',
    '252': 'RPL_LUSEROP',
    '253': 'RPL_LUSERUNKNOWN',
    '254': 'RPL_LUSERCHANNELS',
    '255': 'RPL_LUSERME',
    '256': 'RPL_ADMINME',
    '257': 'RPL_ADMINLOC1',
    '258': 'RPL_ADMINLOC2',
    '259': 'RPL_ADMINEMAIL',
    '265': 'RPL_LOCALUSERS',
    '266': 'RPL_GLOBALUSERS',
    '290': 'RPL_HELPHDR',
    '291': 'RPL_HELPOP',
    '292': 'RPL_HELPTLR',
    '301': 'RPL_AWAY',
    '303': 'RPL_ISON',
    '304': 'RPL_ZIPSTATS',
    '305': 'RPL_UNAWAY',
    '306': 'RPL_NOWAWAY',
    '307': 'RPL_WHOISREGNICK',
    '310': 'RPL_WHOISHELPOP',
    '311': 'RPL_WHOISUSER',
    '312': 'RPL_WHOISSERVER',
    '313': 'RPL_WHOISOPERATOR',
    '314': 'RPL_WHOWASUSER',
    '315': 'RPL_ENDOFWHO',
    '317': 'RPL_WHOISIDLE',
    '318': 'RPL_ENDOFWHOIS',
    '319': 'RPL_WHOISCHANNELS',
    '320': 'RPL_WHOISSPECIAL',
    '321': 'RPL_LISTSTART',
    '322': 'RPL_LIST',
    '323': 'RPL_LISTEND',
    '324': 'RPL_CHANNELMODEIS',
    '328': 'RPL_CHANNEL_URL',
    '329': 'RPL_CREATIONTIME',
    '330': 'RPL_WHOISACCOUNT',
    '331': 'RPL_NOTOPIC',
    '332': 'RPL_TOPIC',
    '333': 'RPL_TOPICWHOTIME',
    '335': 'RPL_WHOISBOT',
    '338': 'RPL_WHOISACTUALLY',
    '341': 'RPL_INVITING',
    '344': 'RPL_WHOISCOUNTRY',
    '346': 'RPL_INVITELIST',
    '347': 'RPL_ENDOFINVITELIST',
    '352': 'RPL_WHOREPLY',
    '353': 'RPL_NAMEREPLY',
    '364': 'RPL_LINKS',
    '365': 'RPL_ENDOFLINKS',
    '366': 'RPL_ENDOFNAMES',
    '367': 'RPL_BANLIST',
    '368': 'RPL_ENDOFBANLIST',
    '369': 'RPL_ENDOFWHOWAS',
    '371': 'RPL_INFO',
    '372': 'RPL_MOTD',
    '374': 'RPL_ENDINFO',
    '375': 'RPL_MOTDSTART',
    '376': 'RPL_ENDOFMOTD',
    '378': 'RPL_WHOISHOST',
    '379': 'RPL_WHOISMODES',
    '381': 'RPL_NOWOPER',
    '396': 'RPL_HOSTCLOAKING',
    '401': 'ERR_NOSUCHNICK',
    '402': 'ERR_NOSUCHSERVER',
    '404': 'ERR_CANNOTSENDTOCHAN',
    '405': 'ERR_TOOMANYCHANNELS',
    '406': 'ERR_WASNOSUCHNICK',
    '421': 'ERR_UNKNOWNCOMMAND',
    '422': 'ERR_NOMOTD',
    '423': 'ERR_NOADMININFO',
    '432': 'ERR_ERRONEOUSNICKNAME',
    '433': 'ERR_NICKNAMEINUSE',
    '441': 'ERR_USERNOTINCHANNEL',
    '442': 'ERR_NOTONCHANNEL',
    '443': 'ERR_USERONCHANNEL',
    '451': 'ERR_NOTREGISTERED',
    '461': 'ERR_NOTENOUGHPARAMS',
    '464': 'ERR_PASSWDMISMATCH',
    '470': 'ERR_LINKCHANNEL',
    '471': 'ERR_CHANNELISFULL',
    '472': 'ERR_UNKNOWNMODE',
    '473': 'ERR_INVITEONLYCHAN',
    '474': 'ERR_BANNEDFROMCHAN',
    '475': 'ERR_BADCHANNELKEY',
    '481': 'ERR_NOPRIVILEGES',
    '482': 'ERR_CHANOPRIVSNEEDED',
    '483': 'ERR_CANTKILLSERVER',
    '484': 'ERR_ISCHANSERVICE',
    '485': 'ERR_ISREALSERVICE',
    '491': 'ERR_NOOPERHOST',
    '670': 'RPL_STARTTLS',
    '671': 'RPL_WHOISSECURE',
    '900': 'RPL_SASLAUTHENTICATED',
    '903': 'RPL_SASLLOGGEDIN',
    '904': 'ERR_SASLNOTAUTHORISED',
    '906': 'ERR_SASLABORTED',
    '907': 'ERR_SASLALREADYAUTHED',
    '972': 'ERR_CANNOTDOCOMMAND',
    'WALLOPS': 'RPL_WALLOPS'
};
