import nodemailer from "nodemailer";

const FROM_ADDRESS = "info@classicalguitarceremonies.com";
const OPT_OUT_LINE = "Reply to let us know if you'd rather not hear from us again.";

export function appendFooter(body: string): string {
  const address = process.env.BUSINESS_ADDRESS?.trim();
  const footerLines = [OPT_OUT_LINE];
  if (address) footerLines.unshift(address);
  return `${body}\n\n---\n${footerLines.join("\n")}`;
}

export async function sendVenueEmail(opts: {
  to: string;
  subject: string;
  body: string;
}): Promise<void> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    throw new Error(
      "GMAIL_USER and GMAIL_APP_PASSWORD environment variables must be set to send email.",
    );
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  const finalBody = appendFooter(opts.body);

  await transporter.sendMail({
    from: `"Classical Guitar Ceremonies" <${FROM_ADDRESS}>`,
    to: opts.to,
    subject: opts.subject,
    text: finalBody,
  });
}
