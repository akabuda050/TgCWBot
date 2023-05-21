import dotenv from 'dotenv';
import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import { v4 } from 'uuid'
import crypto from 'crypto';

dotenv.config();
const bot = new Telegraf(process.env.BOT_API_KEY);

const loginForm = async (ctx) => {
  const msg = await ctx.sendMessage('Please login', {
    reply_markup: {
      inline_keyboard: [
        [
          { text: 'Login', web_app: {url: 'https://akabuda050.github.io/solana-wallet-tg?action=login'} },
          { text: 'Register',  web_app: {url: 'https://akabuda050.github.io/solana-wallet-tg?action=register'} },
        ],
      ]
    }
  });
}

bot.command('start', async (ctx) => {
  const message = await ctx.sendMessage('Welcome! 🙌');

  loginForm(ctx);
});

bot.command('stop', async (ctx) => {
  const message = await ctx.sendMessage('See you next time 🙌');

});

bot.on('callback_query', async (ctx) => {
  if (ctx.callbackQuery.data === 'login') {
  } else if (ctx.callbackQuery.data === 'register') {
  }
})

bot.on(message('text'), async (ctx) => {
  const message = await ctx.sendMessage('TBD');

});

bot.inlineQuery(['help'], async (ctx) => {
  const message = `Weclome to Telegram Wallet Bot!`;
  const result = [{
    type: "article",
    id: v4(),
    title: 'Help',
    description: 'Information on how to use bot',
    input_message_content: {
      message_text: message,
    },
    reply_markup: {
      inline_keyboard: [
        [
          { text: 'Start', url: 'https://t.me/TgCWBot?start=airplane' },
        ],
      ]
    }
  }];

  // Using context shortcut
  await ctx.answerInlineQuery(result, {
    cache_time: 1
  });
});

bot.launch();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

function encryptData(data, password) {
  const pass = String(password);

  const key = crypto.createHash('sha256').update(pass).digest();
  const nonce = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv('aes-256-ccm', key, nonce, { authTagLength: 16 });
  const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);

  // Get the authentication tag
  const authTag = cipher.getAuthTag();

  // Return the encrypted data, nonce, and authentication tag
  return {
    encryptedData: encrypted.toString('hex'),
    nonce: nonce.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

async function decryptData(encryptedData, nonce, authTag, password) {
  const pass = String((password));
  const key = crypto.createHash('sha256').update(pass).digest();

  const decipher = crypto.createDecipheriv('aes-256-ccm', key, Buffer.from(nonce, 'hex'), { authTagLength: 16 });

  // Set the authentication tag
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));

  const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedData, 'hex')), decipher.final()]);

  return decrypted.toString('utf8');
}

function countdown(seconds, stepCb, finishCb) {
  let interval = setInterval(function () {
    if (seconds === 0) {
      clearInterval(interval);

      if (typeof finishCb === 'function') {
        finishCb();
      }

      return;
    }

    seconds--;

    if (typeof stepCb === 'function') {
      stepCb(seconds, interval);
    }
  }, 1000);
}