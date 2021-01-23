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
const config = require('./config');
const User = require('./user');

/* ************************************************** */

const new_users = {};
const pending_users = {};

/* ************************************************** */

const bot = new Telegraf(config.BOT_TOKEN);
const admin = new Composer();
const user = new Composer();

/* ************************************************** */

admin.start((ctx) => ctx.reply('BzzBzz.. hi!'));

admin.help((ctx) => {
  ctx.reply(`*Commands*
/pending get list of new/pending users`);
});

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

async function verifyUser(ctx, user) {
  const msg = await ctx.reply(
    `Welcome ${user.name}! Please click the button below.`,

    Markup.inlineKeyboard([
      Markup.button.callback('Confirm', 'user_confirm')
    ])
  );

  pending_users[user.id] = user;
}

/* ************************************************** */

function periodicCleanup() {
  const now = (new Date()).getTime();
  const max_age = config.MAX_NEWUSER_AGE_SEC * 1000;

  console.log("Periodic cleanp running");

  for(const user of Object.values(new_users)) {
    if((now - user.first_seen) >= max_age) {
      console.log(`Purging old new_user: ${user.str()}`);
      delete new_users[user.id];
    }
  }

  for(const user of Object.values(pending_users)) {
    if((now - user.first_seen) >= max_age) {
      console.log(`Pending_user not verified: ${user.str()}`);
      delete pending_users[user.id];

      console.log(`Banning user ${user.str()}`);
      user.ctx.kickChatMember(user.id);
    }
  }
}

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
});

/* ************************************************** */

user.on('new_chat_members', (ctx) => {
  if(config.DELETE_JOIN_MESSAGE) {
    try {
      ctx.deleteMessage();
    } catch(e) {}
  }

  for(const new_user of ctx.message.new_chat_members) {
    const user = User.from_message(new_user, ctx);

    console.log(`${user.str()} joined group`);

    if(user.is_bot && config.BAN_BOTS) {
      if(config.WHITELISTED_BOT_IDS[user.id])
        return;
      else {
        console.log(`Banning bot ${user.str()}`);
        ctx.kickChatMember(user.id);
      }
    }

    new_users[new_user.id] = user;
  }
});

/* ************************************************** */

user.on('left_chat_member', (ctx) => {
  const user = User.from_message(ctx.message.left_chat_member, ctx);

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

function containsBlacklisted(text) {
  for(const word of config.BLACKLISTED_WORDS) {
    const r = new RegExp("\\b" + word + "\\b", 'ig');

    if(text.match(r))
      return true;
  }

  return false;
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

user.on('text', (ctx) => {
  const uid = ctx.message.from.id;
  let user = pending_users[uid];

  if(user) {
    console.warn(`${user.str()} (unverified)] says: ${ctx.message.text}`);
    ctx.deleteMessage();

    console.log(`Banning user ${user.str()}`);
    ctx.kickChatMember(uid);
    return;
  }

  user = new_users[uid];

  if(!user)
    return;

  const now = (new Date()).getTime();
  const delta_s = Math.floor((now - user.first_seen) / 1000);

  console.log(`${user.str()} first message after ${delta_s}s: ${ctx.message.text}`);

  // user is not new anymore
  delete new_users[uid];

  if(containsBlacklisted(ctx.message.text)) {
    console.log(`${user.str()} sent a blacklisted word`);
    ctx.deleteMessage();

    console.log(`Banning user ${user.str()}`);
    ctx.kickChatMember(uid);
    return;
  }

  if(containsUrl(ctx.message)) {
    console.log(`${user.str()} sent URL, starting verification`);
    ctx.deleteMessage();

    verifyUser(ctx, user);
    return;
  }
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
