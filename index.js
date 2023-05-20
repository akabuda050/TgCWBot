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
  ctx.db.private_key = null;
  ctx.db.step = 'login';

  ctx.deleteMessage();
  loginForm(ctx);
});

bot.on('callback_query', async (ctx) => {
  if (ctx.callbackQuery.data === 'login') {
    await prompt(ctx, 'Enter your secret code (10s) 🗝️', 'enter_secret_code_message_id');
    ctx.db.step = 'secret_code';
  } else if (ctx.callbackQuery.data === 'register') {
    await prompt(ctx, 'Enter your password (10s) 🗝️', 'enter_register_password_message_id');

    ctx.db.step = 'register';
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
    ctx.deleteMessage(ctx.message.message_id).catch((e) => {
      console.log('Logged in error')
    });
    loginForm(ctx);

  } else if (ctx.db.step === 'register') {
    if (ctx.db.enter_register_password_message_id) {
      ctx.deleteMessage(ctx.db.enter_register_password_message_id).catch((e) => {
        console.log('Logged in error')
      })
      ctx.db.enter_register_password_message_id = null;
    }

    ctx.deleteMessage(ctx.message.message_id).catch((e) => {
      console.log('Logged in error')
    })

    const wallet = crypto.randomBytes(32).toString('hex');

    const password = `${ctx.message.text}`;
    const encryptedPrivateKey = encryptData(wallet, password);

    console.log({ password, wallet, encryptedPrivateKey });
    const key = `${encryptedPrivateKey.encryptedData}_${encryptedPrivateKey.nonce}_${encryptedPrivateKey.authTag}`;

    // Using context shortcut

    await prompt(ctx, 'Copy key 📑', 'secret_key_copy_message_id');
    await prompt(ctx, `${key}`, 'secret_key_message_id');

    await ctx.reply(`Logged in.`);
    await ctx.reply(`Balance: 0`);

    ctx.db.private_key = key;
    ctx.db.step = 'wallet';
  } else if (ctx.db.step === 'secret_code') {
    if (ctx.db.enter_secret_code_message_id) {
      ctx.deleteMessage(ctx.db.enter_secret_code_message_id).catch((e) => {
        console.log('Logged in error')
      })

      ctx.db.enter_secret_code_message_id = null;
    }

    ctx.deleteMessage(ctx.message.message_id).catch((e) => {
      console.log('Logged in error')
    })

    ctx.db.private_key = `${ctx.message.text}`;
    ctx.db.step = 'secret_key_confirm';

    await prompt(ctx, 'Enter your password (10s) 🗝️', 'secret_key_confirm_message_id');
  } else if (ctx.db.step === 'secret_key_confirm') {
    if (ctx.db.secret_key_confirm_message_id) {
      ctx.deleteMessage(ctx.db.secret_key_confirm_message_id).catch((e) => {
        console.log('Logged in error')
      })

      ctx.db.secret_key_confirm_message_id = null;
    }
    ctx.deleteMessage(ctx.message.message_id).catch((e) => {
      console.log('Logged in error')
    })
    const params = ctx.db.private_key.split('_');
    const wallet = decryptData(params[0], params[1], params[2], ctx.message.text);
    if (wallet === 'ba68d72d8d3eebbc3e6dd69b4d5dc37a93c8974d8c0ff0ca4a9f61179e675485') {
      await ctx.reply(`Logged in.`);
      await ctx.reply(`Balance: 0`);
      ctx.db.step = 'wallet';

    } else {
      await ctx.reply(`Wrong`);

      ctx.db.private_key = null;
      ctx.db.step = 'login';
    }

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