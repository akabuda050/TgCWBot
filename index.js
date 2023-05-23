import dotenv from 'dotenv';
import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import { v4 } from 'uuid'
import * as web3 from '@solana/web3.js';

dotenv.config();

const bot = new Telegraf(process.env.BOT_API_KEY);

const solanaConnection = new web3.Connection('https://api.testnet.solana.com', 'confirmed');

const loginForm = async (ctx) => {
  const msg = await ctx.sendMessage('Please click Wallet to connect', {
    reply_markup: {
      resize_keyboard: true,
      keyboard: [
        [
          { text: 'Enable in-chat notifications', web_app: { url: 'https://akabuda050.github.io/solana-wallet-tg/?action=enable_notifications' } },
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

bot.on('web_app_data', async (ctx) => {
  console.log(ctx.message)

  if (ctx?.webAppData?.data) {
    try {
      const webAppData = ctx?.webAppData?.data.json();
      console.log(webAppData)

      ctx.reply(`Your Public Key: ${webAppData?.pubKey || ''}`)

      solanaConnection.onAccountChange(new web3.PublicKey(webAppData?.pubKey), () => {
        ctx.reply(`Noticed changes in wallet. Check your wallet.`)
      })

    } catch (e) {
      console.error(`WEB APP DATA: ${e}`);
    }
  }

})

bot.on(message('text'), async (ctx) => {
  if (ctx?.webAppData?.data) {
    try {

    } catch (e) {
      console.error(`WEB APP DATA: ${e}`);
    }
  } else {
    const message = await ctx.sendMessage('TBD');
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