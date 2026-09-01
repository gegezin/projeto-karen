import { google } from 'googleapis';

export class EmailManager {
  private oauth2Client: any;
  private gmail: any;

  constructor(clientId: string, clientSecret: string, redirectUri: string) {
    this.oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  setCredentials(accessToken: string, refreshToken: string): void {
    this.oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken
    });
    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
  }

  async getUnreadEmails(maxResults: number = 10): Promise<Email[]> {
    try {
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: 'is:unread',
        maxResults: maxResults
      });

      const emails: Email[] = [];

      if (response.data.messages) {
        for (const message of response.data.messages) {
          const email = await this.getEmailDetails(message.id);
          emails.push(email);
        }
      }

      return emails;
    } catch (error: any) {
      throw new Error('Erro ao buscar e-mails: ' + error.message);
    }
  }

  async getEmailDetails(messageId: string): Promise<Email> {
    try {
      const response = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full'
      });

      const message = response.data;
      const headers = message.payload.headers;
      
      const subject = this.getHeader(headers, 'Subject');
      const from = this.getHeader(headers, 'From');
      const date = this.getHeader(headers, 'Date');
      const body = this.getEmailBody(message.payload);

      return {
        id: message.id,
        subject: subject || '',
        from: from || '',
        date: date || '',
        body: body,
        snippet: message.snippet || ''
      };
    } catch (error: any) {
      throw new Error('Erro ao buscar detalhes do e-mail: ' + error.message);
    }
  }

  private getHeader(headers: any[], name: string): string {
    const header = headers.find((h: any) => h.name === name);
    return header ? header.value : '';
  }

  private getEmailBody(payload: any): string {
    let body = '';

    if (payload.body && payload.body.data) {
      body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
    } else if (payload.parts) {
      for (const part of payload.parts) {
        body += this.getEmailBody(part);
      }
    }

    return body;
  }

  async draftReply(messageId: string, replyText: string): Promise<string> {
    try {
      const originalEmail = await this.getEmailDetails(messageId);
      const replySubject = originalEmail.subject.startsWith('Re:') 
        ? originalEmail.subject 
        : 'Re: ' + originalEmail.subject;

      const email = [
        'To: ' + originalEmail.from,
        'Subject: ' + replySubject,
        '',
        replyText
      ].join('\r\n');

      const response = await this.gmail.users.drafts.create({
        userId: 'me',
        resource: {
          message: {
            raw: Buffer.from(email).toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '')
          }
        }
      });

      return response.data.id;
    } catch (error: any) {
      throw new Error('Erro ao criar rascunho: ' + error.message);
    }
  }

  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    try {
      const email = [
        'To: ' + to,
        'Subject: ' + subject,
        '',
        body
      ].join('\r\n');

      await this.gmail.users.messages.send({
        userId: 'me',
        resource: {
          raw: Buffer.from(email).toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '')
        }
      });
    } catch (error: any) {
      throw new Error('Erro ao enviar e-mail: ' + error.message);
    }
  }

  async markAsRead(messageId: string): Promise<void> {
    try {
      await this.gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        resource: {
          removeLabelIds: ['UNREAD']
        }
      });
    } catch (error: any) {
      throw new Error('Erro ao marcar como lido: ' + error.message);
    }
  }

  async archiveEmail(messageId: string): Promise<void> {
    try {
      await this.gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        resource: {
          addLabelIds: ['ARCHIVE'],
          removeLabelIds: ['INBOX']
        }
      });
    } catch (error: any) {
      throw new Error('Erro ao arquivar e-mail: ' + error.message);
    }
  }

  generateAuthUrl(): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send']
    });
  }

  async getAccessToken(code: string): Promise<any> {
    const { tokens } = await this.oauth2Client.getToken(code);
    return tokens;
  }
}

interface Email {
  id: string;
  subject: string;
  from: string;
  date: string;
  body: string;
  snippet: string;
}
