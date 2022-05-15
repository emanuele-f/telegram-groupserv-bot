/*
 * Emanuele Faranda - 2021
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston,
 * MA 02110-1301, USA.
 * 
 */

const { Telegraf, Markup, Composer } = require('telegraf');
const User = require('./user');

/* ************************************************** */

const new_users = {};     // uid -> User
const pending_users = {}; // uid -> User
const active_users = {};  // uid -> last_seen

/* ************************************************** */

const config = require((process.argv.length == 3) ? process.argv[2] : './config');

const bot = new Telegraf(config.BOT_TOKEN);
const admin = new Composer();
const user = new Composer();

console.debug = () => {}

/* ************************************************** */

admin.start((ctx) => ctx.reply(`[chatid=${ctx.chat.id}] BzzBzz.. up and running!`));

/*admin.help((ctx) => {
  ctx.replyWithMarkdown(`*Commands*
/pending get list of new/pending users`);
});*/

/* ************************************************** */

admin.command('pending', (ctx) => {
  // Run a periodic cleanup
  periodicCleanup();

  let reply = `*New Users*\n`;

  for(const user of Object.values(new_users)) {
    reply += `${user.getName()} (${user.id}) - ${(new Date(user.first_seen)).toLocaleString()}\n`;
  }

  reply += `\n*Pending Verification*\n`;

  for(const user of Object.values(pending_users)) {
    reply += `${user.getName()} (${user.id}) - ${(new Date(user.first_seen)).toLocaleString()}\n`;
  }

  ctx.replyWithMarkdown(reply);
});

/* ************************************************** */

admin.on('text', (ctx) => {
  // Overridden to avoid applying moderation to admins
});

/* ************************************************** */

async function verifyUser(ctx, user) {
  const msg = await ctx.reply(
    `Hi ${user.name}! Please click the button below.`,

    Markup.inlineKeyboard([
      Markup.button.callback('Confirm', 'user_confirm')
    ])
  );

  pending_users[user.id] = user;
}

/* ************************************************** */

async function logMessage(msg) {
  console.log(msg);

  // Notify to log chats
  for(let i=0; i<config.LOG_CHAT_IDS.length; i++) {
    const chatid = config.LOG_CHAT_IDS[i];

    // https://telegraf.js.org/classes/Telegram.html#sendMessage
    try {
      await bot.telegram.sendMessage(chatid, msg);
    } catch(e) {}
  }
}

/* ************************************************** */

async function notifyBannedUser(user, reason) {
  await logMessage(`Banned user ${user.str()}, reason: ${reason}`);
}

/* ************************************************** */

function periodicCleanup() {
  const now = (new Date()).getTime();
  const max_age = config.MAX_NEWUSER_AGE_SEC * 1000;
  const inactive_age = config.ACTIVE_USER_TIMEOUT * 1000;

  console.debug("Periodic cleanup running");

  for(const user of Object.values(new_users)) {
    if((now - user.first_seen) >= max_age) {
      console.log(`Purging old new_user: ${user.str()}`);
      delete new_users[user.id];
    }
  }

  for(const user of Object.values(pending_users)) {
    if((now - user.first_seen) >= max_age) {
      delete pending_users[user.id];
      //bot.telegram.kickChatMember(user.chat_id, user.id);
      logMessage(`user did not perform verification on time: ${user.str()}`);
    }
  }

  for(const uid of Object.keys(active_users)) {
    const last_seen = active_users[uid];

    if((now - last_seen) >= inactive_age) {
      console.debug(`Purging inactive user [uid=${uid}]`);
      delete active_users[uid];
    }
  }
}

/* ************************************************** */

function shouldBanBot(user) {
  return config.BAN_BOTS &&
      !config.WHITELISTED_BOT_IDS[user.id] &&
      (user.username !== "GroupAnonymousBot");
}

/* ************************************************** */

user.help((ctx) => {
  if(config.HELP)
    ctx.replyWithMarkdown(config.HELP);
});

/* ************************************************** */

user.action('user_confirm', (ctx) => {
  const btn_msg = ctx.callbackQuery.message;
  const uid = ctx.callbackQuery.from.id;

  ctx.answerCbQuery();
  const user = pending_users[uid];

  if(!user)
    return;

  console.log(`${user.str()} verified`);
  delete pending_users[uid];

  ctx.deleteMessage(btn_msg.message_id);

  active_users[uid] = (new Date()).getTime();
});

/* ************************************************** */

user.on('new_chat_members', (ctx) => {
  if(config.DELETE_JOIN_MESSAGE) {
    try {
      ctx.deleteMessage();
    } catch(e) {}
  }

  for(const new_user of ctx.message.new_chat_members) {
    const user = User.from_message(new_user, ctx.chat.id);

    console.log(`${user.str()} joined group`);

    if(user.is_bot) {
      if(shouldBanBot(user)) {
        console.log(`Banning bot ${user.str()}`);
        ctx.kickChatMember(user.id);
      }
    } else
      new_users[new_user.id] = user;
  }
});

/* ************************************************** */

user.on('left_chat_member', (ctx) => {
  const user = User.from_message(ctx.message.left_chat_member, ctx.chat.id);

  console.log(`${user.str()} left group`);

  if(config.DELETE_JOIN_MESSAGE) {
    try {
      ctx.deleteMessage();
    } catch(e) {}
  }

  delete new_users[user.id];
  delete pending_users[user.id];
});

/* ************************************************** */

function getBlacklistedWord(text, wordlist) {
  for(const word of wordlist) {
    const r = new RegExp("\\b" + word + "\\b", 'ig');

    if(text.match(r))
      return word;
  }

  return false;
}

/* ************************************************** */

function isBlacklistedChannel(channel) {
  return config.BLACKLISTED_CHANNELS.indexOf(channel) != -1;
}

/* ************************************************** */

function containsUrl(msg) {
  if(!msg.entities)
    return false;

  for(const entity of msg.entities) {
    if((entity.type === "url") || (entity.type === "text_link"))
      return true;
  }

  return false;
}

/* ************************************************** */

async function checkAutoreply(ctx, is_new) {
  const msg = ctx.message.text;

  for(const rinfo of config.AUTO_REPLY) {
    if((is_new || !rinfo.new_only) && msg.match(rinfo.match)) {
      console.debug(`Message matches a regex: ${msg}`);

      if(rinfo.text) {
        let txt = rinfo.text;

        if(rinfo.autoquote)
          txt = `@` + ctx.message.from.username + " " + txt;

        await ctx.replyWithMarkdown(txt, {disable_web_page_preview: true});
      }

      if(rinfo.overwrite)
        ctx.deleteMessage();

      break;
    }
  }
}

/* ************************************************** */

function banUnverifiedUser(user) {
  // If user has a pending verification (must click button), then ban him
  console.warn(`${user.str()} (unverified)] says: ${ctx.message.text}`);

  ctx.kickChatMember(user.id);
  notifyBannedUser(user, "sent another message without verifying");
  return;
}

/* ************************************************** */

user.on('text', (ctx) => {
  const uid = ctx.message.from.id;
  let user = null;
  let bl_word = null;
  let is_new_user = false;
  const is_inactive_user = !active_users[uid];
  const now = (new Date()).getTime();

  // Check message from pending-verification user
  if((user = pending_users[uid])) {
    ctx.deleteMessage();
    banUnverifiedUser(user);
    return;
  }

  // Check if user is new
  if((user = new_users[uid])) {
    const delta_s = Math.floor((now - user.first_seen) / 1000);
    console.log(`${user.str()} first message after ${delta_s}s: ${ctx.message.text}`);

    delete new_users[uid];
    is_new_user = true;
  } else
    user = User.from_message(ctx.message.from, ctx.chat.id);

  // Check message from bot
  if(user.is_bot) {
    if(shouldBanBot(user)) {
      console.log(`Banning bot ${user.str()}`);
      ctx.deleteMessage();
      ctx.kickChatMember(user.id);
    }

    // If bot is allowed, accept message
    return;
  }

  // Check blacklist
  if(!bl_word && is_new_user)
    bl_word = getBlacklistedWord(ctx.message.text, config.SUSPICIOUS_WORDS);

  if(!bl_word && is_inactive_user)
    bl_word = getBlacklistedWord(ctx.message.text, config.BLACKLISTED_WORDS);

  if(bl_word) {
    ctx.deleteMessage();
    ctx.kickChatMember(uid);
    notifyBannedUser(user, `sent blacklisted word "${bl_word}"`);
    return;
  }

  // Check for forwarded messages from channels
  const fwd_chat = ctx.message.forward_from_chat;

  if(fwd_chat && (fwd_chat.type === "channel")) {
    // This message was forwarded from a channel, very likely spam
    if(isBlacklistedChannel(fwd_chat.username)) {
      ctx.deleteMessage();
      ctx.kickChatMember(user.id);
      notifyBannedUser(user, `forwarded message from blacklisted channel @${fwd_chat.username}`);
      return;
    }

    const log_msg = `forwarded message from channel ${fwd_chat.title} (@${fwd_chat.username} ${fwd_chat.id}): ${ctx.message.text}`;

    if(config.BAN_FORWARDED_CHANNEL && !active_users[uid]) {
      ctx.deleteMessage();
      ctx.kickChatMember(user.id);
      notifyBannedUser(user, log_msg);
      return;
    } else // log anyway
      logMessage(`User ${user.str()} ${log_msg}`);
  }

  // Check for URLs
  if(is_inactive_user && containsUrl(ctx.message)) {
    console.log(`${user.str()} sent URL, starting verification`);
    ctx.deleteMessage();

    verifyUser(ctx, user);
    return;
  }

  // Valid message
  checkAutoreply(ctx, is_new_user);
  active_users[uid] = now;
});

/* ************************************************** */

// https://github.com/telegraf/telegraf/issues/441
bot.use(Composer.acl(config.ADMIN_IDS, admin));
bot.use(user);
bot.launch();

console.log("Bot started");

const periodicCleanup_t = setInterval(periodicCleanup, config.MAX_NEWUSER_AGE_SEC / 2 * 1000);
process.once('SIGINT', () => {bot.stop('SIGINT'); clearInterval(periodicCleanup_t);} )
process.once('SIGTERM', () => {bot.stop('SIGTERM'); clearInterval(periodicCleanup_t);} )
