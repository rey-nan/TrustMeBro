import fs from 'fs';
import path from 'path';
import pino from 'pino';

const logger = pino({ name: 'TelegramBot' });

interface TelegramConfig {
  botToken: string;
  chatId: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: { id: number; first_name: string };
    chat: { id: number };
    text?: string;
  };
}

export class TelegramBot {
  private config: TelegramConfig | null = null;
  private polling = false;
  private lastUpdateId = 0;
  private onMessage: ((chatId: string, text: string) => Promise<string>) | null = null;

  constructor() {
    this.loadConfig();
  }

  private loadConfig(): void {
    const envPath = path.join(process.cwd(), '.env');
    try {
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf-8');
        const env: Record<string, string> = {};
        for (const line of content.split('\n')) {
          const match = line.match(/^([^#=]+)=(.*)$/);
          if (match) env[match[1].trim()] = match[2].trim();
        }

        if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
          this.config = {
            botToken: env.TELEGRAM_BOT_TOKEN,
            chatId: env.TELEGRAM_CHAT_ID,
          };
          logger.info('Telegram config loaded');
        }
      }
    } catch (err) {
      logger.error({ err }, 'Failed to load Telegram config');
    }
  }

  isConfigured(): boolean {
    return this.config !== null;
  }

  setOnMessage(handler: (chatId: string, text: string) => Promise<string>): void {
    this.onMessage = handler;
  }

  async startPolling(): Promise<void> {
    if (!this.config || this.polling) return;

    this.polling = true;
    logger.info('Starting Telegram polling...');

    while (this.polling) {
      try {
        const response = await fetch(
          `https://api.telegram.org/bot${this.config.botToken}/getUpdates?offset=${this.lastUpdateId + 1}&timeout=30`,
          { signal: AbortSignal.timeout(35000) }
        );
        const data: any = await response.json();

        if (data.ok && data.result) {
          for (const update of data.result as TelegramUpdate[]) {
            this.lastUpdateId = update.update_id;

            if (update.message?.text) {
              await this.handleMessage(update.message.chat.id.toString(), update.message.text);
            }
          }
        }
      } catch (err: any) {
        if (!err.message?.includes('timeout')) {
          logger.error({ err: err.message }, 'Telegram polling error');
          await new Promise(r => setTimeout(r, 5000)); // Wait before retry
        }
      }
    }
  }

  private async handleMessage(chatId: string, text: string): Promise<void> {
    logger.info({ chatId, text }, 'Received Telegram message');

    if (!this.onMessage) {
      await this.sendMessage(chatId, 'Sorry, no message handler is configured.');
      return;
    }

    try {
      const response = await this.onMessage(chatId, text);
      await this.sendMessage(chatId, response);
    } catch (err) {
      logger.error({ err }, 'Error handling message');
      await this.sendMessage(chatId, 'Sorry, an error occurred processing your message.');
    }
  }

  async sendMessage(chatId: string, text: string): Promise<void> {
    if (!this.config) return;

    try {
      await fetch(`https://api.telegram.org/bot${this.config.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'Markdown',
        }),
      });
    } catch (err) {
      logger.error({ err }, 'Failed to send Telegram message');
    }
  }

  stop(): void {
    this.polling = false;
  }
}
