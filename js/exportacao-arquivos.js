export function createFileActions(getState) {
  function slug() {
    return (
      getState()
        .name.normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase() || "carta"
    );
  }

  function fileName(index, extension) {
    const state = getState();
    return (
      (state.format === "insta" ? "carta-insta-" : "carta-a-nacao-") +
      state.version +
      "-" +
      slug() +
      (state.pages.length > 1 && extension === "png" ? "-p" + (index + 1) : "") +
      "." +
      extension
    );
  }

  function toBlob(canvas) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (blob) resolve(blob);
        else reject(new Error("toBlob falhou"));
      }, "image/png");
    });
  }

  async function pngFiles() {
    const state = getState();
    return Promise.all(
      state.pages.map(async function (canvas, index) {
        return new File([await toBlob(canvas)], fileName(index, "png"), { type: "image/png" });
      }),
    );
  }

  function downloadFile(file) {
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(file);
    anchor.download = file.name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(function () {
      URL.revokeObjectURL(anchor.href);
    }, 5000);
  }

  function downloadAll(files) {
    files.forEach(function (file, index) {
      setTimeout(function () {
        downloadFile(file);
      }, index * 300);
    });
  }

  function canShare(files) {
    return !!(navigator.canShare && navigator.canShare({ files: files }));
  }

  function copyPng(canvas) {
    if (!navigator.clipboard || !window.ClipboardItem) return Promise.reject(new Error("sem clipboard"));
    return navigator.clipboard.write([new ClipboardItem({ "image/png": toBlob(canvas) })]);
  }

  return {
    slug: slug,
    fileName: fileName,
    pngFiles: pngFiles,
    downloadFile: downloadFile,
    downloadAll: downloadAll,
    canShare: canShare,
    copyPng: copyPng,
  };
}
