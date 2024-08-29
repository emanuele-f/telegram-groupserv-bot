const config = {};

config.BOT_TOKEN = "YOUR_BOT_TOKEN_HERE";
config.BAN_BOTS = true;
config.VERIFY_HUMAN = true;
config.BAN_FORWARDED_CHANNEL = true;
config.DELETE_JOIN_MESSAGE = true;
config.WHITELISTED_BOT_IDS = {};
config.MAX_NEWUSER_AGE_SEC = 3600;
config.ACTIVE_USER_TIMEOUT = 86400;
config.AUTODELETE_TIMEOUT = 60;
config.ADMIN_IDS = [];
config.LOG_CHAT_IDS = [];
config.BLACKLISTED_CHANNELS = [];
config.WHITELISTED_CHANNELS = [];

// ban new users
config.SUSPICIOUS_WORDS = ["bitcoin", "ethereum", "crypto", "wallet"];

// ban new/inactive users
config.BLACKLISTED_WORDS = ["binance"];

// Automatically reply to messages matching the given regex
//  match: regex to match
//  msg_lang: language of the message to match - supported: cn (Chinese)
//  user_lang: matches the user language (currently via user names) - supported: cn (Chinese)
//  text: (string) the text to send
//  overwrite: (bool) if true, overwrite the original message
//  autoquote: (bool) if true, automatically quote the sender of the message
//  new_only: (bool) if true, only match the first message from a user
//  inactive_only: (bool) if true, only match the messages from an inactive user
//  silent: (bool) if true, the message will not generate a notification sound
//  auto_delete: (bool) if true, the message will automatically deleted (see AUTODELETE_TIMEOUT)
config.AUTO_REPLY = [
  // Auto-reply based on message
  { match:/^\s*((hello)|(hi))\s*$/gi, text:"Hi, how can we help?", new_only:true },

  // Welcome new users, optionally matching their language
  { user_lang: 'cn', text:"中文讨论移至此处： https://t.me/tnews365", new_only:true, silent:true, autoquote:true, autodelete:true },

  // Auto reply to inactive users, optionally matching their language
  { msg_lang: 'cn', text:"中文讨论移至此处： https://t.me/tnews365", overwrite:true, inactive_only:true, silent:true, autoquote:true, autodelete:true },

  // Custom commands
  { match:/^man!$/, text:"Check out the user manual: https://example.org", overwrite:true },
];

config.HELP = `You can use the following commands:
\`!man\` - link the user manual`;

module.exports = config;
