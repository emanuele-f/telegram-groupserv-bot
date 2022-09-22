const config = {};

config.BOT_TOKEN = "YOUR_BOT_TOKEN_HERE";
config.BAN_BOTS = true;
config.VERIFY_HUMAN = true;
config.BAN_FORWARDED_CHANNEL = true;
config.DELETE_JOIN_MESSAGE = true;
config.WHITELISTED_BOT_IDS = {};
config.MAX_NEWUSER_AGE_SEC = 3600;
config.ACTIVE_USER_TIMEOUT = 86400;
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
//  text: (string) the text to send
//  overwrite: (bool) if true, overwrite the original message
//  autoquote: (bool) if true, automatically quote the sender of the message
//  new_only: (bool) if true, only match the first message from a user
config.AUTO_REPLY = [
  { match:/^\s*((hello)|(hi))\s*$/gi, text:"Hi, how can we help?", new_only:true },
  { match:/^man!$/, text:"Check out the user manual: https://example.org", overwrite:true },
];

config.HELP = `You can use the following commands:
\`!man\` - link the user manual`;

module.exports = config;
