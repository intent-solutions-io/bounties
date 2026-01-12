import { Resend } from 'resend';
import { readFileSync, existsSync } from 'fs';
import { basename } from 'path';

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send email with optional attachments
 * Usage: node send-email.js <to> <subject> [body-file] [attachment1] [attachment2]
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log(`
Usage: npm run email -- <to> <subject> [body-file] [attachments...]

Examples:
  npm run email -- user@example.com "Hello"
  npm run email -- user@example.com "Report" body.html report.pdf
  npm run email -- user@example.com "Docs" body.md doc1.pdf doc2.pdf
`);
    process.exit(1);
  }

  const [to, subject, bodyFile, ...attachmentPaths] = args;

  // Get body content
  let html = '<p>No body provided</p>';
  if (bodyFile && existsSync(bodyFile)) {
    const content = readFileSync(bodyFile, 'utf-8');
    if (bodyFile.endsWith('.md')) {
      // Simple markdown to HTML
      html = content
        .replace(/^### (.*$)/gm, '<h3>$1</h3>')
        .replace(/^## (.*$)/gm, '<h2>$1</h2>')
        .replace(/^# (.*$)/gm, '<h1>$1</h1>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');
    } else {
      html = content;
    }
  }

  // Build attachments
  const attachments = attachmentPaths
    .filter(p => existsSync(p))
    .map(p => ({
      filename: basename(p),
      content: readFileSync(p).toString('base64'),
    }));

  console.log(`Sending to: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`Attachments: ${attachments.length}`);

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to: [to],
      subject,
      html,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    if (error) {
      console.error('Error:', error);
      process.exit(1);
    }

    console.log('✓ Email sent! ID:', data.id);
  } catch (err) {
    console.error('Failed:', err.message);
    process.exit(1);
  }
}

main();
