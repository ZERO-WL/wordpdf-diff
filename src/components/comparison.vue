<template>
  <div
    class="comparison"
    :style="{ cursor: msgLoading ? 'progress' : 'default' }"
  >
    <div class="similarity">
      <div class="text">
        文档相似度对比：<span>{{ similarity }}</span>
      </div>
    </div>
    <div class="general-card">
      <div class="comparison-list">
        <div v-if="oldSrc" class="old-box">
          <iframe v-if="oldType === 'pdf'" id="oldpdf" :src="oldSrc"></iframe>
          <div v-else class="docx-box" :style="oldStyle">
            <vue-office-docx
              :src="oldSrc"
              class="old-docx"
              @rendered="renderedOld"
            />
          </div>
        </div>
        <div v-if="newSrc" class="new-box">
          <iframe v-if="newType === 'pdf'" id="newpdf" :src="newSrc"></iframe>
          <div v-else class="docx-box" :style="newStyle">
            <vue-office-docx
              :src="newSrc"
              class="new-docx"
              @rendered="renderedNew"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import VueOfficeDocx from "@vue-office/docx";
import "@vue-office/docx/lib/index.css";
import { ref, watchEffect, nextTick, onUnmounted } from "vue";
import { diffDocument } from "../utils/index";

let timer1: any;
let timer2: any;
onUnmounted(() => {
  clearInterval(timer1);
  clearInterval(timer2);
});

const msgLoading = ref(true);

// 判断文档类型
const o = "/文档.docx";
const n = "/文档new.docx";
// const o = "/文档.pdf";
// const n = "/文档new.pdf";
const oldType = o.substr(-3) === "pdf" ? "pdf" : "docx";
const newType = n.substr(-3) === "pdf" ? "pdf" : "docx";
// 获取文档链接
const origin = window.location.origin;
const oldSrc =
  oldType === "docx"
    ? `${window.location.origin}${o}`
    : `${origin}/pdfjs/web/viewer.html?file=${encodeURIComponent(
        `${window.location.origin}${o}`
      )}`;
const newSrc =
  newType === "docx"
    ? `${window.location.origin}${n}`
    : `${origin}/pdfjs/web/viewer.html?file=${encodeURIComponent(
        `${window.location.origin}${n}`
      )}`;
console.log(oldSrc);
console.log(newSrc);

// docx文档选择器|pdf的node节点
let oldSelector: string | HTMLElement[] =
  ".old-docx .docx-wrapper > .docx > article";
let newSelector: string | HTMLElement[] =
  ".new-docx .docx-wrapper > .docx > article";

// 轮询#viewer的高度，赋值给iframe
let nextHeightOld = 0;
let nextHeightnew = 0;
let oldFlag = false;
let newFlag = false;
const getIframeHeight = (id: any) => {
  const iframe = document.querySelector(id) as any;
  const iframeDoc = iframe.contentWindow.document;
  const viewer = iframeDoc.querySelector("#viewer") as HTMLDivElement;
  return setInterval(() => {
    const height = viewer.offsetHeight;
    if (height > 0) {
      // 销毁计时器,修改文档状态
      if (id === "#oldpdf") {
        if (height === nextHeightOld) {
          if (!oldFlag) {
            oldSelector = Array.from(
              iframeDoc.querySelectorAll("#viewer>.page>.textLayer")
            );
            readyList.value[0] = true;
          }
          oldFlag = true;
        } else {
          iframe.style.height = `${height + 10}px`;
        }
      }
      if (id === "#newpdf") {
        if (height === nextHeightnew) {
          if (!newFlag) {
            newSelector = Array.from(
              iframeDoc.querySelectorAll("#viewer>.page>.textLayer")
            );
            readyList.value[1] = true;
          }
          newFlag = true;
        } else {
          iframe.style.height = `${height + 10}px`;
        }
      }
    }
    if (id === "#oldpdf") {
      nextHeightOld = height;
    } else {
      nextHeightnew = height;
    }
  }, 1000);
};
// 修改pdf样式，并记录node节点
const addStyle = (id: string) => {
  const iframe = document.querySelector(id) as any;
  const iframeWindow = iframe.contentWindow;
  // const iframeDoc = iframeWindow.document;
  iframeWindow.onload = () => {
    if (id === "#oldpdf") {
      timer1 = getIframeHeight("#oldpdf");
    } else {
      timer2 = getIframeHeight("#newpdf");
    }
    // 获取 iframe 内部文档的 head 元素
    const iframeDocument = iframeWindow.document;
    const iframeHead = iframeDocument.head;

    // 创建一个新的 style 元素并设置其内容
    const styleElement = iframeDocument.createElement("style");
    styleElement.type = "text/css";

    // 定义内联样式
    const inlineStyles = `
      #viewerContainer {
        inset: 0;
      }
      body {
        background-color: #fff;
      }
      .toolbar {
        display: none;
      }
      #sidebarContainer{
        display: none;
      }
    `;

    // 添加内联样式到 style 元素
    styleElement.appendChild(iframeDocument.createTextNode(inlineStyles));

    // 将 style 元素添加到 head 中
    iframeHead.appendChild(styleElement);
  };
};
if (oldType === "pdf") {
  nextTick(() => {
    addStyle("#oldpdf");
  });
}
if (newType === "pdf") {
  nextTick(() => {
    addStyle("#newpdf");
  });
}
// 比较文档
const similarity = ref("100%");
const compareFun = () => {
  setTimeout(() => {
    const num = diffDocument(
      { selector: oldSelector, type: oldType },
      { selector: newSelector, type: newType }
    );
    similarity.value = `${(num * 100).toFixed(2)}%`;
    msgLoading.value = false;
  }, 300);
};
// 计算docx样式
const oldStyle = ref({
  transform: "scale(1)",
});
const newStyle = ref({
  transform: "scale(1)",
});
const getDocxStyle = () => {
  const w = 813;
  const list = document.querySelector(
    ".comparison .comparison-list"
  ) as HTMLDivElement;
  const oldBox = document.querySelector(
    ".comparison .comparison-list>.old-box"
  ) as HTMLDivElement;
  const oldWidth = oldBox.offsetWidth;
  const oldHegiht = oldBox.offsetHeight;
  const oldScale = parseFloat((oldWidth / w).toFixed(2));
  oldStyle.value.transform = `scale(${oldScale})`;

  const newBox = document.querySelector(
    ".comparison .comparison-list>.new-box"
  ) as HTMLDivElement;
  const newWidth = newBox.offsetWidth;
  const newHegiht = newBox.offsetHeight;
  const newScale = parseFloat((newWidth / w).toFixed(2));
  newStyle.value.transform = `scale(${newScale})`;

  list.style.height = `${Math.max(
    newHegiht * newScale,
    oldHegiht * oldScale
  )}px`;
};
// 监听是否加载完成
const readyList = ref([false, false]);
watchEffect(() => {
  if (readyList.value[0] && readyList.value[1]) {
    compareFun();
    if (oldType === "docx" || newType === "docx") {
      getDocxStyle();
    }
  }
});
// docx加载成功函数
const renderedOld = () => {
  readyList.value[0] = true;
};
const renderedNew = () => {
  readyList.value[1] = true;
};
</script>

<style scoped>
.comparison {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999;
  overflow: auto;
  background-color: #fff;
  color: #000;
}
.comparison :deep(.docx-wrapper) {
  background-color: #fff;
  padding: 0;
}
.comparison :deep(.docx-wrapper > section.docx) {
  margin-bottom: 0px;
  box-shadow: none;
}
.similarity {
  padding: 15px;
  line-height: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--color-neutral-3);
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  z-index: 9;
  background-color: #fff;
  border-bottom: 1px solid #999;
}
.similarity .text {
  line-height: 20px;
  display: flex;
  align-items: center;
}
.similarity .text span {
  font-size: 16px;
}
.general-card {
  margin-top: 63px;
  height: calc(100vh - 63px);
  overflow: auto;
}
.comparison-list {
  display: flex;
}
.comparison-list > div {
  width: 50%;
  position: relative;
}
.comparison-list .docx-box {
  width: 803px;
  position: relative;
  transform-origin: 0 0;
}
iframe {
  width: 100%;
  height: 30000px;
  border: none;
}
</style>
