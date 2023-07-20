import TelegramBot from "node-telegram-bot-api";

export default class ChatContexts {
    ctx: Map<number, Array<TelegramBot.Message>>

    constructor() {
        this.ctx = new Map();
    }

    ctxOf(chatId: number) {
        if (!this.hasContext(chatId)) this.newContext(chatId, []);

        return this.ctx.get(chatId) as Array<TelegramBot.Message>;
    }

    newContext(chatId: number, ctx: Array<TelegramBot.Message>) {
        this.ctx.set(chatId, ctx);
    }

    delContext(chatId: number) {
        this.ctx.delete(chatId);
    }

    hasContext(chatId: number) {
        return this.ctx.has(chatId);
    }

}