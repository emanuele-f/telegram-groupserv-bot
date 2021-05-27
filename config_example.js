const config = {};

config.BOT_TOKEN = "YOUR_BOT_TOKEN_HERE";
config.BAN_BOTS = true;
config.DELETE_JOIN_MESSAGE = true;
config.WHITELISTED_BOT_IDS = {};
config.MAX_NEWUSER_AGE_SEC = 3600;
config.ADMIN_IDS = [];
config.BLACKLISTED_WORDS = ["bitcoin", "ethereum", "crypto", "binance", "wallet", "eth"];

// Automatically reply to messages matching the given regex
//  match: regex to match
//  text: (string) the text to send
//  overwrite: (bool) if true, overwrite the original message
//  autoquote: (bool) if true, automatically quote the sender of the message
config.AUTO_REPLY = [
  { match:/^\s*((hello)|(hi))\s*$/gi, text:"Hi, how can we help?" },
  { match:/^man!$/, text:"Check out the user manual: https://example.org", overwrite:true },
];

module.exports = config;
