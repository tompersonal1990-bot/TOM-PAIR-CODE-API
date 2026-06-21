import express from 'express';
import pino from 'pino';
import baileys from '@whiskeysockets/baileys';
const { makeWASocket, useMultiFileAuthState, delay } = baileys;
import fs from 'fs';
import path from 'path';
import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';

const app = express();
const PORT = process.env.PORT || 3000;

// === 🌐 EXPRESS SERVER HOME ROUTE ===
app.get('/', (req, res) => {
    res.send('👑 TOM PRIME X - REAL PAIRING API WITH TG BOT IS RUNNING ✅');
});

// === 📲 REAL WHATSAPP PAIRING CODE API ROUTE ===
app.get('/pair', async (req, res) => {
    let phone = req.query.phone;
    if (!phone) {
        return res.json({ status: false, error: "Please provide a phone number!" });
    }

    // নাম্বার সম্পূর্ণ ক্লিন করা
    phone = phone.replace(/[^0-9]/g, '');
    
    // পুরানো কোনো ড্যামেজড সেশন থাকলে তা ফ্রেশ করার জন্য রিমুভ লজিক
    const sessionPath = path.join(process.cwd(), `./sessions/${phone}`);
    if (fs.existsSync(sessionPath) && !fs.existsSync(path.join(sessionPath, 'creds.json'))) {
        try { fs.rmSync(sessionPath, { recursive: true, force: true }); } catch (e) {}
    }

    try {
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

        // 🛑 এই কনফিগারেশনটি হোয়াটসঅ্যাপের ফোনে রিয়াল নোটিফিকেশন পুশ করতে বাধ্য করবে
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            browser: ["WhatsApp Web", "Chrome", "11.0.0"], // অফিশিয়াল রিয়াল নোটিফিকেশন ট্রিপার
            syncFullHistory: false,
            markOnlineOnConnect: false
        });

        if (!sock.authState.creds.registered) {
            // হোয়াটসঅ্যাপ ড্যাশবোর্ডের সাথে হ্যান্ডশেক করার জন্য ৪ সেকেন্ড স্টেবল ডিলে
            await delay(4000); 
            
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

        sock.ev.on('creds.update', saveCreds);

        // সেশন কানেক্ট হয়ে গেলে মেমোরি ক্লিন করার জন্য সকেট ক্লোজ করা
        sock.ev.on('connection.update', async (update) => {
            const { connection } = update;
            if (connection === 'open') {
                console.log(`✅ Linked Successfully with: ${phone}`);
                sock.logout(); // পেয়ারিং সাকসেস হলে এপিআই সকেট অফ করে দেবে মেমোরি বাঁচাতে
            }
        });

    } catch (err) {
        console.error(err);
        if (!res.headersSent) {
            res.json({ status: false, error: err.message });
        }
    }
});

// === 🤖 TELEGRAM BOT INTEGRATION ===
const TG_TOKEN = '8803390153:AAGEV-YVCVB7BIOohcUWUAqGULqUjmUbAfs'; 
const bot = new TelegramBot(TG_TOKEN, { polling: true });

console.log('🤖 Telegram Pairing Bot Layer Initialized...');

bot.onText(/\/pair (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const messageId = msg.message_id;
    const chatType = msg.chat.type;

    // গ্রুপ ছাড়া অন্য কোথাও রেসপন্স করবে না
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

    const waitingMsg = await bot.sendMessage(chatId, '⏳ *Please wait...* আপনার হোয়াটসঅ্যাপে অফিশিয়াল নোটিফিকেশন পাঠানো হচ্ছে এবং কোড জেনারেট হচ্ছে...', {
        reply_to_message_id: messageId,
        parse_mode: 'Markdown'
    });

    try {
        const response = await axios.get(`http://localhost:${PORT}/pair`, {
            params: { phone: cleanedPhone },
            timeout: 28000 // ২৪ সেকেন্ড বাফারিং ব্যাকএন্ড টাইমআউট
        });

        const data = response.data;

        if (data.status && data.code) {
            const successMessage = `✅ *Success! Real Pairing Code is Ready*\n\n` +
                                   `📱 *Number:* \`${cleanedPhone}\`\n` +
                                   `🔑 *Pairing Code:* \`${data.code}\`\n\n` +
                                   `🔔 আপনার ফোনের হোয়াটসঅ্যাপ নোটিফিকেশনে ক্লিক করে কোডটি বসিয়ে দিন।`;
            
            await bot.editMessageText(successMessage, {
                chat_id: chatId,
                message_id: waitingMsg.message_id,
                parse_mode: 'Markdown'
            });
        } else {
            await bot.editMessageText(`❌ *Error:* ${data.error || data.message || 'কোড জেনারেট করা যায়নি!'}`, {
                chat_id: chatId,
                message_id: waitingMsg.message_id,
                parse_mode: 'Markdown'
            });
        }

    } catch (error) {
        console.error(error.message);
        await bot.editMessageText(`❌ *API Error:* হোয়াটসঅ্যাপ সার্ভার রিকোয়েস্ট রিজেক্ট করেছে। দয়া করে সঠিক নাম্বার দিয়ে আবার চেষ্টা করুন।`, {
            chat_id: chatId,
            message_id: waitingMsg.message_id,
            parse_mode: 'Markdown'
        });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server with Integrated Bot running on port ${PORT}`);
});
