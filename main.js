import { BRASOES, LAYOUT, VERSOES } from "./js/configuracao-carta.js";
import { createLetterText } from "./js/geracao-textos.js";
import { decodeEditedText, encodeEditedText } from "./js/codificacao-texto-link.js";
import { createFileActions } from "./js/exportacao-arquivos.js";
import { createRenderer } from "./js/renderizacao-canvas.js";

const $ = function (id) {
  return document.getElementById(id);
};

function on(element, event, handler) {
  if (element) element.addEventListener(event, handler);
}

const elements = {
  nome: $("nome"),
  texto: $("texto"),
  headingGender: $("headingGender"),
  headerDescription: $("headerDescription"),
  preview: $("preview"),
  status: $("status"),
  chars: $("chars"),
  brasao: $("brasao"),
  arquivo: $("arquivo"),
  deque: $("deque"),
  carimbo: $("carimbo"),
  zap: $("zapbr"),
};

const state = {
  letterText: "",
  textEdited: false,
};

function getValue(element, fallback) {
  return element && element.value ? element.value : fallback;
}

function versionKey() {
  const selected = document.querySelector('input[name="versao"]:checked');
  return (selected && VERSOES[selected.value] && selected.value) || "chad";
}

function gender() {
  const selected = document.querySelector('input[name="genero"]:checked');
  return selected ? selected.value : "feminino";
}

function format() {
  const selected = document.querySelector('input[name="formato"]:checked');
  return selected ? selected.value : "insta";
}

function department() {
  return getValue(elements.deque, "").trim() || "do Brasil";
}

function setValue(element, value) {
  if (element) element.value = value;
}

function setText(text) {
  state.letterText = text;
  setValue(elements.texto, text);
}

function setStatus(message, allowHtml) {
  if (!elements.status) return;
  if (allowHtml) elements.status.innerHTML = message;
  else elements.status.textContent = message;
}

function updateHeaderDescription() {
  const feminine = gender() === "feminino";
  if (elements.headingGender) elements.headingGender.textContent = feminine ? "Presidenta" : "Presidente";
  document.title = feminine ? "Seja Presidenta" : "Seja Presidente";
  if (elements.headerDescription) {
    elements.headerDescription.textContent =
      "Todo mundo pode ser " +
      (feminine ? "a verdadeira presidenta" : "o verdadeiro presidente") +
      " do Brasil. Coloque seu nome, baixe a Carta à Nação e compartilhe.";
  }
}

function getName() {
  return getValue(elements.nome, "").trim() || "Seu Nome";
}

function getToday() {
  const date = new Date();
  const pad = function (number) {
    return (number < 10 ? "0" : "") + number;
  };
  return pad(date.getDate()) + "." + pad(date.getMonth() + 1) + "." + String(date.getFullYear()).slice(2);
}

function shareText() {
  return "CARTA À NAÇÃO BRASILEIRA 🇧🇷 " + getToday();
}

function zapEnabled() {
  return !!(elements.zap && elements.zap.checked);
}

function baseUrl() {
  const query = [];
  const name = getValue(elements.nome, "").trim();
  if (name) query.push("nome=" + encodeURIComponent(name));
  if (versionKey() !== "chad") query.push("v=" + versionKey());
  if (gender() !== "feminino") query.push("g=" + gender());
  const crest = getValue(elements.brasao, "republica");
  if (crest !== "republica" && crest !== "custom") query.push("brasao=" + crest);
  if (department() !== "do Brasil") query.push("q=" + encodeURIComponent(department()));
  if (format() !== "insta") query.push("f=" + format());
  const stamp = getValue(elements.carimbo, "");
  if (stamp) query.push("carimbo=" + encodeURIComponent(stamp));
  if (zapEnabled()) query.push("zap=1");
  return "https://sejapresidente.com/" + (query.length ? "?" + query.join("&") : "");
}

let renderer;
const images = {};

function getCoatImage() {
  const selectedCrest = getValue(elements.brasao, "republica");
  if (selectedCrest === "custom") return images.custom || { ok: false };
  const crest = BRASOES[selectedCrest] ? selectedCrest : "republica";
  if (!images[crest]) {
    const image = new Image();
    image.ok = false;
    image.onload = function () {
      image.ok = true;
      if (renderer) renderer.render();
    };
    image.onerror = function () {
      image.ok = false;
      console.error("Não foi possível carregar o brasão:", BRASOES[crest]);
    };
    image.src = BRASOES[crest];
    images[crest] = image;
  }
  return images[crest];
}

let urlPromise = Promise.resolve(baseUrl());
function updateLinks() {
  urlPromise = siteUrlAsync();
  urlPromise
    .then(function (url) {
      const whatsAppLink = $("zap");
      const text =
        shareText() +
        "\n" +
        getName() +
        ", " +
        (gender() === "feminino" ? "verdadeira presidenta " : "verdadeiro presidente ") +
        department() +
        ".\n\n" +
        url;
      if (whatsAppLink) whatsAppLink.href = "https://wa.me/?text=" + encodeURIComponent(text);
    })
    .catch(function (error) {
      setStatus("Não foi possível atualizar o link de compartilhamento.");
      console.error("Falha ao criar o link compartilhável.", error);
    });
  if (elements.chars) elements.chars.textContent = state.letterText.length + "/12000";
}

async function siteUrlAsync() {
  const encoded = await encodeEditedText(state.letterText, versionKey(), gender(), department());
  return baseUrl() + (encoded ? "#t=" + encoded : "");
}

function render() {
  if (renderer && elements.preview) renderer.render();
}

renderer = createRenderer({
  preview: elements.preview,
  getVersion: versionKey,
  getGender: gender,
  getFormat: format,
  getDepartment: department,
  getLetterText: function () {
    return state.letterText;
  },
  getName: getName,
  getToday: getToday,
  getStamp: function () {
    return getValue(elements.carimbo, "");
  },
  isZapEnabled: zapEnabled,
  getCoatImage: getCoatImage,
  getBaseUrl: baseUrl,
  updateLinks: updateLinks,
});

const fileActions = createFileActions(function () {
  return {
    format: format(),
    version: versionKey(),
    name: getName(),
    pages: renderer.getPages(),
  };
});

const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

function readQueryParameters() {
  try {
    const query = new URLSearchParams(location.search);
    if (query.get("nome")) setValue(elements.nome, query.get("nome").slice(0, 60));
    if (query.get("v") && VERSOES[query.get("v")]) {
      const version = document.querySelector('input[name="versao"][value="' + query.get("v") + '"]');
      if (version) version.checked = true;
    }
    if (query.get("g") === "masculino" || query.get("g") === "feminino") {
      const genderOption = document.querySelector('input[name="genero"][value="' + query.get("g") + '"]');
      if (genderOption) genderOption.checked = true;
    }
    if (query.get("brasao") && BRASOES[query.get("brasao")]) {
      setValue(elements.brasao, query.get("brasao"));
    }
    if (query.get("q")) setValue(elements.deque, query.get("q").slice(0, 60));
    if (query.get("f") === "insta" || query.get("f") === "carta") {
      const formatOption = document.querySelector('input[name="formato"][value="' + query.get("f") + '"]');
      if (formatOption) formatOption.checked = true;
    }
    if (query.get("carimbo")) setValue(elements.carimbo, query.get("carimbo"));
    if (query.get("zap") === "1" && elements.zap) elements.zap.checked = true;
    if (query.get("og")) document.body.classList.add("og");
  } catch (error) {
    console.error("Não foi possível ler os parâmetros da URL.", error);
  }
}

async function readEditedText() {
  try {
    const fragment = new URLSearchParams(location.hash.replace(/^#/, ""));
    if (!fragment.get("t")) return;
    const text = await decodeEditedText(fragment.get("t"), versionKey(), gender(), department());
    setText(text);
    state.textEdited = true;
    const editorDetails = document.querySelector("details");
    if (editorDetails) editorDetails.open = true;
  } catch (error) {
    setStatus("Não consegui ler o texto editado desse link.");
    console.error("Não foi possível decodificar o texto editado do link.", error);
  }
}

function fileName(index, extension) {
  return fileActions.fileName(index, extension);
}

function xIntentUrl(url) {
  return "https://twitter.com/intent/tweet?text=" + encodeURIComponent(shareText() + "\n\n" + url);
}

function handleDownload() {
  fileActions
    .pngFiles()
    .then(function (files) {
      fileActions.downloadAll(files);
      setStatus(files.length + " PNG salvo(s).");
    })
    .catch(function (error) {
      setStatus("Não consegui gerar a imagem: " + error.message);
    });
}

function handlePdf() {
  if (!window.jspdf) {
    setStatus("Biblioteca de PDF ainda carregando. Tente de novo.");
    return;
  }
  try {
    const insta = format() === "insta";
    const pageWidth = 210;
    const pageHeight = insta ? Math.round(((210 * LAYOUT.instaHeight) / LAYOUT.instaWidth) * 10) / 10 : 297;
    const pdf = new window.jspdf.jsPDF({
      unit: "mm",
      format: insta ? [pageWidth, pageHeight] : "a4",
      compress: true,
    });
    pdf.setProperties({ title: "Carta à Nação Brasileira — " + getName() });
    renderer.getPages().forEach(function (canvas, index) {
      if (index > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, pageWidth, pageHeight);
    });
    pdf.save(fileName(0, "pdf"));
    setStatus("PDF salvo.");
  } catch (error) {
    setStatus("Não consegui gerar o PDF: " + error.message);
  }
}

function handlePostToX() {
  if (isMobile && navigator.canShare) {
    Promise.all([fileActions.pngFiles(), urlPromise])
      .then(function (result) {
        const files = result[0];
        if (!fileActions.canShare(files)) throw new Error("Compartilhamento de arquivos indisponível.");
        return navigator.share({ files: files, text: shareText() + " " + result[1] });
      })
      .then(function () {
        setStatus("Compartilhado.");
      })
      .catch(function (error) {
        if (error && error.name !== "AbortError") {
          setStatus("Não deu pra compartilhar direto. Baixe os PNGs e anexe no X.");
          console.error("Não foi possível compartilhar no X.", error);
        }
      });
    return;
  }

  const pages = renderer.getPages();
  if (!pages.length) {
    setStatus("A prévia ainda não está pronta.");
    return;
  }
  const copied = fileActions.copyPng(pages[0]).then(
    function () {
      return true;
    },
    function () {
      return false;
    },
  );
  Promise.all([copied, fileActions.pngFiles(), urlPromise])
    .then(function (result) {
      const copiedFirstPage = result[0];
      const files = result[1];
      const count = files.length;
      const popup = window.open(xIntentUrl(result[2]), "_blank", "noopener");
      fileActions.downloadAll(files);
      setStatus(
        (copiedFirstPage ? "<b>Página 1 já está copiada: aperte Cmd+V (Ctrl+V) na caixa do post.</b> " : "") +
          count +
          " PNG" +
          (count > 1 ? "s baixados" : " baixado") +
          ": arraste " +
          (copiedFirstPage && count > 1 ? "as páginas 2 e 3 " : "") +
          "pro post" +
          (popup ? "" : " (o popup do X foi bloqueado: abra x.com e cole lá)") +
          ".",
        true,
      );
    })
    .catch(function (error) {
      setStatus("Falhou: " + error.message);
      console.error("Não foi possível preparar a publicação no X.", error);
    });
}

function handleShare() {
  Promise.all([fileActions.pngFiles(), urlPromise])
    .then(function (result) {
      const files = result[0];
      if (fileActions.canShare(files)) {
        return navigator
          .share({ files: files, title: "Carta à Nação", text: shareText() + " " + result[1] })
          .then(function () {
            setStatus("Compartilhado.");
          });
      }
      fileActions.downloadAll(files);
      setStatus("Seu navegador não compartilha imagens direto. PNG baixado: anexe no post.");
    })
    .catch(function (error) {
      if (error && error.name !== "AbortError") {
        setStatus("Falhou: " + error.message);
        console.error("Não foi possível compartilhar a carta.", error);
      }
    });
}

async function createInstagramFile() {
  const size = renderer.getInstagramSize();
  const canvas = document.createElement("canvas");
  canvas.width = size.width * renderer.getScale();
  canvas.height = size.height * renderer.getScale();
  renderer.drawInstagram(canvas);
  const blob = await new Promise(function (resolve, reject) {
    canvas.toBlob(function (value) {
      if (value) resolve(value);
      else reject(new Error("Não foi possível gerar a imagem do Instagram."));
    }, "image/png");
  });
  return new File([blob], "carta-insta-" + versionKey() + "-" + fileActions.slug() + ".png", {
    type: "image/png",
  });
}

function handleInstagram() {
  createInstagramFile()
    .then(function (file) {
      if (isMobile && fileActions.canShare([file])) {
        return navigator.share({ files: [file], title: "Carta à Nação" }).then(function () {
          setStatus("Compartilhado. Escolha Instagram na lista se ainda não escolheu.");
        });
      }
      fileActions.downloadFile(file);
      window.open("https://www.instagram.com/", "_blank", "noopener");
      setStatus(
        "<b>PNG do Insta baixado.</b> No instagram.com, clique em + (Criar) e arraste o arquivo. No celular, use este botão direto do navegador: o Instagram aparece no menu de compartilhar.",
        true,
      );
    })
    .catch(function (error) {
      if (error && error.name !== "AbortError") {
        setStatus("Falhou: " + error.message);
        console.error("Não foi possível preparar a imagem para o Instagram.", error);
      }
    });
}

function handleCopyLink() {
  const done = function (url) {
    setStatus("Link copiado" + (url.indexOf("#t=") > -1 ? " (com o texto editado)" : "") + ": " + url);
  };
  const currentUrl = urlPromise;
  if (navigator.clipboard && window.ClipboardItem) {
    navigator.clipboard
      .write([
        new ClipboardItem({
          "text/plain": currentUrl.then(function (url) {
            return new Blob([url], { type: "text/plain" });
          }),
        }),
      ])
      .then(function () {
        return currentUrl;
      })
      .then(done, function () {
        currentUrl.then(function (url) {
          window.prompt("Copie o link:", url);
        });
      });
  } else {
    currentUrl.then(function (url) {
      window.prompt("Copie o link:", url);
    });
  }
}

function scheduleRender() {
  clearTimeout(scheduleRender.timeout);
  scheduleRender.timeout = setTimeout(render, 60);
}

function updateDefaultText() {
  if (!state.textEdited) setText(createLetterText(VERSOES[versionKey()], gender(), department()));
}

function bindEvents() {
  on($("baixar"), "click", handleDownload);
  on($("pdf"), "click", handlePdf);
  on($("postarX"), "click", handlePostToX);
  on($("compartilhar"), "click", handleShare);
  on($("instagram"), "click", handleInstagram);
  on($("zap"), "click", function () {
    setStatus("O link abre a sua carta. Quer a imagem junto? Baixe os PNGs e anexe.");
  });
  on($("copiar"), "click", handleCopyLink);
  on($("reset"), "click", function () {
    state.textEdited = false;
    updateDefaultText();
    render();
  });
  on(elements.texto, "input", function () {
    state.letterText = elements.texto.value;
    state.textEdited = true;
    scheduleRender();
  });
  document.querySelectorAll('input[name="versao"]').forEach(function (input) {
    on(input, "change", function () {
      updateDefaultText();
      render();
    });
  });
  document.querySelectorAll('input[name="genero"]').forEach(function (input) {
    on(input, "change", function () {
      updateHeaderDescription();
      updateDefaultText();
      render();
    });
  });
  document.querySelectorAll('input[name="formato"]').forEach(function (input) {
    on(input, "change", render);
  });
  on(elements.deque, "input", function () {
    updateDefaultText();
    scheduleRender();
  });
  on(elements.nome, "input", scheduleRender);
  on(elements.carimbo, "change", render);
  on(elements.zap, "change", render);
  on(window, "load", render);
  on(elements.brasao, "change", function () {
    const customHint = $("customHint");
    if (customHint) customHint.hidden = elements.brasao.value !== "custom";
    if (elements.brasao.value === "custom" && !images.custom && elements.arquivo) elements.arquivo.click();
    render();
  });
  on(elements.arquivo, "change", function () {
    const file = elements.arquivo.files && elements.arquivo.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function () {
      const image = new Image();
      image.ok = false;
      image.onload = function () {
        image.ok = true;
        render();
        setStatus("Imagem aplicada: " + file.name);
      };
      image.onerror = function () {
        setStatus("Não consegui ler essa imagem.");
        console.error("O arquivo de imagem selecionado é inválido:", file.name);
      };
      image.src = reader.result;
      images.custom = image;
      setValue(elements.brasao, "custom");
      const customHint = $("customHint");
      if (customHint) customHint.hidden = false;
    };
    reader.onerror = function () {
      setStatus("Não consegui ler esse arquivo.");
      console.error("Falha ao ler o arquivo de imagem:", file.name, reader.error);
    };
    reader.readAsDataURL(file);
  });
}

async function initialize() {
  readQueryParameters();
  updateHeaderDescription();
  updateDefaultText();
  bindEvents();
  await readEditedText();
  render();
}

initialize().catch(function (error) {
  setStatus("Não foi possível iniciar a página.");
  console.error("Falha ao inicializar a aplicação.", error);
});
