const form = document.querySelector("#upload-form");
const input = document.querySelector("#image-input");
const preview = document.querySelector("#preview");
const dropZone = document.querySelector("#drop-zone");
const submitButton = document.querySelector("#submit-button");
const errorBox = document.querySelector("#error");
const emptyResult = document.querySelector("#empty-result");
const resultBox = document.querySelector("#result");
const copyButton = document.querySelector("#copy-button");
const outputSection = document.querySelector("#output-section");
const documentOutput = document.querySelector("#document-output");
const jsonOutput = document.querySelector("#json-output");
const summaryOutput = document.querySelector("#summary");
const apiBaseUrl = (
  document.querySelector('meta[name="api-base-url"]')?.content || ""
).replace(/\/+$/, "");
let lastOutput = "";

function apiUrl(path) {
  return `${apiBaseUrl}${path}`;
}

async function readResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { detail: text.trim() };
  }
}

function showPreview(file) {
  if (!file) return;
  preview.src = URL.createObjectURL(file);
  dropZone.classList.add("has-image");
}

input.addEventListener("change", () => showPreview(input.files[0]));

["dragenter", "dragover"].forEach((name) => {
  dropZone.addEventListener(name, (event) => {
    event.preventDefault();
    dropZone.classList.add("dragging");
  });
});

["dragleave", "drop"].forEach((name) => {
  dropZone.addEventListener(name, (event) => {
    event.preventDefault();
    dropZone.classList.remove("dragging");
  });
});

dropZone.addEventListener("drop", (event) => {
  const file = event.dataTransfer.files[0];
  if (!file) return;
  const transfer = new DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
  showPreview(file);
});

function render(data) {
  const parsed = data.result;
  const displayValue = parsed || { raw_text: data.raw_text };
  lastOutput = JSON.stringify(displayValue, null, 2);
  if (jsonOutput) jsonOutput.textContent = lastOutput;
  if (summaryOutput) {
    summaryOutput.textContent = parsed?.summary || "识别内容如下。";
  }
  renderDocument(parsed, data.raw_text);

  emptyResult.hidden = true;
  resultBox.hidden = false;
  copyButton.disabled = false;
  scrollToOutput();
}

function makeBlock(type, text, label = "", value = "", state = null) {
  const row = document.createElement("div");
  row.className = `document-block block-${type || "printed"}`;

  if (type === "selection") {
    const mark = document.createElement("span");
    mark.className = `choice-mark state-${state || "unclear"}`;
    mark.textContent = state === "selected" ? "✓" : state === "unselected" ? "□" : "?";
    const content = document.createElement("span");
    content.textContent = [label, value, text].filter(Boolean).join(" · ");
    row.append(mark, content);
    return row;
  }

  if (type === "field") {
    const fieldLabel = document.createElement("strong");
    fieldLabel.textContent = label || text || "字段";
    const fieldValue = document.createElement("span");
    fieldValue.textContent = value ?? "未填写";
    row.append(fieldLabel, fieldValue);
    return row;
  }

  row.textContent = text || value || label || "";
  return row;
}

const FRIENDLY_LABELS = {
  summary: "摘要",
  lines: "逐行识别文字",
  line_number: "行号",
  kind: "文字类型",
  document_blocks: "文档内容",
  printed_text: "印刷文字",
  handwritten_text: "手写文字",
  fields: "字段",
  selections: "选项",
  uncertain_items: "需要人工复核",
  type: "类型",
  text: "文字",
  label: "项目",
  value: "结果",
  state: "状态",
  confidence: "置信度",
  section: "区域",
  option: "选项",
  raw_text: "模型返回内容",
};

function friendlyLabel(key) {
  return FRIENDLY_LABELS[key] || key.replaceAll("_", " ");
}

function friendlyScalar(value) {
  if (value === null || value === undefined || value === "") return "未提供";
  if (value === true) return "是";
  if (value === false) return "否";
  if (value === "selected") return "已选择";
  if (value === "unselected") return "未选择";
  if (value === "unclear") return "不确定";
  return String(value);
}

function appendFriendlyValue(parent, value, key = "") {
  if (Array.isArray(value)) {
    if (!value.length) return;
    const group = document.createElement("section");
    group.className = "review-group";
    if (key) {
      const heading = document.createElement("h3");
      heading.textContent = friendlyLabel(key);
      group.append(heading);
    }
    value.forEach((item, index) => {
      if (item && typeof item === "object") {
        const card = document.createElement("div");
        card.className = "review-card";
        appendFriendlyValue(card, item);
        group.append(card);
      } else {
        const row = document.createElement("div");
        row.className = "review-list-item";
        row.textContent = friendlyScalar(item);
        group.append(row);
      }
    });
    parent.append(group);
    return;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value).filter(([, item]) => (
      item !== null && item !== "" && (!Array.isArray(item) || item.length)
    ));
    if (key) {
      const group = document.createElement("section");
      group.className = "review-group";
      const heading = document.createElement("h3");
      heading.textContent = friendlyLabel(key);
      group.append(heading);
      entries.forEach(([childKey, childValue]) => {
        appendFriendlyValue(group, childValue, childKey);
      });
      parent.append(group);
      return;
    }
    entries.forEach(([childKey, childValue]) => {
      appendFriendlyValue(parent, childValue, childKey);
    });
    return;
  }

  const row = document.createElement("div");
  row.className = "review-row";
  const label = document.createElement("strong");
  label.textContent = friendlyLabel(key || "内容");
  const content = document.createElement("span");
  content.textContent = friendlyScalar(value);
  row.append(label, content);
  parent.append(row);
}

function parseRawJson(rawText) {
  if (!rawText || typeof rawText !== "string") return null;
  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function renderDocument(parsed, rawText) {
  if (!documentOutput) {
    throw new Error("页面资源版本不一致，请刷新页面后重试。");
  }
  documentOutput.replaceChildren();
  if (!parsed) {
    const recovered = parseRawJson(rawText);
    if (recovered) {
      appendFriendlyValue(documentOutput, recovered);
    } else {
      const notice = document.createElement("p");
      notice.className = "fallback-note";
      notice.textContent = "模型未返回标准结构，以下按原始内容展示，便于人工复核。";
      documentOutput.append(notice);
      appendFriendlyValue(documentOutput, rawText || "没有可显示的识别内容", "raw_text");
    }
    return;
  }

  const lines = Array.isArray(parsed.lines) ? parsed.lines : [];
  if (lines.length) {
    const heading = document.createElement("h3");
    heading.className = "line-list-heading";
    heading.textContent = "逐行识别文字";
    const lineList = document.createElement("ol");
    lineList.className = "ocr-line-list";
    lines.forEach((line, index) => {
      const item = document.createElement("li");
      const number = document.createElement("span");
      number.className = "ocr-line-number";
      number.textContent = String(line.line_number || index + 1);
      const text = document.createElement("span");
      text.className = `ocr-line-text line-${line.kind || "printed"}`;
      text.textContent = line.text || "";
      item.append(number, text);
      lineList.append(item);
    });
    documentOutput.append(heading, lineList);
  }

  const blocks = Array.isArray(parsed.document_blocks)
    ? parsed.document_blocks
    : [];
  if (!lines.length && blocks.length) {
    blocks.forEach((block) => {
      documentOutput.append(makeBlock(
        block.type,
        block.text,
        block.label,
        block.value,
        block.state
      ));
    });
  } else if (!lines.length) {
    (parsed.printed_text || []).forEach((text) => {
      documentOutput.append(makeBlock("printed", text));
    });
    (parsed.handwritten_text || []).forEach((text) => {
      documentOutput.append(makeBlock("handwritten", text));
    });
    (parsed.fields || []).forEach((field) => {
      documentOutput.append(makeBlock("field", "", field.label, field.value));
    });
    (parsed.selections || [])
      .filter((item) => item.state !== "unselected")
      .forEach((item) => {
        documentOutput.append(makeBlock(
          "selection",
          item.section,
          item.option,
          "",
          item.state
        ));
      });
  }

  const legacyUnclear = (parsed.selections || []).filter(
    (item) => item.state === "unclear"
  ).length;
  const blockUnclear = blocks.filter(
    (item) => item.type === "selection" && item.state === "unclear"
  ).length;
  const unclearCount = Math.max(legacyUnclear, blockUnclear);
  if (unclearCount) {
    const warning = document.createElement("p");
    warning.className = "unclear-note";
    warning.textContent = `${unclearCount} 个选项无法可靠判断，请人工复核原图。`;
    documentOutput.append(warning);
  }

  if (!documentOutput.children.length) {
    appendFriendlyValue(documentOutput, parsed);
  }
}

function scrollToOutput() {
  if (!outputSection) return;
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      outputSection.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorBox.textContent = "";
  if (!input.files[0]) {
    errorBox.textContent = "请先选择图片。";
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "正在识别...";
  emptyResult.hidden = false;
  emptyResult.textContent = "正在识别，请稍候...";
  resultBox.hidden = true;
  scrollToOutput();
  const body = new FormData();
  body.append("image", input.files[0]);
  body.append("extra_instruction", document.querySelector("#instruction").value);
  const apiKey = document.querySelector("#api-key").value.trim();

  try {
    const response = await fetch(apiUrl("/api/recognize"), {
      method: "POST",
      body,
      headers: apiKey ? { "X-API-Key": apiKey } : {},
    });
    const data = await readResponse(response);
    if (!response.ok) throw new Error(data.detail || `请求失败 (${response.status})`);
    render(data);
  } catch (error) {
    errorBox.textContent = error.message;
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "开始识别";
  }
});

copyButton.addEventListener("click", async () => {
  await navigator.clipboard.writeText(lastOutput);
  copyButton.textContent = "已复制";
  setTimeout(() => { copyButton.textContent = "复制 JSON"; }, 1200);
});

async function checkHealth() {
  const health = document.querySelector("#health");
  try {
    const response = await fetch(apiUrl("/api/health"));
    const data = await readResponse(response);
    if (!response.ok) {
      throw new Error(`${response.status}: ${data.detail || "服务连接失败"}`);
    }
    health.textContent = data.vllm_reachable
      ? "识别服务已就绪"
      : "识别服务暂不可用";
    health.className = `health ${data.vllm_reachable ? "ready" : "down"}`;
  } catch (error) {
    health.textContent = `无法读取服务状态 · ${error.message}`;
    health.className = "health down";
  }
}

checkHealth();
