import dotenv from 'dotenv';
import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import { v4 } from 'uuid'
import crypto from 'crypto';

dotenv.config();
const bot = new Telegraf(process.env.BOT_API_KEY);

bot.context.db = {
  step: 'login',
  password: null,
  enter_password_message_id: null,
  enter_private_key_message_id: null,
}

bot.command('deleteAll', async (ctx) => {
  let res = await ctx.reply('deleting');
  console.log(res);
  for (let i = res.message_id; i >= 0; i--) {
    console.log(`chat_id: ${ctx.chat.id}, message_id: ${i}`);
    try {
      let res = await ctx.telegram.deleteMessage(ctx.chat.id, i);
      console.log(res);
    } catch (e) {
      console.error('Message not found');
    }
  }
});

const loginForm = async (ctx) => {
  const msg = await ctx.sendMessage('Please login', {
    reply_markup: {
      inline_keyboard: [
        [
          { text: 'Login', callback_data: 'login' },
          { text: 'Register', callback_data: 'register' },
        ],
      ]
    }
  });

  countdown(3, null, () => {
    ctx.deleteMessage(msg.message_id).catch((e) => {
      console.log('Logged in error')
    })
  });
}

bot.start(async (ctx) => {
  ctx.db.step = 'login';
  ctx.deleteMessage();
  loginForm(ctx);
});

bot.command('stop', async (ctx) => {
  ctx.db.step = 'login';
  ctx.deleteMessage();
  loginForm(ctx);
});

bot.on('callback_query', async (ctx) => {
  if (ctx.callbackQuery.data === 'login') {
    await prompt(ctx, 'Enter your secret code 🗝️', 'enter_secret_code_message_id');
    ctx.db.step = 'secret_key';
  } else if (ctx.callbackQuery.data === 'register') {
    await prompt(ctx, 'Enter your password key 🗝️', 'enter_password_key_message_id');

    ctx.db.step = 'password_key';
  }
})


const prompt = async (ctx, prompt, db_message_id, seconds = 10) => {
  const message = await ctx.sendMessage(prompt);

  if (!seconds) {
    return;
  }

  ctx.db[db_message_id] = message.message_id;

  countdown(10, (seconds, interval) => {
    console.log(`Step: ${ctx.db[db_message_id]}`)
    if (!ctx.db[db_message_id]) {
      clearInterval(interval);

      return;
    }

    ctx.editMessageText(`${prompt} (${seconds}s)`, { message_id: ctx.db[db_message_id] }).then((message) => {
      ctx.db[db_message_id] = message.message_id;
    }).catch(() => {
      console.log(`Step Error: ${ctx.db[db_message_id]}`)
    });
  }, () => {
    ctx.deleteMessage(ctx.db[db_message_id]).then(() => {
      ctx.db[db_message_id] = null
    })
      .catch((e) => {
        console.log('deleteMessage error')
      })
  })
}

bot.on(message('text'), async (ctx) => {
  console.log(ctx.db.step)
  if (ctx.db.step === 'login') {
    loginForm(ctx);

    countdown(3, null, () => {
      ctx.deleteMessage(ctx.message.message_id).catch((e) => {
        console.log('Logged in error')
      })
    });
  } else if (ctx.db.step === 'password_key') {
    const wallet = crypto.randomBytes(32).toString('hex');

    const password = `${ctx.message.text}`;
    const encryptedPrivateKey = encryptData(wallet, password);

    console.log({ password, wallet, encryptedPrivateKey });
    const key = `${encryptedPrivateKey.encryptedData}_${encryptedPrivateKey.nonce}_${encryptedPrivateKey.authTag}`;

    // Using context shortcut
    await ctx.reply(`Copy key 📑`);
    await ctx.reply(`${key}`);

    ctx.db.step = 'wallet';
  }

  else if (ctx.db.step === 'private_key') {
    if (ctx.db.enter_private_key_message_id) {
      await ctx.deleteMessage(ctx.db.enter_private_key_message_id);
      ctx.db.enter_private_key_message_id = null;
    }

    // decrypt this wallet 7ba8094866a9600585c810afbad724e6d52f2aa7c7bebed1b146c756f8e3a1c9

    ctx.db.step = 'wallet';
  } else {
    ctx.deleteMessage(ctx.message.message_id).catch((e) => {
      console.log('Logged in error')
    })
  }
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

function decryptData(encryptedData, nonce, authTag, password) {
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