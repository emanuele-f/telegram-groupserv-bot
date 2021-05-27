A bot to manage telegram groups. Only a single group at a time is supported!

# Features
  - Detect and ban possibly spamming users
  - Prevent user join/leave notifications
  - Automatic replies by regex match

# Requirements:
  - Bot must be an admin of the group
  - Disable bot group privacy: send `/setprivacy` to @BotFather
  - Disable join on other groups: send `/setjoingroups` to @BotFather

# Spam

Spammers are identified via the following methods:
  - Bots are banned unless whitelisted
  - A new user which posts a message containing some keywords (e.g. bitcoin, ethereum, crypto, binance, wallet)
    is banned.
  - A new user which posts a message containing a link must be verified. A verification button is added to the group.
  - If a pending verifiation user sends another message without being first verified, or if he is not verified on time, he is banned.

# Useful references

https://github.com/ZenchainSoftware/telegram-bot-monitor

https://github.com/gdgpisa/gdgpisausermanager/blob/master/gdgpisausermanager.py
