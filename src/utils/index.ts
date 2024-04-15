import Diff from "jsdiff-esm";

// 转义正则表达式的关键字
export const escapeRegExp = (input: string) => {
  // 列出正则表达式的关键字
  const regexKeywords = /[-/\\^$*+?.()|[\]{}]/g;

  // 使用replace方法来转义关键字
  return input.replace(regexKeywords, "\\$&");
};

// 分割字符串，每n个一组
export const splitString = (inputString: string, chunkSize: number) => {
  const result = [];
  for (let i = 0; i < inputString.length; i += chunkSize) {
    result.push(inputString.slice(i, i + chunkSize));
  }
  return result;
};

interface StrDiffObj {
  value: string;
  lastIndex: number;
}
interface DiffObj {
  added?: boolean;
  removed?: boolean;
  count: number;
  value: string;
  lastIndex: number;
  strLastIndexList: number[];
}
// 拼接多页内容，用--PAGEEND--作为分割符
const concatPage = (list: HTMLElement[]) => {
  const strList = list.map((item) => item.innerHTML);
  return strList.join("--PAGEEND--");
};
// 对pdf文件每页内容按照top值重排顺序,并拼接多页内容
const resetPdfSpan = (list: HTMLElement[]) => {
  const strList = list.map((page) => {
    const l: any[] = [];
    let lastTop = 0;
    Array.from(page.children).forEach((node: any) => {
      const obj = {
        node: node.outerHTML,
        top: node.style.top
          ? parseFloat(node.style.top.replace("%", ""))
          : lastTop,
      };
      l.push(obj);
      lastTop = obj.top;
    });
    return l
      .sort((a, b) => a.top - b.top)
      .map((r) => r.node)
      .join("");
  });

  return strList.join("--PAGEEND--");
};
// 比较新老内容，处理差异
export const diffDocument = (
  oldData: { selector: string | HTMLElement[]; type: string },
  newData: { selector: string | HTMLElement[]; type: string }
): number => {
  const oldSelector = oldData.selector;
  const newSelector = newData.selector;
  const oldType = oldData.type;
  const newType = newData.type;
  // 获取文档每页内容
  const oldNodeList: HTMLElement[] =
    typeof oldSelector === "string"
      ? Array.from(document.querySelectorAll(oldSelector))
      : oldSelector;
  const newNodeList: HTMLElement[] =
    typeof newSelector === "string"
      ? Array.from(document.querySelectorAll(newSelector))
      : newSelector;

  if (oldNodeList.length === 0 || newNodeList.length === 0) {
    return 1;
  }
  // 拼接多页内容，用--PAGEEND--作为分割符
  const oldNodeStr =
    typeof oldSelector === "string"
      ? concatPage(oldNodeList)
      : resetPdfSpan(oldNodeList);
  const newNodeStr =
    typeof newSelector === "string"
      ? concatPage(newNodeList)
      : resetPdfSpan(newNodeList);

  // 相似度阈值
  const threshold = typeof oldSelector === typeof newSelector ? 0.1 : 0.05;
  // 以段落为单位比较文档
  let diffList: DiffObj[] = [];
  let similarity = 0;
  const chunkSize = 5;
  const getSimilarity = () => {
    const oStr = oldNodeStr
      .replace(/<[^>]*>/g, "")
      .replace(/\s/g, "")
      .replace(/--PAGEEND--/g, "");
    const nStr = newNodeStr
      .replace(/<[^>]*>/g, "")
      .replace(/\s/g, "")
      .replace(/--PAGEEND--/g, "");
    console.time();
    diffList = Diff.diffLines(
      splitString(oStr, chunkSize).join("\n"),
      splitString(nStr, chunkSize).join("\n")
    );
    console.timeEnd();
    console.log(`以${chunkSize}个字符为一段获取的差异`, diffList);
    const a = diffList.filter((item) => item.added);
    const d = diffList.filter((item) => item.removed);
    const n = diffList.filter((item) => !item.added && !item.removed);
    const aNum = a.reduce((num, item) => num + item.value.length, 0);
    const dNum = d.reduce((num, item) => num + item.value.length, 0);
    const nNum = n.reduce((num, item) => num + item.value.length, 0);
    similarity = 1 - (aNum + dNum) / (nNum + aNum + dNum);
    console.log("数据量", `未改变${nNum}`, `新增${aNum}`, `删除${dNum}`);
    console.log("相似度", similarity);
  };
  getSimilarity();

  let byTag = false;
  // 相似度低于阈值，以段落为单位标记差异
  if (similarity < threshold) {
    byTag = true;
    if (similarity > 0.01) {
      console.log("相似度低于阈值,以段落为单位标记差异");
      const reg = new RegExp("</span>", "g");
      diffList = Diff.diffLines(
        typeof oldSelector === "string"
          ? oldNodeStr.replace(/\<\/p>/g, "\n").replace(/<[^>]*>/g, "")
          : oldNodeStr.replace(reg, "\n").replace(/<[^>]*>/g, ""),
        typeof newSelector === "string"
          ? newNodeStr.replace(/\<\/p>/g, "\n").replace(/<[^>]*>/g, "")
          : newNodeStr.replace(reg, "\n").replace(/<[^>]*>/g, "")
      );
    } else {
      console.log("相似度过低");
      return similarity;
    }
  } else {
    if (similarity === 1) {
      return 1;
    }
    // 以字符为单位比较新老内容，获取差异列表
    console.log("相似度高于阈值,以字符为单位获取差异");
    diffList = Diff.diffChars(
      oldNodeStr.replace(/<[^>]*>/g, ""),
      newNodeStr.replace(/<[^>]*>/g, "")
    );
  }
  console.log(diffList);

  // 区分新增和删除，并获取每个字的位置
  const addList: StrDiffObj[] = [];
  const removeList: StrDiffObj[] = [];
  let reg = new RegExp("", "g");
  let lastIndexOld = 0;
  let lastIndexNew = 0;
  // 记录未改变的字符数/新增字符数/删除字符数
  let addNum = 0;
  let delNum = 0;
  // 获取新增列表
  diffList.forEach((item) => {
    // 忽略被删除的内容，但是要对未改变的内容也进行正则匹配，目的是为了推进lastIndex，避免未改变的内容中跟新增内容重复，干扰结果
    if (!item.removed) {
      if (byTag) {
        item.value = item.value.replace(/\n/g, "");
      }
      const strArr = byTag ? item.value.split("") : item.value.split(""); // 拆分成单个字符
      const strLastIndexList: number[] = []; // 每个字符的lastIndex

      // 获取每个字的位置
      strArr.forEach((s) => {
        reg = new RegExp(
          `(<[^>]*>)*([^${escapeRegExp(s)}])*${escapeRegExp(s)}`,
          "gi"
        ); // 要排除标签的干扰，防止标签内有该字符
        reg.lastIndex = lastIndexOld; // 在上次正则位置基础上，继续匹配
        reg.exec(newNodeStr);
        lastIndexOld = reg.lastIndex; // 记录本次位置
        strLastIndexList.push(reg.lastIndex);
      });
      // 对新增的字符判断是否连续，连续的分一组
      if (item.added) {
        const len = strLastIndexList.length;
        addList.push({
          value: item.value[0],
          lastIndex: strLastIndexList[0],
        });
        let i = 1;
        while (i < len) {
          const lastIndex = strLastIndexList[i - 1];
          const nowIndex = strLastIndexList[i];
          // 是否连续
          if (nowIndex === lastIndex + 1) {
            // 连续的拼接在一起
            addList[addList.length - 1].value = `${
              addList[addList.length - 1].value
            }${item.value[i]}`;
          } else {
            // 不连续新开一组
            addList.push({
              value: item.value[i],
              lastIndex: strLastIndexList[i],
            });
          }
          i += 1;
        }
        addNum += strArr.length;
      }
    }
  });
  console.log("新增列表addList", addList);
  // 获取删除列表
  diffList.forEach((item) => {
    // 忽略新增的内容，但是要对未改变的内容也进行正则匹配，目的是为了推进lastIndex，避免未改变的内容中跟删除内容重复，干扰结果
    if (!item.added) {
      if (byTag) {
        item.value = item.value.replace(/\n/g, "");
      }
      const strArr = byTag ? item.value.split("") : item.value.split(""); // 拆分成单个字符
      const strLastIndexList: number[] = []; // 每个字符的lastIndex
      // 获取每个字的位置
      strArr.forEach((s) => {
        reg = new RegExp(
          `(<[^>]*>)*([^${escapeRegExp(s)}])*${escapeRegExp(s)}`,
          "gi"
        ); // 要排除标签的干扰，防止标签内有该字符
        reg.lastIndex = lastIndexNew; // 在上次正则位置基础上，继续匹配
        reg.exec(oldNodeStr);
        lastIndexNew = reg.lastIndex; // 记录本次位置
        strLastIndexList.push(reg.lastIndex);
      });
      // 对删除的字符判断是否连续，连续的分一组
      if (item.removed) {
        const len = strLastIndexList.length;
        removeList.push({
          value: item.value[0],
          lastIndex: strLastIndexList[0],
        });
        let i = 1;
        while (i < len) {
          const lastIndex = strLastIndexList[i - 1];
          const nowIndex = strLastIndexList[i];
          // 是否连续
          if (nowIndex === lastIndex + 1) {
            // 连续的拼接在一起
            removeList[removeList.length - 1].value = `${
              removeList[removeList.length - 1].value
            }${item.value[i]}`;
          } else {
            // 不连续新开一组
            removeList.push({
              value: item.value[i],
              lastIndex: strLastIndexList[i],
            });
          }
          i += 1;
        }
        delNum += strArr.length;
      }
    }
  });
  console.log("删除列表removeList", removeList);

  // 为差异内容添加标记，分割符单独处理
  let oldHtml = oldNodeStr;
  let increment = 0;
  const regex = /[^ \t\r\n\v\f]/;
  removeList.forEach((item) => {
    if (item.value !== undefined && regex.test(item.value)) {
      reg = new RegExp(`(${escapeRegExp(item.value)})`, "y");
      reg.lastIndex = item.lastIndex + increment - 1;
      oldHtml = oldHtml.replace(reg, (word) => {
        // 分割符单独处理
        if (item.value.includes("--PAGEEND--")) {
          const list = word.split("--PAGEEND--");
          const signList = list.map((s) => {
            if (s !== "") {
              increment += 47;
              return `<span style="background-color:${
                oldType === "pdf" ? "#e33f58" : "#fac5cd"
              };">${s}</span>`;
            }
            return "";
          });
          return signList.join("--PAGEEND--");
        }
        increment += 47;
        return `<span style="background-color:${
          oldType === "pdf" ? "#e33f58" : "#fac5cd"
        };">${word}</span>`;
      });
    }
  });

  let newHtml = newNodeStr;
  increment = 0;
  addList.forEach((item) => {
    if (item.value !== undefined && regex.test(item.value)) {
      reg = new RegExp(`(${escapeRegExp(item.value)})`, "y");
      reg.lastIndex = item.lastIndex + increment - 1;
      newHtml = newHtml.replace(reg, (word) => {
        // 分割符单独处理
        if (item.value.includes("--PAGEEND--")) {
          const list = word.split("--PAGEEND--");
          const signList = list.map((s) => {
            if (s !== "") {
              increment += 47;
              return `<span style="background-color:${
                newType === "pdf" ? "#5ee983" : "#c7f0d2"
              };">${s}</span>`;
            }
            return "";
          });
          return signList.join("--PAGEEND--");
        }
        increment += 47;
        return `<span style="background-color:${
          newType === "pdf" ? "#5ee983" : "#c7f0d2"
        };">${word}</span>`;
      });
    }
  });
  // 根据分割符重新分割每页
  const oldHtmlList = oldHtml.split("--PAGEEND--");
  const newHtmlList = newHtml.split("--PAGEEND--");
  // 将处理后的内容填充回页面
  oldNodeList.forEach((node, i) => {
    node.innerHTML = oldHtmlList[i];
  });
  newNodeList.forEach((node, i) => {
    node.innerHTML = newHtmlList[i];
  });
  if (typeof oldSelector === "string" && typeof newSelector === "string") {
    const hostElement = document.querySelector(".old-docx");
    if (hostElement) {
      const shadowRoot = hostElement.attachShadow({ mode: "open" });
      const divElement = document.createElement("div");
      divElement.innerHTML = hostElement.innerHTML;
      hostElement.innerHTML = "";
      const style = document.createElement("style"); // 创建样式元素
      style.textContent = `.docx-wrapper {
        background-color: #fff !important;
        padding: 0 !important;
      }
      .docx-wrapper>section.docx {
        margin-bottom: 0px !important;
        box-shadow: none !important;
      }`;
      shadowRoot.appendChild(style);
      shadowRoot.appendChild(divElement);
    }
  }
  const oldNodeStrLength = oldNodeStr.replace(/<[^>]*>/g, "").length;
  return 1 - (addNum + delNum) / (oldNodeStrLength + addNum);
};
