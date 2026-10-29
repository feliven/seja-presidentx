import { LAYOUT, VERSOES } from "./configuracao-carta.js";
import { createInstagramText } from "./geracao-textos.js";

export function createRenderer(app) {
  const {
    width: W,
    height: H,
    scale: SCALE,
    font: FONT,
    maxPages: MAX_PAGES,
    instaWidth: IW,
    instaHeight: IH,
  } = LAYOUT;
  const measure = document.createElement("canvas").getContext("2d");
  const pages = [];
  let geometry = VERSOES[app.getVersion()] || VERSOES.chad;

  function wrap(words, maxW) {
    const lines = [];
    let line = [];
    for (let i = 0; i < words.length; i++) {
      const test = line.concat(words[i]).join(" ");
      if (line.length && measure.measureText(test).width > maxW) {
        lines.push(line);
        line = [words[i]];
      } else {
        line.push(words[i]);
      }
    }
    if (line.length) lines.push(line);
    return lines;
  }

  function paginate(paragraphs) {
    const textWidth = W - geometry.ML - geometry.MR;
    measure.font = geometry.FS + "px " + FONT;
    const output = [];
    let currentPage = [];
    let y = geometry.FT;
    function newPage() {
      output.push(currentPage);
      currentPage = [];
      y = geometry.OT;
    }
    for (let p = 0; p < paragraphs.length; p++) {
      const lines = wrap(paragraphs[p], textWidth);
      for (let line = 0; line < lines.length; line++) {
        if (y > geometry.BOTTOM) {
          if (output.length + 1 >= MAX_PAGES) return { pages: output.concat([currentPage]), sig: null };
          newPage();
        }
        currentPage.push({ words: lines[line], y: y, last: line === lines.length - 1 });
        y += geometry.LH;
      }
      y += geometry.PG;
    }
    const sigY = geometry.sig === "center" ? y - geometry.PG + Math.round(geometry.FS * 4.2) : y;
    if (sigY > geometry.BOTTOM + (geometry.sig === "center" ? 40 : 0)) {
      newPage();
      const newSigY = geometry.OT + (geometry.sig === "center" ? 40 : 0);
      output.push(currentPage);
      return { pages: output, sig: { page: output.length - 1, y: newSigY } };
    }
    output.push(currentPage);
    return { pages: output, sig: { page: output.length - 1, y: sigY } };
  }

  function drawJustified(ctx, words, x, y, maxW, last) {
    if (last || words.length === 1) {
      ctx.fillText(words.join(" "), x, y);
      return;
    }
    let wordsW = 0;
    for (let i = 0; i < words.length; i++) wordsW += ctx.measureText(words[i]).width;
    const gap = (maxW - wordsW) / (words.length - 1);
    let cx = x;
    for (let i = 0; i < words.length; i++) {
      ctx.fillText(words[i], cx, y);
      cx += ctx.measureText(words[i]).width + gap;
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y + h, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawStamp(ctx, text, cx, cy, fs) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((-12 * Math.PI) / 180);
    ctx.font = "bold " + fs + "px " + FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (text === "EXILADO" && app.getGender() === "feminino") text = "EXILADA";
    try {
      ctx.letterSpacing = Math.round(fs * 0.12) + "px";
    } catch (error) {
      console.error("Não foi possível ajustar o espaçamento das letras do carimbo.", error);
    }
    const w = ctx.measureText(text).width + fs * 1.1;
    const h = fs * 1.6;
    ctx.globalAlpha = 0.82;
    ctx.strokeStyle = "#c8102e";
    ctx.fillStyle = "#c8102e";
    ctx.lineWidth = Math.max(3, fs * 0.13);
    roundRect(ctx, -w / 2, -h / 2, w, h, fs * 0.25);
    ctx.stroke();
    ctx.fillText(text, 0, fs * 0.05);
    ctx.restore();
  }

  function drawZap(ctx, x, y, qs, url) {
    ctx.save();
    if (window.qrcode) {
      try {
        const qr = window.qrcode(0, "M");
        qr.addData(url);
        qr.make();
        const moduleCount = qr.getModuleCount();
        const cell = qs / moduleCount;
        ctx.fillStyle = "#111";
        for (let row = 0; row < moduleCount; row++) {
          for (let column = 0; column < moduleCount; column++) {
            if (qr.isDark(row, column)) {
              ctx.fillRect(x + column * cell, y + row * cell, cell + 0.4, cell + 0.4);
            }
          }
        }
      } catch (error) {
        console.error("Não foi possível gerar o QR code da carta.", error);
      }
    }
    const fs = qs * 0.165;
    const tx = x + qs + fs;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#111";
    ctx.font = "bold " + fs + "px " + FONT;
    ctx.fillText("Documento assinado digitalmente via zap.br", tx, y + fs * 1.3);
    ctx.fillStyle = "#444";
    ctx.font = fs * 0.9 + "px " + FONT;
    ctx.fillText("Assinante: " + app.getName() + " · " + app.getToday(), tx, y + fs * 2.9);
    ctx.fillText("Confira a autenticidade (ou não) em sejapresidente.com", tx, y + fs * 4.3);
    ctx.strokeStyle = "#c9c9c9";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(
      x - fs * 0.8,
      y - fs * 0.8,
      qs + fs * 1.6 + ctx.measureText("Confira a autenticidade (ou não) em sejapresidente.com").width + fs * 1.2,
      qs + fs * 1.6,
    );
    ctx.restore();
  }

  function drawPage(canvas, ops, index, sig) {
    const ctx = canvas.getContext("2d");
    const textWidth = W - geometry.ML - geometry.MR;
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, W, H);
    const image = app.getCoatImage();
    if (index === 0 && image.ok) {
      let ratio = image.naturalWidth / image.naturalHeight || 1;
      let bh = geometry.BH;
      let bw = bh * ratio;
      if (bw > 300) {
        bw = 300;
        bh = bw / ratio;
      }
      ctx.drawImage(image, (W - bw) / 2, geometry.BT + (geometry.BH - bh), bw, bh);
    }
    ctx.fillStyle = "#111";
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    ctx.font = geometry.FS + "px " + FONT;
    for (let i = 0; i < ops.length; i++) {
      drawJustified(ctx, ops[i].words, geometry.ML, ops[i].y, textWidth, ops[i].last);
    }
    if (sig) {
      if (geometry.sig === "center") {
        ctx.textAlign = "center";
        ctx.font = "bold " + Math.round(geometry.FS * 1.1) + "px " + FONT;
        ctx.fillText(app.getName(), W / 2, sig.y);
      } else {
        ctx.fillText(app.getName(), geometry.ML, sig.y);
      }
    }
    if (index === 0 && app.getStamp()) {
      drawStamp(ctx, app.getStamp(), W - geometry.MR - 130, geometry.BT + 55, 34);
    }
    if (sig && app.isZapEnabled()) {
      drawZap(ctx, geometry.ML, sig.y + (geometry.sig === "center" ? 60 : 50), 92, app.getBaseUrl());
    }
    ctx.textAlign = "right";
    ctx.fillStyle = "#333";
    ctx.font = "17px " + FONT;
    ctx.fillText(
      String(index + 1),
      W - geometry.MR + (geometry.sig === "center" ? 18 : 0),
      H - (geometry.sig === "center" ? 70 : 95),
    );
  }

  function drawInstagram(canvas) {
    const ctx = canvas.getContext("2d");
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, IW, IH);
    const margin = 96;
    const textWidth = IW - 2 * margin;
    const image = app.getCoatImage();
    const crestHeight = 230;
    const crestTop = 84;
    if (image.ok) {
      const ratio = image.naturalWidth / image.naturalHeight || 1;
      let bh = crestHeight;
      let bw = bh * ratio;
      if (bw > 320) {
        bw = 320;
        bh = bw / ratio;
      }
      ctx.drawImage(image, (IW - bw) / 2, crestTop + (crestHeight - bh), bw, bh);
    }
    ctx.fillStyle = "#777";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.font = "600 18px " + FONT;
    try {
      ctx.letterSpacing = "4px";
    } catch (error) {
      console.error("Não foi possível ajustar o espaçamento do título do formato Insta.", error);
    }
    ctx.fillText("CARTA À NAÇÃO BRASILEIRA · " + app.getToday(), IW / 2, crestTop + crestHeight + 46);
    try {
      ctx.letterSpacing = "0px";
    } catch (error) {
      console.error("Não foi possível redefinir o espaçamento do título do formato Insta.", error);
    }

    const paragraphs = createInstagramText(VERSOES[app.getVersion()], app.getGender(), app.getDepartment()).map(
      function (text) {
        return text.split(" ");
      },
    );
    const limit = IH - (app.isZapEnabled() ? 250 : 130);
    let layout = null;
    for (let fs = 34; fs >= 22 && !layout; fs--) {
      const lineHeight = Math.round(fs * 1.45);
      const paragraphGap = Math.round(fs * 0.9);
      let y = crestTop + crestHeight + 110;
      const ops = [];
      measure.font = fs + "px " + FONT;
      paragraphs.forEach(function (words) {
        const lines = wrap(words, textWidth);
        lines.forEach(function (line, index) {
          ops.push({ words: line, y: y, last: index === lines.length - 1 });
          y += lineHeight;
        });
        y += paragraphGap;
      });
      const signatureY = y - paragraphGap + Math.round(fs * 2.2);
      if (signatureY <= limit) layout = { fs: fs, ops: ops, signatureY: signatureY };
    }
    if (!layout) throw new Error("Não foi possível ajustar o texto ao formato Insta.");
    ctx.fillStyle = "#111";
    ctx.textAlign = "left";
    ctx.font = layout.fs + "px " + FONT;
    layout.ops.forEach(function (op) {
      drawJustified(ctx, op.words, margin, op.y, textWidth, op.last);
    });
    if (geometry.sig === "center") {
      ctx.textAlign = "center";
      ctx.font = "bold " + Math.round(layout.fs * 1.15) + "px " + FONT;
      ctx.fillText(app.getName(), IW / 2, layout.signatureY);
    } else {
      ctx.font = layout.fs + "px " + FONT;
      ctx.fillText(app.getName(), margin, layout.signatureY);
    }
    if (app.getStamp()) drawStamp(ctx, app.getStamp(), IW - margin - 150, crestTop + 70, 40);
    if (app.isZapEnabled()) {
      drawZap(ctx, margin, IH - 96 - 104, 104, app.getBaseUrl());
    } else {
      ctx.fillStyle = "#999";
      ctx.textAlign = "center";
      ctx.font = "20px " + FONT;
      ctx.fillText("sejapresidente.com", IW / 2, IH - 56);
    }
  }

  function ensurePages(count, width, height) {
    if (pages.length && (pages[0].width !== width * SCALE || pages[0].height !== height * SCALE)) {
      while (pages.length) app.preview.removeChild(pages.pop());
    }
    while (pages.length < count) {
      const canvas = document.createElement("canvas");
      canvas.width = width * SCALE;
      canvas.height = height * SCALE;
      app.preview.appendChild(canvas);
      pages.push(canvas);
    }
    while (pages.length > count) app.preview.removeChild(pages.pop());
  }

  function render() {
    geometry = VERSOES[app.getVersion()];
    if (app.getFormat() === "insta") {
      ensurePages(1, IW, IH);
      drawInstagram(pages[0]);
      app.updateLinks();
      return;
    }
    const paragraphs = app
      .getLetterText()
      .split(/\n\s*\n/)
      .map(function (paragraph) {
        return paragraph.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
      })
      .filter(function (paragraph) {
        return paragraph.length;
      });
    const layout = paginate(paragraphs);
    ensurePages(layout.pages.length, W, H);
    for (let i = 0; i < layout.pages.length; i++) {
      drawPage(pages[i], layout.pages[i], i, layout.sig && layout.sig.page === i ? layout.sig : null);
    }
    app.updateLinks();
  }

  return {
    render: render,
    drawInstagram: drawInstagram,
    getPages: function () {
      return pages.slice();
    },
    getScale: function () {
      return SCALE;
    },
    getInstagramSize: function () {
      return { width: IW, height: IH };
    },
  };
}
