import express from 'express';
import pino from 'pino';
import TelegramBot from 'node-telegram-bot-api';

// Ultra bulletproof anti-crash global layer
process.on('uncaughtException', (err) => console.error('🛑 Critical Exception:', err.message));
process.on('unhandledRejection', (err) => console.error('🛑 Critical Rejection:', err));

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('👑 TOM PRIME X - MEMORY AUTH SERVER IS RUNNING ✅');
});

// Global memory maps to preserve socket objects safely in RAM
global.pairingInstances = global.pairingInstances || {};

// === 🤖 TELEGRAM BOT ARCHITECTURE ===
const TG_TOKEN = '8803390153:AAGEV-YVCVB7BIOohcUWUAqGULqUjmUbAfs'; 
const bot = new TelegramBot(TG_TOKEN, { 
    polling: {
        autoStart: true,
        params: { timeout: 10 }
    } 
});

console.log('🚀 Memory-Driven Telegram Engine Active...');

bot.on('polling_error', (error) => {
    console.error('⚠️ Telegram Polling Log:', error.message);
});

bot.onText(/\/pair/, async (msg) => {
    const chatId = msg.chat.id;
    const messageId = msg.message_id;
    if (msg.chat.type === 'private') return;

    const text = msg.text || '';
    const args = text.split(' ');

    if (args.length < 2) {
        const usageMessage = `PLEASE PROVIDE A PHONE NUMBER.\n` +
                             `EXAMPLE: /pair +88017XXXXXXXX\n` +
                             `"INCLUDE YOUR COUNTRY CODE"`;
        return bot.sendMessage(chatId, usageMessage, { reply_to_message_id: messageId }).catch(() => {});
    }

    let inputPhone = args.slice(1).join('').trim();
    let cleanedPhone = inputPhone.replace(/[^0-9]/g, '');

    if (!cleanedPhone || cleanedPhone.length < 10) {
        return bot.sendMessage(chatId, '❌ Invalid phone number format! Check country code.', { reply_to_message_id: messageId }).catch(() => {});
    }

    const waitingMsg = await bot.sendMessage(chatId, '⏳ *Please wait...* Establishing isolated connection instance...', {
        reply_to_message_id: messageId,
        parse_mode: 'Markdown'
    }).catch(() => null);

    if (!waitingMsg) return;

    // Purge previous connections to avoid collision
    if (global.pairingInstances[cleanedPhone]) {
        try { 
            global.pairingInstances[cleanedPhone].ev.removeAllListeners();
            global.pairingInstances[cleanedPhone].end(); 
        } catch (e) {}
        delete global.pairingInstances[cleanedPhone];
    }

    setTimeout(async () => {
        try {
            const baileys = await import('@whiskeysockets/baileys');
            const makeWASocket = baileys.default || baileys;
            const { useInMemoryAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, delay } = baileys;

            let { version } = await fetchLatestBaileysVersion();
            
            // 🔥 Fixed: Using official useInMemoryAuthState to bypass Render disk write limits completely
            const { state, saveCreds } = useInMemoryAuthState();

            const sock = makeWASocket({
                version,
                logger: pino({ level: 'silent' }),
                printQRInTerminal: false,
                browser: ["Ubuntu", "Chrome", "20.0.04"],
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                markOnlineOnConnect: true,
                syncFullHistory: false,
            });

            global.pairingInstances[cleanedPhone] = sock;

            sock.ev.on('creds.update', saveCreds);

            sock.ev.on('connection.update', async (update) => {
                const { connection } = update;
                if (connection === 'open') {
                    console.log(`✅ Connection open and locked in RAM for: ${cleanedPhone}`);
                    
                    await bot.sendMessage(chatId, `🎉 *Bot Connected Successfully!*\n📱 *Number:* ${cleanedPhone}\n\n📦 Pairing setup completed on active server.`, {
                        reply_to_message_id: messageId,
                        parse_mode: 'Markdown'
                    }).catch(() => {});
                    
                    try { sock.ev.removeAllListeners(); } catch(e){}
                    delete global.pairingInstances[cleanedPhone];
                }
            });

            if (!sock.authState.creds.registered) {
                await delay(3000); 
                let code = await sock.requestPairingCode(cleanedPhone);
                code = code?.match(/.{1,4}/g)?.join("-") || code;

                const successMessage = `🔒 *PAIR Code Ready*\n` +
                                       `📱 *NUMBER:* ${cleanedPhone}\n` +
                                       `🌐 *Country:* BD (+880)\n\n` +
                                       `\`${code}\`\n\n` +
                                       `      〔 🛡️ CODE 〕      \n` +
                                       `  🔑 \`${code}\`  \n\n` +
                                       `📌 *HOW TO USE:*\n` +
                                       `1. WhatsApp ➡️ Settings ➡️ Linked Devices\n` +
                                       `2. Click LINK A DEVICE ➡️ ENTER CODE\n` +
                                       `⏰ CODE EXPIRES IN ~60 SECONDS\n\n` +
                                       `📢 *WA CHANNEL:*\nhttps://whatsapp.com/channel/0029VbBItW060eBXTB93HT1Q\n\n` +
                                       `👑 *Owner:* Tom`;

                await bot.editMessageText(successMessage, {
                    chat_id: chatId,
                    message_id: waitingMsg.message_id,
                    parse_mode: 'Markdown',
                    disable_web_page_preview: true
                }).catch(() => {});
            } else {
                await bot.editMessageText(`❌ This number is already actively connected!`, {
                    chat_id: chatId,
                    message_id: waitingMsg.message_id
                }).catch(() => {});
                delete global.pairingInstances[cleanedPhone];
            }

        } catch (err) {
            console.error('Inner engine failure:', err.message);
            await bot.editMessageText(`❌ *Pairing Instance Failure:* ${err.message}`, {
                chat_id: chatId,
                message_id: waitingMsg.message_id
            }).catch(() => {});
            delete global.pairingInstances[cleanedPhone];
        }
    }, 50);
});

app.listen(PORT, () => {
    console.log(`🚀 Dedicated proxy active on port ${PORT}`);
});
