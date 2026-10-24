import assert from "node:assert/strict";
import net from "node:net";
import { once } from "node:events";

// Real SMTP delivery terminates here. No relay and no external recipients.
export async function startMailSink() {
  const messages = [];
  const sockets = new Set();
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => {});
    socket.setTimeout(10000, () => socket.destroy());
    socket.write("220 localhost test inbox\r\n");
    let buffer = "",
      data = null,
      recipients = [];
    socket.on("data", (chunk) => {
      buffer += chunk.toString();
      while (buffer.includes("\r\n")) {
        const boundary = buffer.indexOf("\r\n");
        const line = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        if (data !== null) {
          if (line === ".") {
            messages.push({
              recipients: [...recipients],
              raw: data.join("\r\n"),
            });
            data = null;
            recipients = [];
            socket.write("250 stored locally\r\n");
          } else data.push(line.replace(/^\.\./, "."));
        } else if (/^(EHLO|HELO)/i.test(line))
          socket.write("250 localhost\r\n");
        else if (/^MAIL FROM:/i.test(line)) {
          recipients = [];
          socket.write("250 OK\r\n");
        } else if (/^RCPT TO:/i.test(line)) {
          const email = line.match(/<([^>]+)>/)?.[1]?.toLowerCase();
          if (email?.endsWith("@example.invalid")) {
            recipients.push(email);
            socket.write("250 OK\r\n");
          } else
            socket.write(
              "550 Only synthetic example.invalid recipients allowed\r\n",
            );
        } else if (/^DATA$/i.test(line) && recipients.length) {
          data = [];
          socket.write("354 End with dot\r\n");
        } else if (/^QUIT$/i.test(line)) socket.end("221 Bye\r\n");
        else if (/^(RSET|NOOP)/i.test(line)) socket.write("250 OK\r\n");
        else socket.write("500 Unsupported command\r\n");
      }
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return {
    port: server.address().port,
    messages,
    async read(email, after = 0) {
      for (let attempt = 0; attempt < 100; attempt++) {
        const message = messages
          .slice(after)
          .find((m) => m.recipients.includes(email.toLowerCase()));
        if (message) {
          const body = message.raw
            .replace(/=\r\n/g, "")
            .replace(/=([0-9A-F]{2})/gi, (_, hex) =>
              String.fromCharCode(parseInt(hex, 16)),
            );
          const link = body
            .match(/href="([^"]+)"/)?.[1]
            ?.replaceAll("&amp;", "&");
          const otp = body.match(/TEST_CODE:(\d+)/)?.[1];
          assert.ok(link && otp, "Delivered email has a link and code");
          return { link, otp };
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error("Local email delivery timed out");
    },
    async close() {
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve, reject) =>
        server.close((e) => (e ? reject(e) : resolve())),
      );
      messages.length = 0;
    },
  };
}
