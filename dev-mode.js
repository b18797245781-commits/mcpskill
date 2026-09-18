/* 开发模式（Dev Mode）— 页面源码查看器
 * 用法：在 </head> 前引入 dev-mode.css，在 </body> 前引入本脚本即可，无需其它改动。
 * 品牌名可通过 <meta name="dev-mode-brand" content="品牌"> 或 window.DEV_MODE_BRAND 指定。
 * 挂载的元素都带 data-dev-mode 属性，会被自动排除在“页面 HTML 源码”之外。
 */
(function(){
  "use strict";
  var state = { files: [], current: 0, code: "" };

  /* ---------- 品牌名 ---------- */
  function resolveBrand(){
    var meta = document.querySelector('meta[name="dev-mode-brand"]');
    if (meta && (meta.getAttribute("content") || "").trim()) return meta.getAttribute("content").trim();
    if (typeof window.DEV_MODE_BRAND === "string" && window.DEV_MODE_BRAND.trim()) return window.DEV_MODE_BRAND.trim();
    var title = (document.title || "").split(/[·|｜\-—>]+/)[0];
    return (title || "").trim();
  }

  /* ---------- 数据收集 ---------- */
  function cleanHtml(){
    var root = document.documentElement.cloneNode(true);
    root.querySelectorAll(".dev-code-trigger,.dev-code-modal,.dev-code-toast,[data-dev-mode]").forEach(function(el){ el.remove(); });
    return "<!DOCTYPE html>\n" + root.outerHTML;
  }
  function inlineCss(){
    var blocks = [];
    document.querySelectorAll("style:not([data-dev-mode])").forEach(function(style, index){
      blocks.push("/* 内嵌样式块 " + (index + 1) + " */\n" + style.textContent.trim());
    });
    return blocks.join("\n\n");
  }
  function inlineJs(){
    var blocks = [];
    document.querySelectorAll("script:not([src]):not([data-dev-mode])").forEach(function(script, index){
      var text = script.textContent.trim();
      if (text) blocks.push("/* 页面交互脚本 " + (index + 1) + " */\n" + text);
    });
    return blocks.join("\n\n");
  }
  function fileName(href){
    try { return decodeURIComponent(href.split("/").pop().split("?")[0]) || href; } catch (error) { return href; }
  }
  function linkedCssFiles(){
    var files = [];
    document.querySelectorAll('link[rel="stylesheet"]:not([data-dev-mode])').forEach(function(link){
      var href = link.getAttribute("href");
      if (!href) return;
      var code = "/* 文件：" + href + " */\n";
      try {
        var rules = link.sheet && link.sheet.cssRules;
        if (rules) code += Array.prototype.map.call(rules, function(rule){ return rule.cssText; }).join("\n");
        else code += "/* 未能读取到样式内容，请直接打开该文件查看。 */";
      } catch (error) {
        code += "/* 浏览器的本地文件安全策略阻止读取完整内容。\n   前端可按上方相对路径直接打开该 CSS 文件，或改用本地 HTTP 服务打开页面。 */";
      }
      files.push({ name: fileName(href), type: "css", code: code });
    });
    return files;
  }
  function linkedScriptFiles(){
    var files = [];
    document.querySelectorAll("script[src]:not([data-dev-mode])").forEach(function(script){
      var src = script.getAttribute("src");
      if (!src) return;
      files.push({
        name: fileName(src), type: "js", href: src, pending: true,
        code: "/* 文件：" + src + " */\n/* 正在读取… */"
      });
    });
    return files;
  }
  function loadLinkedScripts(){
    state.files.forEach(function(file){
      if (!file.pending) return;
      var done = function(code){ file.code = code; file.pending = false; if (state.files[state.current] === file) showCode(file.code, currentQuery()); };
      try {
        fetch(file.href).then(function(response){
          if (!response.ok) throw new Error("HTTP " + response.status);
          return response.text();
        }).then(function(text){
          done("/* 文件：" + file.href + " */\n" + text);
        }).catch(function(){
          done("/* 文件：" + file.href + " */\n/* 无法在当前环境下读取内容（file:// 打开或跨域时会受限）。\n   解决方案：用本地 HTTP 服务打开页面，或直接打开该文件查看。 */");
        });
      } catch (error) {
        done("/* 文件：" + file.href + " */\n/* 当前环境不支持读取该脚本内容，请直接打开文件查看。 */");
      }
    });
  }
  function buildFiles(){
    var pageName = decodeURIComponent(location.pathname.split("/").pop() || "index.html");
    state.files = [
      { name: pageName, type: "html", code: cleanHtml() },
      { name: "页面内嵌样式.css", type: "css", code: inlineCss() },
      { name: "页面交互逻辑.js", type: "js", code: inlineJs() }
    ].concat(linkedCssFiles()).concat(linkedScriptFiles());
  }

  /* ---------- 渲染 ---------- */
  function escapeHtml(text){ return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function currentQuery(){ var input = document.getElementById("devCodeSearch"); return input ? input.value.trim() : ""; }
  function renderCode(code, query){
    var pre = document.getElementById("devCodePre");
    var q = (query || "").toLowerCase();
    pre.innerHTML = code.split("\n").map(function(line){
      var cls = q && line.toLowerCase().indexOf(q) !== -1 ? "dev-code-line match" : "dev-code-line";
      return "<span class=\"" + cls + "\">" + (line ? escapeHtml(line) : " ") + "</span>";
    }).join("");
    if (q) { var first = pre.querySelector(".match"); if (first) first.scrollIntoView({ block: "center" }); }
  }
  function formatBytes(bytes){
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  }
  function showCode(code, query){
    state.code = code || "";
    document.getElementById("devCodeMeta").textContent = state.code.split("\n").length + " 行 · " + formatBytes(new Blob([state.code]).size);
    renderCode(state.code, query || "");
  }
  function selectFile(index){
    state.current = index;
    document.querySelectorAll(".dev-code-file").forEach(function(btn, i){ btn.classList.toggle("active", i === index); });
    document.getElementById("devCodeCurrent").textContent = state.files[index].name;
    document.getElementById("devCodeSearch").value = "";
    showCode(state.files[index].code, "");
    document.querySelector(".dev-code-scroll").scrollTop = 0;
  }
  function toast(text){
    var el = document.getElementById("devCodeToast"); el.textContent = text; el.classList.add("show");
    clearTimeout(toast.timer); toast.timer = setTimeout(function(){ el.classList.remove("show"); }, 1600);
  }
  function renderFileList(){
    var list = document.getElementById("devCodeFiles");
    list.innerHTML = "<div class=\"dev-code-side-title\">当前项目源码</div>" + state.files.map(function(file, index){
      return "<button class=\"dev-code-file" + (index === state.current ? " active" : "") + "\" data-index=\"" + index + "\"><span class=\"ext\">" + file.type + "</span><span>" + escapeHtml(file.name) + "</span></button>";
    }).join("");
    list.querySelectorAll(".dev-code-file").forEach(function(btn){ btn.addEventListener("click", function(){ selectFile(Number(btn.dataset.index)); }); });
  }

  /* ---------- 动作 ---------- */
  function copyCode(){
    function fallback(){
      var ta = document.createElement("textarea"); ta.value = state.code; ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); toast("代码已复制"); } catch (error) { toast("复制失败，请手动选择"); }
      ta.remove();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(state.code).then(function(){ toast("代码已复制"); }, fallback);
    } else fallback();
  }
  function downloadCode(){
    var file = state.files[state.current];
    var blob = new Blob([state.code], { type: "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob); var a = document.createElement("a");
    a.href = url; a.download = file.name; a.click();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
    toast("已下载 " + file.name);
  }
  function openMode(){
    buildFiles(); renderFileList();
    document.getElementById("devCodeModal").classList.add("is-open");
    document.body.classList.add("dev-code-lock");
    selectFile(0); loadLinkedScripts();
  }
  function refreshCode(){
    buildFiles(); renderFileList();
    selectFile(Math.min(state.current, state.files.length - 1));
    loadLinkedScripts(); toast("已重新读取当前页面");
  }
  function closeMode(){
    document.getElementById("devCodeModal").classList.remove("is-open");
    document.body.classList.remove("dev-code-lock");
  }

  /* ---------- 挂载 ---------- */
  function mount(){
    if (document.querySelector(".dev-code-trigger")) return;
    var brand = resolveBrand();
    var label = brand ? brand + " · 前端源码" : "前端源码";

    var trigger = document.createElement("button");
    trigger.className = "dev-code-trigger"; trigger.type = "button"; trigger.setAttribute("data-dev-mode", "");
    trigger.setAttribute("aria-label", "打开开发模式");
    trigger.innerHTML = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"16 18 22 12 16 6\"></polyline><polyline points=\"8 6 2 12 8 18\"></polyline></svg><span>开发模式</span>";

    var modal = document.createElement("div");
    modal.className = "dev-code-modal"; modal.id = "devCodeModal"; modal.setAttribute("data-dev-mode", "");
    modal.setAttribute("role", "dialog"); modal.setAttribute("aria-modal", "true");
    modal.innerHTML =
      "<div class=\"dev-code-topbar\">" +
        "<div class=\"dev-code-brand\"><i></i>" + escapeHtml(label) + "</div>" +
        "<div class=\"dev-code-path\">" + escapeHtml(decodeURIComponent(location.pathname)) + "</div>" +
        "<div class=\"dev-code-actions\">" +
          "<button class=\"dev-code-action\" id=\"devCodeRefresh\">刷新</button>" +
          "<button class=\"dev-code-action\" id=\"devCodeCopy\">复制代码</button>" +
          "<button class=\"dev-code-action\" id=\"devCodeDownload\">下载当前文件</button>" +
          "<button class=\"dev-code-action primary\" id=\"devCodeClose\">退出开发模式</button>" +
        "</div>" +
      "</div>" +
      "<div class=\"dev-code-layout\">" +
        "<aside class=\"dev-code-sidebar\" id=\"devCodeFiles\"></aside>" +
        "<main class=\"dev-code-main\">" +
          "<div class=\"dev-code-filebar\"><span class=\"dev-code-current\" id=\"devCodeCurrent\"></span><span class=\"dev-code-meta\" id=\"devCodeMeta\"></span>" +
          "<input class=\"dev-code-search\" id=\"devCodeSearch\" type=\"search\" placeholder=\"在当前文件中搜索\"></div>" +
          "<div class=\"dev-code-scroll\"><pre class=\"dev-code-pre\" id=\"devCodePre\"></pre></div>" +
        "</main>" +
      "</div>";

    var toastEl = document.createElement("div");
    toastEl.className = "dev-code-toast"; toastEl.id = "devCodeToast"; toastEl.setAttribute("data-dev-mode", "");

    document.body.appendChild(trigger); document.body.appendChild(modal); document.body.appendChild(toastEl);

    trigger.addEventListener("click", openMode);
    document.getElementById("devCodeClose").addEventListener("click", closeMode);
    document.getElementById("devCodeRefresh").addEventListener("click", refreshCode);
    document.getElementById("devCodeCopy").addEventListener("click", copyCode);
    document.getElementById("devCodeDownload").addEventListener("click", downloadCode);
    document.getElementById("devCodeSearch").addEventListener("input", function(){ renderCode(state.code, this.value.trim()); });
    document.addEventListener("keydown", function(event){
      if (event.key === "Escape" && modal.classList.contains("is-open")) closeMode();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
