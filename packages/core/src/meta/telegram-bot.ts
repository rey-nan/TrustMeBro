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
    // First try process.env (loaded by dotenv in API)
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      this.config = {
        botToken: process.env.TELEGRAM_BOT_TOKEN,
        chatId: process.env.TELEGRAM_CHAT_ID,
      };
      logger.info({ chatId: this.config.chatId }, 'Telegram config loaded from env');
      return;
    }

    // Fallback: try reading .env file directly
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
          logger.info({ chatId: this.config.chatId }, 'Telegram config loaded from file');
        }
      }
    } catch (err) {
      logger.error({ err }, 'Failed to load Telegram config');
    }

    if (!this.config) {
      logger.info('Telegram not configured');
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
    logger.info({ chatId: this.config.chatId }, 'Starting Telegram polling...');

    while (this.polling) {
      try {
        const url = `https://api.telegram.org/bot${this.config.botToken}/getUpdates?offset=${this.lastUpdateId + 1}&timeout=30`;
        logger.info('Polling for updates...');
        
        const response = await fetch(url, { signal: AbortSignal.timeout(35000) });
        const data: any = await response.json();

        if (data.ok && data.result) {
          logger.info({ count: data.result.length }, 'Received updates');
          
          for (const update of data.result as TelegramUpdate[]) {
            this.lastUpdateId = update.update_id;

            if (update.message?.text) {
              const msgChatId = update.message.chat.id.toString();
              logger.info({ chatId: msgChatId, text: update.message.text }, 'Processing message');
              
              // Only process messages from configured chat
              if (msgChatId === this.config.chatId) {
                await this.handleMessage(msgChatId, update.message.text);
              } else {
                logger.info({ chatId: msgChatId }, 'Ignoring message from unknown chat');
              }
            }
          }
        } else {
          logger.warn({ data }, 'Unexpected response from Telegram');
        }
      } catch (err: any) {
        if (!err.message?.includes('timeout')) {
          logger.error({ err: err.message }, 'Telegram polling error');
          await new Promise(r => setTimeout(r, 5000));
        }
      }
    }
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
    logger.info({ chatId, text }, 'Handling Telegram message');

    if (!this.onMessage) {
      logger.warn('No message handler configured!');
      await this.sendMessage(chatId, 'Sorry, no message handler is configured.');
      return;
    }

    try {
      logger.info('Calling onMessage handler...');
      const response = await this.onMessage(chatId, text);
      logger.info({ responseLength: response.length }, 'Got response from handler');
      await this.sendMessage(chatId, response);
      logger.info('Response sent to Telegram');
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
