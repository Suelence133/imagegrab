/**
 * gallery.js —— 结果展示页逻辑
 * 1. 从 chrome.storage.local 读取 content.js 提取到的图片列表并渲染
 * 2. 支持勾选 / 全选 / 反选 / 清空
 * 3. 点「下载选中」把任务交给 background 转 PNG 并保存
 */

var allImages = [];   // 全部图片
var selected = {};    // 已选中的图片索引集合

var grid = document.getElementById('grid');
var meta = document.getElementById('meta');
var selectedLabel = document.getElementById('selected');
var tip = document.getElementById('tip');
var btnDownload = document.getElementById('btn-download');

/** 渲染图片网格 */
function render() {
  grid.innerHTML = '';

  if (!allImages.length) {
    grid.innerHTML =
      '<div class="empty">' +
      '<div class="empty-title">还没有提取到图片</div>' +
      '<div>请到淘宝 / 京东 / 拼多多商家版的商品详情页，点击右下角「获取图片」按钮</div>' +
      '</div>';
    updateStats();
    return;
  }

  allImages.forEach(function (item, index) {
    var card = document.createElement('div');
    card.className = 'card' + (selected[index] ? ' is-selected' : '');
    card.dataset.index = String(index);

    // 尺寸信息：拿不到就显示「未知」
    var sizeText = item.width && item.height
      ? item.width + '×' + item.height
      : '尺寸未知';

    card.innerHTML =
      '<div class="card-check">' + (selected[index] ? '✓' : '') + '</div>' +
      '<img class="card-img" src="' + item.url + '" referrerpolicy="no-referrer" alt="商品图">' +
      '<div class="card-info">' +
      '<span class="card-size">' + sizeText + '</span>' +
      '</div>';

    // 点击卡片切换选中状态
    card.addEventListener('click', function () {
      if (selected[index]) {
        delete selected[index];
      } else {
        selected[index] = true;
      }
      render();
    });

    grid.appendChild(card);
  });

  updateStats();
}

/** 更新顶部统计与底部按钮状态 */
function updateStats() {
  var count = Object.keys(selected).length;
  meta.textContent = '共 ' + allImages.length + ' 张';
  selectedLabel.textContent = '已选 ' + count + ' 张';
  btnDownload.disabled = count === 0;
}

/** 获取当前选中的图片项 */
function getSelectedItems() {
  return Object.keys(selected).map(function (i) {
    return allImages[Number(i)];
  });
}

/** 设置底部提示文字 */
function setTip(text, type) {
  tip.textContent = text;
  tip.className = 'tip' + (type ? ' is-' + type : '');
}

// 全选
document.getElementById('btn-all').addEventListener('click', function () {
  allImages.forEach(function (_, i) { selected[i] = true; });
  render();
});

// 反选
document.getElementById('btn-invert').addEventListener('click', function () {
  allImages.forEach(function (_, i) {
    if (selected[i]) delete selected[i];
    else selected[i] = true;
  });
  render();
});

// 清空选择
document.getElementById('btn-clear').addEventListener('click', function () {
  selected = {};
  render();
});

// 下载选中
btnDownload.addEventListener('click', function () {
  var items = getSelectedItems();
  if (!items.length) return;

  btnDownload.disabled = true;
  setTip('正在转换并下载 ' + items.length + ' 张图片，请稍候…');

  chrome.runtime.sendMessage(
    { type: 'DOWNLOAD_IMAGES', items: items },
    function (res) {
      btnDownload.disabled = false;
      if (!res || !res.ok) {
        setTip('下载失败：' + ((res && res.error) || '未知错误'), 'error');
        return;
      }
      var r = res.result;
      if (r.failed && r.failed.length) {
        setTip('完成：成功 ' + r.success + ' 张，失败 ' + r.failed.length + ' 张（部分图片跨域受限）', 'error');
      } else {
        setTip('完成：已保存 ' + r.success + ' 张 PNG 到下载目录', 'success');
      }
    }
  );
});

// 页面加载：读取存储中的图片列表
chrome.storage.local.get(['imagegrab_images'], function (data) {
  allImages = (data && data.imagegrab_images) || [];
  // 默认全选，减少用户操作
  allImages.forEach(function (_, i) { selected[i] = true; });
  render();
});
