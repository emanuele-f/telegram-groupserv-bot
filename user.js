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

class User {
  constructor(id, is_bot, username, name, chat_id) {
    this.id = id;
    this.is_bot = is_bot;
    this.name = name;
    this.username = username;
    this.chat_id = chat_id;
    this.first_seen = (new Date()).getTime();
  }

  static from_message(msg, chat_id) {
    let name = msg.first_name;

    if(msg.last_name)
      name = name + " " + msg.last_name;

    return new User(msg.id, msg.is_bot, msg.username, name, chat_id)
  }

  getName() {
    return(this.username ? `@${this.username}` : this.name);
  }

  str() {
    return `${this.getName()} (${this.id})`;
  }
};

module.exports = User;
