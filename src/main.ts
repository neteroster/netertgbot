import { ChatGPTContext } from "./openaiGpt.js"
import tgBot, { senderOf, errfySender, Sender } from "./tgbot.js"
import { GPTMultiContexts, isGPTModel } from "./openaiGpt.js";
import ChatContexts from "./chatContext.js";
import TelegramBot from "node-telegram-bot-api";

const gptContexts = new GPTMultiContexts();
const chatContexts = new ChatContexts();

async function queryGPT(ctx: ChatGPTContext) {
    try {
        const res = (await ctx.send()).data.choices[0].message;
        if (res?.content === undefined) { return "[Error] Invalid response from GPT."; }
        return res.content;
    } catch (err) {
        return `[Error] Error requesting GPT: ${err}`;
    }
}

tgBot.on("message", (msg) => {
    const chatId = msg.chat.id;
    chatContexts.ctxOf(chatId).push(msg);
});

function inputHandleSend<T, R>(
    messageHandler: (msg: TelegramBot.Message, match: RegExpExecArray) => T,
    actions: (userInput: T) => R | Promise<R>,
    reply: (result: R, sender: Sender) => void) {

        return async function (msg: TelegramBot.Message, match: RegExpExecArray | null) {
            const sendMsg = senderOf(tgBot, msg.chat.id);
            const sendErr = errfySender(sendMsg);

            if (match === null) { sendErr("Invalid match"); return; }

            const userInput = messageHandler(msg, match);
            const result = await actions(userInput);
            reply(result, sendMsg);
        }
}


tgBot.onText(/\/gptCreate (.+) (.+)/, inputHandleSend(
    (_, match) => ({
        contextName: match[1],
        modelName: match[2]
    }),
    (userInput) => {
        const { contextName, modelName } = userInput;

        if (gptContexts.contextOf(contextName) !== undefined) {
            return `Error: Context ${contextName} already exists.`;
        }

        if (!isGPTModel(modelName)) {
            return `Error: Invalid model name ${modelName}.`;
        }

        gptContexts.newContext(contextName, new ChatGPTContext(modelName));
        return `Context ${contextName} created.`;
    },
    (result, sendMsg) => sendMsg(result))
);

tgBot.onText(/\/gptDelete (.+)/, inputHandleSend(
    (_, match) => match[1],
    (userInput) => {
        const contextName = userInput;

        if (gptContexts.contextOf(contextName) === undefined) {
            return `Error: Context ${contextName} does not exist.`;
        }

        gptContexts.delContext(contextName);
        return `Context ${contextName} deleted.`;
    },
    (result, sendMsg) => sendMsg(result))
);

tgBot.onText(/\/gptList/, inputHandleSend(
    (_) => undefined,
    (_) => Array.from(gptContexts.contexts.keys()).join(", "),
    (result, sendMsg) => sendMsg(`Contexts: ${result}`))
);


tgBot.onText(/\/gptSend (.+) (.+)/, inputHandleSend(
    (_, match) => ({
        contextName: match[1],
        queryContent: match[2]
    }),
    async (userInput) => {
        const { contextName, queryContent } = userInput;

        const gptContext = gptContexts.contextOf(contextName);
        if (gptContext === undefined) {
            return `Error: Context ${contextName} does not exist.`;
        }

        gptContext.add({
            role: "user",
            content: queryContent
        });
        
        const res = await queryGPT(gptContext);
        return res;
    },
    (result, sendMsg) => sendMsg(result))
);


tgBot.onText(/\/gptWithContext (.+) (\d+) (.+)/, inputHandleSend(
    (msg, match) => ({
        modelName: match[1],
        maxLen: parseInt(match[2]),
        queryContent: match[3],
        chatId: msg.chat.id
    }),
    (userInput) => {
        const { modelName, maxLen, queryContent, chatId } = userInput;

        if (!isGPTModel(modelName)) { return `Invalid model name ${modelName}.`; }

        const gptContext = new ChatGPTContext(modelName);
        const ctx = chatContexts
        .ctxOf(chatId)
        .slice(-maxLen)
        .filter((msg) => msg.text !== undefined && !msg.text.startsWith("/"))
        .map((msg) => {
            if (msg.from?.first_name === undefined) return `Anonymous: ${msg.text}`;
            else return `${msg.from.first_name}: ${msg.text}`;
        }).join("\n");

        gptContext.add({
            role: "user",
            content: ctx
        });

        const query = "According to the above conversation, answer the following question:\n" + queryContent;
        gptContext.add({
            role: "user",
            content: query
        });

        return queryGPT(gptContext);
    },
    (result, sendMsg) => sendMsg(result))
);
    
