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
const { isSimplifiedChinese } = require('./is_chinese.js')
const User = require('./user');

/* ************************************************** */

const new_users = {};     // uid -> User
const pending_users = {}; // uid -> {User, message_id, chat_id, orig_message}
const active_users = {};  // uid -> last_seen
const msgs_to_delete = []; // list of {deadline, message_id, chat_id}
let autodeleteMsgs_t = null;

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

  for(const pending of Object.values(pending_users)) {
    const user = pending.user;

    reply += `${user.getName()} (${user.id}) - ${(new Date(user.first_seen)).toLocaleString()}\n`;
  }

  ctx.replyWithMarkdown(reply);
});

/* ************************************************** */

admin.on('text', (ctx) => {
  // Overridden to avoid applying moderation to admins
  checkAutoreply(ctx, null, false, false);
});

/* ************************************************** */

async function verifyUser(ctx, user, orig_message) {
  const msg = await ctx.reply(
    `Hi ${user.name}! Please click the button below.`,

    Markup.inlineKeyboard([
      Markup.button.callback('Confirm', 'user_confirm')
    ]), {disable_notification: true}
  );

  pending_users[user.id] = {
    user: user,
    message_id: msg.message_id,
    chat_id: msg.chat && msg.chat.id,
    orig_message: orig_message,
  };
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

  for(const pending of Object.values(pending_users)) {
    const user = pending.user;

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
  const pending = pending_users[uid];

  if(!pending)
    return;

  const user = pending.user;

  console.log(`${user.str()} verified`);
  delete pending_users[uid];

  ctx.deleteMessage(btn_msg.message_id);

  active_users[uid] = (new Date()).getTime();

  if (pending.orig_message) {
    // Send back the original message
    const msg = "Original message from " + user.getName() + ": " + pending.orig_message;
    ctx.reply(msg, {disable_web_page_preview: true});
  }
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
    } else {
      new_users[new_user.id] = user;
      checkAutoreply(ctx, user, true, false);
    }
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

  // delete the verification message, if any
  const pending = pending_users[user.id];
  if (pending && pending.chat_id && pending.message_id)
    bot.telegram.deleteMessage(pending.chat_id, pending.message_id);

  delete new_users[user.id];
  delete pending_users[user.id];
  delete active_users[user.id];
});

/* ************************************************** */

function checkForInvisibleChars(wordlist) {
  for(const word of wordlist) {
    if (word.match(/\uFE0F/g))
      console.warn(`Invisible character present in wordlist: ${word}`)
  }
}

/* ************************************************** */

function getBlacklistedWord(text, wordlist) {
  for(const word of wordlist) {
    if (word.startsWith('@') || isSimplifiedChinese(word)) {
      // word matching is hard with Chinese, use just a contains check
      // also @ (e.g. for channel names) does not play well with word boundaries
      if (text.includes(word))
        return word;
    } else {
      const r = new RegExp("\\b" + word + "\\b", 'ig');

      if(text.match(r))
        return word;
    }
  }
}

/* ************************************************** */

function isBlacklistedChannel(channel) {
  return config.BLACKLISTED_CHANNELS.indexOf(channel) != -1;
}

/* ************************************************** */

function msgNeedsVerification(msg) {
  if(!msg.entities)
    return false;

  for (const entityArray of [msg.entities, msg.caption_entities]) {
    if (!entityArray)
      continue;

    for(const entity of entityArray) {
      if((entity.type === "url") || (entity.type === "text_link") || (entity.type === "mention"))
        return true;
    }
  }

  return false;
}

/* ************************************************** */

async function autodeleteMsgs(delete_all) {
  const now = Date.now();

  if (autodeleteMsgs_t) {
    clearTimeout(autodeleteMsgs_t);
    autodeleteMsgs_t = null;
  }

  let i = 0;

  while ((i < msgs_to_delete.length) &&
    (delete_all || (msgs_to_delete[i].deadline <= now))
  ) {
    const msg = msgs_to_delete[i];
    await bot.telegram.deleteMessage(msg.chat_id, msg.message_id);
    i++;
  }

  if (i > 0) {
    console.debug(`Auto-deleted ${i} messages`);
    msgs_to_delete.splice(0, i);
  }

  if (msgs_to_delete.length > 0)
    autodeleteMsgs_t = setTimeout(autodeleteMsgs, now - msgs_to_delete[0].deadline);
}

/* ************************************************** */

async function checkAutoreply(ctx, user, is_new, is_inactive) {
  const msg = (ctx.message && ctx.message.text) ? ctx.message.text : "";

  for(const rinfo of config.AUTO_REPLY) {
    if((is_new || !rinfo.new_only) &&
        (is_inactive || !rinfo.inactive_only) &&
        (!rinfo.match || msg.match(rinfo.match)) &&
        (!rinfo.msg_lang || (rinfo.msg_lang === "cn" && isSimplifiedChinese(msg))) &&
        (!rinfo.user_lang || (rinfo.user_lang === "cn" && user && isSimplifiedChinese(user.name)))
    ) {
      console.debug(`Message matches a regex: ${msg}`);

      if(rinfo.text) {
        const extras = {disable_web_page_preview: true};
        let txt = rinfo.text;

        if (rinfo.silent)
          extras.disable_notification = true;

        if(rinfo.autoquote)
          txt = User.from_message(ctx.message.from).getName() + " " + txt;
        else {
          const reply_to = ctx.message.reply_to_message;
          if(reply_to)
            extras.reply_to_message_id = reply_to.message_id;
        }

        const reply = await ctx.replyWithMarkdown(txt, extras);

        if(rinfo.autodelete && (config.AUTODELETE_TIMEOUT > 0) && reply && reply.chat) {
          if (msgs_to_delete.length === 0)
            autodeleteMsgs_t = setTimeout(autodeleteMsgs, config.AUTODELETE_TIMEOUT * 1000);

          msgs_to_delete.push({
            deadline: Date.now() + config.AUTODELETE_TIMEOUT * 1000,
            message_id: reply.message_id,
            chat_id: reply.chat.id
          });
        }
      }

      if(rinfo.overwrite)
        ctx.deleteMessage();

      break;
    }
  }
}

/* ************************************************** */

const handleMessage = (ctx) => {
  const uid = ctx.message.from.id;
  let user = null;
  let bl_word = null;
  let is_new_user = false;
  const is_inactive_user = !active_users[uid];
  const now = (new Date()).getTime();
  const text = ctx.message.text || ctx.message.caption || "";

  // Check message from pending-verification user
  if((pending = pending_users[uid])) {
    const user = pending.user;

    // delete its messages until he is verified
    console.log(`${user.str()} (unverified)] says: ${text}`);
    ctx.deleteMessage();
    return;
  }

  // Check if user is new
  if((user = new_users[uid])) {
    const delta_s = Math.floor((now - user.first_seen) / 1000);
    console.log(`${user.str()} first message after ${delta_s}s: ${text}`);

    delete new_users[uid];
    is_new_user = true;
  } else
    user = User.from_message(ctx.message.from, ctx.chat.id);

  // Check message from bot
  if(user.is_bot) {
    if (user.username === "Channel_Bot") {
      // Message posted by a channel
      const sender_chat = ctx.message.sender_chat;
      console.log(`Banning ${sender_chat.type} ${sender_chat.title} - ${sender_chat.username} (${sender_chat.id})`);

      ctx.deleteMessage();
      ctx.banChatSenderChat(sender_chat.id);
    } else if(shouldBanBot(user)) {
      console.log(`Banning bot ${user.str()}`);
      ctx.deleteMessage();
      ctx.kickChatMember(user.id);
    }

    // If bot is allowed, accept message
    return;
  }

  if (config.DEBUG_MESSAGES)
    console.log(JSON.stringify(ctx.message, null, 2));

  // Check blacklist
  if(!bl_word && is_new_user)
    bl_word = getBlacklistedWord(text, config.SUSPICIOUS_WORDS);

  if(!bl_word && is_inactive_user)
    bl_word = getBlacklistedWord(text, config.BLACKLISTED_WORDS);

  if(bl_word) {
    ctx.deleteMessage();
    ctx.kickChatMember(uid);
    notifyBannedUser(user, `sent blacklisted word "${bl_word}"`);
    return;
  }

  // Check for forwarded messages from channels
  let fwd_chat = ctx.message.forward_from_chat;
  if (!fwd_chat && ctx.message.external_reply)
    // Check for the "external reply" trick to bypass forwards detection
    fwd_chat = ctx.message.external_reply.chat

  if(fwd_chat && (fwd_chat.type !== "private")) { // channel, group, supergroup
    if(config.WHITELISTED_CHANNELS.indexOf(fwd_chat.username) != -1)
      return;

    // This message was forwarded from a channel, very likely spam
    if(isBlacklistedChannel(fwd_chat.username)) {
      ctx.deleteMessage();
      ctx.kickChatMember(user.id);
      notifyBannedUser(user, `forwarded message from blacklisted channel/group @${fwd_chat.username}`);
      return;
    }

    const log_msg = `forwarded message from channel/group ${fwd_chat.title} (@${fwd_chat.username} ${fwd_chat.id}): ${text}`;

    if(config.BAN_FORWARDED_CHANNEL && !active_users[uid]) {
      if(uid != "777000") /* Telegram */ {
        ctx.deleteMessage();
        ctx.kickChatMember(user.id);
        notifyBannedUser(user, log_msg);
      }
      return;
    } else // log anyway
      logMessage(`User ${user.str()} ${log_msg}`);
  }

  // Check for URLs
  if(config.VERIFY_HUMAN &&
     is_inactive_user &&
     (!user.username || !config.WHITELISTED_USERS[user.username]) &&
     msgNeedsVerification(ctx.message))
  {
    console.log(`${user.str()} sent URL, starting verification`);

    verifyUser(ctx, user, text);
    ctx.deleteMessage();
    return;
  }

  // Valid message
  checkAutoreply(ctx, user, is_new_user, is_inactive_user);
  active_users[uid] = now;
};

// https://telegraf.js.org/classes/Telegraf-1.html#on.on-2
user.on('text', handleMessage);
user.on('photo', handleMessage);
user.on('video', handleMessage);
user.on('video_note', handleMessage);
user.on('voice', handleMessage);
user.on('document', handleMessage);
user.on('story', handleMessage);

/* ************************************************** */

checkForInvisibleChars(config.SUSPICIOUS_WORDS)
checkForInvisibleChars(config.BLACKLISTED_WORDS)

// https://github.com/telegraf/telegraf/issues/441
bot.use(Composer.acl(config.ADMIN_IDS, admin));
bot.use(user);
bot.launch();

console.log("Bot started");

const periodicCleanup_t = setInterval(periodicCleanup, config.MAX_NEWUSER_AGE_SEC / 2 * 1000);
process.once('SIGINT', () => {bot.stop('SIGINT'); clearInterval(periodicCleanup_t); autodeleteMsgs(true); } )
process.once('SIGTERM', () => {bot.stop('SIGTERM'); clearInterval(periodicCleanup_t); autodeleteMsgs(true); } )
