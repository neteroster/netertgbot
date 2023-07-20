import TelegramBot from "node-telegram-bot-api";
import { TELEGRAM_BOT_TOKEN } from "./cred.js";
const tgBot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

export type Sender = (message: string) => void;

export default tgBot;

export function senderOf(tgBot: TelegramBot, chatId: number): Sender {
    return (message: string) => tgBot.sendMessage(chatId, message);
}

export function errfySender(sender: Sender): Sender {
    return (err: string | undefined) => {
        if (err === undefined) sender("[Error] Unknown Error");
        else sender(`[Error] ${err}`);
    }
}


