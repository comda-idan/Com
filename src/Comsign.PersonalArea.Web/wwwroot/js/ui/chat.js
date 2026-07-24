import { formatTime, escapeHtml } from '../services/format.js';

const AGENT_REPLIES = [
  'קיבלנו את פנייתך. נציג יבדוק את הפרטים ויחזור אליך כאן בהקדם.',
  'לצורך טיפול מהיר, יש לוודא שהקורא/הטוקן מחובר למחשב ושהותקן מנהל ההתקן העדכני.',
  'ניתן גם לחייג ‎*8770 לתמיכה טלפונית בשעות הפעילות, א׳–ה׳ 09:00–17:00.'
];

const WELCOME = 'שלום! הגעת לתמיכת קומסיין. איך אפשר לעזור עם הכרטיס החכם או הטוקן?';

export class SupportChat {
  #panel = document.getElementById('chat-panel');
  #log = document.getElementById('chat-log');
  #form = document.getElementById('chat-form');
  #input = document.getElementById('chat-input');
  #status = document.getElementById('chat-status');
  #fab = document.getElementById('btn-open-chat');
  #storage;
  #replyIndex = 0;

  constructor(storage) {
    this.#storage = storage;
    this.#bind();
  }

  async open() {
    this.#panel.hidden = false;
    this.#fab.hidden = true;
    await this.#restore();
    this.#input.focus();
  }

  close() {
    this.#panel.hidden = true;
    this.#fab.hidden = false;
  }

  async #restore() {
    const messages = await this.#storage.getChatMessages();
    if (!messages.length) {
      await this.#append({ from: 'agent', text: WELCOME, at: Date.now() });
      return;
    }
    this.#log.innerHTML = '';
    for (const message of messages) this.#draw(message);
    this.#scroll();
  }

  async #append(message) {
    await this.#storage.appendChatMessage(message);
    this.#draw(message);
    this.#scroll();
  }

  #draw(message) {
    const bubble = document.createElement('div');
    bubble.className = `bubble bubble--${message.from === 'me' ? 'me' : 'agent'}`;
    bubble.innerHTML = `${escapeHtml(message.text)}<span class="bubble__time">${formatTime(new Date(message.at))}</span>`;
    this.#log.append(bubble);
  }

  #scroll() {
    this.#log.scrollTop = this.#log.scrollHeight;
  }

  #bind() {
    document.getElementById('btn-close-chat').addEventListener('click', () => this.close());
    this.#fab.addEventListener('click', () => this.open());
    document.getElementById('btn-open-chat-contact')?.addEventListener('click', () => this.open());

    this.#form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const text = this.#input.value.trim();
      if (!text) return;

      this.#input.value = '';
      await this.#append({ from: 'me', text, at: Date.now() });

      this.#status.textContent = 'מקליד…';
      const reply = AGENT_REPLIES[this.#replyIndex % AGENT_REPLIES.length];
      this.#replyIndex += 1;

      setTimeout(async () => {
        this.#status.textContent = 'מקוון';
        await this.#append({ from: 'agent', text: reply, at: Date.now() });
      }, 1100);
    });
  }
}
