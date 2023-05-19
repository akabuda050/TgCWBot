import dotenv from 'dotenv';
import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import { v4 } from 'uuid'

dotenv.config();
const bot = new Telegraf(process.env.API_KEY);

bot.context.db = {
  step: 'login',
  enter_password_message_id: null,
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
    ctx.db.step = 'password';

    const message = await ctx.sendMessage('Enter your password (10s)');
    ctx.db.enter_password_message_id = message.message_id;

    countdown(10, (seconds, interval) => {
      console.log(`Step: ${ctx.db.enter_password_message_id}`)
      if (!ctx.db.enter_password_message_id) {
        clearInterval(interval);

        return;
      }

      ctx.editMessageText(`Enter your password (${seconds}s)`, { message_id: ctx.db.enter_password_message_id }).then((message) => {
        ctx.db.enter_password_message_id = message.message_id;
      }).catch(() => {
        console.log(`Step Error: ${ctx.db.enter_password_message_id}`)
      });
    }, () => {
      ctx.deleteMessage(ctx.db.enter_password_message_id).then(() => {
        ctx.db.enter_password_message_id = null
      })
        .catch((e) => {
          console.log('callback_query error')
        })
    })
  }
})

bot.on(message('text'), async (ctx) => {
  console.log(ctx.db.step)
  if (ctx.db.step === 'login') {
    loginForm(ctx);

    countdown(3, null, () => {
      ctx.deleteMessage(ctx.message.message_id).catch((e) => {
        console.log('Logged in error')
      })
    });
  }
  else if (ctx.db.step === 'password') {
    ctx.db.step = 'wallet';

    await ctx.deleteMessage(ctx.db.enter_password_message_id);
    ctx.db.enter_password_message_id = null;

    // Using context shortcut
    const msg = await ctx.reply(`Logged in ${ctx.message.text}`);

    countdown(3, null, () => {
      ctx.deleteMessage(ctx.message.message_id).catch((e) => {
        console.log('Logged in error')
      })
    });

  } else if (ctx.db.step === 'wallet') {
    const msg = await ctx.reply(`TBD`);
  } else {
    
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