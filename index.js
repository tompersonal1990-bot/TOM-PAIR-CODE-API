import express from 'express';
import pino from 'pino';
import { makeWASocket, useMultiFileAuthState, delay } from '@whiskeysockets/baileys';
import fs from 'fs';
import path from 'path';
import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';

const app = express();
const PORT = process.env.PORT || 3000;

// === 🌐 EXPRESS SERVER HOME ROUTE ===
app.get('/', (req, res) => {
    res.send('👑 TOM PRIME X - PAIRING SERVER & TELEGRAM BOT ARE LIVE ✅');
});

// === 📲 WHATSAPP PAIRING CODE API ROUTE ===
app.get('/pair', async (req, res) => {
    let phone = req.query.phone;
    if (!phone) {
        return res.json({ status: false, error: "Please provide a phone number! Example: /pair?phone=88016xxxxxx" });
    }

    phone = phone.replace(/[^0-9]/g, '');
    const sessionPath = path.join(process.cwd(), `./sessions/${phone}`);

    try {
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            browser: ["Ubuntu", "Chrome", "20.0.04"]
        });

        if (!sock.authState.creds.registered) {
            await delay(2500); 
            let code = await sock.requestPairingCode(phone);
            code = code?.match(/.{1,4}/g)?.join("-") || code;

            if (!res.headersSent) {
                res.json({ status: true, code: code });
            }
        } else {
            if (!res.headersSent) {
                res.json({ status: false, message: "This number is already connected!" });
            }
        }

        sock.ev.on('connection.update', async (update) => {
            const { connection } = update;
            if (connection === 'open') {
                console.log(`✅ Session successfully connected for: ${phone}`);
                await sock.sendMessage(sock.user.id, { text: '✨ TOM BOT successfully connected to your account!' });
            }
        });

        sock.ev.on('creds.update', saveCreds);

    } catch (err) {
        console.error(err);
        if (!res.headersSent) {
            res.json({ status: false, error: err.message });
        }
    }
});

// === 🤖 TELEGRAM BOT INTEGRATION (GROUP ONLY) ===
const TG_TOKEN = '8803390153:AAGEV-YVCVB7BIOohcUWUAqGULqUjmUbAfs'; 
const bot = new TelegramBot(TG_TOKEN, { polling: true });

console.log('🤖 Telegram Pairing Bot Layer Initialized...');

bot.onText(/\/pair (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const messageId = msg.message_id;
    const chatType = msg.chat.type;

    // ইনবক্স (Private Chat) হলে বট রিপ্লাই করবে না, চুপ থাকবে
    if (chatType === 'private') {
        return; 
    }

    let inputPhone = match[1].trim();
    let cleanedPhone = inputPhone.replace(/[^0-9]/g, '');

    if (!cleanedPhone || cleanedPhone.length < 10) {
        return bot.sendMessage(chatId, '❌ বৈধ হোয়াটসঅ্যাপ নাম্বার দিন! উদাহরণ: `/pair 88017XXXXXXXX`', {
            reply_to_message_id: messageId,
            parse_mode: 'Markdown'
        });
    }

    // গ্রুপে সরাসরি ইউজারকে রিপ্লাই করে ওয়েটিং মেসেজ দেওয়া
    const waitingMsg = await bot.sendMessage(chatId, '⏳ *Please wait...* আপনার পেয়ারিং কোড জেনারেট হচ্ছে...', {
        reply_to_message_id: messageId,
        parse_mode: 'Markdown'
    });

    try {
        // রেন্ডারের লোকালহোস্ট এপিআই তেই রিকোয়েস্ট পাঠানো হচ্ছে
        const response = await axios.get(`http://localhost:${PORT}/pair`, {
            params: { phone: cleanedPhone },
            timeout: 25000 
        });

        const data = response.data;

        if (data.status && data.code) {
            const successMessage = `✅ *Success! Your Pairing Code is Ready*\n\n` +
                                   `📱 *Number:* \`${cleanedPhone}\`\n` +
                                   `🔑 *Pairing Code:* \`${data.code}\`\n\n` +
                                   `💡 কোডটি কপি করে হোয়াটসঅ্যাপের "Link with phone number" অপশনে বসিয়ে দিন।`;
            
            await bot.editMessageText(successMessage, {
                chat_id: chatId,
                message_id: waitingMsg.message_id,
                parse_mode: 'Markdown'
            });
        } else {
            await bot.editMessageText(`❌ *Error:* ${data.error || data.message || 'কোড পাওয়া যায়নি!'}`, {
                chat_id: chatId,
                message_id: waitingMsg.message_id,
                parse_mode: 'Markdown'
            });
        }

    } catch (error) {
        console.error(error.message);
        await bot.editMessageText(`❌ *API Error:* কোড জেনারেট করা যায়নি বা টাইমআউট হয়েছে। আবার চেষ্টা করুন।`, {
            chat_id: chatId,
            message_id: waitingMsg.message_id,
            parse_mode: 'Markdown'
        });
    }
});

// === 🚀 START EXPRESS SERVER ===
app.listen(PORT, () => {
    console.log(`🚀 Server with Integrated Bot running on port ${PORT}`);
});
