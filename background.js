/**
 * background.js —— Manifest V3 的 Service Worker
 * 职责一：接收 content.js 提取到的图片列表，存入 chrome.storage.local，并打开结果页
 * 职责二：接收结果页的下载请求，把图片统一转成 PNG 后保存到浏览器下载目录
 *
 * 为什么转 PNG 要放在这里做：
 *   页面里用 canvas 读跨域图片会导致画布被污染（tainted），无法导出。
 *   Service Worker 有 host_permissions 授权，可以直接 fetch 跨域图片，
 *   再用 OffscreenCanvas 转换，规避跨域限制。
 */

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  // 1) 收到图片列表：先存起来，再打开 gallery 结果页
  if (msg.type === 'IMAGES_EXTRACTED') {
    chrome.storage.local.set(
      {
        imagegrab_images: msg.images || [],
        imagegrab_page: { url: msg.pageUrl, title: msg.pageTitle }
      },
      function () {
        chrome.tabs.create({ url: chrome.runtime.getURL('gallery.html') });
        sendResponse({ ok: true });
      }
    );
    return true; // 保持消息通道打开，等待异步回调
  }

  // 2) 收到下载请求：批量转 PNG 并保存
  if (msg.type === 'DOWNLOAD_IMAGES') {
    downloadAsPng(msg.items || [])
      .then(function (result) {
        sendResponse({ ok: true, result: result });
      })
      .catch(function (err) {
        sendResponse({ ok: false, error: String((err && err.message) || err) });
      });
    return true;
  }
});

/** Blob 转 dataURL，chrome.downloads 只接受 URL 形式 */
function blobToDataUrl(blob) {
  return new Promise(function (resolve, reject) {
    var fr = new FileReader();
    fr.onload = function () { resolve(fr.result); };
    fr.onerror = function () { reject(fr.error); };
    fr.readAsDataURL(blob);
  });
}

/** 把一张图片转换为 PNG 格式的 dataURL */
async function toPngDataUrl(url) {
  var resp = await fetch(url, { mode: 'cors', credentials: 'omit' });
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  var blob = await resp.blob();
  var bmp = await createImageBitmap(blob);
  var canvas = new OffscreenCanvas(bmp.width, bmp.height);
  var ctx = canvas.getContext('2d');
  ctx.drawImage(bmp, 0, 0);
  var pngBlob = await canvas.convertToBlob({ type: 'image/png' });
  if (bmp.close) bmp.close();
  return await blobToDataUrl(pngBlob);
}

/**
 * 批量下载：逐张转换并保存，最后返回成功数与失败清单
 * 文件名规则：商品图_001.png、商品图_002.png …
 */
async function downloadAsPng(items) {
  var successCount = 0;
  var failed = [];

  for (var i = 0; i < items.length; i++) {
    var index = String(i + 1).padStart(3, '0'); // 序号补零：001
    var filename = '商品图_' + index + '.png';
    try {
      var dataUrl = await toPngDataUrl(items[i].url);
      await new Promise(function (resolve, reject) {
        chrome.downloads.download(
          { url: dataUrl, filename: filename, saveAs: false },
          function (id) {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(id);
            }
          }
        );
      });
      successCount++;
    } catch (e) {
      failed.push({ url: items[i].url, reason: String((e && e.message) || e) });
    }
  }

  return { total: items.length, success: successCount, failed: failed };
}
