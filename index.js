import dotenv from 'dotenv';
import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import { v4 } from 'uuid'
import * as web3 from '@solana/web3.js';

dotenv.config();

const bot = new Telegraf(process.env.BOT_API_KEY);

bot.context.db = {
  ClientSubscriptionId: null,
}


const solanaConnection = new web3.Connection('https://api.testnet.solana.com', 'confirmed');

async function getHistory(connection, publicKey, options = { limit: 5, before: undefined }) {
  const transactions = await connection.getConfirmedSignaturesForAddress2(publicKey, options);
  const mappedTransactions = await Promise.all(transactions.map(async (t) => {
    const trans = await getTransaction(connection, t.signature);
    console.log(trans);
    const account = trans?.transaction.message.getAccountKeys();

    const itsMine = account?.get(0)?.toBase58() === publicKey.toBase58();

    const preBalance = itsMine ? trans?.meta?.preBalances[0] : trans?.meta?.preBalances[1] || 0;
    const postBalance = itsMine ? trans?.meta?.postBalances[0] : trans?.meta?.postBalances[1] || 0;

    return {
      tsig: t.signature,
      balance: postBalance,
      amount: itsMine ? preBalance - postBalance : postBalance - preBalance,
      accounts: trans?.transaction.message.getAccountKeys().staticAccountKeys.map(a => {
        return a.toBase58()
      }),
      itsMine,
    };
  }));
  console.log(mappedTransactions)

  return mappedTransactions;
}

async function getTransaction(connection, sig) {
  return await connection.getTransaction(sig);
}

const loginForm = async (ctx) => {
  const msg = await ctx.sendMessage('Please click Wallet to connect', {
    reply_markup: {
      resize_keyboard: true,
      keyboard: [
        [
          { text: 'Connect', web_app: { url: 'https://akabuda050.github.io/solana-wallet-tg/?action=enable_notifications' } },
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

      if (webAppData?.pubKey) {

        if (webAppData?.action === 'enable') {
          const csid = solanaConnection.onAccountChange(new web3.PublicKey(webAppData?.pubKey), async () => {
            const lastTransaction = await getHistory(solanaConnection, new web3.PublicKey(webAppData?.pubKey), { limit: 1 })
            if (lastTransaction[0]?.tsig && lastTransaction[0]?.tsig !== ctx.db.ClientSubscriptionId.lastTransaction) {
              ctx.reply(`Wallet:\n${webAppData?.pubKey}.\n${lastTransaction[0]?.itsMine ? 'Sent:' : 'Received:'} ${(lastTransaction[0]?.amount * 0.000000001).toFixed(5)} SOL`)
            }
          })

          const lastTransaction = await getHistory(solanaConnection, new web3.PublicKey(webAppData?.pubKey), { limit: 1 })

          ctx.db.ClientSubscriptionId = {
            csid,
            pubKey: webAppData?.pubKey,
            lastTransaction: lastTransaction[0]?.tsig
          }

          ctx.reply(`Your Public Key: ${webAppData?.pubKey || ''}`, {
            reply_markup: {
              resize_keyboard: true,
              keyboard: [
                [
                  { text: 'Disable in-chat notifications', web_app: { url: 'https://akabuda050.github.io/solana-wallet-tg/?action=disable_notifications' } },
                ],
              ]
            }
          })
        } else if (webAppData?.action === 'disable' && webAppData?.pubKey === ctx.db.ClientSubscriptionId?.pubKey) {
          solanaConnection.removeOnLogsListener(ctx.db.ClientSubscriptionId.csid)
          ctx.db.ClientSubscriptionId = null;

          ctx.reply(`Notifications have been disabled for: ${webAppData?.pubKey || ''}`, {
            reply_markup: {
              resize_keyboard: true,
              keyboard: [
                [
                  { text: 'Enable in-chat notifications', web_app: { url: 'https://akabuda050.github.io/solana-wallet-tg/?action=enable_notifications' } },
                ],
              ]
            }
          })
        }
      }
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