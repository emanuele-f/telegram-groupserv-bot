A bot to manage telegram groups. Only a single group at a time is supported!

# Features
  - Detect and ban possibly spamming users
  - Prevent user join/leave notifications
  - Automatic replies by regex match and/or detected language (only Chinese for now)
  - Welcome (silent) messages

# Requirements:
  - Bot must be an admin of the group
  - Disable bot group privacy: send `/setprivacy` to @BotFather
  - Disable join on other groups: send `/setjoingroups` to @BotFather

# Spam

Spammers are identified via the following methods:
  - Bots are banned unless whitelisted
  - An inactive user which posts a message containing some keywords (e.g. bitcoin, ethereum, crypto, binance, wallet) is banned
  - An inactive user which posts a message containing a link must be verified. A verification button is added to the group.
  - If a pending verification user sends another message without being first verified, he is banned
  - An inactive user which forwards messages from channels is banned

A user is inactive if he has not sent any message recently (see `ACTIVE_USER_TIMEOUT`).

# Useful references

https://telegraf.js.org/modules.html

https://github.com/ZenchainSoftware/telegram-bot-monitor

https://github.com/gdgpisa/gdgpisausermanager/blob/master/gdgpisausermanager.py
