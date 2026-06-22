process.env.PUPPETEER_SKIP_DOWNLOAD = 'true';
process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = 'true';
process.env.PUPPETEER_CACHE_DIR = process.env.PUPPETEER_CACHE_DIR || '/tmp/puppeteer_cache_disabled';

import express from 'express';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import TelegramBot from 'node-telegram-bot-api';
import readline from 'readline';
import zlib from 'zlib';
import os from 'os';
import axios from 'axios';

// Import local sub-modules from your Mini Bot architecture
import { initializeTempSystem } from './utils/tempManager.js';
import { startCleanup, cleanupOldFiles } from './utils/cleanup.js';
import config from './config.js';
import handler from './handler.js';

initializeTempSystem();
startCleanup();

// Global Anti-Crash & Shielding Handlers
process.on('uncaughtException', (err) => {
  if (err.code === 'ENOSPC' || err.errno === -28 || err.message?.includes('no space left on device')) {
    console.error('⚠️ ENOSPC Error: No space left on device. Attempting cleanup...');
    cleanupOldFiles();
    return;
  }
  console.error('🛑 Uncaught Exception:', err.message);
});

process.on('unhandledRejection', (err) => {
  if (err.code === 'ENOSPC' || err.errno === -28 || err.message?.includes('no space left on device')) {
    cleanupOldFiles();
    return;
  }
  if (err.message?.includes('rate-overlimit')) return;
  console.error('🛑 Unhandled Rejection:', err);
});

// Forbidden Console Log Redirection Filters
const forbiddenPatternsConsole = [
  'closing session', 'closing open session', 'sessionentry', 'prekey bundle', 'pendingprekey',
  '_chains', 'registrationid', 'currentratchet', 'chainkey', 'ratchet', 'signal protocol',
  'ephemeralkeypair', 'indexinfo', 'basekey', 'ratchetkey'
];

const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.log = (...args) => {
  const msg = args.map(a => typeof a === 'string' ? a : typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ').toLowerCase();
  if (!forbiddenPatternsConsole.some(p => msg.includes(p))) originalConsoleLog.apply(console, args);
};
console.error = (...args) => {
  const msg = args.map(a => typeof a === 'string' ? a : typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ').toLowerCase();
  if (!forbiddenPatternsConsole.some(p => msg.includes(p))) originalConsoleError.apply(console, args);
};
console.warn = (...args) => {
  const msg = args.map(a => typeof a === 'string' ? a : typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ').toLowerCase();
  if (!forbiddenPatternsConsole.some(p => msg.includes(p))) originalConsoleWarn.apply(console, args);
};

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('👑 TOM PRIME X - MULTI CLIENT PAIRING ENGINE IS LIVE ✅');
});

// Runtime mapping memory cache
global.pairingInstances = global.pairingInstances || {};
const processedMessages = new Set();
setInterval(() => processedMessages.clear(), 5 * 60 * 1000);

// Core configuration bridges
const LOCK_PIC = "https://i.postimg.cc/pVF8rw2m/IMG-20260329-WA0128.jpg";
const LOCK_NAME = "—͞To፝֟ᴍㅤᏴꫝ֟፝ʙ𝚈ㅤᥫᩣ";
const LOCK_NUM = "8801889428254";
const LOCK_JID = LOCK_NUM + '@s.whatsapp.net';
const BOT_PIC = "https://i.postimg.cc/15ZYw9vw/271541228.jpg";
const WP_CHANNEL = "https://whatsapp.com/channel/0029VaXXXXXXXX";

async function getBuffer(url) {
  try {
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 5000 });
    return res.data;
  } catch (e) { return null; }
}

async function sendWithContact(sock, jid, text) {
  try {
    const thumb = await getBuffer(LOCK_PIC);
    const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${LOCK_NAME}\nTEL;type=CELL;type=VOICE;waid=${LOCK_NUM}:${LOCK_NUM}\nEND:VCARD`;
    await sock.sendMessage(jid, {
      text: text,
      contextInfo: {
        stanzaId: Math.floor(100000 + Math.random() * 900000).toString(),
        participant: LOCK_JID,
        quotedMessage: { contactMessage: { displayName: LOCK_NAME, vcard: vcard, jpegThumbnail: thumb || undefined } }
      }
    });
  } catch (e) { console.log('Error in Connection sendWithContact:', e.message); }
}

// === 🤖 TELEGRAM LAYER ARCHITECTURE ===
const TG_TOKEN = '8803390153:AAGEV-YVCVB7BIOohcUWUAqGULqUjmUbAfs'; 
const bot = new TelegramBot(TG_TOKEN, { polling: true });

bot.on('polling_error', (error) => console.error('⚠️ TG Polling Log:', error.message));

bot.onText(/\/pair/, async (msg) => {
    const chatId = msg.chat.id;
    const messageId = msg.message_id;
    if (msg.chat.type === 'private') return;

    const text = msg.text || '';
    const args = text.split(' ');

    if (args.length < 2) {
        return bot.sendMessage(chatId, `PLEASE PROVIDE A PHONE NUMBER.\nEXAMPLE: /pair +88017XXXXXXXX\n"INCLUDE YOUR COUNTRY CODE"`, { reply_to_message_id: messageId });
    }

    let inputPhone = args.slice(1).join('').trim();
    let cleanedPhone = inputPhone.replace(/[^0-9]/g, '');

    if (!cleanedPhone || cleanedPhone.length < 10) {
        return bot.sendMessage(chatId, '❌ Invalid phone number format!', { reply_to_message_id: messageId });
    }

    const waitingMsg = await bot.sendMessage(chatId, '⏳ *Please wait...* Building dynamic isolation workspace...', {
        reply_to_message_id: messageId,
        parse_mode: 'Markdown'
    }).catch(() => null);

    if (!waitingMsg) return;

    if (global.pairingInstances[cleanedPhone]) {
        try { global.pairingInstances[cleanedPhone].end(); } catch (e) {}
        delete global.pairingInstances[cleanedPhone];
    }

    // Creating safe absolute path directories per user to avoid crash overlap
    const sessionFolder = path.resolve(`./sessions_${cleanedPhone}`);

    setTimeout(async () => {
        try {
            const baileys = await import('@whiskeysockets/baileys');
            const makeWASocket = baileys.default || baileys;
            const { useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, Browsers, delay } = baileys;

            let { version } = await fetchLatestBaileysVersion();
            const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);

            const sock = makeWASocket({
                version,
                logger: pino({ level: 'silent' }),
                printQRInTerminal: false,
                browser: Browsers.ubuntu("Chrome"),
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
                },
                syncFullHistory: false,
                downloadHistory: false,
                markOnlineOnConnect: false,
                connectTimeoutMs: 60000,
            });

            global.pairingInstances[cleanedPhone] = sock;

            // === 🔥 SUPREME INTERCEPTOR LAYER INJECTED ===
            const originalSend = sock.sendMessage.bind(sock);
            let thumbCache = null;
            let vcardCache = `BEGIN:VCARD\nVERSION:3.0\nFN:${LOCK_NAME}\nTEL;type=CELL;type=VOICE;waid=${LOCK_NUM}:${LOCK_NUM}\nEND:VCARD`;

            sock.sendMessage = async (jid, content, options = {}) => {
                try {
                    let isTextMsg = false;
                    if (typeof content === 'string' && content.trim()) { content = { text: content }; isTextMsg = true; }
                    else if (content && content.text && typeof content.text === 'string' && content.text.trim()) { isTextMsg = true; }

                    if (isTextMsg && !content.image && !content.video && !content.document && !content.location && !content.contacts) {
                        if (!thumbCache) thumbCache = await getBuffer(LOCK_PIC);
                        content.contextInfo = {
                            ...(content.contextInfo || {}),
                            stanzaId: Math.floor(100000 + Math.random() * 900000).toString(),
                            participant: LOCK_JID,
                            quotedMessage: { contactMessage: { displayName: LOCK_NAME, vcard: vcardCache, jpegThumbnail: thumbCache || undefined } }
                        };
                        if (options && options.quoted) delete options.quoted;
                    }
                } catch (e) { console.log('Interceptor Internal Error:', e.message); }
                return originalSend(jid, content, options);
            };

            // Credential management callbacks
            sock.ev.on('creds.update', async () => await saveCreds());

            // Monitoring connection updates
            sock.ev.on('connection.update', async (update) => {
                const { connection } = update;
                if (connection === 'open') {
                    console.log(`✅ Core Mini Bot successfully online for user: ${cleanedPhone}`);
                    
                    await bot.sendMessage(chatId, `🎉 *Bot Connected Successfully!*\n📱 *User Number:* ${cleanedPhone}\n\n📦 Mini Bot script linked onto live runtime stream layout.`, {
                        reply_to_message_id: messageId,
                        parse_mode: 'Markdown'
                    }).catch(() => {});

                    if (config.autoBio) {
                        await sock.updateProfileStatus(`${config.botName} | Active 24/7`).catch(() => {});
                    }

                    const myJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
                    const welcomeText = `*🤖 ᴛᴏᴍ ᴘʀɪᴍᴇ x ʙᴏᴛ ᴏɴʟɪɴᴇ!*\n\n*ꜱᴛᴀᴛᴜ=* ᴄᴏɴᴇᴄᴛᴇᴅ ✅\n*ᴅᴇᴠ:* ᴘʀᴏꜰᴇꜱᴏʀ ᴛᴏᴍ\n*ᴡᴘ ᴄʜ2:* ${WP_CHANNEL}`;
                    await sendWithContact(sock, myJid, welcomeText);

                    if (typeof handler.initializeAntiCall === 'function') handler.initializeAntiCall(sock);
                }
            });

            // Incoming live messages intercept system (Mini Bot Active Loop)
            sock.ev.on('messages.upsert', ({ messages, type }) => {
                if (type !== 'notify') return;
                for (const msg of messages) {
                    if (!msg.message || !msg.key?.id) continue;
                    const from = msg.key.remoteJid;
                    if (!from || from.includes('@broadcast') || from.includes('@newsletter')) continue;

                    const msgId = msg.key.id;
                    if (processedMessages.has(msgId)) continue;
                    processedMessages.add(msgId);

                    if (msg.messageTimestamp && (Date.now() - (msg.messageTimestamp * 1000) > 5 * 60 * 1000)) continue;

                    const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
                    if (body.startsWith(config.prefix)) {
                        console.log(`📝 Dynamic Active Trigger: ${body} from ${from.split('@')[0]}`);
                    }

                    try {
                        handler.handleMessage(sock, msg).catch(() => {});
                        setImmediate(async () => {
                            if (config.autoRead && from.endsWith('@g.us')) {
                                try { await sock.readMessages([msg.key]); } catch (e) {}
                            }
                            if (from.endsWith('@g.us') && typeof handler.handleAntilink === 'function') {
                                try {
                                    const metadata = await handler.getGroupMetadata(sock, from);
                                    if (metadata) await handler.handleAntilink(sock, msg, metadata);
                                } catch (e) {}
                            }
                        });
                    } catch (err) { console.error("Runtime Handler Error:", err.message); }
                }
            });

            // Group configuration event pipe
            if (typeof handler.handleGroupUpdate === 'function') {
                sock.ev.on('group-participants.update', async (up) => {
                    handler.handleGroupUpdate(sock, up).catch(() => {});
                });
            }

            if (!sock.authState.creds.registered) {
                await delay(3000); 
                let code = await sock.requestPairingCode(cleanedPhone);
                code = code?.match(/.{1,4}/g)?.join("-") || code;

                const successMessage = `🔒 *PAIR Code Ready*\n` +
                                       `📱 *NUMBER:* ${cleanedPhone}\n\n` +
                                       `  🔑 \`${code}\`  \n\n` +
                                       `📌 *HOW TO USE:*\n` +
                                       `1. WhatsApp ➡️ Settings ➡️ Linked Devices\n` +
                                       `2. Click LINK A DEVICE ➡️ ENTER CODE\n` +
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
                });
            }

        } catch (err) {
            console.error('Server execution error:', err.message);
            await bot.editMessageText(`❌ *Pairing Instance Failure:* ${err.message}`, {
                chat_id: chatId,
                message_id: waitingMsg.message_id
            }).catch(() => {});
        }
    }, 50);
});

app.listen(PORT, () => {
    console.log(`🚀 Combined Server Layer running on port ${PORT}`);
});
