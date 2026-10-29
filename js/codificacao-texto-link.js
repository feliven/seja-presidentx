import { VERSOES } from "./configuracao-carta.js";
import { createLetterText } from "./geracao-textos.js";

function paragraphs(text) {
  return text
    .split(/\n\s*\n/)
    .map(function (paragraph) {
      return paragraph.trim();
    })
    .filter(Boolean);
}

function encodeBase64Url(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeBase64Url(value) {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function transformStream(bytes, Constructor, format) {
  const stream = new Constructor(format);
  const writer = stream.writable.getWriter();
  await writer.write(bytes);
  await writer.close();
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}

export async function encodeEditedText(currentText, versionKey, gender, department) {
  const current = paragraphs(currentText);
  const base = paragraphs(createLetterText(VERSOES[versionKey], gender, department));
  let payload;
  if (current.join("\n\n") === base.join("\n\n")) return "";
  if (current.length === base.length) {
    payload = [];
    for (let i = 0; i < current.length; i++) {
      if (current[i] !== base[i]) payload.push([i, current[i]]);
    }
  } else {
    payload = current.join("\n\n");
  }
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  if (!window.CompressionStream) return "r" + encodeBase64Url(bytes);
  return "z" + encodeBase64Url(await transformStream(bytes, CompressionStream, "deflate-raw"));
}

export async function decodeEditedText(code, versionKey, gender, department) {
  const bytes = decodeBase64Url(code.slice(1));
  const decoded =
    code[0] === "z" && window.DecompressionStream
      ? await transformStream(bytes, DecompressionStream, "deflate-raw")
      : bytes;
  const payload = JSON.parse(new TextDecoder().decode(decoded));
  if (typeof payload === "string") return payload;
  const base = paragraphs(createLetterText(VERSOES[versionKey], gender, department));
  payload.forEach(function (change) {
    if (change[0] < base.length) base[change[0]] = change[1];
  });
  return base.join("\n\n");
}
