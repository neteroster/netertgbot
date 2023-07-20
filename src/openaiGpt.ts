import { OpenAIApi } from "openai";
import { OPENAI_CONFIG } from "./cred.js";

import { ChatCompletionResponseMessage as GPTMessage } from "openai";

type GPTModel = "gpt-3.5-turbo" | "gpt-3.5-turbo-16k";
const GPTModels: Array<GPTModel> = ["gpt-3.5-turbo", "gpt-3.5-turbo-16k"];
export const isGPTModel = (model: string): model is GPTModel => GPTModels.includes(model as GPTModel);

export class ChatGPTContext {
    model: GPTModel
    history: Array<GPTMessage>
    api: OpenAIApi

    constructor(model: GPTModel) {
        this.model = model;
        this.history = [];
        this.api = new OpenAIApi(OPENAI_CONFIG);
    }

    latest() {
        return this.history[this.history.length - 1];
    }

    add(message: GPTMessage | Array<GPTMessage>) {
        if (Array.isArray(message)) {
            this.history = this.history.concat(message);
        } else {
            this.history.push(message);
        }
    }

    async send() {
        const res = await this.api.createChatCompletion({
            model: this.model,
            messages: this.history
        });

        if (res.data.choices[0].message != undefined) {
            this.add(res.data.choices[0].message);
        }
        
        return res;
    }

}

export class MultiContexts {
    contexts: Map<string, ChatGPTContext>

    constructor() {
        this.contexts = new Map();
    }

    contextOf(key: string) {
        return this.contexts.get(key);
    }

    newContext(key: string, ctx: ChatGPTContext) {
        this.contexts.set(key, ctx);
    }

    delContext(key: string) {
        this.contexts.delete(key);
    }
    
}